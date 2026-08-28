import type { ChangeEntry } from '../changes-model.js';

export interface ChangesListProps {
  entries: readonly ChangeEntry[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
}

function badgeLabel(entry: ChangeEntry): string {
  if (entry.category === 'connection') return `Connection ${entry.kind}`;
  if (entry.category === 'workflow') return 'Workflow';
  return entry.kind.charAt(0).toUpperCase() + entry.kind.slice(1);
}

export function ChangesList({
  entries,
  selectedId,
  onSelect,
  query,
  onQueryChange,
}: ChangesListProps): React.JSX.Element {
  return (
    <div className="nd-list-pane">
      <input
        aria-label="Search changes"
        className="nd-search"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search changes"
        type="search"
        value={query}
      />
      <p className="nd-count" role="status">
        {entries.length === 0
          ? 'No matching changes'
          : `${entries.length} change${entries.length === 1 ? '' : 's'}`}
      </p>
      <ul className="nd-list">
        {entries.map((entry) => {
          const selected = entry.id === selectedId;
          return (
            <li key={entry.id}>
              <button
                aria-pressed={selected}
                className={selected ? 'nd-item nd-item-selected' : 'nd-item'}
                onClick={() => onSelect(entry.id)}
                type="button"
              >
                <span className={`nd-badge nd-kind-${entry.kind}`}>
                  {badgeLabel(entry)}
                </span>
                <span className="nd-item-text">
                  <span className="nd-title">{entry.title}</span>
                  {entry.detail === undefined ? null : (
                    <span className="nd-item-detail">{entry.detail}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
