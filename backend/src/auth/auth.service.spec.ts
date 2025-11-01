import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from './services/jwt.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { UsersService } from '../users/users.service';
import { OAuthService } from '../oauth/oauth.service';

describe('AuthService', () => {
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
      getAccessTokenExpiration: jest.fn(),
    };

    const mockRefreshTokenService = {
      generateRefreshToken: jest.fn(),
      validateRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllForUser: jest.fn(),
    };

    const mockGoogleOAuthService = {
      getAuthorizationUrl: jest.fn(),
      exchangeCodeForTokens: jest.fn(),
      getUserInfo: jest.fn(),
      decodeIdToken: jest.fn(),
    };

    const mockUsersService = {
      createOrUpdate: jest.fn(),
      findById: jest.fn(),
    };

    const mockOAuthService = {
      upsertOAuthAccount: jest.fn(),
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getGoogleAuthUrl', () => {
    it('should return Google authorization URL', () => {
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test';
      googleOAuthService.getAuthorizationUrl.mockReturnValue(url);

      const result = service.getGoogleAuthUrl();

      expect(result).toBe(url);
      expect(googleOAuthService.getAuthorizationUrl).toHaveBeenCalled();
    });
  });

  describe('googleLogin', () => {
    const mockCode = 'auth-code-123';
    const mockTokens = {
      access_token: 'access-token',
      expires_in: 3600,
      refresh_token: 'refresh-token',
      id_token: 'id-token',
      scope: 'email profile',
      token_type: 'Bearer',
    };
    const mockUserInfo = {
      id: 'google-user-id',
      email: 'test@example.com',
      verified_email: true,
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
      given_name: 'Test',
      family_name: 'User',
    };
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      avatar: 'https://example.com/avatar.jpg',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully login with Google OAuth', async () => {
      googleOAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokens);
      googleOAuthService.decodeIdToken.mockResolvedValue(mockUserInfo);
      usersService.createOrUpdate.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue('jwt-token');
      jwtService.getAccessTokenExpiration.mockReturnValue(3600);
      refreshTokenService.generateRefreshToken.mockResolvedValue('refresh-token');

      const result = await service.googleLogin(mockCode);

      expect(result).toMatchObject({
        access_token: 'jwt-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        user: {
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          avatar: 'https://example.com/avatar.jpg',
        },
      });

      expect(googleOAuthService.exchangeCodeForTokens).toHaveBeenCalledWith(mockCode);
      expect(usersService.createOrUpdate).toHaveBeenCalledWith({
        email: mockUserInfo.email,
        name: mockUserInfo.name,
        avatar: mockUserInfo.picture,
      });
      expect(oAuthService.upsertOAuthAccount).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user info is invalid', async () => {
      googleOAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokens);
      googleOAuthService.decodeIdToken.mockResolvedValue(null);
      googleOAuthService.getUserInfo.mockResolvedValue(null as any);

      await expect(service.googleLogin(mockCode)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if email is not verified', async () => {
      googleOAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokens);
      googleOAuthService.decodeIdToken.mockResolvedValue({
        ...mockUserInfo,
        verified_email: false,
      });

      await expect(service.googleLogin(mockCode)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshAccessToken', () => {
    const mockRefreshToken = 'refresh-token-123';
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully refresh access token', async () => {
      refreshTokenService.validateRefreshToken.mockResolvedValue({ userId: 1 });
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue('new-jwt-token');
      jwtService.getAccessTokenExpiration.mockReturnValue(3600);

      const result = await service.refreshAccessToken(mockRefreshToken);

      expect(result).toMatchObject({
        access_token: 'new-jwt-token',
        expires_in: 3600,
      });

      expect(refreshTokenService.validateRefreshToken).toHaveBeenCalledWith(mockRefreshToken);
      expect(usersService.findById).toHaveBeenCalledWith(1);
      expect(jwtService.generateAccessToken).toHaveBeenCalledWith({
        sub: 1,
        email: 'test@example.com',
      });
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      refreshTokenService.validateRefreshToken.mockResolvedValue(null);

      await expect(service.refreshAccessToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      refreshTokenService.validateRefreshToken.mockResolvedValue({ userId: 1 });
      usersService.findById.mockResolvedValue(null);

      await expect(service.refreshAccessToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke refresh token', async () => {
      const refreshToken = 'refresh-token-123';

      await service.logout(refreshToken);

      expect(refreshTokenService.revokeRefreshToken).toHaveBeenCalledWith(refreshToken);
    });
  });

  describe('getUserById', () => {
    it('should return user DTO if user exists', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.getUserById(1);

      expect(result).toMatchObject({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
      });
    });

    it('should return null if user does not exist', async () => {
      usersService.findById.mockResolvedValue(null);

      const result = await service.getUserById(999);

      expect(result).toBeNull();
    });
  });
});

