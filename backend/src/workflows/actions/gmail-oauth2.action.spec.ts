import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GmailOAuth2ActionHandler } from './gmail-oauth2.action';
import { PrismaService } from '../../database/prisma.service';
import { GoogleOAuthService } from '../../auth/services/google-oauth.service';
import { ExecutionContext } from '../interfaces/workflow.interface';
import * as nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

// Mock GoogleOAuthService
const mockGoogleOAuthService = {
  refreshAccessToken: jest.fn(),
};

// Mock PrismaService
const mockPrismaService = {
  oAuthAccount: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

// Helper function to create a mock JWT with specified scopes
function createMockJWT(scopes: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ scope: scopes, exp: Date.now() / 1000 + 3600 })).toString('base64url');
  return `${header}.${payload}.mock_signature`;
}

describe('GmailOAuth2ActionHandler', () => {
  let handler: GmailOAuth2ActionHandler;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmailOAuth2ActionHandler,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GOOGLE_CLIENT_ID') return 'test-client-id';
              if (key === 'GOOGLE_CLIENT_SECRET') return 'test-client-secret';
              return null;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: GoogleOAuthService,
          useValue: mockGoogleOAuthService,
        },
      ],
    }).compile();

    handler = module.get<GmailOAuth2ActionHandler>(GmailOAuth2ActionHandler);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const mockContext: ExecutionContext = {
      executionId: 1,
      workflowId: 1,
      userId: 1,
      triggerData: {},
      stepResults: {},
      currentStepOrder: 0,
    };

    // Create mock OAuth account with valid JWT token containing Gmail scopes
    const mockOAuthAccount = {
      id: 1,
      userId: 1,
      provider: 'google',
      providerUserId: 'test-user-id',
      accessToken: createMockJWT('openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly'),
      refreshToken: 'valid-refresh-token',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      user: {
        id: 1,
        email: 'user@example.com',
        name: 'Test User',
      },
    };

    it('should send email successfully with valid OAuth credentials', async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({
          messageId: 'test-message-id',
          accepted: ['recipient@example.com'],
          rejected: [],
        }),
      };

      (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
      mockPrismaService.oAuthAccount.findFirst = jest.fn().mockResolvedValue(mockOAuthAccount);

      const config = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const result = await handler.execute(mockContext, config);

      expect(mockPrismaService.oAuthAccount.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 1,
          provider: 'google',
        },
        include: {
          user: true,
        },
      });

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: 'user@example.com',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          refreshToken: 'valid-refresh-token',
          accessToken: mockOAuthAccount.accessToken, // JWT with Gmail scopes
        },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'user@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test Body',
        html: 'Test Body',
      });

      expect(result.messageId).toBe('test-message-id');
    });

    it('should refresh token if expired and resend', async () => {
      const expiredOAuthAccount = {
        ...mockOAuthAccount,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago - expired
      };

      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({
          messageId: 'test-message-id',
          accepted: ['recipient@example.com'],
          rejected: [],
        }),
        close: jest.fn(),
      };

      const newAccessToken = createMockJWT('openid email profile https://www.googleapis.com/auth/gmail.send');
      const refreshedToken = {
        access_token: newAccessToken,
        expires_in: 3600,
      };

      (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
      mockPrismaService.oAuthAccount.findFirst = jest.fn().mockResolvedValue(expiredOAuthAccount);
      mockPrismaService.oAuthAccount.update = jest.fn().mockResolvedValue({
        ...expiredOAuthAccount,
        accessToken: newAccessToken,
      });
      mockGoogleOAuthService.refreshAccessToken = jest.fn().mockResolvedValue(refreshedToken);

      const config = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const result = await handler.execute(mockContext, config);

      expect(mockGoogleOAuthService.refreshAccessToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(mockPrismaService.oAuthAccount.update).toHaveBeenCalled();
      expect(result.messageId).toBe('test-message-id');
    });

    it('should retry up to 3 times on failure', async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('Network error')),
      };

      (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
      mockPrismaService.oAuthAccount.findFirst = jest.fn().mockResolvedValue(mockOAuthAccount);

      const config = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(handler.execute(mockContext, config)).rejects.toThrow('Network error');
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
    });

    it('should fail if OAuth account not found', async () => {
      mockPrismaService.oAuthAccount.findFirst = jest.fn().mockResolvedValue(null);

      const config = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(handler.execute(mockContext, config)).rejects.toThrow(
        'No Google OAuth account found for user',
      );
    });

    it('should validate required fields', async () => {
      const config = {
        to: '',
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(handler.execute(mockContext, config)).rejects.toThrow(
        'Email action requires to, subject, and body or htmlBody',
      );
    });

    it('should support HTML body', async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({
          messageId: 'test-message-id',
          accepted: ['recipient@example.com'],
        }),
      };

      (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
      mockPrismaService.oAuthAccount.findFirst = jest.fn().mockResolvedValue(mockOAuthAccount);

      const config = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        htmlBody: '<h1>Test HTML</h1>',
      };

      const result = await handler.execute(mockContext, config);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'user@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: undefined,
        html: '<h1>Test HTML</h1>',
      });

      expect(result.messageId).toBe('test-message-id');
    });

    it('should support multiple recipients', async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({
          messageId: 'test-message-id',
          accepted: ['recipient1@example.com', 'recipient2@example.com'],
        }),
      };

      (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
      mockPrismaService.oAuthAccount.findFirst = jest.fn().mockResolvedValue(mockOAuthAccount);

      const config = {
        to: 'recipient1@example.com, recipient2@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const result = await handler.execute(mockContext, config);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'user@example.com',
        to: 'recipient1@example.com, recipient2@example.com',
        subject: 'Test Subject',
        text: 'Test Body',
        html: 'Test Body',
      });

      expect(result.accepted.length).toBe(2);
    });
  });
});

