import { Test, TestingModule } from '@nestjs/testing';
import { GoogleOAuthService } from './google-oauth.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/google/callback',
      };
      return config[key] || defaultValue || '';
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleOAuthService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GoogleOAuthService>(GoogleOAuthService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should throw error if GOOGLE_CLIENT_ID is not set', () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue(''),
      };

      expect(() => {
        new GoogleOAuthService(mockConfigService as any);
      }).toThrow('Google OAuth clientID is required');
    });

    it('should throw error if GOOGLE_CLIENT_SECRET is not set', () => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'GOOGLE_CLIENT_ID') return 'test-client-id';
          if (key === 'GOOGLE_CLIENT_SECRET') return '';
          return '';
        }),
      };

      expect(() => {
        new GoogleOAuthService(mockConfigService as any);
      }).toThrow('Google OAuth clientSecret is required');
    });

    it('should throw error if GOOGLE_REDIRECT_URI is not set', () => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'GOOGLE_CLIENT_ID') return 'test-client-id';
          if (key === 'GOOGLE_CLIENT_SECRET') return 'test-secret';
          if (key === 'GOOGLE_REDIRECT_URI') return '';
          return '';
        }),
      };

      expect(() => {
        new GoogleOAuthService(mockConfigService as any);
      }).toThrow('Google OAuth redirect URI is required');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should return Google authorization URL', () => {
      const result = service.getAuthorizationUrl();

      expect(result).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result).toContain('client_id=test-client-id');
      expect(result).toContain('redirect_uri=');
      expect(result).toContain('response_type=code');
      expect(result).toContain('scope=openid+email+profile');
      expect(result).toContain('access_type=offline');
      expect(result).toContain('prompt=consent');
    });

    it('should include state parameter if provided', () => {
      const state = 'random-state-value';

      const result = service.getAuthorizationUrl(state);

      expect(result).toContain(`state=${state}`);
    });

    it('should not include state parameter if not provided', () => {
      const result = service.getAuthorizationUrl();

      expect(result).not.toContain('state=');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens', async () => {
      const code = 'auth-code-123';
      const expectedResponse = {
        access_token: 'access-token',
        expires_in: 3600,
        refresh_token: 'refresh-token',
        scope: 'email profile',
        token_type: 'Bearer',
        id_token: 'id-token',
      };

      mockedAxios.post.mockResolvedValue({
        data: expectedResponse,
      });

      const result = await service.exchangeCodeForTokens(code);

      expect(result).toEqual(expectedResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.stringContaining('code=auth-code-123'),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
    });

    it('should handle error from token exchange', async () => {
      const code = 'invalid-code';

      mockedAxios.post.mockRejectedValue(new Error('Invalid code'));

      await expect(service.exchangeCodeForTokens(code)).rejects.toThrow('Invalid code');
    });
  });

  describe('getUserInfo', () => {
    it('should get user info from access token', async () => {
      const accessToken = 'access-token';
      const expectedUserInfo = {
        id: 'google-user-id',
        email: 'test@example.com',
        verified_email: true,
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        given_name: 'Test',
        family_name: 'User',
      };

      mockedAxios.get.mockResolvedValue({
        data: expectedUserInfo,
      });

      const result = await service.getUserInfo(accessToken);

      expect(result).toEqual(expectedUserInfo);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
    });

    it('should handle error from user info request', async () => {
      const accessToken = 'invalid-token';

      mockedAxios.get.mockRejectedValue(new Error('Invalid token'));

      await expect(service.getUserInfo(accessToken)).rejects.toThrow('Invalid token');
    });
  });

  describe('decodeIdToken', () => {
    it('should decode valid ID token', async () => {
      // Create a mock JWT token payload
      const payload = {
        sub: 'google-user-id',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        given_name: 'Test',
        family_name: 'User',
      };

      const header = { alg: 'RS256', typ: 'JWT' };
      const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64');
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
      const idToken = `${headerB64}.${payloadB64}.signature`;

      const result = await service.decodeIdToken(idToken);

      expect(result).toEqual({
        id: 'google-user-id',
        email: 'test@example.com',
        verified_email: true,
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        given_name: 'Test',
        family_name: 'User',
      });
    });

    it('should return null for invalid token format', async () => {
      const idToken = 'invalid-token';

      const result = await service.decodeIdToken(idToken);

      expect(result).toBeNull();
    });

    it('should return null for token with wrong number of parts', async () => {
      const idToken = 'part1.part2';

      const result = await service.decodeIdToken(idToken);

      expect(result).toBeNull();
    });

    it('should return null if decoding fails', async () => {
      const idToken = 'invalid.base64.signature';

      const result = await service.decodeIdToken(idToken);

      expect(result).toBeNull();
    });

    it('should handle missing optional fields', async () => {
      const payload = {
        sub: 'google-user-id',
        email: 'test@example.com',
        email_verified: false,
      };

      const header = { alg: 'RS256', typ: 'JWT' };
      const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64');
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
      const idToken = `${headerB64}.${payloadB64}.signature`;

      const result = await service.decodeIdToken(idToken);

      expect(result).toEqual({
        id: 'google-user-id',
        email: 'test@example.com',
        verified_email: false,
        name: '',
        picture: '',
        given_name: '',
        family_name: '',
      });
    });
  });
});

