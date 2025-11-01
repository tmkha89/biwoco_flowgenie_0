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

    it('should successfully handle OAuth callback', async () => {
      authService.googleLogin.mockResolvedValue(mockAuthResponse);

      await controller.googleCallback('auth-code', undefined, mockResponse as Response);

      expect(authService.googleLogin).toHaveBeenCalledWith('auth-code');
      expect(mockResponse.send).toHaveBeenCalled();
      expect(mockResponse.send).toHaveBeenCalledWith(expect.stringContaining('OAUTH_SUCCESS'));
    });

    it('should return error if OAuth error is present', async () => {
      await controller.googleCallback(undefined, 'access_denied', mockResponse as Response);

      expect(authService.googleLogin).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'OAuth error: access_denied' });
    });

    it('should return error if code is missing', async () => {
      await controller.googleCallback(undefined, undefined, mockResponse as Response);

      expect(authService.googleLogin).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authorization code is required',
      });
    });

    it('should handle service errors', async () => {
      authService.googleLogin.mockRejectedValue(new Error('Service error'));

      await controller.googleCallback('auth-code', undefined, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Service error' });
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
});

