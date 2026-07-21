// mail.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { SendWelcomeDto, SendPasswordResetDto, MailResponseDto } from './dto';
import { ApiDoc } from '../common/decorators/api-doc.decorator';

@ApiTags('Mail')
@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Post('welcome')
  @ApiDoc({
    summary: 'Send welcome email',
    bodyType: SendWelcomeDto,
    responses: {
      success: {
        status: 201,
        description: 'Welcome email sent successfully',
        type: MailResponseDto,
      },
      errors: [
        {
          status: 400,
          description: 'Bad Request - Invalid email or name',
        },
        {
          status: 500,
          description: 'Internal Server Error - Failed to send email',
        },
      ],
    },
  })
  welcome(@Body() dto: SendWelcomeDto) {
    return this.mail.sendWelcome(dto.email, dto.name);
  }

  @Post('reset')
  @ApiDoc({
    summary: 'Send password reset email',
    bodyType: SendPasswordResetDto,
    responses: {
      success: {
        status: 201,
        description: 'Password reset email sent successfully',
        type: MailResponseDto,
      },
      errors: [
        {
          status: 400,
          description: 'Bad Request - Invalid email or URL',
        },
        {
          status: 500,
          description: 'Internal Server Error - Failed to send email',
        },
      ],
    },
  })
  reset(@Body() dto: SendPasswordResetDto) {
    return this.mail.sendPasswordReset(dto.email, dto.url);
  }
}
