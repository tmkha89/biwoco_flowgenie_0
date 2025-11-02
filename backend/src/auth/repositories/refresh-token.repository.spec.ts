import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenRepository } from './refresh-token.repository';
import { PrismaService } from '../../database/prisma.service';

describe('RefreshTokenRepository', () => {
  let repository: RefreshTokenRepository;
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    const mockPrisma = {
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<RefreshTokenRepository>(RefreshTokenRepository);
    prisma = module.get(PrismaService) as typeof mockPrisma;
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create a new refresh token', async () => {
      const data = {
        token: 'refresh-token-123',
        expiresAt: new Date(Date.now() + 604800000),
        user: { connect: { id: 1 } },
      };

      const expectedToken = {
        id: 1,
        token: 'refresh-token-123',
        userId: 1,
        expiresAt: data.expiresAt,
        revoked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.refreshToken.create.mockResolvedValue(expectedToken);

      const result = await repository.create(data);

      expect(result).toEqual(expectedToken);
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('findByToken', () => {
    it('should return refresh token if found', async () => {
      const token = 'refresh-token-123';

      const expectedToken = {
        id: 1,
        token,
        userId: 1,
        expiresAt: new Date(Date.now() + 604800000),
        revoked: false,
        user: {
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.refreshToken.findUnique.mockResolvedValue(expectedToken);

      const result = await repository.findByToken(token);

      expect(result).toEqual(expectedToken);
      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token },
        include: { user: true },
      });
    });

    it('should return null if token not found', async () => {
      const token = 'nonexistent-token';

      prisma.refreshToken.findUnique.mockResolvedValue(null);

      const result = await repository.findByToken(token);

      expect(result).toBeNull();
      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token },
        include: { user: true },
      });
    });
  });

  describe('revoke', () => {
    it('should revoke refresh token', async () => {
      const token = 'refresh-token-123';

      const expectedToken = {
        id: 1,
        token,
        userId: 1,
        expiresAt: new Date(Date.now() + 604800000),
        revoked: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.refreshToken.update.mockResolvedValue(expectedToken);

      const result = await repository.revoke(token);

      expect(result).toEqual(expectedToken);
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { token },
        data: { revoked: true },
      });
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke all refresh tokens for user', async () => {
      const userId = 1;

      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await repository.revokeAllForUser(userId);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId, revoked: false },
        data: { revoked: true },
      });
    });

    it('should handle no tokens to revoke', async () => {
      const userId = 999;

      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await repository.revokeAllForUser(userId);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId, revoked: false },
        data: { revoked: true },
      });
    });
  });

  describe('deleteExpired', () => {
    it('should delete expired tokens', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

      await repository.deleteExpired();

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });

    it('should handle no expired tokens', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      await repository.deleteExpired();

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe('deleteRevoked', () => {
    it('should delete revoked tokens', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

      await repository.deleteRevoked();

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { revoked: true },
      });
    });

    it('should handle no revoked tokens', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      await repository.deleteRevoked();

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { revoked: true },
      });
    });
  });
});

