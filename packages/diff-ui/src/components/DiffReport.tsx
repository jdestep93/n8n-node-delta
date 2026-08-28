import type { WorkflowDiff } from '@nodedelta/core';
import { useMemo, useState } from 'react';

import {
  createChangeEntries,
  matchesChangeFilter,
  SUMMARY_CHIP_LABELS,
  type DiffFilter,
} from '../changes-model.js';

import { ChangeDetail } from './ChangeDetail.js';
import { ChangesList } from './ChangesList.js';

export interface DiffReportProps {
  diff: WorkflowDiff;
  beforeLabel?: string;
  afterLabel?: string;
  filter?: DiffFilter;
  query?: string;
  onQueryChange?: (query: string) => void;
  selectedNodeId?: string | undefined;
  onSelectedNodeIdChange?: (nodeId: string | undefined) => void;
}

function summaryChips(
  diff: WorkflowDiff,
): Array<{ count: number; label: string; key: keyof WorkflowDiff['summary'] }> {
  return SUMMARY_CHIP_LABELS.flatMap(({ key, one, many }) => {
    const count = diff.summary[key];
    if (count === 0) return [];
    return [{ count, label: count === 1 ? one : many, key }];
  });
}

export function DiffReport({
  diff,
  beforeLabel = 'Before',
  afterLabel = 'After',
  filter = 'all',
  query: controlledQuery,
  onQueryChange,
  selectedNodeId,
  onSelectedNodeIdChange,
}: DiffReportProps): React.JSX.Element {
  const entries = useMemo(() => createChangeEntries(diff), [diff]);
  const [localQuery, setLocalQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const query = controlledQuery ?? localQuery;
  const setQuery = onQueryChange ?? setLocalQuery;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter(
      (entry) =>
        matchesChangeFilter(entry, filter) &&
        (needle === '' || entry.searchText.includes(needle)),
    );
  }, [entries, filter, query]);

  const selected =
    visible.find(
      (entry) =>
        selectedNodeId !== undefined && entry.nodeId === selectedNodeId,
    ) ??
    visible.find((entry) => entry.id === selectedId) ??
    visible[0];

  return (
    <div className="nd-report">
      <div className="nd-chips">
        {summaryChips(diff).map(({ count, label, key }) => (
          <span className={`nd-chip nd-summary-${key}`} key={label}>
            <strong>{count}</strong> {label}
          </span>
        ))}
      </div>
      <ChangesList
        entries={visible}
        onSelect={(id) => {
          setSelectedId(id);
          onSelectedNodeIdChange?.(
            visible.find((entry) => entry.id === id)?.nodeId,
          );
        }}
        onQueryChange={setQuery}
        query={query}
        selectedId={selected?.id}
      />
      {entries.length === 0 ? (
        <p className="nd-empty">No changes detected.</p>
      ) : null}
      {selected === undefined ? null : (
        <ChangeDetail
          afterLabel={afterLabel}
          beforeLabel={beforeLabel}
          entry={selected}
        />
      )}
    </div>
  );
}
