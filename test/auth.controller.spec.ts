import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../src/api/auth/auth.controller';
import { AuthService } from '../src/api/auth/auth.service';
import { UserService } from '../src/api/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/api/user/entities/user.entity';
import { UserRole } from '../src/api/user/entities/user-role.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockUserRoleRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(UserRole),
          useValue: mockUserRoleRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        name: 'Test User',
        phone: '99112233',
        password: 'password123',
      };

      const expectedResult = {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        user: {
          id: 1,
          name: 'Test User',
          phone: '99112233',
          role: 'USER',
          createdAt: new Date(),
        },
      };

      jest.spyOn(service, 'register').mockResolvedValue(expectedResult);

      const result = await controller.register(registerDto);
      expect(result).toEqual(expectedResult);
      expect(service.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const loginDto = {
        phone: '99112233',
        password: 'password123',
      };

      const expectedResult = {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        user: {
          id: 1,
          name: 'Test User',
          phone: '99112233',
          role: 'USER',
          createdAt: new Date(),
        },
      };

      jest.spyOn(service, 'login').mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto);
      expect(result).toEqual(expectedResult);
      expect(service.login).toHaveBeenCalledWith(loginDto);
    });
  });
});
