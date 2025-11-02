import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { ExecutionService } from './execution.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('WorkflowController', () => {
  let controller: WorkflowController;
  let workflowService: jest.Mocked<WorkflowService>;
  let executionService: jest.Mocked<ExecutionService>;

  beforeEach(async () => {
    const mockWorkflowService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      trigger: jest.fn(),
    };

    const mockExecutionService = {
      findById: jest.fn(),
      findByWorkflowId: jest.fn(),
      findByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowController],
      providers: [
        {
          provide: WorkflowService,
          useValue: mockWorkflowService,
        },
        {
          provide: ExecutionService,
          useValue: mockExecutionService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WorkflowController>(WorkflowController);
    workflowService = module.get(WorkflowService);
    executionService = module.get(ExecutionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a workflow', async () => {
      const userId = 1;
      const createDto = {
        name: 'Test Workflow',
        trigger: { type: 'manual' as any, config: {} },
        actions: [],
      };

      const mockWorkflow = {
        id: 1,
        userId,
        ...createDto,
      };

      workflowService.create.mockResolvedValue(mockWorkflow as any);

      const result = await controller.create(userId, createDto);

      expect(workflowService.create).toHaveBeenCalledWith(userId, createDto);
      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return all workflows for a user', async () => {
      const userId = 1;
      const mockWorkflows = [
        { id: 1, userId, name: 'Workflow 1' },
        { id: 2, userId, name: 'Workflow 2' },
      ];

      workflowService.findByUserId.mockResolvedValue(mockWorkflows as any);

      const result = await controller.findAll(userId);

      expect(workflowService.findByUserId).toHaveBeenCalledWith(userId, {});
      expect(result).toBeDefined();
    });
  });

  describe('trigger', () => {
    it('should trigger a workflow', async () => {
      const userId = 1;
      const workflowId = 1;
      const triggerDto = { triggerData: { test: 'data' } };

      const mockExecution = {
        id: 1,
        workflowId,
        userId,
        status: 'pending',
      };

      workflowService.trigger.mockResolvedValue(mockExecution as any);

      const result = await controller.trigger(userId, workflowId, triggerDto);

      expect(workflowService.trigger).toHaveBeenCalledWith(
        workflowId,
        userId,
        triggerDto.triggerData,
      );
      expect(result).toBeDefined();
    });
  });
});

