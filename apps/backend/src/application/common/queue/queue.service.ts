export interface IQueueService {
  enqueue(taskName: string, payload: any, delayMs?: number): Promise<void>;
  registerProcessor(taskName: string, processor: (payload: any) => Promise<void>): void;
}

export const IQueueServiceToken = Symbol("IQueueService");
