// @ts-nocheck
import { Test, TestingModule } from '@nestjs/testing';
import { GoogleMailTriggerHandler } from './google-mail.trigger';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WorkflowEventService } from '../services/workflow-event.service';
import { GmailService } from '../services/gmail.service';
import { PubSubService } from '../services/pubsub.service';
import { OAuthService } from '../../oauth/oauth.service';
import { GoogleOAuthService } from '../../auth/services/google-oauth.service';
import { TriggerType } from '../interfaces/workflow.interface';

// Mock the gmailEventQueue
jest.mock('../../queues/gmail-event.queue', () => ({
  gmailEventQueue: {
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
  },
}));

describe('GoogleMailTriggerHandler', () => {
  let handler: GoogleMailTriggerHandler;
  let prismaService: jest.Mocked<PrismaService>;
  let configService: jest.Mocked<ConfigService>;
  let workflowEventService: jest.Mocked<WorkflowEventService>;
  let gmailService: jest.Mocked<GmailService>;

  beforeEach(async () => {
    const mockPrismaService = {
      oAuthAccount: {
        findFirst: jest.fn() as jest.MockedFunction<any>,
      },
      trigger: {
        update: jest.fn() as jest.MockedFunction<any>,
        findUnique: jest.fn() as jest.MockedFunction<any>,
        findMany: jest.fn() as jest.MockedFunction<any>,
      },
    };

    (mockPrismaService.oAuthAccount.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrismaService.workflow.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrismaService.trigger.update as jest.Mock).mockResolvedValue({});
    (mockPrismaService.trigger.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrismaService.trigger.findMany as jest.Mock).mockResolvedValue([]);

    const mockConfigService = {
      get: jest.fn().mockReturnValue('http://localhost:3000/api/triggers/gmail/pubsub'),
    };

    const mockWorkflowEventService = {
      emitWorkflowTrigger: jest.fn(),
    };

    const mockGmailService = {
      createWatch: jest.fn(),
      stopWatch: jest.fn(),
      fetchNewMessages: jest.fn(),
    };

    const mockPubSubService = {
      isAvailable: jest.fn().mockReturnValue(false),
      getTopicPath: jest.fn(),
      getSubscriptionPath: jest.fn(),
      createTopic: jest.fn(),
      createSubscription: jest.fn(),
      checkGmailPushPermissions: jest.fn(),
    };

    const mockOAuthService = {
      findByUserIdAndProvider: jest.fn(),
      refreshGoogleTokens: jest.fn(),
    };

    const mockGoogleOAuthService = {
      refreshAccessToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleMailTriggerHandler,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: WorkflowEventService,
          useValue: mockWorkflowEventService,
        },
        {
          provide: GmailService,
          useValue: mockGmailService,
        },
        {
          provide: PubSubService,
          useValue: mockPubSubService,
        },
        {
          provide: OAuthService,
          useValue: mockOAuthService,
        },
        {
          provide: GoogleOAuthService,
          useValue: mockGoogleOAuthService,
        },
      ],
    }).compile();

    handler = module.get<GoogleMailTriggerHandler>(GoogleMailTriggerHandler);
    prismaService = module.get(PrismaService);
    configService = module.get(ConfigService);
    workflowEventService = module.get(WorkflowEventService);
    gmailService = module.get(GmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should have correct type and name', () => {
    expect(handler.type).toBe(TriggerType.GOOGLE_MAIL);
    expect(handler.name).toBe('Google-Mail Trigger');
  });

  describe('validate', () => {
    it('should return true if userId is provided', async () => {
      const config = { userId: 1 };
      const result = await handler.validate(config);
      expect(result).toBe(true);
    });

    it('should return false if userId is not provided', async () => {
      const config = {};
      const result = await handler.validate(config);
      expect(result).toBe(false);
    });

    it('should return false if userId is not a number', async () => {
      const config = { userId: 'not-a-number' };
      const result = await handler.validate(config);
      expect(result).toBe(false);
    });
  });

  describe('register', () => {
    it('should register Gmail watch and update trigger config', async () => {
      const workflowId = 1;
      const userId = 1;
      const config = { userId };

      const mockOAuthAccount = {
        userId: 1,
        provider: 'google',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      };

      const mockWatchResponse = {
        historyId: '12345',
        expiration: '1234567890000',
      };

      (prismaService.oAuthAccount.findFirst as jest.Mock).mockResolvedValue(mockOAuthAccount as any);
      gmailService.createWatch.mockResolvedValue(mockWatchResponse);
      (prismaService.trigger.update as jest.Mock).mockResolvedValue({} as any);

      await handler.register(workflowId, config);

      expect(prismaService.oAuthAccount.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          provider: 'google',
        },
      });

      expect(gmailService.createWatch).toHaveBeenCalledWith(
        'test-access-token',
        expect.objectContaining({
          labelIds: ['INBOX'],
        }),
      );

      expect(prismaService.trigger.update).toHaveBeenCalledWith({
        where: { workflowId },
        data: {
          config: expect.objectContaining({
            watchChannelId: expect.any(String),
            watchHistoryId: '12345',
            watchExpiration: '1234567890000',
          }),
        },
      });
    });

    it('should throw error if user does not have OAuth tokens', async () => {
      const workflowId = 1;
      const userId = 1;
      const config = { userId };

      (prismaService.oAuthAccount.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(handler.register(workflowId, config)).rejects.toThrow(
        'does not have Google OAuth tokens',
      );
    });
  });

  describe('unregister', () => {
    it('should stop Gmail watch and remove from memory', async () => {
      const workflowId = 1;
      const userId = 1;

      const mockTrigger = {
        workflowId: 1,
        config: {},
        workflow: {
          userId,
        },
      };

      const mockOAuthAccount = {
        accessToken: 'test-access-token',
      };

      // First register
      (prismaService.oAuthAccount.findFirst as jest.Mock).mockResolvedValue({
        userId: 1,
        provider: 'google',
        accessToken: 'test-access-token',
      } as any);
      gmailService.createWatch.mockResolvedValue({
        historyId: '12345',
        expiration: '1234567890000',
      });
      (prismaService.trigger.update as jest.Mock).mockResolvedValue({} as any);
      await handler.register(workflowId, { userId });

      // Then unregister
      (prismaService.trigger.findUnique as jest.Mock).mockResolvedValue(mockTrigger as any);
      (prismaService.oAuthAccount.findFirst as jest.Mock).mockResolvedValue(mockOAuthAccount as any);
      gmailService.stopWatch.mockResolvedValue(undefined);

      await handler.unregister(workflowId);

      expect(gmailService.stopWatch).toHaveBeenCalledWith('test-access-token');
    });
  });

  describe('handlePubSubNotification', () => {
    it('should process Gmail notification and trigger workflow', async () => {
      const channelId = 'channel-123';
      const workflowId = 1;
      const userId = 1;

      const mockWorkflow = {
        id: workflowId,
        userId,
        enabled: true,
        trigger: {
          id: 1,
          workflowId,
          type: TriggerType.GOOGLE_MAIL,
          config: {
            watchChannelId: channelId,
            watchHistoryId: '12345',
          },
        },
      };

      const mockTrigger = {
        workflowId,
        config: {
          watchChannelId: channelId,
          watchHistoryId: '12345',
        },
        workflow: {
          userId,
          enabled: true,
        },
      };

      const mockOAuthAccount = {
        accessToken: 'test-access-token',
        expiresAt: new Date(Date.now() + 3600000), // Not expired
      };

      const mockMessages = [
        {
          id: 'msg-1',
          threadId: 'thread-1',
          labelIds: ['INBOX'],
          snippet: 'Test message',
          historyId: '12346',
        },
      ];

      // Mock workflow.findMany to return workflows with Gmail trigger
      (prismaService.workflow.findMany as jest.Mock).mockResolvedValue([mockWorkflow]);

      (prismaService.trigger.findMany as jest.Mock).mockResolvedValue([mockTrigger] as any);
      (prismaService.trigger.findUnique as jest.Mock).mockResolvedValue(mockTrigger as any);
      (prismaService.oAuthAccount.findFirst as jest.Mock).mockResolvedValue(mockOAuthAccount as any);
      gmailService.fetchNewMessages.mockResolvedValue(mockMessages);
      (prismaService.trigger.update as jest.Mock).mockResolvedValue({} as any);

      // Pass payload with topicName to extract userId
      const payload = {
        topicName: `projects/test-project/topics/flowgenie-gmail-${userId}`,
      };

      await handler.handlePubSubNotification(channelId, payload);

      // The handler now queues events instead of directly emitting
      // We can verify the queue was called
      const { gmailEventQueue } = require('../../queues/gmail-event.queue');
      expect(gmailEventQueue.add).toHaveBeenCalledWith(
        'gmail-event',
        expect.objectContaining({
          workflowId,
          userId,
          messageId: 'msg-1',
          threadId: 'thread-1',
          labelIds: ['INBOX'],
          snippet: 'Test message',
          historyId: '12346',
          channelId: channelId,
        }),
        expect.any(Object), // job options
      );
    });

    it('should not process if workflow is disabled', async () => {
      const channelId = 'channel-123';
      const workflowId = 1;

      const mockTrigger = {
        workflowId,
        config: {
          watchChannelId: channelId,
        },
        workflow: {
          userId: 1,
          enabled: false,
        },
      };

      (prismaService.trigger.findMany as jest.Mock).mockResolvedValue([mockTrigger] as any);
      (prismaService.trigger.findUnique as jest.Mock).mockResolvedValue(mockTrigger as any);

      await handler.handlePubSubNotification(channelId, {});

      expect(workflowEventService.emitWorkflowTrigger).not.toHaveBeenCalled();
    });
  });
});

