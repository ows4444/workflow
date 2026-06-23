import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  OnModuleInit,
  Post,
} from '@nestjs/common';
import { RegistrationService } from '../../application/services/registration.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Controller('users')
export class UserController implements OnModuleInit {
  constructor(private readonly registrationService: RegistrationService) {}
  onModuleInit() {
    setTimeout(async () => {
      void (await this.registrationService.register('ows4444@gmail.com'));
    }, 100);
  }

  @Post('register')
  async register(@Body() dto: RegisterUserDto) {
    return this.registrationService.register(dto.email);
  }

  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.registrationService.verifyEmail(dto.workflowId, dto.token);
  }
}
