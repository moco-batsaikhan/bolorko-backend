import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt.guard';
import {
  ApiAuthResponse,
  ApiProfileResponse,
  ApiTokenVerificationResponse,
  ApiRefreshTokenResponse,
} from '../../common/decorators/api-responses.decorator';
import { ApiDoc } from '../../common/decorators/api-doc.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserProfileDto } from './dto/user-profile.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  @ApiDoc({
    summary: 'Register a new user',
    bodyType: RegisterDto,
    responses: {
      success: {
        status: 201,
        description: 'User successfully registered',
        type: AuthResponseDto,
      },
      errors: [
        { status: 400, description: 'Bad request - validation failed' },
        { status: 409, description: 'User already exists' },
      ],
    },
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('/login')
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiAuthResponse()
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('/refresh-token')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refresh_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiRefreshTokenResponse()
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('/verify-token')
  @ApiOperation({ summary: 'Verify JWT token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiTokenVerificationResponse()
  async verifyToken(@Body('token') token: string) {
    const isValid = await this.authService.verifyToken(token);
    return { valid: isValid };
  }

  @Get('/me')
  @UseGuards(JwtAuthGuard)
  @ApiDoc({
    summary: 'Get current user profile',
    requiresAuth: true,
    responses: {
      success: {
        status: 200,
        description: 'Current user profile',
        type: UserProfileDto,
      },
      errors: [{ status: 401, description: 'Unauthorized' }],
    },
  })
  async getProfile(@Request() req) {
    return req.user;
  }
}
