import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({
    description: 'Access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refresh_token: string;

  @ApiProperty({
    description: 'User information',
    type: 'object',
    properties: {
      id: { type: 'number', example: 1 },
      name: { type: 'string', example: 'User' },
      phone: { type: 'string', example: '99112233' },
      role: { type: 'string', example: 'USER' },
      createdAt: { type: 'string', example: '2025-12-01T10:00:00Z' },
    },
  })
  user: {
    id: number;
    name: string;
    phone: string;
    role: string;
    createdAt: string;
  };
}
