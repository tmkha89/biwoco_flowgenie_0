import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from './services/jwt.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { UsersService } from '../users/users.service';
import { OAuthService } from '../oauth/oauth.service';
import * as jest from 'jest-mock';
import * as bcrypt from 'bcrypt';

// Mock bcrypt module
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
  genSalt: jest.fn(),
}));

describe('AuthService (Updated)', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let refreshTokenService: jest.Mocked<RefreshTokenService>;
  let googleOAuthService: jest.Mocked<GoogleOAuthService>;
  let usersService: jest.Mocked<UsersService>;
  let oAuthService: jest.Mocked<OAuthService>;

  beforeEach(async () => {
    const mockJwtService = {
      generateAccessToken: jest.fn(),
      verifyToken: jest.fn(),
      getAccessTokenExpiration: jest.fn().mockReturnValue(3600),
    };

    const mockRefreshTokenService = {
      generateRefreshToken: jest.fn(),
      validateRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
    };

    const mockGoogleOAuthService = {
      getAuthorizationUrl: jest.fn(),
      exchangeCodeForTokens: jest.fn(),
      getUserInfo: jest.fn(),
      decodeIdToken: jest.fn(),
      refreshAccessToken: jest.fn(),
    };


    const mockUsersService = {
      createOrUpdate: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      createUser: jest.fn(),
    };

    const mockOAuthService = {
      upsertOAuthAccount: jest.fn(),
      findByUserId: jest.fn(),
      findByProviderAndUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: RefreshTokenService,
          useValue: mockRefreshTokenService,
        },
        {
          provide: GoogleOAuthService,
          useValue: mockGoogleOAuthService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: OAuthService,
          useValue: mockOAuthService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService);
    refreshTokenService = module.get(RefreshTokenService);
    googleOAuthService = module.get(GoogleOAuthService);
    usersService = module.get(UsersService);
    oAuthService = module.get(OAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login - username or email', () => {
    it('should login with email successfully', async () => {
      const mockUser = {
        id: 1,
        email: 'user@example.com',
        username: 'john123',
        password: 'hashed_password',
        name: 'John Doe',
        avatar: null,
      };

      usersService.findByEmail.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.generateAccessToken.mockResolvedValue('access_token');
      refreshTokenService.generateRefreshToken.mockResolvedValue('refresh_token');

      const result = await service.login({
        email: 'user@example.com',
        password: 'password123',
      });

      expect(result.access_token).toBe('access_token');
      expect(result.refresh_token).toBe('refresh_token');
      expect(result.user.email).toBe('user@example.com');
      expect(result.user.username).toBe('john123');
      expect(usersService.findByEmail).toHaveBeenCalledWith('user@example.com');
    });

    it('should login with username successfully', async () => {
      const mockUser = {
        id: 1,
        email: 'user@example.com',
        username: 'john123',
        password: 'hashed_password',
        name: 'John Doe',
      };

      usersService.findByUsername.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.generateAccessToken.mockResolvedValue('access_token');
      refreshTokenService.generateRefreshToken.mockResolvedValue('refresh_token');

      const result = await service.login({
        username: 'john123',
        password: 'password123',
      });

      expect(result.access_token).toBe('access_token');
      expect(result.user.username).toBe('john123');
      expect(usersService.findByUsername).toHaveBeenCalledWith('john123');
    });

    it('should throw error if user not found by email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw error if user not found by username', async () => {
      usersService.findByUsername.mockResolvedValue(null);

      await expect(
        service.login({
          username: 'nonexistent',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw error if password is invalid', async () => {
      const mockUser = {
        id: 1,
        email: 'user@example.com',
        username: 'john123',
        password: 'hashed_password',
      };

      usersService.findByEmail.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'user@example.com',
          password: 'wrong_password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('signup', () => {
    it('should signup with username and email successfully', async () => {
      const mockUser = {
        id: 1,
        username: 'john123',
        email: 'user@example.com',
        name: 'John Doe',
        password: 'hashed_password',
      };

      usersService.findByEmail.mockResolvedValue(null);
      usersService.findByUsername.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      usersService.createUser.mockResolvedValue(mockUser as any);
      jwtService.generateAccessToken.mockResolvedValue('access_token');
      refreshTokenService.generateRefreshToken.mockResolvedValue('refresh_token');

      const result = await service.signup({
        username: 'john123',
        name: 'John Doe',
        email: 'user@example.com',
        password: 'password123',
      });

      expect(result.access_token).toBe('access_token');
      expect(result.user.username).toBe('john123');
      expect(result.user.email).toBe('user@example.com');
      expect(usersService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'john123',
          email: 'user@example.com',
          password: 'hashed_password',
        }),
      );
    });

    it('should throw error if email already exists', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 1,
        email: 'user@example.com',
      } as any);

      await expect(
        service.signup({
          username: 'john123',
          name: 'John Doe',
          email: 'user@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if username already exists', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.findByUsername.mockResolvedValue({
        id: 1,
        username: 'john123',
      } as any);

      await expect(
        service.signup({
          username: 'john123',
          name: 'John Doe',
          email: 'user@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('OAuth - Google', () => {
    it('should handle Google OAuth login for new user', async () => {
      const mockTokens = {
        access_token: 'google_access_token',
        refresh_token: 'google_refresh_token',
        expires_in: 3600,
        id_token: 'id_token',
      };

      const mockUserInfo = {
        id: 'google123',
        email: 'user@gmail.com',
        verified_email: true,
        name: 'John Doe',
        picture: 'avatar.jpg',
        given_name: 'John',
        family_name: 'Doe',
      };

      const mockUser = {
        id: 1,
        username: null,
        email: 'user@gmail.com',
        name: 'John Doe',
        avatar: 'avatar.jpg',
      };

      googleOAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokens as any);
      googleOAuthService.decodeIdToken.mockResolvedValue(mockUserInfo);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createOrUpdate.mockResolvedValue(mockUser as any);
      oAuthService.upsertOAuthAccount.mockResolvedValue({} as any);
      jwtService.generateAccessToken.mockResolvedValue('access_token');
      refreshTokenService.generateRefreshToken.mockResolvedValue('refresh_token');

      const result = await service.oauthLogin('google', 'auth_code');

      expect(result.access_token).toBe('access_token');
      expect(result.user.email).toBe('user@gmail.com');
      expect(oAuthService.upsertOAuthAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'google',
          providerUserId: 'google123',
        }),
      );
    });

    it('should handle Google OAuth login for existing user (link account)', async () => {
      const mockTokens = {
        access_token: 'google_access_token',
        refresh_token: 'google_refresh_token',
        expires_in: 3600,
        id_token: 'id_token',
      };

      const mockUserInfo = {
        id: 'google123',
        email: 'user@example.com',
        verified_email: true,
        name: 'John Doe',
        picture: 'avatar.jpg',
        given_name: 'John',
        family_name: 'Doe',
      };

      const mockUser = {
        id: 1,
        username: 'john123',
        email: 'user@example.com',
        name: 'John Doe',
      };

      googleOAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokens as any);
      googleOAuthService.decodeIdToken.mockResolvedValue(mockUserInfo);
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      oAuthService.upsertOAuthAccount.mockResolvedValue({} as any);
      jwtService.generateAccessToken.mockResolvedValue('access_token');
      refreshTokenService.generateRefreshToken.mockResolvedValue('refresh_token');

      const result = await service.oauthLogin('google', 'auth_code');

      expect(result.access_token).toBe('access_token');
      expect(result.user.username).toBe('john123');
      // Should link OAuth account to existing user
      expect(oAuthService.upsertOAuthAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          provider: 'google',
        }),
      );
    });
  });


  describe('getConnectedProviders', () => {
    it('should return connected providers for user', async () => {
      const mockOAuthAccounts = [
        { provider: 'google', providerUserId: 'google123' },
      ];

      oAuthService.findByUserId.mockResolvedValue(mockOAuthAccounts as any);

      const providers = await service.getConnectedProviders(1);

      expect(providers).toEqual(['google']);
      expect(oAuthService.findByUserId).toHaveBeenCalledWith(1);
    });

    it('should return empty array if no connected providers', async () => {
      oAuthService.findByUserId.mockResolvedValue([]);

      const providers = await service.getConnectedProviders(1);

      expect(providers).toEqual([]);
    });
  });
});

