import { Injectable, Logger } from '@nestjs/common';

import { EventPublisher } from '../../application/events/event-publisher';

@Injectable()
export class ConsoleEventPublisher extends EventPublisher {
  private readonly logger = new Logger(ConsoleEventPublisher.name);

  async publish(event: object): Promise<void> {
    this.logger.log(JSON.stringify(event, null, 2));
  }
}
