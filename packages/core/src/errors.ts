export type NodeDeltaErrorCode =
  | 'N8N_NOT_DETECTED'
  | 'WORKFLOW_NOT_FOUND'
  | 'N8N_AUTHENTICATION'
  | 'UNSUPPORTED_N8N_RESPONSE'
  | 'N8N_NETWORK'
  | 'PERMISSION_REQUIRED'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_QUOTA';

export interface NodeDeltaErrorOptions extends ErrorOptions {
  diagnostics?: Readonly<Record<string, unknown>>;
}

export class NodeDeltaError extends Error {
  readonly code: NodeDeltaErrorCode;
  readonly diagnostics?: Readonly<Record<string, unknown>>;

  constructor(
    code: NodeDeltaErrorCode,
    message: string,
    options: NodeDeltaErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.code = code;
    if (options.diagnostics !== undefined) {
      this.diagnostics = options.diagnostics;
    }
    this.name = new.target.name;
  }
}

export class N8nNotDetectedError extends NodeDeltaError {
  constructor(options?: NodeDeltaErrorOptions) {
    super(
      'N8N_NOT_DETECTED',
      "NodeDelta couldn't detect an n8n instance on this page.",
      options,
    );
  }
}

export class WorkflowNotFoundError extends NodeDeltaError {
  constructor(workflowId?: string, options?: NodeDeltaErrorOptions) {
    const errorOptions =
      workflowId === undefined
        ? options
        : {
            ...options,
            diagnostics: { ...options?.diagnostics, workflowId },
          };

    super(
      'WORKFLOW_NOT_FOUND',
      'The requested n8n workflow could not be found.',
      errorOptions,
    );
  }
}

export class N8nAuthenticationError extends NodeDeltaError {
  constructor(options?: NodeDeltaErrorOptions) {
    super(
      'N8N_AUTHENTICATION',
      'NodeDelta could not read this workflow. Reload n8n and sign in again.',
      options,
    );
  }
}

export class UnsupportedN8nResponseError extends NodeDeltaError {
  constructor(options?: NodeDeltaErrorOptions) {
    super(
      'UNSUPPORTED_N8N_RESPONSE',
      'This n8n response format is not supported by this version of NodeDelta.',
      options,
    );
  }
}

export class N8nNetworkError extends NodeDeltaError {
  constructor(options?: NodeDeltaErrorOptions) {
    super(
      'N8N_NETWORK',
      'NodeDelta could not reach this n8n instance. Check your connection and try again.',
      options,
    );
  }
}

export class PermissionRequiredError extends NodeDeltaError {
  constructor(origin?: string, options?: NodeDeltaErrorOptions) {
    const errorOptions =
      origin === undefined
        ? options
        : {
            ...options,
            diagnostics: { ...options?.diagnostics, origin },
          };

    super(
      'PERMISSION_REQUIRED',
      'NodeDelta needs permission to access this n8n instance.',
      errorOptions,
    );
  }
}

export class StorageUnavailableError extends NodeDeltaError {
  constructor(options?: NodeDeltaErrorOptions) {
    super(
      'STORAGE_UNAVAILABLE',
      'Local snapshot storage is unavailable in this browser.',
      options,
    );
  }
}

export class StorageQuotaError extends NodeDeltaError {
  constructor(options?: NodeDeltaErrorOptions) {
    super(
      'STORAGE_QUOTA',
      'Local snapshot storage is full. Delete older snapshots and try again.',
      options,
    );
  }
}
