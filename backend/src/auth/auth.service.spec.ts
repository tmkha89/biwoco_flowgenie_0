import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from './services/jwt.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { UsersService } from '../users/users.service';
import { OAuthService } from '../oauth/oauth.service';
import * as bcrypt from 'bcrypt';

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
      findByEmail: jest.fn(),
      createUser: jest.fn(),
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
      password: '123456',
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
      password: "123456",
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
        password: '123456',
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

  describe('login', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      avatar: 'https://example.com/avatar.jpg',
      password: '$2b$10$hashedpassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should successfully login with valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue('jwt-token');
      jwtService.getAccessTokenExpiration.mockReturnValue(3600);
      refreshTokenService.generateRefreshToken.mockResolvedValue('refresh-token');

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

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

      expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', mockUser.password);
      expect(jwtService.generateAccessToken).toHaveBeenCalledWith({
        sub: 1,
        email: 'test@example.com',
      });
      expect(refreshTokenService.generateRefreshToken).toHaveBeenCalledWith(1);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(usersService.findByEmail).toHaveBeenCalledWith('nonexistent@example.com');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', mockUser.password);
      expect(jwtService.generateAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('signup', () => {
    const mockNewUser = {
      id: 1,
      email: 'newuser@example.com',
      name: 'New User',
      avatar: null,
      password: '$2b$10$hashedpassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('$2b$10$hashedpassword'));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should successfully signup new user', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue(mockNewUser);
      jwtService.generateAccessToken.mockResolvedValue('jwt-token');
      jwtService.getAccessTokenExpiration.mockReturnValue(3600);
      refreshTokenService.generateRefreshToken.mockResolvedValue('refresh-token');

      const result = await service.signup({
        name: 'New User',
        email: 'newuser@example.com',
        password: 'password123',
      });

      expect(result).toMatchObject({
        access_token: 'jwt-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        user: {
          id: 1,
          email: 'newuser@example.com',
          name: 'New User',
        },
      });

      expect(usersService.findByEmail).toHaveBeenCalledWith('newuser@example.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(usersService.createUser).toHaveBeenCalledWith({
        name: 'New User',
        email: 'newuser@example.com',
        password: '$2b$10$hashedpassword',
      });
      expect(jwtService.generateAccessToken).toHaveBeenCalledWith({
        sub: 1,
        email: 'newuser@example.com',
      });
    });

    it('should throw BadRequestException for duplicate email', async () => {
      const existingUser = {
        id: 1,
        email: 'existing@example.com',
        name: 'Existing User',
        avatar: null,
        password: '$2b$10$hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      usersService.findByEmail.mockResolvedValue(existingUser);

      await expect(
        service.signup({
          name: 'New User',
          email: 'existing@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(usersService.findByEmail).toHaveBeenCalledWith('existing@example.com');
      expect(usersService.createUser).not.toHaveBeenCalled();
    });
  });
});

