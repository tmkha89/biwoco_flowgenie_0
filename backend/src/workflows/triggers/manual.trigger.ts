import { Injectable } from '@nestjs/common';
import { ITriggerHandler, TriggerType } from '../interfaces/workflow.interface';

/**
 * Manual trigger handler
 * Manual triggers don't require registration/unregistration
 */
@Injectable()
export class ManualTriggerHandler implements ITriggerHandler {
  readonly type: TriggerType = TriggerType.MANUAL;
  readonly name = 'Manual Trigger';

  async validate(config: Record<string, any>): Promise<boolean> {
    // Manual triggers don't require any configuration
    return true;
  }

  async register(workflowId: number, config: Record<string, any>): Promise<void> {
    // Manual triggers don't need registration
    // They are triggered via API calls
  }

  async unregister(workflowId: number): Promise<void> {
    // Manual triggers don't need unregistration
  }
}

