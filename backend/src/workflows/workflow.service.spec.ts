import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowService } from './workflow.service';
import { WorkflowRepository } from './repositories/workflow.repository';
import { ExecutionRepository } from './repositories/execution.repository';
import { TriggerRegistry } from './triggers/trigger.registry';
import { ActionRegistry } from './actions/action.registry';
import { Queue } from 'bullmq';
import { getRedisConnectionObject } from '../queues/queue.config';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let workflowRepository: jest.Mocked<WorkflowRepository>;
  let executionRepository: jest.Mocked<ExecutionRepository>;
  let triggerRegistry: jest.Mocked<TriggerRegistry>;
  let actionRegistry: jest.Mocked<ActionRegistry>;
  let workflowQueue: Queue;

  beforeEach(async () => {
    workflowQueue = new Queue('workflow-execution', {
      connection: getRedisConnectionObject(),
    });

    const mockWorkflowRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockExecutionRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByWorkflowId: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      createExecutionStep: jest.fn(),
      updateExecutionStep: jest.fn(),
    };

    const mockTriggerRegistry = {
      register: jest.fn(),
      unregister: jest.fn(),
    };

    const mockActionRegistry = {
      getHandler: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        {
          provide: WorkflowRepository,
          useValue: mockWorkflowRepository,
        },
        {
          provide: ExecutionRepository,
          useValue: mockExecutionRepository,
        },
        {
          provide: TriggerRegistry,
          useValue: mockTriggerRegistry,
        },
        {
          provide: ActionRegistry,
          useValue: mockActionRegistry,
        },
        {
          provide: 'WORKFLOW_QUEUE',
          useValue: workflowQueue,
        },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
    workflowRepository = module.get(WorkflowRepository);
    executionRepository = module.get(ExecutionRepository);
    triggerRegistry = module.get(TriggerRegistry);
    actionRegistry = module.get(ActionRegistry);
  });

  afterEach(async () => {
    await workflowQueue.close();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a workflow with trigger and actions', async () => {
      const userId = 1;
      const createDto = {
        name: 'Test Workflow',
        description: 'Test Description',
        enabled: true,
        trigger: {
          type: 'manual' as any,
          config: {},
        },
        actions: [
          {
            type: 'test_action',
            name: 'Test Action',
            config: {},
            order: 0,
            retryConfig: undefined,
          },
        ],
      };

      const mockWorkflow = {
        id: 1,
        userId,
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
        trigger: {
          id: 1,
          workflowId: 1,
          type: 'manual',
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        actions: createDto.actions.map((action, index) => ({
          id: index + 1,
          workflowId: 1,
          ...action,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      };

      workflowRepository.create.mockResolvedValue(mockWorkflow as any);
      triggerRegistry.register.mockResolvedValue(undefined);

      const result = await service.create(userId, createDto);

      expect(workflowRepository.create).toHaveBeenCalledWith({
        userId,
        name: createDto.name,
        description: createDto.description,
        enabled: createDto.enabled,
        trigger: {
          type: createDto.trigger.type,
          config: createDto.trigger.config,
        },
        actions: createDto.actions.map((action) => ({
          type: action.type,
          name: action.name,
          config: action.config,
          order: action.order,
          retryConfig: (action as any).retryConfig ? {
            attempts: 3,
            backoff: {
              type: (action as any).retryConfig.type,
              delay: (action as any).retryConfig.delay,
            },
          } : undefined,
        })),
      });

      expect(triggerRegistry.register).toHaveBeenCalledWith(
        mockWorkflow.id,
        createDto.trigger.type,
        createDto.trigger.config,
      );

      expect(result).toEqual(mockWorkflow);
    });
  });

  describe('findById', () => {
    it('should return a workflow by id', async () => {
      const workflowId = 1;
      const userId = 1;
      const mockWorkflow = {
        id: workflowId,
        userId,
        name: 'Test Workflow',
        enabled: true,
      };

      workflowRepository.findById.mockResolvedValue(mockWorkflow as any);

      const result = await service.findById(workflowId, userId);

      expect(workflowRepository.findById).toHaveBeenCalledWith(workflowId);
      expect(result).toEqual(mockWorkflow);
    });

    it('should throw error if workflow not found', async () => {
      workflowRepository.findById.mockResolvedValue(null);

      await expect(service.findById(1, 1)).rejects.toThrow();
    });

    it('should throw error if workflow belongs to different user', async () => {
      const mockWorkflow = {
        id: 1,
        userId: 2,
        name: 'Test Workflow',
      };

      workflowRepository.findById.mockResolvedValue(mockWorkflow as any);

      await expect(service.findById(1, 1)).rejects.toThrow();
    });
  });

  describe('findByUserId', () => {
    it('should return workflows for a user', async () => {
      const userId = 1;
      const mockWorkflows = [
        {
          id: 1,
          userId,
          name: 'Workflow 1',
        },
        {
          id: 2,
          userId,
          name: 'Workflow 2',
        },
      ];

      workflowRepository.findByUserId.mockResolvedValue(mockWorkflows as any);

      const result = await service.findByUserId(userId);

      expect(workflowRepository.findByUserId).toHaveBeenCalledWith(userId, {});
      expect(result).toEqual(mockWorkflows);
    });
  });

  describe('trigger', () => {
    it('should create an execution and queue it for processing', async () => {
      const workflowId = 1;
      const userId = 1;
      const triggerData = { test: 'data' };

      const mockWorkflow = {
        id: workflowId,
        userId,
        enabled: true,
        actions: [],
      };

      const mockExecution = {
        id: 1,
        workflowId,
        userId,
        status: 'pending' as any,
        triggerData,
      };

      workflowRepository.findById.mockResolvedValue(mockWorkflow as any);
      executionRepository.create.mockResolvedValue(mockExecution as any);

      const result = await service.trigger(workflowId, userId, triggerData);

      expect(workflowRepository.findById).toHaveBeenCalledWith(workflowId);
      expect(executionRepository.create).toHaveBeenCalledWith({
        workflowId,
        userId,
        status: 'pending',
        triggerData,
      });

      expect(result).toEqual(mockExecution);
    });

    it('should throw error if workflow not found', async () => {
      workflowRepository.findById.mockResolvedValue(null);

      await expect(service.trigger(1, 1, {})).rejects.toThrow();
    });

    it('should throw error if workflow is disabled', async () => {
      const mockWorkflow = {
        id: 1,
        userId: 1,
        enabled: false,
        status: 'pending' as any,
      };

      workflowRepository.findById.mockResolvedValue(mockWorkflow as any);

      await expect(service.trigger(1, 1, {})).rejects.toThrow();
    });
  });
});

