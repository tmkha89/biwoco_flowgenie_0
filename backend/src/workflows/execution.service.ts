import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException, ExecutionException } from '../common/exceptions/custom-exceptions';
import { ExecutionRepository } from './repositories/execution.repository';
import { ActionRegistry } from './actions/action.registry';
import { ActionFactory } from './actions/action.factory';
import {
  ExecutionContext,
  ExecutionStepStatus,
  WorkflowStatus,
  LoopContext,
  ActionResult,
} from './interfaces/workflow.interface';

/**
 * Enhanced Execution Service with DAG traversal, parallel execution, conditionals, and loops
 */
@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    private readonly executionRepository: ExecutionRepository,
    private readonly actionRegistry: ActionRegistry,
    private readonly actionFactory: ActionFactory,
  ) {
    // ActionFactory depends on ActionRegistry, which is already injected
  }

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
   * Execute a workflow with DAG traversal, parallel execution, conditionals, and loops
   */
  async execute(executionId: number): Promise<void> {
    const execution = await this.executionRepository.findById(executionId);

    if (!execution) {
      throw new NotFoundException('Execution', executionId);
    }

    if (execution.status !== WorkflowStatus.PENDING) {
      this.logger.warn(`Execution ${executionId} is already ${execution.status}, skipping`);
      return;
    }

    // Update execution status to running
    await this.executionRepository.update(executionId, {
      status: WorkflowStatus.RUNNING,
      startedAt: new Date(),
    });

    try {
      // Build action map for quick lookup
      const actionMap = new Map<number, any>();
      for (const action of execution.workflow.actions) {
        actionMap.set(action.id, action);
      }

      // Find root actions (actions with no previous action or order 0)
      const rootActions = execution.workflow.actions.filter((action) => !action.nextActionId && action.order === 0);

      if (rootActions.length === 0) {
        throw new ExecutionException('No root actions found in workflow');
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

      // Execute workflow starting from root actions
      if (rootActions.length === 1) {
        // Single root action - sequential execution
        await this.executeActionNode(rootActions[0].id, actionMap, context, executionId);
      } else {
        // Multiple root actions - execute in parallel
        await this.executeActionsParallel(rootActions.map((a) => a.id), actionMap, context, executionId);
      }

      // Mark execution as completed
      await this.executionRepository.update(executionId, {
        status: WorkflowStatus.COMPLETED,
        result: context.stepResults,
        completedAt: new Date(),
      });

      this.logger.log(`Execution ${executionId} completed successfully`);
    } catch (error: any) {
      this.logger.error(`Execution ${executionId} failed: ${error.message}`, error.stack);
      await this.executionRepository.update(executionId, {
        status: WorkflowStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      });
      throw error;
    }
  }

  /**
   * Execute a single action node (recursive for DAG traversal)
   */
  private async executeActionNode(
    actionId: number,
    actionMap: Map<number, any>,
    context: ExecutionContext,
    executionId: number,
  ): Promise<void> {
    const action = actionMap.get(actionId);
    if (!action) {
      throw new ExecutionException(`Action ${actionId} not found`, executionId);
    }

    // Check if step already exists, if not create it
    let step = await this.findOrCreateExecutionStep(executionId, actionId, action.order, context);

    // Skip if already completed
    if (step.status === ExecutionStepStatus.COMPLETED) {
      this.logger.debug(`Step ${step.id} (Action ${actionId}) already completed, skipping`);
      return;
    }

    // Update step status to running
    await this.executionRepository.updateExecutionStep(step.id, {
      status: ExecutionStepStatus.RUNNING,
      startedAt: new Date(),
    });

    try {
      // Get action handler
      const handler = this.actionFactory.getHandler(action.type);
      context.currentStepOrder = action.order;

      // Execute action with retry logic
      let output: any;
      let retryCount = step.retryCount || 0;
      const retryConfig = action.retryConfig as { attempts: number; backoff: { type: string; delay: number } } | null;
      const maxAttempts = retryConfig?.attempts || 3;

      while (retryCount < maxAttempts) {
        try {
          output = await handler.execute(context, action.config as Record<string, any>);
          break; // Success, exit retry loop
        } catch (error: any) {
          retryCount++;
          if (retryCount >= maxAttempts) {
            throw error; // Max retries reached, throw error
          }

          // Wait before retry (exponential backoff)
          const delay = retryConfig?.backoff?.delay || 1000;
          const backoffDelay = retryConfig?.backoff?.type === 'exponential'
            ? delay * Math.pow(2, retryCount - 1)
            : delay;

          this.logger.warn(`Action ${actionId} failed (attempt ${retryCount}/${maxAttempts}), retrying in ${backoffDelay}ms`);
          await this.executionRepository.updateExecutionStep(step.id, {
            status: ExecutionStepStatus.PENDING,
            retryCount,
            error: error instanceof Error ? error.message : String(error),
          });

          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      }

      // Store step result
      context.stepResults[actionId] = output;

      // Update step status to completed
      await this.executionRepository.updateExecutionStep(step.id, {
        status: ExecutionStepStatus.COMPLETED,
        output,
        completedAt: new Date(),
        retryCount,
      });

      // Handle action-specific logic
      if (action.type === 'conditional') {
        // Conditional action - branch based on result
        await this.handleConditionalAction(action, output, actionMap, context, executionId);
      } else if (action.type === 'parallel') {
        // Parallel action - execute sub-actions in parallel
        await this.handleParallelAction(action, output, actionMap, context, executionId);
      } else if (action.type === 'loop') {
        // Loop action - iterate over items
        await this.handleLoopAction(action, output, actionMap, context, executionId);
      } else {
        // Sequential action - execute next action if exists
        if (action.nextActionId) {
          await this.executeActionNode(action.nextActionId, actionMap, context, executionId);
        }
      }
    } catch (error: any) {
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

      throw error;
    }
  }

  /**
   * Handle conditional action execution
   */
  private async handleConditionalAction(
    action: any,
    output: any,
    actionMap: Map<number, any>,
    context: ExecutionContext,
    executionId: number,
  ): Promise<void> {
    const nextActionId = output.nextActionId;
    if (nextActionId) {
      const nextAction = actionMap.get(nextActionId);
      if (nextAction) {
        await this.executeActionNode(nextActionId, actionMap, context, executionId);
      }
    }
  }

  /**
   * Handle parallel action execution
   */
  private async handleParallelAction(
    action: any,
    output: any,
    actionMap: Map<number, any>,
    context: ExecutionContext,
    executionId: number,
  ): Promise<void> {
    const parallelActionIds = output.actionIds || output.parallelActionIds || [];
    if (parallelActionIds.length > 0) {
      await this.executeActionsParallel(parallelActionIds, actionMap, context, executionId, output.stopOnFirstFailure);
    }
  }

  /**
   * Handle loop action execution
   */
  private async handleLoopAction(
    action: any,
    output: any,
    actionMap: Map<number, any>,
    context: ExecutionContext,
    executionId: number,
  ): Promise<void> {
    const { items, itemVariable, loopActionId } = output;

    if (!items || !Array.isArray(items) || items.length === 0) {
      this.logger.warn(`Loop action ${action.id} has no items to iterate`);
      return;
    }

    if (!loopActionId) {
      this.logger.warn(`Loop action ${action.id} has no loopActionId`);
      return;
    }

    const loopAction = actionMap.get(loopActionId);
    if (!loopAction) {
      throw new ExecutionException(`Loop action ${action.id} references non-existent action ${loopActionId}`, executionId);
    }

    // Execute loop body for each item
    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      // Update loop context
      context.loopContext = {
        item,
        index,
        itemVariable: itemVariable || 'item',
        parentActionId: action.id,
      };

      // Execute loop body action
      await this.executeActionNode(loopActionId, actionMap, context, executionId);

      // Clear loop context after iteration
      delete context.loopContext;
    }
  }

  /**
   * Execute multiple actions in parallel
   */
  private async executeActionsParallel(
    actionIds: number[],
    actionMap: Map<number, any>,
    context: ExecutionContext,
    executionId: number,
    stopOnFirstFailure = false,
  ): Promise<void> {
    const promises = actionIds.map(async (actionId) => {
      try {
        await this.executeActionNode(actionId, actionMap, context, executionId);
        return { actionId, success: true };
      } catch (error: any) {
        if (stopOnFirstFailure) {
          throw error;
        }
        this.logger.error(`Parallel action ${actionId} failed: ${error.message}`);
        return { actionId, success: false, error };
      }
    });

    await Promise.all(promises);
  }

  /**
   * Find or create execution step
   */
  private async findOrCreateExecutionStep(
    executionId: number,
    actionId: number,
    order: number,
    context: ExecutionContext,
  ): Promise<any> {
    // Try to find existing step
    const execution = await this.executionRepository.findById(executionId);
    const existingStep = execution.executionSteps.find((step) => step.actionId === actionId);

    if (existingStep) {
      return existingStep;
    }

    // Create new step
    return this.executionRepository.createExecutionStep({
      executionId,
      actionId,
      order,
      status: ExecutionStepStatus.PENDING,
      input: context.triggerData,
    });
  }
}

