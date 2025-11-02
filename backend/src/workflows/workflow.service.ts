import { Injectable, Inject } from '@nestjs/common';
import { NotFoundException, BadRequestException, WorkflowException } from '../common/exceptions/custom-exceptions';
import { WorkflowRepository } from './repositories/workflow.repository';
import { ExecutionRepository } from './repositories/execution.repository';
import { TriggerRegistry } from './triggers/trigger.registry';
import { ActionRegistry } from './actions/action.registry';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { WorkflowStatus } from './interfaces/workflow.interface';
import { Queue } from 'bullmq';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly workflowRepository: WorkflowRepository,
    private readonly executionRepository: ExecutionRepository,
    private readonly triggerRegistry: TriggerRegistry,
    private readonly actionRegistry: ActionRegistry,
    @Inject('WORKFLOW_QUEUE') private readonly workflowQueue: Queue,
  ) {}

  async create(userId: number, createDto: CreateWorkflowDto) {
    // Validate that all action types are registered
    for (const action of createDto.actions) {
      const handler = this.actionRegistry.getHandler(action.type);
      if (!handler) {
        throw new BadRequestException(
          `Action type "${action.type}" is not registered. Available types: ${this.actionRegistry.getRegisteredTypes().join(', ')}`,
        );
      }
    }

    // Create workflow with trigger and actions
    const workflow = await this.workflowRepository.create({
      userId,
      name: createDto.name,
      description: createDto.description,
      enabled: createDto.enabled ?? true,
      trigger: {
        type: createDto.trigger.type,
        config: createDto.trigger.config,
      },
      actions: createDto.actions.map((action) => ({
        type: action.type,
        name: action.name,
        config: action.config,
        order: action.order,
        retryConfig: action.retryConfig ? {
          attempts: action.retryConfig.delay > 0 ? 3 : 1,
          backoff: {
            type: action.retryConfig.type,
            delay: action.retryConfig.delay,
          },
        } : undefined,
      })),
    });

    // Register trigger if workflow is enabled
    if (workflow.enabled) {
      await this.triggerRegistry.register(
        workflow.id,
        createDto.trigger.type,
        createDto.trigger.config,
      );
    }

    return workflow;
  }

  async findById(id: number, userId: number) {
    const workflow = await this.workflowRepository.findById(id);

    if (!workflow) {
      throw new NotFoundException('Workflow', id);
    }

    if (workflow.userId !== userId) {
      throw new NotFoundException('Workflow', id);
    }

    return workflow;
  }

  async findByUserId(userId: number, options?: { enabled?: boolean }) {
    return this.workflowRepository.findByUserId(userId, options);
  }

  async update(id: number, userId: number, data: {
    name?: string;
    description?: string;
    enabled?: boolean;
  }) {
    const workflow = await this.findById(id, userId);

    const updated = await this.workflowRepository.update(id, data);

    // If enabled status changed, register/unregister trigger
    if (data.enabled !== undefined && data.enabled !== workflow.enabled) {
      if (data.enabled && workflow.trigger) {
        await this.triggerRegistry.register(
          workflow.id,
          workflow.trigger.type as any,
          workflow.trigger.config as Record<string, any>,
        );
      } else {
        await this.triggerRegistry.unregister(workflow.id);
      }
    }

    return updated;
  }

  async delete(id: number, userId: number) {
    const workflow = await this.findById(id, userId);

    // Unregister trigger
    await this.triggerRegistry.unregister(workflow.id);

    // Delete workflow
    await this.workflowRepository.delete(id);
  }

  async trigger(workflowId: number, userId: number, triggerData?: Record<string, any>) {
    const workflow = await this.workflowRepository.findById(workflowId);

    if (!workflow) {
      throw new NotFoundException('Workflow', workflowId);
    }

    if (!workflow.enabled) {
      throw new WorkflowException(`Workflow ${workflowId} is disabled and cannot be executed`);
    }

    // Create execution
    const execution = await this.executionRepository.create({
      workflowId,
      userId,
      status: WorkflowStatus.PENDING,
      triggerData: triggerData || {},
    });

    // Queue execution for processing
    await this.workflowQueue.add(
      'execute-workflow',
      {
        executionId: execution.id,
        workflowId,
        userId,
        triggerData: triggerData || {},
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    return execution;
  }
}

