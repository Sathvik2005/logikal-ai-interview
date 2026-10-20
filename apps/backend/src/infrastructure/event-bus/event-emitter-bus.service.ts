import { Injectable, Logger } from "@nestjs/common";
import { IEventBus } from "../../application/common/event-bus/event-bus.interface";
import { DomainEvent } from "../../domain/common/domain-event.base";
import { Subject } from "rxjs";

@Injectable()
export class EventEmitterBusService implements IEventBus {
  private readonly logger = new Logger(EventEmitterBusService.name);
  private readonly eventSubject = new Subject<DomainEvent>();

  publish(event: DomainEvent): void {
    this.logger.log(
      `Publishing Domain Event: ${event.getEventName()} (Occurred: ${event.occurredAt.toISOString()})`,
    );
    this.eventSubject.next(event);
  }

  publishAll(events: DomainEvent[]): void {
    events.forEach((e) => this.publish(e));
  }

  getEvents$() {
    return this.eventSubject.asObservable();
  }
}
