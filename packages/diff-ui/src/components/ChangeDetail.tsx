import type { ChangeEntry } from '../changes-model.js';

import { ValueDiff } from './ValueDiff.js';

export interface ChangeDetailProps {
  entry: ChangeEntry;
  beforeLabel: string;
  afterLabel: string;
}

export function ChangeDetail({
  entry,
  beforeLabel,
  afterLabel,
}: ChangeDetailProps): React.JSX.Element | null {
  if (entry.nodeChange !== undefined) {
    const change = entry.nodeChange;
    const type = change.after?.type ?? change.before?.type;
    return (
      <div className="nd-detail-pane">
        {type === undefined ? null : (
          <p className="nd-node-type">
            <code>{type}</code>
          </p>
        )}
        <ul className="nd-values">
          {change.changes.map((valueChange, index) => (
            <li key={`${valueChange.path}-${index}`}>
              <ValueDiff
                afterLabel={afterLabel}
                beforeLabel={beforeLabel}
                change={valueChange}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (entry.connectionChange !== undefined) {
    const connection = entry.connectionChange.connection;
    return (
      <div className="nd-detail-pane">
        <p className="nd-connection">
          {connection.sourceNode} → {connection.targetNode}
        </p>
        <p className="nd-connection-ports">
          {connection.sourceOutputType}[{connection.sourceOutputIndex}] →{' '}
          {connection.targetInputType}[{connection.targetInputIndex}]
        </p>
      </div>
    );
  }
  if (entry.valueChange !== undefined) {
    return (
      <div className="nd-detail-pane">
        <ValueDiff
          afterLabel={afterLabel}
          beforeLabel={beforeLabel}
          change={entry.valueChange}
        />
      </div>
    );
  }
  return null;
}
