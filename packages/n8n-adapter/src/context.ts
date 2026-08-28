export type N8nRouteType = 'workflow' | 'new-workflow' | 'other';

export interface N8nContextInput {
  url: URL;
  basePathScriptUrls: readonly string[];
  restEndpointContent?: string | undefined;
}

export interface N8nContext {
  detected: boolean;
  origin: string;
  basePath: string;
  restEndpoint: string;
  instanceId: string;
  workflowId: string | undefined;
  routeType: N8nRouteType;
}

interface WorkflowRoute {
  basePath: string;
  workflowId: string | undefined;
  routeType: N8nRouteType;
}

const BASE_PATH_SCRIPT_SUFFIX = '/static/base-path.js';
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9._~-]+$/u;

function normalizeBasePath(pathname: string): string {
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return withLeadingSlash.endsWith('/')
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

function findMarkerBasePath(
  origin: string,
  scriptUrls: readonly string[],
): string | undefined {
  for (const scriptUrl of scriptUrls) {
    try {
      const parsed = new URL(scriptUrl, origin);
      if (
        parsed.origin === origin &&
        parsed.pathname.endsWith(BASE_PATH_SCRIPT_SUFFIX)
      ) {
        return normalizeBasePath(
          parsed.pathname.slice(0, -BASE_PATH_SCRIPT_SUFFIX.length),
        );
      }
    } catch {
      // A malformed page-provided script URL is not trustworthy evidence.
    }
  }

  return undefined;
}

function parseWorkflowRoute(url: URL): WorkflowRoute {
  const match =
    /^(?<prefix>.*)\/workflow\/(?<workflowId>[^/]+)(?:\/.*)?$/u.exec(
      url.pathname,
    );

  if (match?.groups === undefined) {
    return { basePath: '/', workflowId: undefined, routeType: 'other' };
  }

  const encodedWorkflowId = match.groups.workflowId;
  if (encodedWorkflowId === undefined) {
    return { basePath: '/', workflowId: undefined, routeType: 'other' };
  }

  let workflowId: string;
  try {
    workflowId = decodeURIComponent(encodedWorkflowId);
  } catch {
    return {
      basePath: normalizeBasePath(match.groups.prefix ?? ''),
      workflowId: undefined,
      routeType: 'other',
    };
  }

  const isNewWorkflow =
    workflowId === 'new' || url.searchParams.get('new') === 'true';
  return {
    basePath: normalizeBasePath(match.groups.prefix ?? ''),
    workflowId: isNewWorkflow ? undefined : workflowId,
    routeType: isNewWorkflow ? 'new-workflow' : 'workflow',
  };
}

function decodeRestEndpoint(content: string | undefined): string {
  if (content === undefined) {
    return 'rest';
  }

  try {
    const decoded = atob(content);
    if (
      SAFE_PATH_SEGMENT.test(decoded) &&
      decoded !== '.' &&
      decoded !== '..'
    ) {
      return decoded;
    }
  } catch {
    // Invalid configuration is treated as absent for compatibility.
  }

  return 'rest';
}

export function detectN8nContext(input: N8nContextInput): N8nContext {
  const route = parseWorkflowRoute(input.url);
  const markerBasePath = findMarkerBasePath(
    input.url.origin,
    input.basePathScriptUrls,
  );
  const basePath = markerBasePath ?? route.basePath;
  const detected = markerBasePath !== undefined || route.routeType !== 'other';

  return {
    detected,
    origin: input.url.origin,
    basePath,
    restEndpoint: decodeRestEndpoint(input.restEndpointContent),
    instanceId: `${input.url.origin}${basePath}`,
    workflowId: route.workflowId,
    routeType: route.routeType,
  };
}
