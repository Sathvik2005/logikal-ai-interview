import { DomainEvent } from "../../../domain/common/domain-event.base";

export interface IEventBus {
  publish(event: DomainEvent): void;
  publishAll(events: DomainEvent[]): void;
}

export const IEventBusToken = Symbol("IEventBus");
