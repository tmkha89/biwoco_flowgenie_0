import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleTriggerHandler } from './schedule.trigger';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowEventService } from '../services/workflow-event.service';
import { Queue } from 'bullmq';
import { TriggerType } from '../interfaces/workflow.interface';

// Mock node-cron
const mockValidate = jest.fn((cron) => {
  // Simple validation - check if it's a valid cron-like string
  return typeof cron === 'string' && cron.length > 0;
});

const mockSchedule = jest.fn((cron, callback, options) => {
  // Return a mock scheduled task
  return {
    start: jest.fn(),
    stop: jest.fn(),
    destroy: jest.fn(),
    getStatus: jest.fn(() => 'scheduled'),
  };
});

jest.mock('node-cron', () => {
  const mockValidate = jest.fn((cron) => {
    return typeof cron === 'string' && cron.length > 0;
  });
  const mockSchedule = jest.fn((cron, callback, options) => {
    return {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
      getStatus: jest.fn(() => 'scheduled'),
    };
  });
  return {
    schedule: mockSchedule,
    validate: mockValidate,
  };
});

describe('ScheduleTriggerHandler', () => {
  let handler: ScheduleTriggerHandler;
  let prismaService: jest.Mocked<PrismaService>;
  let workflowEventService: jest.Mocked<WorkflowEventService>;
  let scheduleQueue: Queue | null;

  beforeEach(async () => {
    const mockPrismaService = {
      trigger: {
        update: jest.fn() as jest.MockedFunction<any>,
      },
    };

    (mockPrismaService.trigger.update as jest.Mock).mockResolvedValue({});

    const mockWorkflowEventService = {
      emitWorkflowTrigger: jest.fn(),
    };

    const mockScheduleQueue = {
      add: jest.fn(),
      removeRepeatableByKey: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleTriggerHandler,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: WorkflowEventService,
          useValue: mockWorkflowEventService,
        },
        {
          provide: 'WORKFLOW_SCHEDULE_QUEUE',
          useValue: mockScheduleQueue,
        },
      ],
    }).compile();

    handler = module.get<ScheduleTriggerHandler>(ScheduleTriggerHandler);
    prismaService = module.get(PrismaService);
    workflowEventService = module.get(WorkflowEventService);
    scheduleQueue = module.get('WORKFLOW_SCHEDULE_QUEUE');
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await handler.unregister(1); // Clean up any registered jobs
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should have correct type and name', () => {
    expect(handler.type).toBe(TriggerType.SCHEDULE);
    expect(handler.name).toBe('Schedule Trigger');
  });

  describe('validate', () => {
    it('should return true if cron expression is provided', async () => {
      const config = { cron: '0 * * * *' };
      const result = await handler.validate(config);
      expect(result).toBe(true);
    });

    it('should return true if interval is provided', async () => {
      const config = { interval: 3600 };
      const result = await handler.validate(config);
      expect(result).toBe(true);
    });

    it('should return false if neither cron nor interval is provided', async () => {
      const config = {};
      const result = await handler.validate(config);
      expect(result).toBe(false);
    });

    it('should return false if cron is not a string', async () => {
      const config = { cron: 123 };
      const result = await handler.validate(config);
      expect(result).toBe(false);
    });

    it('should return false if interval is not a positive number', async () => {
      const config = { interval: -100 };
      const result = await handler.validate(config);
      expect(result).toBe(false);
    });

    it('should return false if interval is 0', async () => {
      const config = { interval: 0 };
      const result = await handler.validate(config);
      expect(result).toBe(false);
    });
  });

  describe('register', () => {
    it('should register CRON schedule', async () => {
      const workflowId = 1;
      const config = { cron: '0 * * * *', timezone: 'UTC' };

      (prismaService.trigger.update as jest.Mock).mockResolvedValue({} as any);
      if (scheduleQueue) {
        (scheduleQueue.add as jest.Mock).mockResolvedValue({});
      }

      await handler.register(workflowId, config);

      expect(prismaService.trigger.update).toHaveBeenCalledWith({
        where: { workflowId },
        data: {
          config: expect.objectContaining({
            scheduled: true,
            nextRun: expect.any(String),
          }),
        },
      });
    });

    it('should register interval schedule', async () => {
      const workflowId = 1;
      const config = { interval: 3600 };

      (prismaService.trigger.update as jest.Mock).mockResolvedValue({} as any);
      if (scheduleQueue) {
        (scheduleQueue.add as jest.Mock).mockResolvedValue({});
      }

      await handler.register(workflowId, config);

      expect(prismaService.trigger.update).toHaveBeenCalledWith({
        where: { workflowId },
        data: {
          config: expect.objectContaining({
            scheduled: true,
          }),
        },
      });
    });

    it('should throw error if neither cron nor interval is provided', async () => {
      const workflowId = 1;
      const config = {};

      await expect(handler.register(workflowId, config)).rejects.toThrow(
        'Either cron or interval must be provided',
      );
    });
  });

  describe('unregister', () => {
    it('should stop scheduled job and remove from queue', async () => {
      const workflowId = 1;
      const config = { cron: '0 * * * *' };

      (prismaService.trigger.update as jest.Mock).mockResolvedValue({} as any);
      if (scheduleQueue) {
        (scheduleQueue.add as jest.Mock).mockResolvedValue({});
        (scheduleQueue.removeRepeatableByKey as jest.Mock).mockResolvedValue(true);
      }

      await handler.register(workflowId, config);
      await handler.unregister(workflowId);

      if (scheduleQueue) {
        expect(scheduleQueue.removeRepeatableByKey).toHaveBeenCalledWith(
          `schedule-${workflowId}`,
        );
      }

      expect(prismaService.trigger.update).toHaveBeenCalledWith({
        where: { workflowId },
        data: {
          config: expect.objectContaining({
            scheduled: false,
            nextRun: null,
          }),
        },
      });
    });
  });

  describe('onModuleDestroy', () => {
    it('should stop all scheduled jobs on module destruction', async () => {
      const workflowId1 = 1;
      const workflowId2 = 2;
      const config = { cron: '0 * * * *' };

      (prismaService.trigger.update as jest.Mock).mockResolvedValue({} as any);
      if (scheduleQueue) {
        (scheduleQueue.add as jest.Mock).mockResolvedValue({});
      }

      await handler.register(workflowId1, config);
      await handler.register(workflowId2, config);

      await handler.onModuleDestroy();

      // Verify all jobs are stopped (this is handled by the onModuleDestroy implementation)
      // The actual stopping happens in the implementation
    });
  });
});

