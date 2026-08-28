import {
  classifyValueChange,
  type SpecializedTextKind,
} from '@nodedelta/diff-engine';
import type { ValueChange } from '@nodedelta/core';
import type { ReactNode } from 'react';

import {
  compactRows,
  diffTextRows,
  diffWords,
  displayText,
  type TextDiffRow,
} from '../text-diff.js';

const KIND_LABELS: Record<SpecializedTextKind, string> = {
  expression: 'Expression',
  javascript: 'JavaScript',
  json: 'JSON',
  python: 'Python',
  sql: 'SQL',
  text: 'Text',
};

export interface ValueDiffProps {
  change: ValueChange;
  beforeLabel: string;
  afterLabel: string;
}

function CodeRows({
  rows,
}: {
  rows: readonly TextDiffRow[];
}): React.JSX.Element {
  return (
    <pre className="nd-code">
      {rows.map((row, index) => {
        if (row.type === 'gap') {
          return (
            <span className="nd-gap" key={index}>
              ⋯ {row.count} unchanged line{row.count === 1 ? '' : 's'}
            </span>
          );
        }
        const marker =
          row.type === 'added' ? '+' : row.type === 'removed' ? '−' : ' ';
        const text =
          row.type === 'added' ? (row.after ?? '') : (row.before ?? '');
        const className =
          row.type === 'added'
            ? 'nd-line nd-add'
            : row.type === 'removed'
              ? 'nd-line nd-del'
              : 'nd-line';
        return (
          <span className={className} key={index}>
            <span className="nd-marker">{marker} </span>
            {text}
            {'\n'}
          </span>
        );
      })}
    </pre>
  );
}

function WordDiff({
  before,
  after,
}: {
  before: string;
  after: string;
}): React.JSX.Element {
  const rows = diffWords(before, after);
  const beforeParts = rows.flatMap((row, index) => {
    if (row.before === undefined) return [];
    return row.type === 'removed'
      ? [
          <mark className="nd-mark-del" key={index}>
            {row.before}
          </mark>,
        ]
      : [<span key={index}>{row.before}</span>];
  });
  const afterParts = rows.flatMap((row, index) => {
    if (row.after === undefined) return [];
    return row.type === 'added'
      ? [
          <mark className="nd-mark-add" key={index}>
            {row.after}
          </mark>,
        ]
      : [<span key={index}>{row.after}</span>];
  });
  return (
    <div className="nd-words">
      <pre className="nd-code">
        <span className="nd-marker">− </span>
        {beforeParts}
      </pre>
      <pre className="nd-code">
        <span className="nd-marker">+ </span>
        {afterParts}
      </pre>
    </div>
  );
}

export function ValueDiff({
  change,
  beforeLabel,
  afterLabel,
}: ValueDiffProps): React.JSX.Element {
  const kind = classifyValueChange(change);
  const before = displayText(change.before);
  const after = displayText(change.after);
  let body: ReactNode;
  if (change.kind === 'modified') {
    const singleLine = !before.includes('\n') && !after.includes('\n');
    body =
      before === '' || after === '' ? (
        <CodeRows
          rows={[
            ...(before === '' ? [] : [{ type: 'removed' as const, before }]),
            ...(after === '' ? [] : [{ type: 'added' as const, after }]),
          ]}
        />
      ) : singleLine ? (
        <WordDiff after={after} before={before} />
      ) : (
        <CodeRows rows={compactRows(diffTextRows(before, after), 2)} />
      );
  } else if (change.kind === 'added') {
    body = (
      <pre className="nd-code">
        <span className="nd-label">{afterLabel}: </span>
        {after}
        {'\n'}
      </pre>
    );
  } else {
    body = (
      <pre className="nd-code">
        <span className="nd-label">{beforeLabel}: </span>
        {before}
        {'\n'}
      </pre>
    );
  }
  return (
    <div className="nd-value">
      <div className="nd-value-head">
        <code className="nd-path">{change.path}</code>
        <span className={`nd-badge nd-kind-${kind}`}>{KIND_LABELS[kind]}</span>
      </div>
      {body}
    </div>
  );
}
