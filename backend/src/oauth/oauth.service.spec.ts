import { Test, TestingModule } from '@nestjs/testing';
import { OAuthService } from './oauth.service';
import { OAuthRepository } from './oauth.repository';

describe('OAuthService', () => {
  let service: OAuthService;
  let repository: jest.Mocked<OAuthRepository>;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findByProviderAndUserId: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        {
          provide: OAuthRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);
    repository = module.get(OAuthRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOAuthAccount', () => {
    it('should create a new OAuth account', async () => {
      const data = {
        userId: 1,
        provider: 'google',
        providerUserId: 'google-user-id',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      const expectedAccount = {
        id: 1,
        userId: 1,
        provider: 'google',
        providerUserId: 'google-user-id',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: data.expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.create.mockResolvedValue(expectedAccount);

      const result = await service.createOAuthAccount(data);

      expect(result).toEqual(expectedAccount);
      expect(repository.create).toHaveBeenCalledWith({
        user: { connect: { id: data.userId } },
        provider: data.provider,
        providerUserId: data.providerUserId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      });
    });

    it('should create OAuth account without optional fields', async () => {
      const data = {
        userId: 1,
        provider: 'google',
        providerUserId: 'google-user-id',
      };

      const expectedAccount = {
        id: 1,
        userId: 1,
        provider: 'google',
        providerUserId: 'google-user-id',
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.create.mockResolvedValue(expectedAccount);

      const result = await service.createOAuthAccount(data);

      expect(result).toEqual(expectedAccount);
      expect(repository.create).toHaveBeenCalledWith({
        user: { connect: { id: data.userId } },
        provider: data.provider,
        providerUserId: data.providerUserId,
        accessToken: undefined,
        refreshToken: undefined,
        expiresAt: undefined,
      });
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
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.findByProviderAndUserId.mockResolvedValue(expectedAccount);

      const result = await service.findByProviderAndUserId(provider, providerUserId);

      expect(result).toEqual(expectedAccount);
      expect(repository.findByProviderAndUserId).toHaveBeenCalledWith(
        provider,
        providerUserId,
      );
    });

    it('should return null if OAuth account not found', async () => {
      const provider = 'google';
      const providerUserId = 'nonexistent-id';

      repository.findByProviderAndUserId.mockResolvedValue(null);

      const result = await service.findByProviderAndUserId(provider, providerUserId);

      expect(result).toBeNull();
      expect(repository.findByProviderAndUserId).toHaveBeenCalledWith(
        provider,
        providerUserId,
      );
    });
  });

  describe('updateOAuthAccount', () => {
    it('should update OAuth account', async () => {
      const id = 1;
      const updateData = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 7200000),
      };

      const expectedAccount = {
        id,
        userId: 1,
        provider: 'google',
        providerUserId: 'google-user-id',
        ...updateData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.update.mockResolvedValue(expectedAccount);

      const result = await service.updateOAuthAccount(id, updateData);

      expect(result).toEqual(expectedAccount);
      expect(repository.update).toHaveBeenCalledWith(id, updateData);
    });

    it('should update only provided fields', async () => {
      const id = 1;
      const updateData = {
        accessToken: 'new-access-token',
      };

      const expectedAccount = {
        id,
        userId: 1,
        provider: 'google',
        providerUserId: 'google-user-id',
        accessToken: 'new-access-token',
        refreshToken: 'old-refresh-token',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.update.mockResolvedValue(expectedAccount);

      const result = await service.updateOAuthAccount(id, updateData);

      expect(result).toEqual(expectedAccount);
      expect(repository.update).toHaveBeenCalledWith(id, updateData);
    });
  });

  describe('upsertOAuthAccount', () => {
    it('should create OAuth account if not exists', async () => {
      const data = {
        userId: 1,
        provider: 'google',
        providerUserId: 'google-user-id',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
      };

      const expectedAccount = {
        id: 1,
        userId: 1,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.upsert.mockResolvedValue(expectedAccount);

      const result = await service.upsertOAuthAccount(data);

      expect(result).toEqual(expectedAccount);
      expect(repository.upsert).toHaveBeenCalledWith({
        where: {
          provider_providerUserId: {
            provider: data.provider,
            providerUserId: data.providerUserId,
          },
        },
        create: {
          user: { connect: { id: data.userId } },
          provider: data.provider,
          providerUserId: data.providerUserId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
        },
        update: {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
        },
      });
    });

    it('should update OAuth account if exists', async () => {
      const data = {
        userId: 1,
        provider: 'google',
        providerUserId: 'existing-google-user-id',
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(),
      };

      const expectedAccount = {
        id: 1,
        userId: 1,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.upsert.mockResolvedValue(expectedAccount);

      const result = await service.upsertOAuthAccount(data);

      expect(result).toEqual(expectedAccount);
      expect(repository.upsert).toHaveBeenCalledWith({
        where: {
          provider_providerUserId: {
            provider: data.provider,
            providerUserId: data.providerUserId,
          },
        },
        create: {
          user: { connect: { id: data.userId } },
          provider: data.provider,
          providerUserId: data.providerUserId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
        },
        update: {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
        },
      });
    });
  });
});

