import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(UsersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        password: 'hashedpassword',
      };

      const expectedUser = {
        id: 1,
        ...userData,
        username: null,
        googleLinked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.create.mockResolvedValue(expectedUser);

      const result = await service.createUser(userData);

      expect(result).toEqual(expectedUser);
      expect(repository.create).toHaveBeenCalledWith(userData);
    });

    it('should create user with optional fields', async () => {
      const userData = {
        email: 'test@example.com',
      };

      const expectedUser = {
        id: 1,
        email: 'test@example.com',
        username: null,
        name: null,
        avatar: null,
        password: null,
        googleLinked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.create.mockResolvedValue(expectedUser);

      const result = await service.createUser(userData);

      expect(result).toEqual(expectedUser);
      expect(repository.create).toHaveBeenCalledWith(userData);
    });
  });

  describe('findByEmail', () => {
    it('should return user if found', async () => {
      const email = 'test@example.com';
      const expectedUser = {
        id: 1,
        email,
        username: 'testuser',
        name: 'Test User',
        avatar: null,
        password: 'hashedpassword',
        googleLinked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.findByEmail.mockResolvedValue(expectedUser);

      const result = await service.findByEmail(email);

      expect(result).toEqual(expectedUser);
      expect(repository.findByEmail).toHaveBeenCalledWith(email);
    });

    it('should return null if user not found', async () => {
      const email = 'nonexistent@example.com';

      repository.findByEmail.mockResolvedValue(null);

      const result = await service.findByEmail(email);

      expect(result).toBeNull();
      expect(repository.findByEmail).toHaveBeenCalledWith(email);
    });
  });

  describe('findById', () => {
    it('should return user if found', async () => {
      const id = 1;
      const expectedUser = {
        id,
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        avatar: null,
        password: 'hashedpassword',
        googleLinked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.findById.mockResolvedValue(expectedUser);

      const result = await service.findById(id);

      expect(result).toEqual(expectedUser);
      expect(repository.findById).toHaveBeenCalledWith(id);
    });

    it('should return null if user not found', async () => {
      const id = 999;

      repository.findById.mockResolvedValue(null);

      const result = await service.findById(id);

      expect(result).toBeNull();
      expect(repository.findById).toHaveBeenCalledWith(id);
    });
  });

  describe('updateUser', () => {
    it('should update user with provided fields', async () => {
      const id = 1;
      const updateData = {
        name: 'Updated Name',
        avatar: 'https://example.com/new-avatar.jpg',
      };

      const expectedUser = {
        id,
        email: 'test@example.com',
        username: 'testuser',
        name: 'Updated Name',
        avatar: 'https://example.com/new-avatar.jpg',
        password: 'hashedpassword',
        googleLinked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.update.mockResolvedValue(expectedUser);

      const result = await service.updateUser(id, updateData);

      expect(result).toEqual(expectedUser);
      expect(repository.update).toHaveBeenCalledWith(id, {
        name: 'Updated Name',
        avatar: 'https://example.com/new-avatar.jpg',
      });
    });

    it('should update user password if provided', async () => {
      const id = 1;
      const updateData = {
        password: 'newhashedpassword',
      };

      const expectedUser = {
        id,
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        avatar: null,
        password: 'newhashedpassword',
        googleLinked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.update.mockResolvedValue(expectedUser);

      const result = await service.updateUser(id, updateData);

      expect(result).toEqual(expectedUser);
      expect(repository.update).toHaveBeenCalledWith(id, {
        password: 'newhashedpassword',
      });
    });

    it('should not update password if empty string', async () => {
      const id = 1;
      const updateData = {
        password: '   ',
      };

      const expectedUser = {
        id,
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        avatar: null,
        password: 'oldpassword',
        googleLinked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.update.mockResolvedValue(expectedUser);

      const result = await service.updateUser(id, updateData);

      expect(result).toEqual(expectedUser);
      expect(repository.update).toHaveBeenCalledWith(id, {});
    });
  });

  describe('createOrUpdate', () => {
    it('should create new user if not exists', async () => {
      const data = {
        email: 'newuser@example.com',
        name: 'New User',
        avatar: 'https://example.com/avatar.jpg',
      };

      const expectedUser = {
        id: 1,
        ...data,
        username: null,
        password: null,
        googleLinked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.upsert.mockResolvedValue(expectedUser);

      const result = await service.createOrUpdate(data);

      expect(result).toEqual(expectedUser);
      expect(repository.upsert).toHaveBeenCalledWith({
        where: { email: data.email },
        create: data,
        update: { name: data.name },
      });
    });

    it('should update existing user if exists', async () => {
      const data = {
        email: 'existing@example.com',
        name: 'Updated Name',
        avatar: 'https://example.com/new-avatar.jpg',
      };

      const expectedUser = {
        id: 1,
        email: 'existing@example.com',
        username: 'existinguser',
        name: 'Updated Name',
        avatar: 'https://example.com/new-avatar.jpg',
        password: 'hashedpassword',
        googleLinked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.upsert.mockResolvedValue(expectedUser);

      const result = await service.createOrUpdate(data);

      expect(result).toEqual(expectedUser);
      expect(repository.upsert).toHaveBeenCalledWith({
        where: { email: data.email },
        create: data,
        update: { name: data.name },
      });
    });

    it('should include password in update if provided', async () => {
      const data = {
        email: 'user@example.com',
        name: 'Test User',
        password: 'newhashedpassword',
      };

      const expectedUser = {
        id: 1,
        ...data,
        username: null,
        avatar: null,
        googleLinked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.upsert.mockResolvedValue(expectedUser);

      const result = await service.createOrUpdate(data);

      expect(result).toEqual(expectedUser);
      expect(repository.upsert).toHaveBeenCalledWith({
        where: { email: data.email },
        create: data,
        update: { name: data.name, password: data.password },
      });
    });

    it('should not include empty password in update', async () => {
      const data = {
        email: 'user@example.com',
        name: 'Test User',
        password: '   ',
      };

      const expectedUser = {
        id: 1,
        email: 'user@example.com',
        username: 'testuser',
        name: 'Test User',
        avatar: null,
        password: 'oldpassword',
        googleLinked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.upsert.mockResolvedValue(expectedUser);

      const result = await service.createOrUpdate(data);

      expect(result).toEqual(expectedUser);
      expect(repository.upsert).toHaveBeenCalledWith({
        where: { email: data.email },
        create: data,
        update: { name: data.name },
      });
    });
  });
});

