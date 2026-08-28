import type { WorkflowDiff } from '@nodedelta/core';
import { useMemo, useState } from 'react';

import { createChangeEntries, SUMMARY_CHIP_LABELS } from '../changes-model.js';

import { ChangeDetail } from './ChangeDetail.js';
import { ChangesList } from './ChangesList.js';

export interface DiffReportProps {
  diff: WorkflowDiff;
  beforeLabel?: string;
  afterLabel?: string;
}

function summaryChips(
  diff: WorkflowDiff,
): Array<{ count: number; label: string }> {
  return SUMMARY_CHIP_LABELS.flatMap(({ key, one, many }) => {
    const count = diff.summary[key];
    if (count === 0) return [];
    return [{ count, label: count === 1 ? one : many }];
  });
}

export function DiffReport({
  diff,
  beforeLabel = 'Before',
  afterLabel = 'After',
}: DiffReportProps): React.JSX.Element {
  const entries = useMemo(() => createChangeEntries(diff), [diff]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle === ''
      ? entries
      : entries.filter((entry) => entry.searchText.includes(needle));
  }, [entries, query]);

  if (entries.length === 0) {
    return (
      <div className="nd-report">
        <p className="nd-empty">No changes detected.</p>
      </div>
    );
  }

  const selected =
    visible.find((entry) => entry.id === selectedId) ?? visible[0];

  return (
    <div className="nd-report">
      <div className="nd-chips">
        {summaryChips(diff).map(({ count, label }) => (
          <span className="nd-chip" key={label}>
            <strong>{count}</strong> {label}
          </span>
        ))}
      </div>
      <ChangesList
        entries={visible}
        onSelect={setSelectedId}
        onQueryChange={setQuery}
        query={query}
        selectedId={selected?.id}
      />
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
