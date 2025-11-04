import { Injectable, Inject, Logger } from '@nestjs/common';
import { NotFoundException, BadRequestException, WorkflowException } from '../common/exceptions/custom-exceptions';
import { WorkflowRepository } from './repositories/workflow.repository';
import { ExecutionRepository } from './repositories/execution.repository';
import { WorkflowRelationshipHelper } from './repositories/workflow.relationship.helper';
import { PrismaService } from '../database/prisma.service';
import { TriggerRegistry } from './triggers/trigger.registry';
import { ActionRegistry } from './actions/action.registry';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowStatus, TriggerType } from './interfaces/workflow.interface';
import { PubSubService } from './services/pubsub.service';
import { Queue } from 'bullmq';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly workflowRepository: WorkflowRepository,
    private readonly executionRepository: ExecutionRepository,
    private readonly relationshipHelper: WorkflowRelationshipHelper,
    private readonly triggerRegistry: TriggerRegistry,
    private readonly actionRegistry: ActionRegistry,
    private readonly prisma: PrismaService,
    @Inject('WORKFLOW_QUEUE') private readonly workflowQueue: Queue,
    private readonly pubSubService: PubSubService,
  ) {}

  async create(userId: number, createDto: CreateWorkflowDto) {
    this.logger.log(`Creating workflow "${createDto.name}" for user ${userId}`);
    this.logger.debug(`Workflow DTO: ${JSON.stringify({ name: createDto.name, actionCount: createDto.actions.length, triggerType: createDto.trigger.type })}`);

    // Validate that all action types are registered
    for (const action of createDto.actions) {
      const handler = this.actionRegistry.getHandler(action.type);
      if (!handler) {
        this.logger.error(`Action type "${action.type}" is not registered. Available types: ${this.actionRegistry.getRegisteredTypes().join(', ')}`);
        throw new BadRequestException(
          `Action type "${action.type}" is not registered. Available types: ${this.actionRegistry.getRegisteredTypes().join(', ')}`,
        );
      }
    }

    this.logger.debug(`All ${createDto.actions.length} actions validated`);

    // Validate Pub/Sub topic for Gmail triggers before saving to database
    if (createDto.trigger.type === TriggerType.GOOGLE_MAIL) {
      await this.validatePubSubTopicForGmailTrigger(userId, createDto.trigger.config);
    }

    // Create workflow with trigger and actions
    this.logger.debug(`Creating workflow in database with ${createDto.actions.length} actions`);
    const workflow = await this.workflowRepository.create({
      userId,
      name: createDto.name,
      description: createDto.description,
      enabled: createDto.enabled ?? true,
      trigger: {
        type: createDto.trigger.type,
        config: createDto.trigger.config,
        positionX: createDto.trigger.positionX,
        positionY: createDto.trigger.positionY,
      },
      actions: createDto.actions.map((action) => ({
        type: action.type,
        name: action.name,
        config: action.config,
        order: action.order,
        positionX: action.positionX,
        positionY: action.positionY,
        retryConfig: action.retryConfig ? {
          attempts: action.retryConfig.delay > 0 ? 3 : 1,
          backoff: {
            type: action.retryConfig.type,
            delay: action.retryConfig.delay,
          },
        } : undefined,
      })),
    });

    this.logger.log(`Workflow created with ID ${workflow.id}, setting up relationships for ${(workflow as any).actions?.length || 0} actions`);

    // Build and set up action relationships
    const actionRelationships = new Map<number, { nextActionId?: number; parentActionId?: number }>();
    
    // Map order indices to actual action IDs
    const orderToActionId = new Map<number, number>();
    (workflow as any).actions.forEach((action: any, index: number) => {
      orderToActionId.set(index, action.id);
      this.logger.debug(`Mapped action order ${index} -> action ID ${action.id} (${action.type}: ${action.name})`);
    });

    // Process each action to build relationships
    createDto.actions.forEach((action, index) => {
      const actionId = orderToActionId.get(index);
      if (!actionId) return;

      const relationships: { nextActionId?: number; parentActionId?: number } = {};

      // Handle parallel action: set parentActionId for child actions
      if (action.type === 'parallel' && action.config?.actionIds) {
        const childOrderIndices = action.config.actionIds as number[];
        this.logger.debug(`Processing parallel action ${actionId} with child order indices: [${childOrderIndices.join(', ')}]`);
        
        const childActionIds = childOrderIndices
          .map((orderIdx) => orderToActionId.get(orderIdx))
          .filter((id): id is number => id !== undefined);
        
        this.logger.debug(`Parallel action ${actionId} mapped to child action IDs: [${childActionIds.join(', ')}]`);
        
        // Set parentActionId for each child action
        childActionIds.forEach((childActionId) => {
          const childRelations = actionRelationships.get(childActionId) || {};
          childRelations.parentActionId = actionId;
          actionRelationships.set(childActionId, childRelations);
          this.logger.debug(`Set parentActionId=${actionId} for child action ${childActionId}`);
        });
      }

      // Handle conditional action: relationships are in config (trueActionId, falseActionId)
      // These are handled by the execution service, not stored as parentActionId

      // Handle loop action: set parentActionId for loop body action
      if (action.type === 'loop' && action.config?.loopActionId !== undefined) {
        const loopBodyOrderIdx = action.config.loopActionId as number;
        const loopBodyActionId = orderToActionId.get(loopBodyOrderIdx);
        if (loopBodyActionId) {
          this.logger.debug(`Loop action ${actionId} has loop body at order ${loopBodyOrderIdx} -> action ID ${loopBodyActionId}`);
          const loopBodyRelations = actionRelationships.get(loopBodyActionId) || {};
          loopBodyRelations.parentActionId = actionId;
          actionRelationships.set(loopBodyActionId, loopBodyRelations);
        }
      }

      // Handle sequential flow: use nextActionOrder from frontend if provided
      if (action.nextActionOrder !== undefined) {
        const nextOrderIdx = action.nextActionOrder;
        const nextActionId = orderToActionId.get(nextOrderIdx);
        if (nextActionId) {
          relationships.nextActionId = nextActionId;
          this.logger.debug(`Sequential flow (from frontend): action ${actionId} -> nextActionId ${nextActionId} (order ${nextOrderIdx})`);
        }
      } else {
        // Fallback: infer sequential flow from order (action at index N connects to index N+1)
        // But only if it's not parallel/conditional/loop and has no config overrides
        if (index < createDto.actions.length - 1) {
          const nextAction = createDto.actions[index + 1];
          // Only set nextActionId if next action doesn't have a parent already
          // and current action isn't special type
          if (
            action.type !== 'parallel' &&
            action.type !== 'conditional' &&
            action.type !== 'loop' &&
            !action.config?.actionIds &&
            !action.config?.loopActionId &&
            !action.config?.trueActionId &&
            !action.config?.falseActionId &&
            action.parentActionOrder === undefined // Don't infer if this is a child action
          ) {
            const nextActionId = orderToActionId.get(index + 1);
            if (nextActionId) {
              relationships.nextActionId = nextActionId;
              this.logger.debug(`Sequential flow (inferred): action ${actionId} -> nextActionId ${nextActionId}`);
            }
          }
        }
      }

      // Handle parent-child relationships: use parentActionOrder from frontend if provided
      if (action.parentActionOrder !== undefined) {
        const parentOrderIdx = action.parentActionOrder;
        const parentActionId = orderToActionId.get(parentOrderIdx);
        if (parentActionId) {
          relationships.parentActionId = parentActionId;
          this.logger.debug(`Parent-child (from frontend): action ${actionId} -> parentActionId ${parentActionId} (order ${parentOrderIdx})`);
        }
      }

      if (Object.keys(relationships).length > 0) {
        actionRelationships.set(actionId, relationships);
        this.logger.debug(`Relationships for action ${actionId}: ${JSON.stringify(relationships)}`);
      }
    });

    this.logger.log(`Built ${actionRelationships.size} action relationships`);

    // Handle parallel action config updates (need to be done before relationship updates)
    for (const action of createDto.actions) {
      if (action.type === 'parallel' && action.config?.actionIds) {
        const actionIndex = createDto.actions.indexOf(action);
        const actionId = orderToActionId.get(actionIndex);
        if (actionId) {
          const childOrderIndices = action.config.actionIds as number[];
          const childActionIds = childOrderIndices
            .map((orderIdx) => orderToActionId.get(orderIdx))
            .filter((id): id is number => id !== undefined);
          
          this.logger.log(`Updating parallel action ${actionId} config: replacing order indices [${childOrderIndices.join(', ')}] with action IDs [${childActionIds.join(', ')}]`);
          
          // Update parallel action config with real action IDs (not order indices)
          await this.prisma.action.update({
            where: { id: actionId },
            data: {
              config: {
                ...action.config,
                actionIds: childActionIds, // Replace order indices with real action IDs
              },
            },
          });
          
          this.logger.debug(`Parallel action ${actionId} config updated successfully`);
        }
      }
    }

    // Update action relationships in database
    if (actionRelationships.size > 0) {
      this.logger.log(`Updating ${actionRelationships.size} action relationships in database`);
      await this.relationshipHelper.updateActionRelationships(workflow.id, actionRelationships);
      this.logger.debug(`Action relationships updated successfully`);
    } else {
      this.logger.warn(`No action relationships to update`);
    }

    // Reload workflow with relationships
    this.logger.debug(`Reloading workflow ${workflow.id} with relationships`);
    const workflowWithRelations = await this.workflowRepository.findById(workflow.id);
    if (!workflowWithRelations) {
      this.logger.error(`Failed to reload workflow ${workflow.id} after creating relationships`);
      throw new WorkflowException('Failed to reload workflow after creating relationships');
    }

    this.logger.debug(`Workflow reloaded: ${(workflowWithRelations as any).actions?.length || 0} actions with relationships`);

    // Register trigger if workflow is enabled
    if (workflow.enabled) {
      this.logger.log(`Registering trigger for workflow ${workflow.id} (type: ${createDto.trigger.type})`);
      await this.triggerRegistry.register(
        workflow.id,
        createDto.trigger.type,
        createDto.trigger.config,
      );
      this.logger.debug(`Trigger registered successfully`);
    } else {
      this.logger.debug(`Workflow ${workflow.id} is disabled, skipping trigger registration`);
    }

    this.logger.log(`Workflow "${createDto.name}" created successfully with ID ${workflowWithRelations.id}`);
    return workflowWithRelations;
  }

  /**
   * Validate Pub/Sub topic creation for Gmail triggers
   * Ensures topic can be created before saving workflow to database
   */
  private async validatePubSubTopicForGmailTrigger(userId: number, config: any): Promise<void> {
    if (!this.pubSubService.isAvailable()) {
      throw new BadRequestException(
        'Pub/Sub service is not available. Please set GOOGLE_PROJECT_NAME (or GCP_PROJECT_ID) and GOOGLE_APPLICATION_CREDENTIALS environment variables.'
      );
    }

    try {
      this.logger.log(`[WorkflowService] Validating Pub/Sub topic creation for user ${userId}`);
      
      // Attempt to create or verify topic exists
      const topicPath = await this.pubSubService.createTopic(userId);
      
      this.logger.log(`[WorkflowService] ✅ Pub/Sub topic validated successfully: ${topicPath}`);
    } catch (error: any) {
      this.logger.error(`[WorkflowService] Failed to validate Pub/Sub topic for user ${userId}: ${error.message}`);
      throw new BadRequestException(
        `Failed to validate Pub/Sub topic: ${error.message}. Please ensure Google Cloud Pub/Sub is properly configured.`
      );
    }
  }

  async findById(id: number, userId: number) {
    this.logger.debug(`Finding workflow ${id} for user ${userId}`);
    const workflow = await this.workflowRepository.findById(id);

    if (!workflow) {
      this.logger.warn(`Workflow ${id} not found`);
      throw new NotFoundException('Workflow', id);
    }

    if (workflow.userId !== userId) {
      this.logger.warn(`User ${userId} attempted to access workflow ${id} owned by user ${workflow.userId}`);
      throw new NotFoundException('Workflow', id);
    }

    this.logger.debug(`Workflow ${id} found with ${(workflow as any).actions?.length || 0} actions`);
    return workflow;
  }

  async findByUserId(userId: number, options?: { enabled?: boolean }) {
    this.logger.debug(`Finding workflows for user ${userId}${options?.enabled !== undefined ? ` (enabled: ${options.enabled})` : ''}`);
    const workflows = await this.workflowRepository.findByUserId(userId, options);
    this.logger.debug(`Found ${workflows.length} workflows for user ${userId}`);
    return workflows;
  }

  async update(id: number, userId: number, data: UpdateWorkflowDto) {
    this.logger.log(`Updating workflow ${id} for user ${userId}`);
    this.logger.debug(`Update data: ${JSON.stringify({ ...data, actions: data.actions ? `${data.actions.length} actions` : undefined })}`);
    
    const workflow = await this.findById(id, userId);

    // Update trigger if provided
    if (data.trigger) {
      this.logger.log(`Updating trigger for workflow ${id}`);
      
      // Validate Pub/Sub topic for Gmail triggers before updating database
      if (data.trigger.type === TriggerType.GOOGLE_MAIL) {
        await this.validatePubSubTopicForGmailTrigger(userId, data.trigger.config);
      }
      
      await this.prisma.trigger.update({
        where: { workflowId: id },
        data: {
          type: data.trigger.type,
          config: data.trigger.config,
          positionX: data.trigger.positionX ?? undefined,
          positionY: data.trigger.positionY ?? undefined,
        } as any,
      });
      this.logger.debug(`Trigger updated for workflow ${id}`);
    }

    // Update actions if provided
    if (data.actions && data.actions.length > 0) {
      this.logger.log(`Updating ${data.actions.length} actions for workflow ${id}`);
      
      // Validate all action types
      for (const action of data.actions) {
        const handler = this.actionRegistry.getHandler(action.type);
        if (!handler) {
          this.logger.error(`Action type "${action.type}" is not registered`);
          throw new BadRequestException(
            `Action type "${action.type}" is not registered. Available types: ${this.actionRegistry.getRegisteredTypes().join(', ')}`,
          );
        }
      }

      // Delete existing actions (cascade will handle relationships)
      this.logger.debug(`Deleting existing actions for workflow ${id}`);
      await this.prisma.action.deleteMany({
        where: { workflowId: id },
      });

      // Create new actions
      this.logger.debug(`Creating ${data.actions.length} new actions for workflow ${id}`);
      const createdActions = await Promise.all(
        data.actions.map((action) =>
          this.prisma.action.create({
            data: {
              workflowId: id,
              type: action.type,
              name: action.name,
              config: action.config,
              order: action.order,
              positionX: action.positionX ?? undefined,
              positionY: action.positionY ?? undefined,
              retryConfig: action.retryConfig
                ? {
                    attempts: action.retryConfig.delay > 0 ? 3 : 1,
                    backoff: {
                      type: action.retryConfig.type,
                      delay: action.retryConfig.delay,
                    },
                  }
                : undefined,
            } as any,
          }),
        ),
      );

      this.logger.log(`Created ${createdActions.length} actions, setting up relationships`);

      // Build and set up action relationships (same logic as create)
      const actionRelationships = new Map<number, { nextActionId?: number; parentActionId?: number }>();
      
      // Map order indices to actual action IDs
      const orderToActionId = new Map<number, number>();
      createdActions.forEach((action, index) => {
        orderToActionId.set(index, action.id);
        this.logger.debug(`Mapped action order ${index} -> action ID ${action.id} (${action.type}: ${action.name})`);
      });

      // Process each action to build relationships
      data.actions.forEach((action, index) => {
        const actionId = orderToActionId.get(index);
        if (!actionId) return;

        const relationships: { nextActionId?: number; parentActionId?: number } = {};

        // Handle parallel action: set parentActionId for child actions
        if (action.type === 'parallel' && action.config?.actionIds) {
          const childOrderIndices = action.config.actionIds as number[];
          this.logger.debug(`Processing parallel action ${actionId} with child order indices: [${childOrderIndices.join(', ')}]`);
          
          const childActionIds = childOrderIndices
            .map((orderIdx) => orderToActionId.get(orderIdx))
            .filter((id): id is number => id !== undefined);
          
          this.logger.debug(`Parallel action ${actionId} mapped to child action IDs: [${childActionIds.join(', ')}]`);
          
          childActionIds.forEach((childActionId) => {
            const childRelations = actionRelationships.get(childActionId) || {};
            childRelations.parentActionId = actionId;
            actionRelationships.set(childActionId, childRelations);
            this.logger.debug(`Set parentActionId=${actionId} for child action ${childActionId}`);
          });
        }

        // Handle loop action: set parentActionId for loop body action
        if (action.type === 'loop' && action.config?.loopActionId !== undefined) {
          const loopBodyOrderIdx = action.config.loopActionId as number;
          const loopBodyActionId = orderToActionId.get(loopBodyOrderIdx);
          if (loopBodyActionId) {
            this.logger.debug(`Loop action ${actionId} has loop body at order ${loopBodyOrderIdx} -> action ID ${loopBodyActionId}`);
            const loopBodyRelations = actionRelationships.get(loopBodyActionId) || {};
            loopBodyRelations.parentActionId = actionId;
            actionRelationships.set(loopBodyActionId, loopBodyRelations);
          }
        }

        // Handle sequential flow: use nextActionOrder from frontend if provided
        if (action.nextActionOrder !== undefined) {
          const nextOrderIdx = action.nextActionOrder;
          const nextActionId = orderToActionId.get(nextOrderIdx);
          if (nextActionId) {
            relationships.nextActionId = nextActionId;
            this.logger.debug(`Sequential flow (from frontend): action ${actionId} -> nextActionId ${nextActionId} (order ${nextOrderIdx})`);
          }
        } else {
          // Fallback: infer sequential flow from order
          if (index < data.actions.length - 1) {
            const nextAction = data.actions[index + 1];
            if (
              action.type !== 'parallel' &&
              action.type !== 'conditional' &&
              action.type !== 'loop' &&
              !action.config?.actionIds &&
              !action.config?.loopActionId &&
              !action.config?.trueActionId &&
              !action.config?.falseActionId &&
              action.parentActionOrder === undefined
            ) {
              const nextActionId = orderToActionId.get(index + 1);
              if (nextActionId) {
                relationships.nextActionId = nextActionId;
                this.logger.debug(`Sequential flow (inferred): action ${actionId} -> nextActionId ${nextActionId}`);
              }
            }
          }
        }

        // Handle parent-child relationships: use parentActionOrder from frontend if provided
        if (action.parentActionOrder !== undefined) {
          const parentOrderIdx = action.parentActionOrder;
          const parentActionId = orderToActionId.get(parentOrderIdx);
          if (parentActionId) {
            relationships.parentActionId = parentActionId;
            this.logger.debug(`Parent-child (from frontend): action ${actionId} -> parentActionId ${parentActionId} (order ${parentOrderIdx})`);
          }
        }

        if (Object.keys(relationships).length > 0) {
          actionRelationships.set(actionId, relationships);
          this.logger.debug(`Relationships for action ${actionId}: ${JSON.stringify(relationships)}`);
        }
      });

      this.logger.log(`Built ${actionRelationships.size} action relationships`);

      // Handle parallel action config updates
      for (const action of data.actions) {
        if (action.type === 'parallel' && action.config?.actionIds) {
          const actionIndex = data.actions.indexOf(action);
          const actionId = orderToActionId.get(actionIndex);
          if (actionId) {
            const childOrderIndices = action.config.actionIds as number[];
            const childActionIds = childOrderIndices
              .map((orderIdx) => orderToActionId.get(orderIdx))
              .filter((id): id is number => id !== undefined);
            
            this.logger.log(`Updating parallel action ${actionId} config: replacing order indices [${childOrderIndices.join(', ')}] with action IDs [${childActionIds.join(', ')}]`);
            
            await this.prisma.action.update({
              where: { id: actionId },
              data: {
                config: {
                  ...action.config,
                  actionIds: childActionIds,
                },
              },
            });
            
            this.logger.debug(`Parallel action ${actionId} config updated successfully`);
          }
        }
      }

      // Update action relationships in database
      if (actionRelationships.size > 0) {
        this.logger.log(`Updating ${actionRelationships.size} action relationships in database`);
        await this.relationshipHelper.updateActionRelationships(id, actionRelationships);
        this.logger.debug(`Action relationships updated successfully`);
      }
    }

    // Update basic workflow properties
    const updateData: { name?: string; description?: string; enabled?: boolean } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    if (Object.keys(updateData).length > 0) {
      await this.workflowRepository.update(id, updateData);
      this.logger.debug(`Workflow ${id} basic properties updated in database`);
    }

    // Reload workflow to get updated data with relationships
    this.logger.debug(`Reloading workflow ${id} with relationships`);
    const updated = await this.workflowRepository.findById(id);
    if (!updated) {
      this.logger.error(`Failed to reload workflow ${id} after update`);
      throw new NotFoundException('Workflow', id);
    }

    // If enabled status changed, register/unregister trigger
    const wasEnabled = workflow.enabled;
    const isEnabled = data.enabled !== undefined ? data.enabled : workflow.enabled;
    const trigger = (updated as any).trigger;

    if (data.enabled !== undefined && isEnabled !== wasEnabled) {
      if (isEnabled && trigger) {
        this.logger.log(`Workflow ${id} enabled, registering trigger (type: ${trigger.type})`);
        await this.triggerRegistry.register(
          updated.id,
          trigger.type as any,
          trigger.config as Record<string, any>,
        );
        this.logger.debug(`Trigger registered for workflow ${id}`);
      } else {
        this.logger.log(`Workflow ${id} disabled, unregistering trigger`);
        await this.triggerRegistry.unregister(updated.id);
        this.logger.debug(`Trigger unregistered for workflow ${id}`);
      }
    } else if (data.trigger && workflow.enabled) {
      // If trigger was updated and workflow is enabled, re-register it
      this.logger.log(`Re-registering trigger for workflow ${id} (type: ${data.trigger.type})`);
      await this.triggerRegistry.unregister(updated.id);
      await this.triggerRegistry.register(updated.id, data.trigger.type, data.trigger.config);
      this.logger.debug(`Trigger re-registered for workflow ${id}`);
    }

    this.logger.log(`Workflow ${id} updated successfully`);
    return updated;
  }

  async delete(id: number, userId: number) {
    this.logger.log(`Deleting workflow ${id} for user ${userId}`);
    const workflow = await this.findById(id, userId);

    // Unregister trigger
    this.logger.debug(`Unregistering trigger for workflow ${id}`);
    await this.triggerRegistry.unregister(workflow.id);

    // Delete workflow
    this.logger.debug(`Deleting workflow ${id} from database`);
    await this.workflowRepository.delete(id);
    
    this.logger.log(`Workflow ${id} deleted successfully`);
  }

  async trigger(workflowId: number, userId: number, triggerData?: Record<string, any>) {
    this.logger.log(`Triggering workflow ${workflowId} for user ${userId}`);
    this.logger.debug(`Trigger data: ${JSON.stringify(triggerData || {})}`);
    
    const workflow = await this.workflowRepository.findById(workflowId);

    if (!workflow) {
      this.logger.error(`Workflow ${workflowId} not found`);
      throw new NotFoundException('Workflow', workflowId);
    }

    if (!workflow.enabled) {
      this.logger.warn(`Attempted to trigger disabled workflow ${workflowId}`);
      throw new WorkflowException(`Workflow ${workflowId} is disabled and cannot be executed`);
    }

    this.logger.debug(`Creating execution for workflow ${workflowId}`);
    // Create execution
    const execution = await this.executionRepository.create({
      workflowId,
      userId,
      status: WorkflowStatus.PENDING,
      triggerData: triggerData || {},
    });

    this.logger.log(`Execution ${execution.id} created for workflow ${workflowId}, queuing for processing`);

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

    this.logger.debug(`Execution ${execution.id} queued successfully`);
    return execution;
  }
}

