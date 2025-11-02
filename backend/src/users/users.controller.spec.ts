import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const mockUsersService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCurrentUser', () => {
    it('should return current user profile', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      const expectedUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      usersService.findById.mockResolvedValue(expectedUser);

      const result = await controller.getCurrentUser(mockUser);

      expect(usersService.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(expectedUser);
    });

    it('should return null if user not found', async () => {
      const mockUser = { id: 999, email: 'nonexistent@example.com' };

      usersService.findById.mockResolvedValue(null);

      const result = await controller.getCurrentUser(mockUser);

      expect(usersService.findById).toHaveBeenCalledWith(999);
      expect(result).toBeNull();
    });
  });
});

