import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { RedisService } from '../../database/redis.service';
import { ConfigService } from '@nestjs/config';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let repository: jest.Mocked<RefreshTokenRepository>;
  let redisService: jest.Mocked<RedisService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findByToken: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    };

    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('604800'), // 7 days in seconds
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: RefreshTokenRepository,
          useValue: mockRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    repository = module.get(RefreshTokenRepository);
    redisService = module.get(RedisService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateRefreshToken', () => {
    it('should generate and store refresh token', async () => {
      const userId = 1;
      const mockToken = {
        id: 1,
        token: 'generated-token',
        userId,
        expiresAt: new Date(Date.now() + 604800000),
        revoked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.create.mockResolvedValue(mockToken);
      redisService.set.mockResolvedValue(undefined);

      const result = await service.generateRefreshToken(userId);

      // The actual token is a random hex string, so we check it's a string and matches the pattern
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(repository.create).toHaveBeenCalledWith({
        token: expect.any(String),
        expiresAt: expect.any(Date),
        user: { connect: { id: userId } },
      });
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('refresh_token:'),
        userId.toString(),
        604800,
      );
    });

    it('should use custom expiration from config', async () => {
      configService.get.mockReturnValue('86400'); // 1 day
      const userId = 1;
      const mockToken = {
        id: 1,
        token: 'generated-token',
        userId,
        expiresAt: new Date(),
        revoked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.create.mockResolvedValue(mockToken);
      redisService.set.mockResolvedValue(undefined);

      const newService = new RefreshTokenService(
        repository,
        redisService,
        configService,
      );

      await newService.generateRefreshToken(userId);

      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('refresh_token:'),
        userId.toString(),
        86400,
      );
    });
  });

  describe('validateRefreshToken', () => {
    it('should return userId if token exists in Redis', async () => {
      const token = 'refresh-token-123';
      const userId = 1;

      redisService.get.mockResolvedValue(userId.toString());

      const result = await service.validateRefreshToken(token);

      expect(result).toEqual({ userId });
      expect(redisService.get).toHaveBeenCalledWith('refresh_token:refresh-token-123');
      expect(repository.findByToken).not.toHaveBeenCalled();
    });

    it('should return userId from database if not in Redis', async () => {
      const token = 'refresh-token-123';
      const userId = 1;
      const mockToken = {
        id: 1,
        token,
        userId,
        expiresAt: new Date(Date.now() + 86400000),
        revoked: false,
        user: {
          id: userId,
          email: 'test@example.com',
          name: 'Test User',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      redisService.get.mockResolvedValue(null);
      repository.findByToken.mockResolvedValue(mockToken);
      redisService.set.mockResolvedValue(undefined);

      const result = await service.validateRefreshToken(token);

      expect(result).toEqual({ userId });
      expect(redisService.get).toHaveBeenCalledWith('refresh_token:refresh-token-123');
      expect(repository.findByToken).toHaveBeenCalledWith(token);
      expect(redisService.set).toHaveBeenCalled();
    });

    it('should return null if token not found', async () => {
      const token = 'nonexistent-token';

      redisService.get.mockResolvedValue(null);
      repository.findByToken.mockResolvedValue(null);

      const result = await service.validateRefreshToken(token);

      expect(result).toBeNull();
      expect(repository.findByToken).toHaveBeenCalledWith(token);
      expect(redisService.set).not.toHaveBeenCalled();
    });

    it('should return null if token is revoked', async () => {
      const token = 'revoked-token';
      const userId = 1;
      const mockToken = {
        id: 1,
        token,
        userId,
        expiresAt: new Date(Date.now() + 86400000),
        revoked: true,
        user: {
          id: userId,
          email: 'test@example.com',
          name: 'Test User',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      redisService.get.mockResolvedValue(null);
      repository.findByToken.mockResolvedValue(mockToken);

      const result = await service.validateRefreshToken(token);

      expect(result).toBeNull();
      expect(repository.findByToken).toHaveBeenCalledWith(token);
    });

    it('should return null if token is expired', async () => {
      const token = 'expired-token';
      const userId = 1;
      const mockToken = {
        id: 1,
        token,
        userId,
        expiresAt: new Date(Date.now() - 86400000), // Expired
        revoked: false,
        user: {
          id: userId,
          email: 'test@example.com',
          name: 'Test User',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      redisService.get.mockResolvedValue(null);
      repository.findByToken.mockResolvedValue(mockToken);

      const result = await service.validateRefreshToken(token);

      expect(result).toBeNull();
      expect(repository.findByToken).toHaveBeenCalledWith(token);
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke token in database and Redis', async () => {
      const token = 'refresh-token-123';
      const mockToken = {
        id: 1,
        token,
        userId: 1,
        expiresAt: new Date(),
        revoked: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.revoke.mockResolvedValue(mockToken);
      redisService.del.mockResolvedValue(undefined);

      await service.revokeRefreshToken(token);

      expect(repository.revoke).toHaveBeenCalledWith(token);
      expect(redisService.del).toHaveBeenCalledWith('refresh_token:refresh-token-123');
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke all tokens for user', async () => {
      const userId = 1;

      repository.revokeAllForUser.mockResolvedValue(undefined);

      await service.revokeAllForUser(userId);

      expect(repository.revokeAllForUser).toHaveBeenCalledWith(userId);
    });
  });
});

