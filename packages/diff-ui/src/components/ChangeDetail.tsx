import type { ChangeEntry } from '../changes-model.js';
import { classifyValueChange } from '@nodedelta/diff-engine';
import type { ValueChange } from '@nodedelta/core';

import { ValueDiff } from './ValueDiff.js';

export interface ChangeDetailProps {
  entry: ChangeEntry;
  beforeLabel: string;
  afterLabel: string;
}

function Section({
  title,
  changes,
  beforeLabel,
  afterLabel,
}: {
  title: string;
  changes: readonly ValueChange[];
  beforeLabel: string;
  afterLabel: string;
}): React.JSX.Element | null {
  if (changes.length === 0) return null;
  return (
    <section className="nd-inspector-section">
      <h4 className="nd-inspector-heading">{title}</h4>
      <ul className="nd-values">
        {changes.map((valueChange, index) => (
          <li key={`${valueChange.path}-${index}`}>
            <ValueDiff
              afterLabel={afterLabel}
              beforeLabel={beforeLabel}
              change={valueChange}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ChangeDetail({
  entry,
  beforeLabel,
  afterLabel,
}: ChangeDetailProps): React.JSX.Element | null {
  if (entry.nodeChange !== undefined) {
    const change = entry.nodeChange;
    const type = change.after?.type ?? change.before?.type;
    const code = change.changes.filter(
      (valueChange) => classifyValueChange(valueChange) !== 'text',
    );
    const position = change.changes.filter((valueChange) =>
      valueChange.path.startsWith('position.'),
    );
    const parameters = change.changes.filter(
      (valueChange) =>
        valueChange.path.startsWith('parameters.') &&
        classifyValueChange(valueChange) === 'text',
    );
    const overview = change.changes.filter(
      (valueChange) =>
        !valueChange.path.startsWith('parameters.') &&
        !valueChange.path.startsWith('position.'),
    );
    return (
      <div className="nd-detail-pane">
        <section className="nd-inspector-section">
          <h4 className="nd-inspector-heading">Overview</h4>
          {type === undefined ? null : (
            <p className="nd-node-type">
              <code>{type}</code>
            </p>
          )}
          {overview.length === 0 ? null : (
            <ul className="nd-values">
              {overview.map((valueChange, index) => (
                <li key={`${valueChange.path}-${index}`}>
                  <ValueDiff
                    afterLabel={afterLabel}
                    beforeLabel={beforeLabel}
                    change={valueChange}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <Section
          afterLabel={afterLabel}
          beforeLabel={beforeLabel}
          changes={parameters}
          title="Parameters"
        />
        <Section
          afterLabel={afterLabel}
          beforeLabel={beforeLabel}
          changes={code}
          title="Code / Text"
        />
        <Section
          afterLabel={afterLabel}
          beforeLabel={beforeLabel}
          changes={position}
          title="Position"
        />
      </div>
    );
  }
  if (entry.connectionChange !== undefined) {
    const connection = entry.connectionChange.connection;
    return (
      <div className="nd-detail-pane">
        <h4 className="nd-inspector-heading">Connections</h4>
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
        <h4 className="nd-inspector-heading">Overview</h4>
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
