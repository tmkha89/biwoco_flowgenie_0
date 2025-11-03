import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkflowService } from '../workflow.service';
import { WorkflowRepository } from '../repositories/workflow.repository';

interface WorkflowTriggerEvent {
  workflowId: number;
  payload: Record<string, any>;
}

/**
 * Listener for workflow trigger events
 * Listens to 'workflow.trigger' events emitted by trigger handlers
 * and starts workflow executions
 */
@Injectable()
export class WorkflowTriggerListener implements OnModuleInit {
  private readonly logger = new Logger(WorkflowTriggerListener.name);

  constructor(
    private readonly workflowService: WorkflowService,
    private readonly workflowRepository: WorkflowRepository,
  ) {}

  onModuleInit() {
    this.logger.log('WorkflowTriggerListener initialized and listening for workflow.trigger events');
  }

  /**
   * Handle workflow trigger events
   * This method is called whenever a trigger emits a 'workflow.trigger' event
   */
  @OnEvent('workflow.trigger')
  async handleWorkflowTrigger(event: WorkflowTriggerEvent) {
    const { workflowId, payload } = event;
    
    this.logger.log(`Received workflow trigger event for workflow ${workflowId}`);
    this.logger.debug(`Trigger payload: ${JSON.stringify(payload)}`);

    try {
      // Get workflow directly from repository (system triggers don't require user auth check)
      const workflow = await this.workflowRepository.findById(workflowId);
      
      if (!workflow) {
        this.logger.error(`Workflow ${workflowId} not found`);
        return;
      }

      if (!workflow.enabled) {
        this.logger.warn(`Workflow ${workflowId} is disabled, skipping execution`);
        return;
      }

      // Trigger workflow execution
      await this.workflowService.trigger(workflowId, workflow.userId, payload);
      
      this.logger.log(`Workflow ${workflowId} execution triggered successfully`);
    } catch (error: any) {
      this.logger.error(`Error triggering workflow ${workflowId}:`, error.message);
      // Don't throw - we don't want to break the event emitter
    }
  }
}

