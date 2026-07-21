import { applyDecorators } from '@nestjs/common';
import { ApiResponse, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthResponseDto } from '../../api/auth/dto/auth-response.dto';
import { UserProfileDto } from '../../api/auth/dto/user-profile.dto';
import { TokenVerificationDto } from '../../api/auth/dto/token-verification.dto';

export function ApiAuthResponse() {
  return applyDecorators(
    ApiResponse({
      status: 201,
      description: 'User successfully registered/logged in',
      type: AuthResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - validation failed',
    }),
    ApiResponse({
      status: 401,
      description: 'Invalid credentials',
    }),
    ApiResponse({
      status: 409,
      description: 'User already exists',
    }),
  );
}

export function ApiProfileResponse() {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description: 'User profile retrieved successfully',
      type: UserProfileDto,
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized',
    }),
  );
}

export function ApiTokenVerificationResponse() {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description: 'Token verification result',
      type: TokenVerificationDto,
    }),
  );
}

export function ApiRefreshTokenResponse() {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description: 'Token successfully refreshed',
      type: AuthResponseDto,
    }),
    ApiResponse({
      status: 401,
      description: 'Invalid refresh token',
    }),
  );
}
