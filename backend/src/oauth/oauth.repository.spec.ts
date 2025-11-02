import { Test, TestingModule } from '@nestjs/testing';
import { OAuthRepository } from './oauth.repository';
import { PrismaService } from '../database/prisma.service';

describe('OAuthRepository', () => {
  let repository: OAuthRepository;
  let prisma: {
    oAuthAccount: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
    };
  };

  beforeEach(async () => {
    const mockPrisma = {
      oAuthAccount: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<OAuthRepository>(OAuthRepository);
    prisma = module.get(PrismaService) as typeof mockPrisma;
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create a new OAuth account', async () => {
      const data = {
        user: { connect: { id: 1 } },
        provider: 'google',
        providerUserId: 'google-user-id',
        accessToken: 'access-token',
      };

      const expectedAccount = {
        id: 1,
        userId: 1,
        provider: 'google',
        providerUserId: 'google-user-id',
        accessToken: 'access-token',
        refreshToken: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.oAuthAccount.create.mockResolvedValue(expectedAccount);

      const result = await repository.create(data);

      expect(result).toEqual(expectedAccount);
      expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('findByProviderAndUserId', () => {
    it('should return OAuth account if found', async () => {
      const provider = 'google';
      const providerUserId = 'google-user-id';

      const expectedAccount = {
        id: 1,
        userId: 1,
        provider,
        providerUserId,
        accessToken: 'access-token',
        refreshToken: null,
        expiresAt: null,
        user: {
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.oAuthAccount.findUnique.mockResolvedValue(expectedAccount);

      const result = await repository.findByProviderAndUserId(provider, providerUserId);

      expect(result).toEqual(expectedAccount);
      expect(prisma.oAuthAccount.findUnique).toHaveBeenCalledWith({
        where: {
          provider_providerUserId: {
            provider,
            providerUserId,
          },
        },
        include: { user: true },
      });
    });

    it('should return null if OAuth account not found', async () => {
      const provider = 'google';
      const providerUserId = 'nonexistent-id';

      prisma.oAuthAccount.findUnique.mockResolvedValue(null);

      const result = await repository.findByProviderAndUserId(provider, providerUserId);

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should return array of OAuth accounts for user', async () => {
      const userId = 1;

      const expectedAccounts = [
        {
          id: 1,
          userId,
          provider: 'google',
          providerUserId: 'google-user-id',
          accessToken: 'access-token',
          refreshToken: null,
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.oAuthAccount.findMany.mockResolvedValue(expectedAccounts);

      const result = await repository.findByUserId(userId);

      expect(result).toEqual(expectedAccounts);
      expect(prisma.oAuthAccount.findMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should return empty array if no accounts found', async () => {
      const userId = 999;

      prisma.oAuthAccount.findMany.mockResolvedValue([]);

      const result = await repository.findByUserId(userId);

      expect(result).toEqual([]);
      expect(prisma.oAuthAccount.findMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });

  describe('update', () => {
    it('should update OAuth account', async () => {
      const id = 1;
      const updateData = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      const expectedAccount = {
        id,
        userId: 1,
        provider: 'google',
        providerUserId: 'google-user-id',
        ...updateData,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.oAuthAccount.update.mockResolvedValue(expectedAccount);

      const result = await repository.update(id, updateData);

      expect(result).toEqual(expectedAccount);
      expect(prisma.oAuthAccount.update).toHaveBeenCalledWith({
        where: { id },
        data: updateData,
      });
    });
  });

  describe('upsert', () => {
    it('should create or update OAuth account', async () => {
      const upsertData = {
        where: {
          provider_providerUserId: {
            provider: 'google',
            providerUserId: 'google-user-id',
          },
        },
        create: {
          user: { connect: { id: 1 } },
          provider: 'google',
          providerUserId: 'google-user-id',
          accessToken: 'access-token',
        },
        update: {
          accessToken: 'new-access-token',
        },
      };

      const expectedAccount = {
        id: 1,
        userId: 1,
        provider: 'google',
        providerUserId: 'google-user-id',
        accessToken: 'new-access-token',
        refreshToken: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.oAuthAccount.upsert.mockResolvedValue(expectedAccount);

      const result = await repository.upsert(upsertData);

      expect(result).toEqual(expectedAccount);
      expect(prisma.oAuthAccount.upsert).toHaveBeenCalledWith(upsertData);
    });
  });
});

