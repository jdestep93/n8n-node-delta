export type FlowDiffErrorCode =
  | 'N8N_NOT_DETECTED'
  | 'WORKFLOW_NOT_FOUND'
  | 'N8N_AUTHENTICATION'
  | 'UNSUPPORTED_N8N_RESPONSE'
  | 'N8N_NETWORK'
  | 'PERMISSION_REQUIRED'
  | 'STORAGE_UNAVAILABLE';

export interface FlowDiffErrorOptions extends ErrorOptions {
  diagnostics?: Readonly<Record<string, unknown>>;
}

export class FlowDiffError extends Error {
  readonly code: FlowDiffErrorCode;
  readonly diagnostics?: Readonly<Record<string, unknown>>;

  constructor(
    code: FlowDiffErrorCode,
    message: string,
    options: FlowDiffErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.code = code;
    if (options.diagnostics !== undefined) {
      this.diagnostics = options.diagnostics;
    }
    this.name = new.target.name;
  }
}

export class N8nNotDetectedError extends FlowDiffError {
  constructor(options?: FlowDiffErrorOptions) {
    super(
      'N8N_NOT_DETECTED',
      "FlowDiff couldn't detect an n8n instance on this page.",
      options,
    );
  }
}

export class WorkflowNotFoundError extends FlowDiffError {
  constructor(workflowId?: string, options?: FlowDiffErrorOptions) {
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

export class N8nAuthenticationError extends FlowDiffError {
  constructor(options?: FlowDiffErrorOptions) {
    super(
      'N8N_AUTHENTICATION',
      'FlowDiff could not read this workflow. Reload n8n and sign in again.',
      options,
    );
  }
}

export class UnsupportedN8nResponseError extends FlowDiffError {
  constructor(options?: FlowDiffErrorOptions) {
    super(
      'UNSUPPORTED_N8N_RESPONSE',
      'This n8n response format is not supported by this version of FlowDiff.',
      options,
    );
  }
}

export class N8nNetworkError extends FlowDiffError {
  constructor(options?: FlowDiffErrorOptions) {
    super(
      'N8N_NETWORK',
      'FlowDiff could not reach this n8n instance. Check your connection and try again.',
      options,
    );
  }
}

export class PermissionRequiredError extends FlowDiffError {
  constructor(origin?: string, options?: FlowDiffErrorOptions) {
    const errorOptions =
      origin === undefined
        ? options
        : {
            ...options,
            diagnostics: { ...options?.diagnostics, origin },
          };

    super(
      'PERMISSION_REQUIRED',
      'FlowDiff needs permission to access this n8n instance.',
      errorOptions,
    );
  }
}

export class StorageUnavailableError extends FlowDiffError {
  constructor(options?: FlowDiffErrorOptions) {
    super(
      'STORAGE_UNAVAILABLE',
      'Local snapshot storage is unavailable in this browser.',
      options,
    );
  }
}
