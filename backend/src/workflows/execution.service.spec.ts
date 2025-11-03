import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionService } from './execution.service';
import { ExecutionRepository } from './repositories/execution.repository';
import { ActionRegistry } from './actions/action.registry';
import { ActionFactory } from './actions/action.factory';

describe('ExecutionService', () => {
  let service: ExecutionService;
  let executionRepository: jest.Mocked<ExecutionRepository>;
  let actionRegistry: jest.Mocked<ActionRegistry>;

  beforeEach(async () => {
    const mockExecutionRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 1,
        workflowId: 1,
        userId: 1,
        status: 'pending',
        executionSteps: [],
      }),
      findByWorkflowId: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      createExecutionStep: jest.fn(),
      updateExecutionStep: jest.fn(),
    };

    const mockActionRegistry = {
      getHandler: jest.fn(),
    };

    const mockActionFactory = {
      createAction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionService,
        {
          provide: ExecutionRepository,
          useValue: mockExecutionRepository,
        },
        {
          provide: ActionRegistry,
          useValue: mockActionRegistry,
        },
        {
          provide: ActionFactory,
          useValue: mockActionFactory,
        },
      ],
    }).compile();

    service = module.get<ExecutionService>(ExecutionService);
    executionRepository = module.get(ExecutionRepository);
    actionRegistry = module.get(ActionRegistry);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return an execution by id', async () => {
      const executionId = 1;
      const userId = 1;
      const mockExecution = {
        id: executionId,
        userId,
        workflowId: 1,
        status: 'pending' as any,
      };

      executionRepository.findById.mockResolvedValue(mockExecution as any);

      const result = await service.findById(executionId, userId);

      expect(executionRepository.findById).toHaveBeenCalledWith(executionId);
      expect(result).toEqual(mockExecution);
    });

    it('should throw error if execution not found', async () => {
      executionRepository.findById.mockResolvedValue(null);

      await expect(service.findById(1, 1)).rejects.toThrow();
    });

    it('should throw error if execution belongs to different user', async () => {
      const mockExecution = {
        id: 1,
        userId: 2,
        workflowId: 1,
      };

      executionRepository.findById.mockResolvedValue(mockExecution as any);

      await expect(service.findById(1, 1)).rejects.toThrow();
    });
  });

  describe('execute', () => {
    it('should execute a workflow and all its actions', async () => {
      const executionId = 1;
      const mockExecution = {
        id: executionId,
        workflowId: 1,
        userId: 1,
        status: 'pending' as any,
        triggerData: { test: 'data' },
        workflow: {
          id: 1,
          actions: [
            {
              id: 1,
              type: 'example_action',
              name: 'Test Action',
              config: {},
              order: 0,
            },
          ],
        },
      };

      const mockHandler = {
        type: 'example_action',
        name: 'Test Action',
        execute: jest.fn().mockResolvedValue({ result: 'success' }),
      };

      executionRepository.findById.mockResolvedValue(mockExecution as any);
      executionRepository.update.mockResolvedValue(mockExecution as any);
      executionRepository.createExecutionStep.mockResolvedValue({
        id: 1,
        executionId,
        actionId: 1,
        order: 0,
        status: 'pending' as any,
      } as any);
      executionRepository.updateExecutionStep.mockResolvedValue({
        id: 1,
        status: 'completed',
      } as any);
      actionRegistry.getHandler.mockReturnValue(mockHandler);

      await service.execute(executionId);

      expect(executionRepository.findById).toHaveBeenCalledWith(executionId);
      expect(executionRepository.update).toHaveBeenCalledWith(executionId, {
        status: 'running' as any,
        startedAt: expect.any(Date),
      });
      expect(mockHandler.execute).toHaveBeenCalled();
      expect(executionRepository.update).toHaveBeenCalledWith(executionId, {
        status: 'completed' as any,
        result: { 1: { result: 'success' } },
        completedAt: expect.any(Date),
      });
    });

    it('should handle action failures and retry', async () => {
      const executionId = 1;
      const mockExecution = {
        id: executionId,
        workflowId: 1,
        userId: 1,
        status: 'pending' as any,
        triggerData: {},
        workflow: {
          id: 1,
          actions: [
            {
              id: 1,
              type: 'example_action',
              name: 'Test Action',
              config: {},
              order: 0,
              retryConfig: {
                attempts: 2,
                backoff: { type: 'fixed', delay: 100 },
              },
            },
          ],
        },
      };

      const mockHandler = {
        type: 'example_action',
        name: 'Test Action',
        execute: jest.fn()
          .mockRejectedValueOnce(new Error('First failure'))
          .mockResolvedValue({ result: 'success' }),
      };

      executionRepository.findById.mockResolvedValue(mockExecution as any);
      executionRepository.update.mockResolvedValue(mockExecution as any);
      executionRepository.createExecutionStep.mockResolvedValue({
        id: 1,
        executionId,
        actionId: 1,
        order: 0,
        status: 'pending' as any,
        retryCount: 0,
      } as any);
      actionRegistry.getHandler.mockReturnValue(mockHandler);

      await service.execute(executionId);

      // Should retry on first failure
      expect(mockHandler.execute).toHaveBeenCalledTimes(2);
    });
  });
});

