import { Test, TestingModule } from '@nestjs/testing';
import { SlackMessageActionHandler } from './slack-message.action';
import { SlackService } from '../../slack/slack.service';
import { ExecutionContext } from '../interfaces/workflow.interface';

describe('SlackMessageActionHandler', () => {
  let handler: SlackMessageActionHandler;
  let slackService: jest.Mocked<SlackService>;

  beforeEach(async () => {
    const mockSlackService = {
      sendMessage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackMessageActionHandler,
        {
          provide: SlackService,
          useValue: mockSlackService,
        },
      ],
    }).compile();

    handler = module.get<SlackMessageActionHandler>(SlackMessageActionHandler);
    slackService = module.get(SlackService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should have correct type and name', () => {
    expect(handler.type).toBe('slack_message');
    expect(handler.name).toBe('Send Slack Message');
  });

  describe('execute', () => {
    it('should send message to Slack channel successfully', async () => {
      const context: ExecutionContext = {
        executionId: 1,
        workflowId: 1,
        userId: 1,
        triggerData: {},
        stepResults: {},
        currentStepOrder: 0,
      };

      const config = {
        channelId: 'C123456',
        text: 'Hello, world!',
      };

      const mockSlackResponse = {
        ok: true,
        channel: 'C123456',
        ts: '1234567890.123456',
        message: {
          text: 'Hello, world!',
        },
      };

      slackService.sendMessage.mockResolvedValueOnce(mockSlackResponse);

      const result = await handler.execute(context, config);

      expect(result).toEqual(mockSlackResponse);
      expect(slackService.sendMessage).toHaveBeenCalledWith(
        1,
        'C123456',
        'Hello, world!',
      );
    });

    it('should support template variables in text', async () => {
      const context: ExecutionContext = {
        executionId: 1,
        workflowId: 1,
        userId: 1,
        triggerData: {
          message: 'Hello from trigger!',
        },
        stepResults: {
          1: {
            data: 'Previous step result',
          },
        },
        currentStepOrder: 1,
      };

      const config = {
        channelId: 'C123456',
        text: '{{trigger.message}} - {{step.1.data}}',
      };

      slackService.sendMessage.mockResolvedValueOnce({
        ok: true,
      });

      await handler.execute(context, config);

      expect(slackService.sendMessage).toHaveBeenCalledWith(
        1,
        'C123456',
        'Hello from trigger! - Previous step result',
      );
    });

    it('should support template variables in channelId', async () => {
      const context: ExecutionContext = {
        executionId: 1,
        workflowId: 1,
        userId: 1,
        triggerData: {
          channel: 'C123456',
        },
        stepResults: {},
        currentStepOrder: 0,
      };

      const config = {
        channelId: '{{trigger.channel}}',
        text: 'Hello!',
      };

      slackService.sendMessage.mockResolvedValueOnce({
        ok: true,
      });

      await handler.execute(context, config);

      expect(slackService.sendMessage).toHaveBeenCalledWith(
        1,
        'C123456',
        'Hello!',
      );
    });

    it('should throw error if channelId is missing', async () => {
      const context: ExecutionContext = {
        executionId: 1,
        workflowId: 1,
        userId: 1,
        triggerData: {},
        stepResults: {},
        currentStepOrder: 0,
      };

      const config = {
        text: 'Hello!',
      };

      await expect(handler.execute(context, config)).rejects.toThrow(
        'Slack message action requires channelId and text',
      );
    });

    it('should throw error if text is missing', async () => {
      const context: ExecutionContext = {
        executionId: 1,
        workflowId: 1,
        userId: 1,
        triggerData: {},
        stepResults: {},
        currentStepOrder: 0,
      };

      const config = {
        channelId: 'C123456',
      };

      await expect(handler.execute(context, config)).rejects.toThrow(
        'Slack message action requires channelId and text',
      );
    });

    it('should throw error if Slack API fails', async () => {
      const context: ExecutionContext = {
        executionId: 1,
        workflowId: 1,
        userId: 1,
        triggerData: {},
        stepResults: {},
        currentStepOrder: 0,
      };

      const config = {
        channelId: 'C123456',
        text: 'Hello!',
      };

      slackService.sendMessage.mockRejectedValueOnce(
        new Error('Slack API error: channel_not_found'),
      );

      await expect(handler.execute(context, config)).rejects.toThrow(
        'Slack API error: channel_not_found',
      );
    });

    it('should throw error if user has no Slack token', async () => {
      const context: ExecutionContext = {
        executionId: 1,
        workflowId: 1,
        userId: 1,
        triggerData: {},
        stepResults: {},
        currentStepOrder: 0,
      };

      const config = {
        channelId: 'C123456',
        text: 'Hello!',
      };

      slackService.sendMessage.mockRejectedValueOnce(
        new Error('No Slack access token found for user'),
      );

      await expect(handler.execute(context, config)).rejects.toThrow(
        'No Slack access token found for user',
      );
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const config = {
        channelId: 'C123456',
        text: 'Hello!',
      };

      expect(handler.validateConfig(config)).toBe(true);
    });

    it('should throw error for missing channelId', () => {
      const config = {
        text: 'Hello!',
      };

      expect(() => handler.validateConfig(config)).toThrow(
        'Slack message action requires channelId and text',
      );
    });

    it('should throw error for missing text', () => {
      const config = {
        channelId: 'C123456',
      };

      expect(() => handler.validateConfig(config)).toThrow(
        'Slack message action requires channelId and text',
      );
    });
  });
});

