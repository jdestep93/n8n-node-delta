import type { ValueChange } from '@nodedelta/core';

export type TextContentType =
  | 'plain'
  | 'expression'
  | 'javascript'
  | 'python'
  | 'sql'
  | 'json'
  | 'html'
  | 'prompt'
  | 'markdown'
  | 'unknown';

const fieldMatches = (path: string, names: readonly string[]): boolean => {
  const field = path.split('.').at(-1)?.toLowerCase() ?? '';
  return names.some((name) => field.includes(name.toLowerCase()));
};

export function classifyTextValue(
  path: string,
  nodeType: string,
  value: unknown,
): TextContentType {
  if (typeof value !== 'string') return 'unknown';
  const type = nodeType.toLowerCase();
  if (
    fieldMatches(path, ['jscode']) ||
    (type.includes('.code') &&
      fieldMatches(path, ['code']) &&
      !fieldMatches(path, ['python']))
  ) {
    return 'javascript';
  }
  if (
    fieldMatches(path, ['pythoncode']) ||
    (type.includes('.code') && fieldMatches(path, ['python']))
  )
    return 'python';
  if (
    (type.includes('postgres') ||
      type.includes('mysql') ||
      type.includes('mssql') ||
      type.includes('sqlite') ||
      type.includes('database')) &&
    fieldMatches(path, ['query', 'sql', 'statement'])
  )
    return 'sql';
  if (fieldMatches(path, ['html']) || type.includes('.html')) return 'html';
  if (fieldMatches(path, ['markdown']) || type.includes('markdown'))
    return 'markdown';
  if (fieldMatches(path, ['prompt', 'systemmessage', 'instructions']))
    return 'prompt';

  const trimmed = value.trim();
  if (/=\s*\{\{[\s\S]*\}\}/u.test(trimmed)) return 'expression';
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      /* plain fallback */
    }
  }
  if (/^\s*<(?:!doctype|[a-z][\w-]*)(?:\s|>)/iu.test(trimmed)) return 'html';
  if (
    /^(?:select|insert|update|delete|with|create|alter|drop)\b/iu.test(trimmed)
  )
    return 'sql';
  if (/^(?:#{1,6}\s|[-*+]\s|```)/u.test(trimmed)) return 'markdown';
  return 'plain';
}

/** Compatibility seam retained for the existing T09 UI package. */
export type SpecializedTextKind =
  'expression' | 'javascript' | 'json' | 'python' | 'sql' | 'text';

export function classifyTextParameter(
  path: string,
  value: unknown,
): SpecializedTextKind {
  const classified = classifyTextValue(path, '', value);
  return classified === 'expression' ||
    classified === 'javascript' ||
    classified === 'json' ||
    classified === 'python' ||
    classified === 'sql'
    ? classified
    : 'text';
}

export function classifyValueChange(
  change: Pick<ValueChange, 'path' | 'before' | 'after'>,
): SpecializedTextKind {
  return classifyTextParameter(change.path, change.after ?? change.before);
}
