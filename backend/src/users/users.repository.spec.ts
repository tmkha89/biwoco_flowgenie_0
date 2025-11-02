import { Test, TestingModule } from '@nestjs/testing';
import { UsersRepository } from './users.repository';
import { PrismaService } from '../database/prisma.service';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let prisma: {
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
    };
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<UsersRepository>(UsersRepository);
    prisma = module.get(PrismaService) as typeof mockPrisma;
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
      };

      const expectedUser = {
        id: 1,
        ...userData,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.create.mockResolvedValue(expectedUser);

      const result = await repository.create(userData);

      expect(result).toEqual(expectedUser);
      expect(prisma.user.create).toHaveBeenCalledWith({ data: userData });
    });
  });

  describe('findByEmail', () => {
    it('should return user if found', async () => {
      const email = 'test@example.com';
      const expectedUser = {
        id: 1,
        email,
        name: 'Test User',
        avatar: null,
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(expectedUser);

      const result = await repository.findByEmail(email);

      expect(result).toEqual(expectedUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
    });

    it('should return null if user not found', async () => {
      const email = 'nonexistent@example.com';

      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail(email);

      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
    });
  });

  describe('findById', () => {
    it('should return user with OAuth accounts if found', async () => {
      const id = 1;
      const expectedUser = {
        id,
        email: 'test@example.com',
        name: 'Test User',
        avatar: null,
        password: 'hashedpassword',
        oauthAccounts: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(expectedUser);

      const result = await repository.findById(id);

      expect(result).toEqual(expectedUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id },
        include: { oauthAccounts: true },
      });
    });

    it('should return null if user not found', async () => {
      const id = 999;

      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById(id);

      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id },
        include: { oauthAccounts: true },
      });
    });
  });

  describe('update', () => {
    it('should update user with provided data', async () => {
      const id = 1;
      const updateData = {
        name: 'Updated Name',
        avatar: 'https://example.com/new-avatar.jpg',
      };

      const expectedUser = {
        id,
        email: 'test@example.com',
        ...updateData,
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.update.mockResolvedValue(expectedUser);

      const result = await repository.update(id, updateData);

      expect(result).toEqual(expectedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id },
        data: updateData,
      });
    });
  });

  describe('upsert', () => {
    it('should create or update user', async () => {
      const upsertData = {
        where: { email: 'test@example.com' },
        create: {
          email: 'test@example.com',
          name: 'Test User',
        },
        update: {
          name: 'Updated Name',
        },
      };

      const expectedUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Updated Name',
        avatar: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.upsert.mockResolvedValue(expectedUser);

      const result = await repository.upsert(upsertData);

      expect(result).toEqual(expectedUser);
      expect(prisma.user.upsert).toHaveBeenCalledWith(upsertData);
    });
  });
});

