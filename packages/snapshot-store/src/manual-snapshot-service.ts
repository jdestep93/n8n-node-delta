import type {
  NormalizedWorkflow,
  SnapshotRepository,
  SnapshotRetention,
  SnapshotSaveResult,
  WorkflowNormalizer,
  WorkflowProvider,
  WorkflowSnapshot,
} from '@nodedelta/core';

export interface ManualSnapshotServiceOptions {
  workflowProvider: WorkflowProvider;
  workflowNormalizer: WorkflowNormalizer;
  hashWorkflow: (workflow: NormalizedWorkflow) => Promise<string>;
  snapshotRepository: SnapshotRepository;
  createId?: () => string;
  now?: () => Date;
}

export interface SaveManualSnapshotInput {
  instanceId: string;
  workflowId: string;
  label?: string;
  retention?: SnapshotRetention;
}

export class ManualSnapshotService {
  readonly #workflowProvider: WorkflowProvider;
  readonly #workflowNormalizer: WorkflowNormalizer;
  readonly #hashWorkflow: (workflow: NormalizedWorkflow) => Promise<string>;
  readonly #snapshotRepository: SnapshotRepository;
  readonly #createId: () => string;
  readonly #now: () => Date;

  constructor(options: ManualSnapshotServiceOptions) {
    this.#workflowProvider = options.workflowProvider;
    this.#workflowNormalizer = options.workflowNormalizer;
    this.#hashWorkflow = options.hashWorkflow;
    this.#snapshotRepository = options.snapshotRepository;
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#now = options.now ?? (() => new Date());
  }

  async save(input: SaveManualSnapshotInput): Promise<SnapshotSaveResult> {
    const rawWorkflow = await this.#workflowProvider.getWorkflow(
      input.workflowId,
    );
    const normalizedWorkflow = this.#workflowNormalizer.normalize(rawWorkflow);
    const workflowHash = await this.#hashWorkflow(normalizedWorkflow);
    const snapshot: WorkflowSnapshot = {
      id: this.#createId(),
      schemaVersion: 1,
      instanceId: input.instanceId,
      workflowId: input.workflowId,
      workflowName: rawWorkflow.name,
      ...(input.label === undefined ? {} : { label: input.label }),
      createdAt: this.#now().toISOString(),
      normalizedWorkflow,
      workflowHash,
      source: 'manual',
    };
    return this.#snapshotRepository.save(
      snapshot,
      input.retention === undefined ? {} : { retention: input.retention },
    );
  }
}
