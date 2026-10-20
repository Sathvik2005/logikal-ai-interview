import { Test, TestingModule } from "@nestjs/testing";
import { InMemoryQueueService } from "./in-memory-queue.service";

describe("InMemoryQueueService", () => {
  let service: InMemoryQueueService;

  beforeEach(async () => {
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [InMemoryQueueService],
    }).compile();

    service = module.get<InMemoryQueueService>(InMemoryQueueService);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should register a processor and execute tasks asynchronously using setImmediate", async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    service.registerProcessor("test-task", handler);

    await service.enqueue("test-task", { data: "abc" });

    expect(handler).not.toHaveBeenCalled();

    // Fast-forward immediate tasks
    jest.runAllTimers();

    expect(handler).toHaveBeenCalledWith({ data: "abc" });
  });

  it("should register a processor and execute tasks asynchronously using setTimeout when delay is specified", async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    service.registerProcessor("delayed-task", handler);

    await service.enqueue("delayed-task", { key: 1 }, 500);

    // Should not execute because of 500ms delay
    expect(handler).not.toHaveBeenCalled();

    // Advance time
    jest.advanceTimersByTime(500);
    expect(handler).toHaveBeenCalledWith({ key: 1 });
  });

  it("should log a warning if no handler is registered for a task", async () => {
    const loggerWarnSpy = jest.spyOn((service as any).logger, "warn").mockImplementation(() => {});

    await service.enqueue("missing-task", { data: 123 });
    jest.runAllTimers();

    expect(loggerWarnSpy).toHaveBeenCalledWith("No handler registered for task: missing-task");
  });

  it("should handle processor errors gracefully and log them", async () => {
    const handler = jest.fn().mockRejectedValue(new Error("Processor error"));
    service.registerProcessor("failing-task", handler);

    const loggerErrorSpy = jest.spyOn((service as any).logger, "error").mockImplementation(() => {});

    await service.enqueue("failing-task", { count: 5 });
    jest.runAllTimers();
    await Promise.resolve();
    await Promise.resolve();

    expect(handler).toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "Task [failing-task] failed: Processor error",
      expect.any(String)
    );
  });
});
