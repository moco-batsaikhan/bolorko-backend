import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from './entities/user-role.entity';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of all users',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 1 },
          name: { type: 'string', example: 'User' },
          phone: { type: 'string', example: '99112233' },
          role: { type: 'string', example: 'USER' },
          createdAt: { type: 'string', example: '2023-12-01T10:00:00Z' },
        },
      },
    },
  })
  async findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'User details',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'User' },
        phone: { type: 'string', example: '99112233' },
        role: { type: 'string', example: 'USER' },
        createdAt: { type: 'string', example: '2023-12-01T10:00:00Z' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findById(id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Phone number already exists',
  })
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(req.user.id, updateProfileDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change user password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Current password is incorrect',
  })
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.userService.changePassword(req.user.id, changePasswordDto);
    return { message: 'Password changed successfully' };
  }

  @Get('roles')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all user roles' })
  @ApiResponse({
    status: 200,
    description: 'List of all roles',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 1 },
          role: { type: 'string', example: 'USER' },
        },
      },
    },
  })
  async getAllRoles() {
    return this.userService.getAllRoles();
  }

  @Post('admin/update-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Update user information (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID', example: 1 })
  @ApiBody({ type: AdminUpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Updated Name' },
        phone: { type: 'string', example: '99112244' },
        createdAt: { type: 'string', example: '2023-12-01T10:00:00Z' },
        role: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 2 },
            role: { type: 'string', example: 'ADMIN' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Phone number already exists',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async adminUpdateUser(
    @Param('id', ParseIntPipe) userId: number,
    @Body() adminUpdateUserDto: AdminUpdateUserDto,
  ) {
    return this.userService.adminUpdateUser(userId, adminUpdateUserDto);
  }

  @Delete('admin/delete-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'User ID to delete',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'User with ID 1 has been deleted successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete admin users',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async adminDeleteUser(@Param('id', ParseIntPipe) userId: number) {
    return this.userService.adminDeleteUser(userId);
  }

  @Post('create-admin')
  @ApiOperation({ summary: 'Create admin user (Development only)' })
  @ApiResponse({
    status: 201,
    description: 'Admin user created successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'User with this phone number already exists',
  })
  @ApiBody({ type: CreateAdminDto })
  async createAdmin(@Body() createAdminDto: CreateAdminDto) {
    return this.userService.createAdminUser(
      createAdminDto.phone,
      createAdminDto.password,
      createAdminDto.name,
    );
  }
}
