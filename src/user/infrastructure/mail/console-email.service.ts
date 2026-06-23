import { Injectable, Logger } from '@nestjs/common';

import { EmailService } from './email.service';

@Injectable()
export class ConsoleEmailService extends EmailService {
  private readonly logger = new Logger(ConsoleEmailService.name);

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    this.logger.log(
      [
        '',
        '=========================',
        'EMAIL VERIFICATION',
        `email: ${email}`,
        `token: ${token}`,
        '=========================',
      ].join('\n'),
    );
  }
}
