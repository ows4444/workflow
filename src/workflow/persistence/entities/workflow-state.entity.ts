import { Column, Entity, PrimaryColumn, VersionColumn } from 'typeorm';

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
  status!: string;

  @Column({ nullable: true })
  currentStep?: string;

  @Column({ nullable: true })
  executingStep?: string;

  @Column({ nullable: true })
  failedStep?: string;

  @Column({ nullable: true })
  lastError?: string;

  @Column({ nullable: true })
  recoveryReason?: string;

  @Column({ type: 'json' })
  data!: Record<string, unknown>;

  @Column({ type: 'json' })
  history!: unknown[];

  @Column({ nullable: true, type: 'json' })
  waitingForSignal?: unknown;

  @Column()
  iteration!: number;

  @Column({ nullable: true })
  failureCount?: number;

  @Column({ nullable: true })
  requiresRecovery?: boolean;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @Column({ nullable: true })
  failedAt?: Date;

  @Column({ nullable: true })
  stepStartedAt?: Date;

  @VersionColumn()
  stateVersion!: number;
}
