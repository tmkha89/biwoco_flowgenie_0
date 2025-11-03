import { Injectable } from '@nestjs/common';
import { NotFoundException, ExecutionException } from '../common/exceptions/custom-exceptions';
import { ExecutionRepository } from './repositories/execution.repository';
import { ActionRegistry } from './actions/action.registry';
import { ExecutionContext, ExecutionStepStatus, WorkflowStatus } from './interfaces/workflow.interface';

@Injectable()
export class ExecutionService {
  constructor(
    private readonly executionRepository: ExecutionRepository,
    private readonly actionRegistry: ActionRegistry,
  ) {}

  async findById(id: number, userId: number) {
    const execution = await this.executionRepository.findById(id);

    if (!execution) {
      throw new NotFoundException('Execution', id);
    }

    if (execution.userId !== userId) {
      throw new NotFoundException('Execution', id);
    }

    return execution;
  }

  async findByWorkflowId(workflowId: number, options?: {
    limit?: number;
    offset?: number;
  }) {
    return this.executionRepository.findByWorkflowId(workflowId, options);
  }

  async findByUserId(userId: number, options?: {
    limit?: number;
    offset?: number;
  }) {
    return this.executionRepository.findByUserId(userId, options);
  }

  /**
   * Execute a workflow
   * This is called by the BullMQ worker
   */
  async execute(executionId: number): Promise<void> {
    // Get execution with workflow and actions
    const execution = await this.executionRepository.findById(executionId);

    if (!execution) {
      throw new NotFoundException('Execution', executionId);
    }

    if (execution.status !== WorkflowStatus.PENDING) {
      // Execution already started or completed
      return;
    }

    // Update execution status to running
    await this.executionRepository.update(executionId, {
      status: WorkflowStatus.RUNNING,
      startedAt: new Date(),
    });

    // Create execution steps for each action
    const executionSteps = [];
    for (const action of execution.workflow.actions) {
      const step = await this.executionRepository.createExecutionStep({
        executionId,
        actionId: action.id,
        order: action.order,
        status: ExecutionStepStatus.PENDING,
        input: null,
      });
      executionSteps.push(step);
    }

    // Build execution context
    const context: ExecutionContext = {
      executionId,
      workflowId: execution.workflowId,
      userId: execution.userId,
      triggerData: (execution.triggerData as Record<string, any>) || {},
      stepResults: {},
      currentStepOrder: 0,
    };

    try {
      // Execute each action in order
      for (let i = 0; i < executionSteps.length; i++) {
        const step = executionSteps[i];
        const action = execution.workflow.actions.find((a) => a.id === step.actionId);

        if (!action) {
          continue;
        }

        context.currentStepOrder = action.order;

        // Update step status to running
        await this.executionRepository.updateExecutionStep(step.id, {
          status: ExecutionStepStatus.RUNNING,
          startedAt: new Date(),
        });

        try {
          // Get action handler
          const handler = this.actionRegistry.getHandler(action.type);

          if (!handler) {
            throw new Error(`Action type "${action.type}" is not registered`);
          }

          // Execute action
          const output = await handler.execute(context, action.config as Record<string, any>);

          // Store step result
          context.stepResults[action.id] = output;

          // Update step status to completed
          await this.executionRepository.updateExecutionStep(step.id, {
            status: ExecutionStepStatus.COMPLETED,
            output: output,
            completedAt: new Date(),
          });
        } catch (error) {
          // Handle retry logic
          const retryCount = step.retryCount + 1;
          const retryConfig = action.retryConfig as { attempts: number; backoff: { type: string; delay: number } } | null;

          const maxAttempts = retryConfig?.attempts || 3;

          if (retryCount < maxAttempts) {
            // Retry the step
            await this.executionRepository.updateExecutionStep(step.id, {
              status: ExecutionStepStatus.PENDING,
              retryCount,
              error: error instanceof Error ? error.message : String(error),
            });

            // Wait before retry (exponential backoff)
            const delay = retryConfig?.backoff?.delay || 1000;
            const backoffDelay = retryConfig?.backoff?.type === 'exponential'
              ? delay * Math.pow(2, retryCount - 1)
              : delay;

            await new Promise((resolve) => setTimeout(resolve, backoffDelay));

            // Retry the step (simplified - in production, you might want to re-queue)
            i--; // Decrement to retry current step
            continue;
          } else {
            // Mark step as failed
            await this.executionRepository.updateExecutionStep(step.id, {
              status: ExecutionStepStatus.FAILED,
              error: error instanceof Error ? error.message : String(error),
              completedAt: new Date(),
            });

            // Mark execution as failed
            await this.executionRepository.update(executionId, {
              status: WorkflowStatus.FAILED,
              error: `Action "${action.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
              completedAt: new Date(),
            });

            return;
          }
        }
      }

      // All steps completed successfully
      await this.executionRepository.update(executionId, {
        status: WorkflowStatus.COMPLETED,
        result: context.stepResults,
        completedAt: new Date(),
      });
    } catch (error) {
      // Mark execution as failed
      await this.executionRepository.update(executionId, {
        status: WorkflowStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      });

      throw error;
    }
  }
}

