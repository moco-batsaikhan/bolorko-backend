import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole, UserRoleEnum } from './entities/user-role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterDto } from '../auth/dto/register.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
  ) {}

  async create(dto: CreateUserDto | RegisterDto): Promise<User> {
    const hashed = await bcrypt.hash(dto.password, 10);

    // Ensure roles exist first
    await this.initializeRoles();

    // Handle role assignment
    let roleId: number;

    if ('role' in dto && dto.role) {
      // Find the specified role
      const role = await this.userRoleRepo.findOne({
        where: { role: dto.role },
      });
      roleId = role ? role.id : await this.getDefaultRoleId();
    } else {
      // Default to USER role
      roleId = await this.getDefaultRoleId();
    }

    const user = this.userRepo.create({
      name: dto.name,
      phone: dto.phone,
      password: hashed,
      roleId: roleId,
    });

    const savedUser = await this.userRepo.save(user);
    const foundUser = await this.findById(savedUser.id);
    if (!foundUser) {
      throw new Error('Failed to create user');
    }
    return foundUser;
  }

  private async getDefaultRoleId(): Promise<number> {
    const defaultRole = await this.userRoleRepo.findOne({
      where: { role: UserRoleEnum.USER },
    });

    if (!defaultRole) {
      // Create default role if it doesn't exist
      const newRole = this.userRoleRepo.create({ role: UserRoleEnum.USER });
      const savedRole = await this.userRoleRepo.save(newRole);
      return savedRole.id;
    }

    return defaultRole.id;
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      relations: ['role'],
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { phone },
      relations: ['role'],
    });
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find({ relations: ['role'] });
  }

  async updateProfile(
    userId: number,
    updateDto: UpdateProfileDto,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if phone is being updated and is unique
    if (updateDto.phone && updateDto.phone !== user.phone) {
      const existingUser = await this.findByPhone(updateDto.phone);
      if (existingUser) {
        throw new ConflictException('Phone number already exists');
      }
    }

    if (updateDto.name || updateDto.phone) {
      user.updateProfile(
        updateDto.name || user.name,
        updateDto.phone || user.phone,
      );
    }

    await this.userRepo.save(user);
    const updatedUser = await this.findById(userId);
    if (!updatedUser) {
      throw new Error('Failed to update user profile');
    }
    return updatedUser;
  }

  async changePassword(
    userId: number,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(
      changePasswordDto.oldPassword,
      user.password,
    );
    if (!isOldPasswordValid) {
      throw new ConflictException('Current password is incorrect');
    }

    // Hash new password and update
    const hashedNewPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      10,
    );
    user.changePassword(hashedNewPassword);

    await this.userRepo.save(user);
  }

  // Role management methods
  async initializeRoles(): Promise<void> {
    try {
      // Check if USER role exists
      const userRole = await this.userRoleRepo.findOne({
        where: { role: UserRoleEnum.USER },
      });

      if (!userRole) {
        const newUserRole = this.userRoleRepo.create({
          role: UserRoleEnum.USER,
        });
        await this.userRoleRepo.save(newUserRole);
      }

      // Check if ADMIN role exists
      const adminRole = await this.userRoleRepo.findOne({
        where: { role: UserRoleEnum.ADMIN },
      });

      if (!adminRole) {
        const newAdminRole = this.userRoleRepo.create({
          role: UserRoleEnum.ADMIN,
        });
        await this.userRoleRepo.save(newAdminRole);
      }
    } catch (error) {
      console.error('Error initializing roles:', error);
      throw error;
    }
  }

  async getAllRoles(): Promise<UserRole[]> {
    return this.userRoleRepo.find();
  }

  async createAdminUser(
    phone: string,
    password: string,
    name: string,
  ): Promise<User> {
    // Ensure roles exist first
    await this.initializeRoles();

    // Check if admin user already exists
    const existingAdmin = await this.userRepo.findOne({
      where: { phone },
      relations: ['role'],
    });

    if (existingAdmin) {
      throw new ConflictException('User with this phone number already exists');
    }

    // Get admin role
    const adminRole = await this.userRoleRepo.findOne({
      where: { role: UserRoleEnum.ADMIN },
    });

    if (!adminRole) {
      throw new NotFoundException('Admin role not found');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const adminUser = this.userRepo.create({
      name,
      phone,
      password: hashedPassword,
      roleId: adminRole.id,
    });

    const savedUser = await this.userRepo.save(adminUser);
    const foundUser = await this.findById(savedUser.id);
    if (!foundUser) {
      throw new NotFoundException('Failed to create admin user');
    }
    return foundUser;
  }

  // Admin method to update user information
  async adminUpdateUser(
    userId: number,
    updateData: {
      name?: string;
      phone?: string;
      role?: UserRoleEnum;
    },
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (updateData.phone) {
      user.phone = updateData.phone;
    }

    if (updateData.name) {
      user.name = updateData.name;
    }

    console.log(`<<< Original user roleId: ${user.roleId}`);

    // Update role if provided
    if (updateData.role) {
      console.log(`<<< Requested role: ${updateData.role}`);

      // Look up the actual role ID from the database
      const role = await this.userRoleRepo.findOne({
        where: { role: updateData.role },
      });

      console.log(`<<< Found role in DB:`, role);

      if (!role) {
        throw new NotFoundException(`Role ${updateData.role} not found`);
      }

      console.log(`<<< Setting user.roleId from ${user.roleId} to ${role.id}`);
      user.roleId = role.id;
      console.log(`<<< User roleId after assignment: ${user.roleId}`);
    }

    console.log(`<<< About to save user with roleId: ${user.roleId}`);

    // Use direct UPDATE query to force database update
    await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({
        name: user.name,
        phone: user.phone,
        roleId: user.roleId,
      })
      .where('id = :id', { id: userId })
      .execute();

    console.log(`<<< Direct UPDATE executed`);

    // Let's also check what's actually in the database
    const dbCheck = await this.userRepo
      .createQueryBuilder('user')
      .select(['user.id', 'user.roleId'])
      .where('user.id = :id', { id: userId })
      .getRawOne();
    console.log(`<<< Raw DB check:`, dbCheck);

    // Force a fresh query to avoid caching issues
    const updatedUser = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.id = :id', { id: userId })
      .getOne();

    console.log(
      `<<< Final result - updatedUser roleId: ${updatedUser?.roleId}, role: ${updatedUser?.role?.role}`,
    );

    if (!updatedUser) {
      throw new NotFoundException('Failed to retrieve updated user');
    }

    return updatedUser;
  }

  // Admin method to delete user
  async adminDeleteUser(userId: number): Promise<{ message: string }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Prevent deleting admin users (optional security measure)
    if (user.role?.role === UserRoleEnum.ADMIN) {
      throw new ConflictException('Cannot delete admin users');
    }

    // Use transaction to ensure all related data is deleted properly
    await this.userRepo.manager.transaction(
      async (transactionalEntityManager) => {
        // Delete related data first to avoid foreign key constraints

        // Delete cart items and cart
        await transactionalEntityManager.query(
          'DELETE FROM cart_items WHERE cartId IN (SELECT id FROM carts WHERE userId = ?)',
          [userId],
        );
        await transactionalEntityManager.query(
          'DELETE FROM carts WHERE userId = ?',
          [userId],
        );

        // Delete orders and order items
        await transactionalEntityManager.query(
          'DELETE FROM order_items WHERE orderId IN (SELECT id FROM orders WHERE userId = ?)',
          [userId],
        );
        await transactionalEntityManager.query(
          'DELETE FROM orders WHERE userId = ?',
          [userId],
        );

        // Delete product ratings
        await transactionalEntityManager.query(
          'DELETE FROM product_ratings WHERE userId = ?',
          [userId],
        );

        // Finally delete the user
        await transactionalEntityManager.query(
          'DELETE FROM users WHERE id = ?',
          [userId],
        );
      },
    );

    return {
      message: `User with ID ${userId} and all related data have been deleted successfully`,
    };
  }
}
