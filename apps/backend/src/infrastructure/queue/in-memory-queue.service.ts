import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { IQueueService } from "../../application/common/queue/queue.service";

@Injectable()
export class InMemoryQueueService implements IQueueService, OnModuleInit {
  private readonly logger = new Logger(InMemoryQueueService.name);
  private readonly handlers = new Map<string, (payload: any) => Promise<void>>();

  onModuleInit() {
    this.logger.log("In-Memory Queue Service initialized.");
  }

  registerProcessor(taskName: string, processor: (payload: any) => Promise<void>) {
    this.handlers.set(taskName, processor);
    this.logger.log(`Registered background processor for task: ${taskName}`);
  }

  async enqueue(taskName: string, payload: any, delayMs?: number): Promise<void> {
    this.logger.log(`Enqueued task [${taskName}] (Delay: ${delayMs ?? 0}ms)`);

    const taskExecution = async () => {
      const handler = this.handlers.get(taskName);
      if (!handler) {
        this.logger.warn(`No handler registered for task: ${taskName}`);
        return;
      }
      try {
        this.logger.log(`Executing background task [${taskName}]`);
        await handler(payload);
        this.logger.log(`Completed background task [${taskName}]`);
      } catch (err) {
        this.logger.error(
          `Task [${taskName}] failed: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    };

    if (delayMs && delayMs > 0) {
      setTimeout(taskExecution, delayMs);
    } else {
      setImmediate(taskExecution);
    }
  }
}
