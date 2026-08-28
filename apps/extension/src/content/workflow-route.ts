export function getWorkflowId(url: URL): string | undefined {
  if (url.searchParams.get('new') === 'true') return undefined;

  const segments = url.pathname.split('/').filter(Boolean);
  const workflowSegment = segments.lastIndexOf('workflow');
  const encodedWorkflowId = segments[workflowSegment + 1];

  if (workflowSegment < 0 || encodedWorkflowId === undefined) {
    return undefined;
  }

  try {
    const workflowId = decodeURIComponent(encodedWorkflowId);
    return workflowId === 'new' || workflowId === '' ? undefined : workflowId;
  } catch {
    return undefined;
  }
}
