import { Test, TestingModule } from '@nestjs/testing';
import { SlackController } from './slack.controller';
import { SlackService } from './slack.service';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

describe('SlackController', () => {
  let controller: SlackController;
  let slackService: jest.Mocked<SlackService>;
  let queue: jest.Mocked<Queue>;

  beforeEach(async () => {
    const mockSlackService = {
      getAuthorizationUrl: jest.fn(),
      exchangeCodeForTokens: jest.fn(),
      storeTokens: jest.fn(),
      verifySignature: jest.fn().mockReturnValue(true),
    };

    const mockQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SlackController],
      providers: [
        {
          provide: SlackService,
          useValue: mockSlackService,
        },
        {
          provide: 'SLACK_EVENT_QUEUE',
          useValue: mockQueue,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-signing-secret'),
          },
        },
      ],
    }).compile();

    controller = module.get<SlackController>(SlackController);
    slackService = module.get(SlackService);
    queue = module.get('SLACK_EVENT_QUEUE');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('startOAuth', () => {
    it('should redirect to Slack authorization URL', async () => {
      const mockReq = {
        user: { id: 1 },
      } as any;
      const mockRes = {
        redirect: jest.fn(),
      } as any;

      slackService.getAuthorizationUrl.mockReturnValue(
        'https://slack.com/oauth/v2/authorize?client_id=test',
      );

      await controller.startOAuth(mockReq, mockRes);

      expect(slackService.getAuthorizationUrl).toHaveBeenCalledWith(expect.stringContaining('user_1'));
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'https://slack.com/oauth/v2/authorize?client_id=test',
      );
    });

    it('should handle unauthenticated user', async () => {
      const mockReq = {
        user: null,
      } as any;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.startOAuth(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });
  });

  describe('oauthCallback', () => {
    it('should handle OAuth callback successfully', async () => {
      const mockReq = {
        query: {
          code: 'test-code',
          state: 'user_1',
        },
      } as any;
      const mockRes = {
        redirect: jest.fn(),
      } as any;

      slackService.exchangeCodeForTokens.mockResolvedValue({
        accessToken: 'xoxb-token',
        refreshToken: 'xoxb-refresh',
        expiresIn: 3600,
        teamId: 'T123',
        userId: 'U123',
      });

      slackService.storeTokens.mockResolvedValue({} as any);

      await controller.oauthCallback('test-code', 'user_1', undefined, mockRes);

      expect(slackService.exchangeCodeForTokens).toHaveBeenCalledWith('test-code');
      expect(slackService.storeTokens).toHaveBeenCalledWith(1, expect.any(Object));
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('slack/oauth/success'),
      );
    });

    it('should handle OAuth callback error', async () => {
      const mockRes = {
        redirect: jest.fn(),
      } as any;

      await controller.oauthCallback(undefined, undefined, 'access_denied', mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('slack/oauth/error'),
      );
    });

    it('should handle invalid state', async () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.oauthCallback('test-code', 'invalid-state', undefined, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid state parameter' });
    });
  });

  describe('handleEvent', () => {
    it('should handle URL verification challenge', async () => {
      const mockReq = {
        body: {
          type: 'url_verification',
          challenge: 'test-challenge',
        },
        rawBody: JSON.stringify({
          type: 'url_verification',
          challenge: 'test-challenge',
        }),
      } as any;
      const mockHeaders = {} as any;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const result = await controller.handleEvent(mockReq.body, mockReq, mockHeaders, mockRes);

      expect(result).toEqual({ challenge: 'test-challenge' });
    });

    it('should enqueue event and return 200 OK', async () => {
      const eventData = {
        type: 'event_callback',
        event: {
          type: 'message',
          text: 'Hello',
          channel: 'C123',
          user: 'U123',
        },
        team_id: 'T123',
      };

      const mockReq = {
        body: eventData,
        rawBody: JSON.stringify(eventData),
        headers: {
          'x-slack-signature': 'v0=signature',
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
        },
      } as any;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      slackService.verifySignature.mockReturnValue(true);
      queue.add.mockResolvedValue({} as any);

      const mockHeaders = {
        'x-slack-signature': 'v0=signature',
        'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
      } as any;

      const result = await controller.handleEvent(mockReq.body, mockReq, mockHeaders, mockRes);

      expect(result).toEqual({ ok: true });
      expect(queue.add).toHaveBeenCalledWith('slack.event', expect.objectContaining({
        event: eventData.event,
        teamId: 'T123',
      }));
    });

    it('should reject invalid signature', async () => {
      const eventData = {
        type: 'event_callback',
        event: {
          type: 'message',
        },
      };

      const mockReq = {
        body: eventData,
        rawBody: JSON.stringify(eventData),
        headers: {
          'x-slack-signature': 'v0=invalid',
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
        },
      } as any;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      slackService.verifySignature.mockReturnValue(false);

      const mockHeaders = {
        'x-slack-signature': 'v0=invalid',
        'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
      } as any;

      await controller.handleEvent(mockReq.body, mockReq, mockHeaders, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid signature' });
    });

    it('should handle retry events', async () => {
      const eventData = {
        type: 'event_callback',
        event: {
          type: 'message',
        },
      };

      const mockReq = {
        body: {
          ...eventData,
          retry_reason: 'http_timeout',
        },
        rawBody: JSON.stringify(eventData),
        headers: {
          'x-slack-signature': 'v0=signature',
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
        },
      } as any;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      slackService.verifySignature.mockReturnValue(true);

      const mockHeaders = {
        'x-slack-signature': 'v0=signature',
        'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
      } as any;

      const result = await controller.handleEvent(mockReq.body, mockReq, mockHeaders, mockRes);

      // Should still return 200 OK but not process the event
      expect(result).toEqual({ ok: true });
      expect(queue.add).not.toHaveBeenCalled();
    });
  });
});

