export interface IQueueService {
  enqueue(taskName: string, payload: any, delayMs?: number): Promise<void>;
}

export const IQueueServiceToken = Symbol("IQueueService");
