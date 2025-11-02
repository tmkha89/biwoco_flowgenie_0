import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    const mockAuthService = {
      getGoogleAuthUrl: jest.fn(),
      googleLogin: jest.fn(),
      refreshAccessToken: jest.fn(),
      logout: jest.fn(),
      getUserById: jest.fn(),
      login: jest.fn(),
      signup: jest.fn(),
    };

    mockResponse = {
      redirect: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('googleAuth', () => {
    it('should redirect to Google authorization URL', () => {
      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test';
      authService.getGoogleAuthUrl.mockReturnValue(authUrl);

      controller.googleAuth(mockResponse as Response);

      expect(authService.getGoogleAuthUrl).toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith(authUrl);
    });
  });

  describe('googleCallback', () => {
    const mockAuthResponse = {
      access_token: 'jwt-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      user: {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
      },
    };

    it('should successfully handle OAuth callback and redirect', async () => {
      const originalEnv = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'http://localhost:5173';
      
      authService.googleLogin.mockResolvedValue(mockAuthResponse);

      await controller.googleCallback('auth-code', undefined, mockResponse as Response);

      expect(authService.googleLogin).toHaveBeenCalledWith('auth-code');
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:5173/oauth-redirect?access_token=jwt-token&refresh_token=refresh-token'),
      );
      
      process.env.FRONTEND_URL = originalEnv;
    });

    it('should redirect with error if OAuth error is present', async () => {
      const originalEnv = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'http://localhost:5173';

      await controller.googleCallback(undefined, 'access_denied', mockResponse as Response);

      expect(authService.googleLogin).not.toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:5173/login?oauthError='),
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('OAuth error: access_denied')),
      );
      
      process.env.FRONTEND_URL = originalEnv;
    });

    it('should redirect with error if code is missing', async () => {
      const originalEnv = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'http://localhost:5173';

      await controller.googleCallback(undefined, undefined, mockResponse as Response);

      expect(authService.googleLogin).not.toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:5173/login?oauthError='),
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('Authorization code is missing')),
      );
      
      process.env.FRONTEND_URL = originalEnv;
    });

    it('should redirect with error on service errors', async () => {
      const originalEnv = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'http://localhost:5173';

      authService.googleLogin.mockRejectedValue(new Error('Service error'));

      await controller.googleCallback('auth-code', undefined, mockResponse as Response);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:5173/login?oauthError='),
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('Service error')),
      );
      
      process.env.FRONTEND_URL = originalEnv;
    });
  });

  describe('refresh', () => {
    it('should refresh access token', async () => {
      const refreshTokenDto = { refresh_token: 'refresh-token-123' };
      const expectedResult = {
        access_token: 'new-jwt-token',
        expires_in: 3600,
      };

      authService.refreshAccessToken.mockResolvedValue(expectedResult);

      const result = await controller.refresh(refreshTokenDto);

      expect(authService.refreshAccessToken).toHaveBeenCalledWith('refresh-token-123');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('logout', () => {
    it('should logout user and revoke refresh token', async () => {
      const refreshTokenDto = { refresh_token: 'refresh-token-123' };
      const mockUser = { id: 1, email: 'test@example.com' };

      authService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(refreshTokenDto, mockUser);

      expect(authService.logout).toHaveBeenCalledWith('refresh-token-123');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      const expectedUserDto = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        avatar: undefined,
      };

      authService.getUserById.mockResolvedValue(expectedUserDto);

      const result = await controller.getCurrentUser(mockUser);

      expect(authService.getUserById).toHaveBeenCalledWith(1);
      expect(result).toEqual(expectedUserDto);
    });
  });

  describe('login', () => {
    it('should successfully login user', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };
      const expectedResult = {
        access_token: 'jwt-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        user: {
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          avatar: null,
        },
      };

      authService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('signup', () => {
    it('should successfully signup new user', async () => {
      const signupDto = {
        name: 'New User',
        email: 'newuser@example.com',
        password: 'password123',
      };
      const expectedResult = {
        access_token: 'jwt-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        user: {
          id: 1,
          email: 'newuser@example.com',
          name: 'New User',
        },
      };

      authService.signup.mockResolvedValue(expectedResult);

      const result = await controller.signup(signupDto);

      expect(authService.signup).toHaveBeenCalledWith(signupDto);
      expect(result).toEqual(expectedResult);
    });
  });
});

