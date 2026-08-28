import {
  NodeDeltaError,
  N8nAuthenticationError,
  N8nNetworkError,
  N8nNotDetectedError,
  UnsupportedN8nResponseError,
  WorkflowNotFoundError,
  type N8nAdapter,
  type N8nAdapterHealth,
  type N8nInstanceInfo,
  type RawN8nWorkflow,
} from '@nodedelta/core';
import { z } from 'zod';

import { detectN8nContext, type N8nContext } from './context.js';

export interface N8nAdapterEnvironment {
  currentUrl(): URL;
  basePathScriptUrls(): readonly string[];
  restEndpointContent(): string | undefined;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

const unknownRecordSchema = z.record(z.string(), z.unknown());

const rawNodeSchema = z.looseObject({
  id: z.string().optional(),
  name: z.string(),
  type: z.string(),
  typeVersion: z.number().optional(),
  position: z.tuple([z.number(), z.number()]),
  parameters: unknownRecordSchema,
  disabled: z.boolean().optional(),
  notes: z.string().optional(),
  credentials: unknownRecordSchema.optional(),
});

const rawWorkflowSchema = z.looseObject({
  id: z.string().optional(),
  name: z.string(),
  nodes: z.array(rawNodeSchema),
  connections: unknownRecordSchema,
  settings: unknownRecordSchema.optional(),
  staticData: z.unknown().optional(),
  tags: z.array(z.unknown()).optional(),
  active: z.boolean().optional(),
  versionId: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

function workflowCandidate(body: unknown): unknown {
  const direct = rawWorkflowSchema.safeParse(body);
  if (direct.success) {
    return direct.data;
  }

  if (typeof body === 'object' && body !== null && 'data' in body) {
    return body.data;
  }

  return body;
}

function adapterDiagnostics(
  status: number,
  workflowId: string,
): Readonly<Record<string, unknown>> {
  return { status, workflowId };
}

export class EditorRestN8nAdapter implements N8nAdapter {
  readonly #environment: N8nAdapterEnvironment;
  #version: string | undefined;

  constructor(environment: N8nAdapterEnvironment) {
    this.#environment = environment;
  }

  detect(): Promise<N8nInstanceInfo> {
    const context = this.#context();
    if (!context.detected) {
      return Promise.reject(
        new N8nNotDetectedError({
          diagnostics: { origin: context.origin },
        }),
      );
    }

    return Promise.resolve({
      origin: context.origin,
      basePath: context.basePath,
      instanceId: context.instanceId,
      ...(this.#version === undefined ? {} : { version: this.#version }),
    });
  }

  getCurrentWorkflowId(): string | undefined {
    const context = this.#context();
    return context.detected ? context.workflowId : undefined;
  }

  async getWorkflow(workflowId: string): Promise<RawN8nWorkflow> {
    const context = this.#context();
    if (!context.detected) {
      throw new N8nNotDetectedError({
        diagnostics: { origin: context.origin },
      });
    }

    const requestUrl = this.#workflowUrl(context, workflowId);
    let response: Response;
    try {
      response = await this.#environment.fetch(requestUrl, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
    } catch (cause) {
      if (cause instanceof NodeDeltaError) {
        throw cause;
      }
      throw new N8nNetworkError({
        cause,
        diagnostics: { workflowId, retryable: true },
      });
    }

    this.#assertSuccessfulResponse(response, workflowId);

    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      throw new UnsupportedN8nResponseError({
        cause,
        diagnostics: {
          status: response.status,
          workflowId,
          reason: 'invalid-json',
        },
      });
    }

    const parsed = rawWorkflowSchema.safeParse(workflowCandidate(body));
    if (
      !parsed.success ||
      (parsed.data.id !== undefined && parsed.data.id !== workflowId)
    ) {
      throw new UnsupportedN8nResponseError({
        diagnostics: {
          status: response.status,
          workflowId,
          reason: parsed.success ? 'workflow-id-mismatch' : 'invalid-shape',
        },
      });
    }

    const version = response.headers.get('x-n8n-version');
    if (version !== null && version.trim() !== '') {
      this.#version = version;
    }

    return parsed.data as RawN8nWorkflow;
  }

  async healthCheck(): Promise<N8nAdapterHealth> {
    await this.detect();
    const workflowId = this.getCurrentWorkflowId();
    if (workflowId === undefined) {
      return {
        reachable: true,
        authenticated: true,
        capabilities: { workflowFetch: false, versionDetected: false },
      };
    }

    try {
      await this.getWorkflow(workflowId);
      return {
        reachable: true,
        authenticated: true,
        ...(this.#version === undefined ? {} : { version: this.#version }),
        capabilities: {
          workflowFetch: true,
          versionDetected: this.#version !== undefined,
        },
      };
    } catch (error) {
      if (error instanceof N8nAuthenticationError) {
        return {
          reachable: true,
          authenticated: error.diagnostics?.status === 403,
          capabilities: { workflowFetch: false, versionDetected: false },
        };
      }
      if (
        error instanceof WorkflowNotFoundError ||
        error instanceof UnsupportedN8nResponseError
      ) {
        return {
          reachable: true,
          authenticated: true,
          capabilities: { workflowFetch: false, versionDetected: false },
        };
      }
      if (error instanceof N8nNetworkError) {
        return {
          reachable: false,
          authenticated: false,
          capabilities: { workflowFetch: false, versionDetected: false },
        };
      }
      throw error;
    }
  }

  #context(): N8nContext {
    return detectN8nContext({
      url: this.#environment.currentUrl(),
      basePathScriptUrls: this.#environment.basePathScriptUrls(),
      restEndpointContent: this.#environment.restEndpointContent(),
    });
  }

  #workflowUrl(context: N8nContext, workflowId: string): URL {
    const baseUrl = new URL(context.basePath, `${context.origin}/`);
    const requestUrl = new URL(
      `${context.restEndpoint}/workflows/${encodeURIComponent(workflowId)}`,
      baseUrl,
    );

    if (requestUrl.origin !== context.origin) {
      throw new N8nNotDetectedError({
        diagnostics: { reason: 'cross-origin-rest-endpoint' },
      });
    }
    return requestUrl;
  }

  #assertSuccessfulResponse(response: Response, workflowId: string): void {
    const diagnostics = adapterDiagnostics(response.status, workflowId);
    if (response.status === 401 || response.status === 403) {
      throw new N8nAuthenticationError({ diagnostics });
    }
    if (response.status === 404) {
      throw new WorkflowNotFoundError(workflowId, { diagnostics });
    }
    if (!response.ok) {
      throw new N8nNetworkError({ diagnostics });
    }
  }
}
