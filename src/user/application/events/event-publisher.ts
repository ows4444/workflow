export abstract class EventPublisher {
  abstract publish(event: object): Promise<void>;
}
