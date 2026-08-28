export function getWorkflowId(url: URL): string | undefined {
  const segments = url.pathname.split('/').filter(Boolean);
  const workflowSegment = segments.lastIndexOf('workflow');
  const encodedWorkflowId = segments[workflowSegment + 1];

  if (workflowSegment < 0 || encodedWorkflowId === undefined) {
    return undefined;
  }

  try {
    return decodeURIComponent(encodedWorkflowId);
  } catch {
    return undefined;
  }
}
