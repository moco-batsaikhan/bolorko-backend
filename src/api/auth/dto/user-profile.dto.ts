import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  id: number;

  name: string;

  email: string;

  role: string;

  createdAt: string;
}
