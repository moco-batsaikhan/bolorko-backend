import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(phone: string, pass: string) {
    const user = await this.userService.findByPhone(phone);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    throw new UnauthorizedException('Invalid credentials');
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.phone, loginDto.password);
    return this.generateTokens(user);
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.userService.findByPhone(registerDto.phone);
    if (existingUser) {
      throw new ConflictException('User with this phone number already exists');
    }

    const newUser = await this.userService.create(registerDto);
    return this.generateTokens(newUser);
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async verifyToken(token: string): Promise<boolean> {
    try {
      this.jwtService.verify(token);
      return true;
    } catch (error) {
      return false;
    }
  }

  private generateTokens(user: any) {
    const payload = {
      phone: user.phone,
      sub: user.id,
      role: user.role?.role || 'USER',
    };

    const access_token = this.jwtService.sign(payload, {
      expiresIn: '600000000m',
    });
    const refresh_token = this.jwtService.sign(payload, {
      expiresIn: '700000d',
    });

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role?.role || 'USER',
        createdAt: user.createdAt,
      },
    };
  }
}
