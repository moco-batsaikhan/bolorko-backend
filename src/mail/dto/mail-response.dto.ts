import { ApiProperty } from '@nestjs/swagger';

export class MailResponseDto {
  @ApiProperty({
    description: 'Message ID from the mail server',
    example: '<20231016123456.1.abc123@example.com>',
  })
  messageId: string;

  @ApiProperty({
    description: 'List of accepted email addresses',
    example: ['user@example.com'],
    type: [String],
  })
  accepted: string[];
}
