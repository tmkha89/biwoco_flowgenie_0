import { Test, TestingModule } from '@nestjs/testing';
import { WebhookTriggerHandler } from './webhook.trigger';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowEventService } from '../services/workflow-event.service';
import { TriggerType } from '../interfaces/workflow.interface';

describe('WebhookTriggerHandler', () => {
  let handler: WebhookTriggerHandler;
  let prismaService: jest.Mocked<PrismaService>;
  let workflowEventService: jest.Mocked<WorkflowEventService>;

  beforeEach(async () => {
    const mockPrismaService = {
      trigger: {
        update: jest.fn() as jest.MockedFunction<any>,
        findUnique: jest.fn() as jest.MockedFunction<any>,
        findMany: jest.fn() as jest.MockedFunction<any>,
      },
    };

    (mockPrismaService.trigger.update as jest.Mock).mockResolvedValue({});
    (mockPrismaService.trigger.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrismaService.trigger.findMany as jest.Mock).mockResolvedValue([]);

    const mockWorkflowEventService = {
      emitWorkflowTrigger: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookTriggerHandler,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: WorkflowEventService,
          useValue: mockWorkflowEventService,
        },
      ],
    }).compile();

    handler = module.get<WebhookTriggerHandler>(WebhookTriggerHandler);
    prismaService = module.get(PrismaService);
    workflowEventService = module.get(WorkflowEventService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should have correct type and name', () => {
    expect(handler.type).toBe(TriggerType.WEBHOOK);
    expect(handler.name).toBe('Webhook Trigger');
  });

  describe('validate', () => {
    it('should return true if path is provided', async () => {
      const config = { path: 'test-path' };
      const result = await handler.validate(config);
      expect(result).toBe(true);
    });

    it('should return false if path is not provided', async () => {
      const config = {};
      const result = await handler.validate(config);
      expect(result).toBe(false);
    });

    it('should return false if path is not a string', async () => {
      const config = { path: 123 };
      const result = await handler.validate(config);
      expect(result).toBe(false);
    });
  });

  describe('register', () => {
    it('should register webhook and update trigger config', async () => {
      const workflowId = 1;
      const config = { path: 'test-path', secret: 'test-secret' };

      (prismaService.trigger.update as jest.Mock).mockResolvedValue({} as any);

      await handler.register(workflowId, config);

      expect(prismaService.trigger.update).toHaveBeenCalledWith({
        where: { workflowId },
        data: {
          config: expect.objectContaining({
            webhookId: expect.any(String),
            webhookUrl: expect.stringContaining('/api/triggers/webhook/'),
          }),
        },
      });
    });

    it('should generate webhookId if not provided', async () => {
      const workflowId = 1;
      const config = { path: 'test-path' };

      (prismaService.trigger.update as jest.Mock).mockResolvedValue({} as any);

      await handler.register(workflowId, config);

      const updateCall = (prismaService.trigger.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.config.webhookId).toBeDefined();
    });
  });

  describe('unregister', () => {
    it('should remove webhook from memory', async () => {
      const workflowId = 1;
      const config = { path: 'test-path' };

      await handler.register(workflowId, config);
      await handler.unregister(workflowId);

      const path = handler.getWebhookPath(workflowId);
      expect(path).toBeUndefined();
    });
  });

  describe('handleWebhookRequest', () => {
    it('should trigger workflow when webhook is called', async () => {
      const webhookId = 'webhook-1';
      const payload = { data: 'test' };
      const headers = {};

      const mockTrigger = {
        workflowId: 1,
        config: {
          webhookId,
          secret: undefined,
        },
        workflow: {
          userId: 1,
          enabled: true,
        },
      };

      (prismaService.trigger.findMany as jest.Mock).mockResolvedValue([mockTrigger] as any);

      await handler.handleWebhookRequest(webhookId, payload, headers);

      expect(workflowEventService.emitWorkflowTrigger).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          triggerType: TriggerType.WEBHOOK,
          webhookId,
          payload,
        }),
      );
    });

    it('should validate secret if provided', async () => {
      const webhookId = 'webhook-1';
      const payload = { data: 'test' };
      const headers = { 'x-webhook-secret': 'wrong-secret' };

      const mockTrigger = {
        workflowId: 1,
        config: {
          webhookId,
          secret: 'correct-secret',
        },
        workflow: {
          userId: 1,
          enabled: true,
        },
      };

      (prismaService.trigger.findMany as jest.Mock).mockResolvedValue([mockTrigger] as any);

      await expect(
        handler.handleWebhookRequest(webhookId, payload, headers),
      ).rejects.toThrow('Invalid webhook secret');
    });

    it('should throw error if webhook not found', async () => {
      const webhookId = 'non-existent';
      (prismaService.trigger.findMany as jest.Mock).mockResolvedValue([] as any);

      await expect(
        handler.handleWebhookRequest(webhookId, {}, {}),
      ).rejects.toThrow('Webhook non-existent not found');
    });
  });

  describe('getWebhookUrl', () => {
    it('should return webhook URL from database config', async () => {
      const workflowId = 1;
      const mockTrigger = {
        config: {
          webhookId: 'test-webhook',
          webhookUrl: '/api/triggers/webhook/test-webhook',
        },
      };

      (prismaService.trigger.findUnique as jest.Mock).mockResolvedValue(mockTrigger as any);

      const url = await handler.getWebhookUrl(workflowId);

      expect(url).toBe('/api/triggers/webhook/test-webhook');
    });

    it('should return undefined if webhook not registered', async () => {
      const workflowId = 999;
      const url = await handler.getWebhookUrl(workflowId);
      expect(url).toBeUndefined();
    });
  });
});

