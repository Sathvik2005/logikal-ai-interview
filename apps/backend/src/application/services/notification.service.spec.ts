import { Test, TestingModule } from "@nestjs/testing";
import { NotificationService } from "./notification.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { IQueueServiceToken } from "../common/queue/queue.service";
import { InMemoryQueueService } from "../../infrastructure/queue/in-memory-queue.service";

describe("NotificationService", () => {
  let service: NotificationService;
  let prisma: any;
  let queue: any;

  const mockPrismaService = {
    notificationOutbox: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockQueueService = {
    registerProcessor: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.RESEND_API_KEY; // clear any existing key

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IQueueServiceToken,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get<PrismaService>(PrismaService);
    queue = module.get(IQueueServiceToken);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("onModuleInit", () => {
    it("should register background task send-notification if in-memory queue", () => {
      const inMemoryQueue = Object.create(InMemoryQueueService.prototype);
      inMemoryQueue.registerProcessor = jest.fn();

      const tempService = new NotificationService(prisma, inMemoryQueue);
      tempService.onModuleInit();

      expect(inMemoryQueue.registerProcessor).toHaveBeenCalledWith(
        "send-notification",
        expect.any(Function),
      );
    });
  });

  describe("sendEmail (Mock Log Mode)", () => {
    it("should write email payload to notificationOutbox and complete without calling Resend client", async () => {
      const mockOutbox = { id: "outbox-123", status: "pending" };
      prisma.notificationOutbox.create.mockResolvedValue(mockOutbox);
      prisma.notificationOutbox.update.mockResolvedValue({});

      const loggerLogSpy = jest.spyOn((service as any).logger, "log").mockImplementation(() => {});

      await service.sendEmail("org-1", "candidate_welcome", "test@example.com", {
        candidateName: "Alice",
        role: "Node Engineer",
      });

      expect(prisma.notificationOutbox.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          org_id: "org-1",
          kind: "candidate_welcome",
          recipient_email: "test@example.com",
          status: "pending",
        }),
      });

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Email Output Mock LOG] To: test@example.com"),
      );

      expect(prisma.notificationOutbox.update).toHaveBeenCalledWith({
        where: { id: "outbox-123" },
        data: expect.objectContaining({
          status: "sent",
          sent_at: expect.any(Date),
        }),
      });
    });
  });

  describe("sendEmail (Resend Client Mode)", () => {
    let serviceWithResend: NotificationService;
    let mockSend: jest.Mock;

    beforeEach(async () => {
      process.env.RESEND_API_KEY = "re_someapikey";
      process.env.EMAIL_FROM_NAME = "Lokality AI Recruitment";
      process.env.EMAIL_FROM_ADDRESS = "recruitment@lokality.ai";
      mockSend = jest.fn().mockResolvedValue({});

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: IQueueServiceToken,
            useValue: mockQueueService,
          },
        ],
      }).compile();

      serviceWithResend = module.get<NotificationService>(NotificationService);
      (serviceWithResend as any).resend = {
        emails: {
          send: mockSend,
        },
      };
    });

    it("should send email via Resend and update outbox status to sent", async () => {
      const mockOutbox = { id: "outbox-456", status: "pending" };
      prisma.notificationOutbox.create.mockResolvedValue(mockOutbox);
      prisma.notificationOutbox.update.mockResolvedValue({});

      await serviceWithResend.sendEmail("org-2", "interview_invitation", "bob@example.com", {
        candidateName: "Bob",
        role: "React Dev",
        interviewId: "int-789",
      });

      expect(mockSend).toHaveBeenCalledWith({
        from: "Lokality AI Recruitment <recruitment@lokality.ai>",
        to: "bob@example.com",
        subject: "Action Required: Schedule your Lokality AI Interview for React Dev",
        html: expect.stringContaining("Bob"),
      });

      expect(prisma.notificationOutbox.update).toHaveBeenCalledWith({
        where: { id: "outbox-456" },
        data: expect.objectContaining({
          status: "sent",
          sent_at: expect.any(Date),
        }),
      });
    });

    it("should catch errors from Resend and update outbox status to failed", async () => {
      const mockOutbox = { id: "outbox-789", status: "pending" };
      prisma.notificationOutbox.create.mockResolvedValue(mockOutbox);
      prisma.notificationOutbox.update.mockResolvedValue({});
      mockSend.mockRejectedValue(new Error("Network Timeout"));

      const loggerErrorSpy = jest
        .spyOn((serviceWithResend as any).logger, "error")
        .mockImplementation(() => {});

      await expect(
        serviceWithResend.sendEmail("org-2", "interview_reminder", "bob@example.com", {
          candidateName: "Bob",
          scheduledAt: "10:00 AM",
        }),
      ).rejects.toThrow(/Email delivery failed: Network Timeout/);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        "Resend email delivery failed with sender [Lokality AI Recruitment <recruitment@lokality.ai>]: Network Timeout",
      );

      expect(prisma.notificationOutbox.update).toHaveBeenCalledWith({
        where: { id: "outbox-789" },
        data: {
          status: "failed",
          error: "Original: Network Timeout | Fallback: Network Timeout",
        },
      });
    });
  });

  describe("idempotent sending (at-least-once queue delivery)", () => {
    const payload = { candidateName: "Jane", interviewId: "int-1", role: "Dev" };
    const duplicateError = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

    beforeEach(() => {
      prisma.notificationOutbox.create.mockReset();
      prisma.notificationOutbox.update.mockReset().mockResolvedValue({});
      prisma.notificationOutbox.findUnique.mockReset();
    });

    it("derives a stable key per event and recipient, and none when there is no event id", () => {
      const a = NotificationService.dedupeKey("interview_invitation", "Jane@X.com", payload);
      const b = NotificationService.dedupeKey("interview_invitation", "jane@x.com ", payload);
      const other = NotificationService.dedupeKey("interview_invitation", "jane@x.com", {
        interviewId: "int-2",
      });
      expect(a).toBe(b); // case/whitespace-insensitive
      expect(a).not.toBe(other);
      expect(
        NotificationService.dedupeKey("candidate_welcome", "jane@x.com", { candidateName: "Jane" }),
      ).toBeNull();
      // reminders for different times are different events
      expect(
        NotificationService.dedupeKey("interview_reminder", "j@x.com", {
          interviewId: "i",
          scheduledAt: "9",
        }),
      ).not.toBe(
        NotificationService.dedupeKey("interview_reminder", "j@x.com", {
          interviewId: "i",
          scheduledAt: "10",
        }),
      );
    });

    it("stores the dedupe key with the outbox row", async () => {
      prisma.notificationOutbox.create.mockResolvedValue({ id: "o1", status: "pending" });
      await service.sendEmail("org-1", "interview_invitation", "jane@x.com", payload);
      expect(prisma.notificationOutbox.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dedupe_key: NotificationService.dedupeKey("interview_invitation", "jane@x.com", payload),
        }),
      });
    });

    it("suppresses a retry when the same event was already sent", async () => {
      prisma.notificationOutbox.create.mockRejectedValue(duplicateError);
      prisma.notificationOutbox.findUnique.mockResolvedValue({ id: "o1", status: "sent" });
      const warn = jest.spyOn((service as any).logger, "warn").mockImplementation(() => {});

      await service.sendEmail("org-1", "interview_invitation", "jane@x.com", payload);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Duplicate interview_invitation"));
      expect(prisma.notificationOutbox.update).not.toHaveBeenCalled(); // nothing re-sent, nothing re-marked
    });

    it("retries on the same row when the earlier attempt had failed", async () => {
      prisma.notificationOutbox.create.mockRejectedValue(duplicateError);
      prisma.notificationOutbox.findUnique.mockResolvedValue({ id: "o1", status: "failed" });

      await service.sendEmail("org-1", "interview_invitation", "jane@x.com", payload);

      expect(prisma.notificationOutbox.update).toHaveBeenCalledWith({
        where: { id: "o1" },
        data: expect.objectContaining({ status: "sent" }),
      });
    });

    it("rethrows unrelated database errors", async () => {
      prisma.notificationOutbox.create.mockRejectedValue(new Error("db down"));
      await expect(
        service.sendEmail("org-1", "interview_invitation", "jane@x.com", payload),
      ).rejects.toThrow("db down");
    });
  });
});
