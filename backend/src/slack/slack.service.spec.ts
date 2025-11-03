import { Test, TestingModule } from '@nestjs/testing';
import { SlackService } from './slack.service';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from '../oauth/oauth.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SlackService', () => {
  let service: SlackService;
  let configService: jest.Mocked<ConfigService>;
  let oauthService: jest.Mocked<OAuthService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        SLACK_CLIENT_ID: 'test-client-id',
        SLACK_CLIENT_SECRET: 'test-client-secret',
        SLACK_REDIRECT_URI: 'https://api.flowgenie.com/slack/oauth/callback',
      };
      return config[key] || defaultValue || '';
    });

    const mockOAuthService = {
      upsertOAuthAccount: jest.fn(),
      findByUserId: jest.fn(),
      findByProviderAndUserId: jest.fn(),
      updateOAuthAccount: jest.fn(),
      createOAuthAccount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: OAuthService,
          useValue: mockOAuthService,
        },
      ],
    }).compile();

    service = module.get<SlackService>(SlackService);
    configService = module.get(ConfigService);
    oauthService = module.get(OAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAuthorizationUrl', () => {
    it('should return a valid Slack authorization URL with state', () => {
      const state = 'test-state-123';
      const url = service.getAuthorizationUrl(state);

      expect(url).toContain('https://slack.com/oauth/v2/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fapi.flowgenie.com%2Fslack%2Foauth%2Fcallback');
      expect(url).toContain(`state=${state}`);
      expect(url).toContain('scope=');
    });

    it('should return a valid Slack authorization URL without state', () => {
      const url = service.getAuthorizationUrl();

      expect(url).toContain('https://slack.com/oauth/v2/authorize');
      expect(url).toContain('client_id=test-client-id');
    });

    it('should throw error if client ID is not configured', () => {
      configService.get.mockReturnValue('');
      const newService = new SlackService(configService as any, oauthService as any);

      expect(() => newService.getAuthorizationUrl()).toThrow('Slack OAuth is not configured');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens successfully', async () => {
      const mockTokenResponse = {
        access_token: 'xoxb-access-token',
        refresh_token: 'xoxb-refresh-token',
        expires_in: 3600,
        token_type: 'bot',
        scope: 'chat:write,channels:history',
        team: { id: 'T123456', name: 'Test Team' },
        authed_user: { id: 'U123456' },
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: mockTokenResponse,
      });

      const result = await service.exchangeCodeForTokens('test-code');

      expect(result).toEqual({
        accessToken: 'xoxb-access-token',
        refreshToken: 'xoxb-refresh-token',
        expiresIn: 3600,
        teamId: 'T123456',
        userId: 'U123456',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://slack.com/api/oauth.v2.access',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );
    });

    it('should throw error if token exchange fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Token exchange failed'));

      await expect(service.exchangeCodeForTokens('invalid-code')).rejects.toThrow(
        'Token exchange failed',
      );
    });

    it('should throw error if response indicates failure', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          ok: false,
          error: 'invalid_code',
        },
      });

      await expect(service.exchangeCodeForTokens('invalid-code')).rejects.toThrow(
        'Slack OAuth error: invalid_code',
      );
    });
  });

  describe('storeTokens', () => {
    it('should store tokens successfully', async () => {
      const mockOAuthAccount = {
        id: 1,
        userId: 1,
        provider: 'slack',
        providerUserId: 'U123456',
        accessToken: 'xoxb-access-token',
        refreshToken: 'xoxb-refresh-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      oauthService.upsertOAuthAccount.mockResolvedValueOnce(mockOAuthAccount as any);

      const result = await service.storeTokens(1, {
        accessToken: 'xoxb-access-token',
        refreshToken: 'xoxb-refresh-token',
        expiresIn: 3600,
        teamId: 'T123456',
        userId: 'U123456',
      });

      expect(result).toEqual(mockOAuthAccount);
      expect(oauthService.upsertOAuthAccount).toHaveBeenCalledWith({
        userId: 1,
        provider: 'slack',
        providerUserId: 'U123456',
        accessToken: 'xoxb-access-token',
        refreshToken: 'xoxb-refresh-token',
        expiresAt: expect.any(Date),
      });
    });
  });

  describe('getAccessToken', () => {
    it('should return access token for user', async () => {
      const mockOAuthAccount = {
        id: 1,
        userId: 1,
        provider: 'slack',
        providerUserId: 'U123456',
        accessToken: 'xoxb-access-token',
        refreshToken: 'xoxb-refresh-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };

      oauthService.findByUserId.mockResolvedValueOnce([
        mockOAuthAccount as any,
      ]);

      const token = await service.getAccessToken(1);

      expect(token).toBe('xoxb-access-token');
      expect(oauthService.findByUserId).toHaveBeenCalledWith(1);
    });

    it('should return null if no Slack account found', async () => {
      oauthService.findByUserId.mockResolvedValueOnce([]);

      const token = await service.getAccessToken(1);

      expect(token).toBeNull();
    });

    it('should refresh token if expired', async () => {
      const mockOAuthAccount = {
        id: 1,
        userId: 1,
        provider: 'slack',
        providerUserId: 'U123456',
        accessToken: 'xoxb-old-token',
        refreshToken: 'xoxb-refresh-token',
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      const refreshedAccount = {
        ...mockOAuthAccount,
        accessToken: 'xoxb-new-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };

      oauthService.findByUserId.mockResolvedValueOnce([mockOAuthAccount as any]);

      const mockRefreshResponse = {
        ok: true,
        access_token: 'xoxb-new-token',
        expires_in: 3600,
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: mockRefreshResponse,
      });

      oauthService.updateOAuthAccount.mockResolvedValueOnce(refreshedAccount as any);

      const token = await service.getAccessToken(1);

      expect(token).toBe('xoxb-new-token');
      expect(mockedAxios.post).toHaveBeenCalled();
      expect(oauthService.updateOAuthAccount).toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      const mockRefreshResponse = {
        ok: true,
        access_token: 'xoxb-new-token',
        expires_in: 3600,
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: mockRefreshResponse,
      });

      const mockOAuthAccount = {
        id: 1,
        accessToken: 'xoxb-old-token',
        refreshToken: 'xoxb-refresh-token',
        expiresAt: new Date(Date.now() - 1000),
      };

      oauthService.findByUserId.mockResolvedValueOnce([mockOAuthAccount as any]);

      const refreshedAccount = {
        ...mockOAuthAccount,
        accessToken: 'xoxb-new-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };

      oauthService.updateOAuthAccount.mockResolvedValueOnce(refreshedAccount as any);

      const result = await service.refreshAccessToken(1);

      expect(result).toBe('xoxb-new-token');
      expect(oauthService.updateOAuthAccount).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          accessToken: 'xoxb-new-token',
        }),
      );
    });

    it('should throw error if refresh token is missing', async () => {
      const mockOAuthAccount = {
        id: 1,
        accessToken: 'xoxb-old-token',
        refreshToken: null,
      };

      oauthService.findByUserId.mockResolvedValueOnce([mockOAuthAccount as any]);

      await expect(service.refreshAccessToken(1)).rejects.toThrow(
        'No refresh token available',
      );
    });

    it('should throw error if refresh fails', async () => {
      const mockOAuthAccount = {
        id: 1,
        refreshToken: 'xoxb-refresh-token',
      };

      oauthService.findByUserId.mockResolvedValueOnce([mockOAuthAccount as any]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          ok: false,
          error: 'invalid_refresh_token',
        },
      });

      await expect(service.refreshAccessToken(1)).rejects.toThrow(
        'Failed to refresh Slack token: invalid_refresh_token',
      );
    });
  });

  describe('sendMessage', () => {
    it('should send message to channel successfully', async () => {
      const mockOAuthAccount = {
        id: 1,
        accessToken: 'xoxb-access-token',
      };

      oauthService.findByUserId.mockResolvedValueOnce([mockOAuthAccount as any]);

      const mockSlackResponse = {
        ok: true,
        channel: 'C123456',
        ts: '1234567890.123456',
        message: {
          text: 'Hello, world!',
        },
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: mockSlackResponse,
      });

      const result = await service.sendMessage(1, 'C123456', 'Hello, world!');

      expect(result).toEqual(mockSlackResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          channel: 'C123456',
          text: 'Hello, world!',
        }),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer xoxb-access-token',
            'Content-Type': 'application/json',
          },
        }),
      );
    });

    it('should throw error if access token is missing', async () => {
      oauthService.findByUserId.mockResolvedValueOnce([]);

      await expect(service.sendMessage(1, 'C123456', 'Hello')).rejects.toThrow(
        'No Slack access token found for user',
      );
    });

    it('should throw error if Slack API returns error', async () => {
      const mockOAuthAccount = {
        id: 1,
        accessToken: 'xoxb-access-token',
      };

      oauthService.findByUserId.mockResolvedValueOnce([mockOAuthAccount as any]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          ok: false,
          error: 'channel_not_found',
        },
      });

      await expect(service.sendMessage(1, 'C123456', 'Hello')).rejects.toThrow(
        'Slack API error: channel_not_found',
      );
    });
  });
});

