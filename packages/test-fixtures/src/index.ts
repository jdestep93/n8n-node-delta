import aiPromptAfter from './fixtures/ai-prompt-after.json' with { type: 'json' };
import aiPromptBefore from './fixtures/ai-prompt-before.json' with { type: 'json' };
import codeAfter from './fixtures/code-after.json' with { type: 'json' };
import codeBefore from './fixtures/code-before.json' with { type: 'json' };
import connectionsAfter from './fixtures/connections-after.json' with { type: 'json' };
import connectionsBefore from './fixtures/connections-before.json' with { type: 'json' };
import largeWorkflowAfter from './fixtures/large-workflow-after.json' with { type: 'json' };
import largeWorkflowBefore from './fixtures/large-workflow-before.json' with { type: 'json' };
import nodeAddedAfter from './fixtures/node-added-after.json' with { type: 'json' };
import nodeAddedBefore from './fixtures/node-added-before.json' with { type: 'json' };
import nodeModifiedAfter from './fixtures/node-modified-after.json' with { type: 'json' };
import nodeModifiedBefore from './fixtures/node-modified-before.json' with { type: 'json' };
import nodeMovedAfter from './fixtures/node-moved-after.json' with { type: 'json' };
import nodeMovedBefore from './fixtures/node-moved-before.json' with { type: 'json' };
import nodeRemovedAfter from './fixtures/node-removed-after.json' with { type: 'json' };
import nodeRemovedBefore from './fixtures/node-removed-before.json' with { type: 'json' };
import nodeRenamedAfter from './fixtures/node-renamed-after.json' with { type: 'json' };
import nodeRenamedBefore from './fixtures/node-renamed-before.json' with { type: 'json' };
import simpleAfter from './fixtures/simple-after.json' with { type: 'json' };
import simpleBefore from './fixtures/simple-before.json' with { type: 'json' };
import sqlAfter from './fixtures/sql-after.json' with { type: 'json' };
import sqlBefore from './fixtures/sql-before.json' with { type: 'json' };

export const workflowFixtures = {
  'ai-prompt-after': aiPromptAfter,
  'ai-prompt-before': aiPromptBefore,
  'code-after': codeAfter,
  'code-before': codeBefore,
  'connections-after': connectionsAfter,
  'connections-before': connectionsBefore,
  'large-workflow-after': largeWorkflowAfter,
  'large-workflow-before': largeWorkflowBefore,
  'node-added-after': nodeAddedAfter,
  'node-added-before': nodeAddedBefore,
  'node-modified-after': nodeModifiedAfter,
  'node-modified-before': nodeModifiedBefore,
  'node-moved-after': nodeMovedAfter,
  'node-moved-before': nodeMovedBefore,
  'node-removed-after': nodeRemovedAfter,
  'node-removed-before': nodeRemovedBefore,
  'node-renamed-after': nodeRenamedAfter,
  'node-renamed-before': nodeRenamedBefore,
  'simple-after': simpleAfter,
  'simple-before': simpleBefore,
  'sql-after': sqlAfter,
  'sql-before': sqlBefore,
} as const;

export type WorkflowFixtureName = keyof typeof workflowFixtures;

export function getWorkflowFixture(name: WorkflowFixtureName): unknown {
  return workflowFixtures[name];
}
