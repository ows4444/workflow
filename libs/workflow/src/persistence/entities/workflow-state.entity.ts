import type { WorkflowSignal } from '../../contracts/workflow-signal';
import { WorkflowExecutionState } from '../../contracts/workflow-execution-state';
import type { WorkflowFailure } from '../../contracts/workflow-failure';
import { type WorkflowStatus } from '../../contracts/workflow-status';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Index(['status'])
@Index(['status', 'stepStartedAt'])
@Index(['status', 'completedAt'])
@Index(['workflowId', 'stateVersion'])
@Entity('workflow_executions')
export class WorkflowStateEntity {
  @PrimaryColumn()
  workflowId!: string;

  @Column()
  executionId!: string;

  @Column()
  workflowName!: string;

  @Column()
  workflowVersion!: number;

  @Column()
  status!: WorkflowStatus;

  @Column({ nullable: true })
  currentStep?: string;

  @Column({ nullable: true })
  failedStep?: string;

  @Column({ type: 'json', nullable: true })
  lastFailure?: WorkflowFailure;

  @Column({ nullable: true })
  recoveryReason?: WorkflowExecutionState['recoveryReason'];

  @Column({ type: 'json' })
  data!: Record<string, unknown>;

  @Column()
  historyCount!: number;

  @Column({ nullable: true })
  correlationId?: string;

  @Column({ nullable: true })
  executingStep?: string;

  @Column({ nullable: true })
  retryCount?: number;

  @Column({ nullable: true, type: 'json' })
  waitingForSignal?: WorkflowSignal;

  @Column()
  iteration!: number;

  @Column({ nullable: true })
  failureCount?: number;

  @Column({ type: 'boolean', nullable: true })
  requiresRecovery?: boolean;

  @Column({ type: 'datetime' })
  createdAt!: Date;

  @Column({ type: 'datetime' })
  updatedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  failedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  stepStartedAt?: Date;

  @Column()
  stateVersion!: number;
}
