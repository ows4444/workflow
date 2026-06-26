import { Injectable } from '@nestjs/common';
import type { WorkflowExecutionState } from '../../models/workflow-execution-state';

export type ChildWorkflowFailurePolicy =
  | 'fail-parent'
  | 'ignore'
  | 'detach'
  | 'retry-child';

export interface ChildWorkflowFailureDecision {
  readonly failParent: boolean;
  readonly retryChild: boolean;
}

@Injectable()
export class ChildWorkflowFailureService {
  evaluate(
    policy: ChildWorkflowFailurePolicy,
    child: WorkflowExecutionState,
  ): ChildWorkflowFailureDecision {
    switch (policy) {
      case 'fail-parent':
        return {
          failParent: true,
          retryChild: false,
        };

      case 'retry-child':
        return {
          failParent: false,
          retryChild: true,
        };

      case 'detach':
      case 'ignore':
        return {
          failParent: false,
          retryChild: false,
        };

      default: {
        const exhaustive: never = policy;
        throw new Error(
          `Unsupported child workflow failure policy: ${exhaustive}`,
        );
      }
    }
  }
}
