import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from './jwt.service';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('JwtService', () => {
  let service: JwtService;
  let nestJwtService: jest.Mocked<NestJwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockNestJwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtService,
        {
          provide: NestJwtService,
          useValue: mockNestJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<JwtService>(JwtService);
    nestJwtService = module.get(NestJwtService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAccessToken', () => {
    it('should generate access token', async () => {
      const payload = {
        sub: 1,
        email: 'test@example.com',
      };

      const expectedToken = 'jwt-token-123';

      nestJwtService.signAsync.mockResolvedValue(expectedToken);

      const result = await service.generateAccessToken(payload);

      expect(result).toBe(expectedToken);
      expect(nestJwtService.signAsync).toHaveBeenCalledWith(payload);
    });
  });

  describe('verifyToken', () => {
    it('should verify token and return payload', async () => {
      const token = 'jwt-token-123';
      const expectedPayload = {
        sub: 1,
        email: 'test@example.com',
        iat: 1234567890,
        exp: 1234571490,
      };

      nestJwtService.verifyAsync.mockResolvedValue(expectedPayload);

      const result = await service.verifyToken(token);

      expect(result).toEqual(expectedPayload);
      expect(nestJwtService.verifyAsync).toHaveBeenCalledWith(token);
    });

    it('should throw error if token is invalid', async () => {
      const token = 'invalid-token';

      nestJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(service.verifyToken(token)).rejects.toThrow('Invalid token');
      expect(nestJwtService.verifyAsync).toHaveBeenCalledWith(token);
    });
  });

  describe('getAccessTokenExpiration', () => {
    it('should return expiration in seconds for hours format', () => {
      configService.get.mockReturnValue('2h');

      const result = service.getAccessTokenExpiration();

      expect(result).toBe(7200); // 2 * 3600
      expect(configService.get).toHaveBeenCalledWith('JWT_EXPIRES_IN', '1h');
    });

    it('should return expiration in seconds for minutes format', () => {
      configService.get.mockReturnValue('30m');

      const result = service.getAccessTokenExpiration();

      expect(result).toBe(1800); // 30 * 60
      expect(configService.get).toHaveBeenCalledWith('JWT_EXPIRES_IN', '1h');
    });

    it('should return expiration in seconds for numeric format', () => {
      configService.get.mockReturnValue('3600');

      const result = service.getAccessTokenExpiration();

      expect(result).toBe(3600);
      expect(configService.get).toHaveBeenCalledWith('JWT_EXPIRES_IN', '1h');
    });

    it('should return default expiration if config is invalid', () => {
      configService.get.mockReturnValue('invalid');

      const result = service.getAccessTokenExpiration();

      expect(result).toBe(3600); // Default or parseInt('invalid') || 3600
      expect(configService.get).toHaveBeenCalledWith('JWT_EXPIRES_IN', '1h');
    });

    it('should use default value if config is not set', () => {
      configService.get.mockReturnValue('1h'); // Return default value instead of undefined

      const result = service.getAccessTokenExpiration();

      expect(result).toBe(3600); // Default '1h' = 3600
      expect(configService.get).toHaveBeenCalledWith('JWT_EXPIRES_IN', '1h');
    });
  });
});

