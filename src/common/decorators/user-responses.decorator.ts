import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { UserProfileDto } from '../../api/auth/dto/user-profile.dto';

export function ApiUserListResponse() {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description: 'List of all users',
      type: [UserProfileDto], // Array of users
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Admin access required',
    }),
  );
}

export function ApiUserProfileUpdateResponse() {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description: 'Profile updated successfully',
      type: UserProfileDto,
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized',
    }),
    ApiResponse({
      status: 409,
      description: 'Email already exists',
    }),
  );
}

export function ApiPasswordChangeResponse() {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description: 'Password changed successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Password changed successfully' },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized',
    }),
    ApiResponse({
      status: 409,
      description: 'Current password is incorrect',
    }),
  );
}
