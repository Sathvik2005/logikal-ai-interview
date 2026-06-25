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
        expect.any(Function)
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
        expect.stringContaining("[Email Output Mock LOG] To: test@example.com")
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

      const loggerErrorSpy = jest.spyOn((serviceWithResend as any).logger, "error").mockImplementation(() => {});

      await serviceWithResend.sendEmail("org-2", "interview_reminder", "bob@example.com", {
        candidateName: "Bob",
        scheduledAt: "10:00 AM",
      });

      expect(loggerErrorSpy).toHaveBeenCalledWith("Resend email delivery failed: Network Timeout");

      expect(prisma.notificationOutbox.update).toHaveBeenCalledWith({
        where: { id: "outbox-789" },
        data: {
          status: "failed",
          error: "Network Timeout",
        },
      });
    });
  });
});
