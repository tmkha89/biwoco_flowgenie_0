import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Service for emitting workflow trigger events
 * All triggers should use this service to emit events that trigger workflow executions
 */
@Injectable()
export class WorkflowEventService {
  private readonly logger = new Logger(WorkflowEventService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Emit a workflow trigger event
   * This event will be picked up by the workflow engine to start execution
   */
  emitWorkflowTrigger(workflowId: number, payload: Record<string, any>): void {
    this.logger.log(`Emitting workflow trigger event for workflow ${workflowId}`);
    this.logger.debug(`Trigger payload: ${JSON.stringify(payload)}`);

    this.eventEmitter.emit('workflow.trigger', {
      workflowId,
      payload,
    });
  }
}

