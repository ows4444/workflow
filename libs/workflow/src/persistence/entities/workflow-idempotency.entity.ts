import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('workflow_idempotency')
export class WorkflowIdempotencyEntity {
  @PrimaryColumn()
  key!: string;

  @Column()
  workflowId!: string;

  @Column()
  completed!: boolean;

  @Column({
    type: 'datetime',
  })
  createdAt!: Date;

  @Column({
    type: 'datetime',
    nullable: true,
  })
  completedAt?: Date;
}
