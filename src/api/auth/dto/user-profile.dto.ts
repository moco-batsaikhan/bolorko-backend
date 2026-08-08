import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  id: number;

  name: string;

  phone: string;

  role: string;

  createdAt: string;
}
