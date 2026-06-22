import { Injectable, Inject, Logger, OnModuleInit } from "@nestjs/common";
import { Resend } from "resend";
import { IQueueService, IQueueServiceToken } from "../common/queue/queue.service";
import { InMemoryQueueService } from "../../infrastructure/queue/in-memory-queue.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private resend: Resend | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IQueueServiceToken)
    private readonly queue: IQueueService,
  ) {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey && apiKey !== "re_yourResendApiKeyHere" && apiKey.startsWith("re_")) {
      this.resend = new Resend(apiKey);
      this.logger.log("Resend client service initialized successfully.");
    } else {
      this.logger.warn(
        "RESEND_API_KEY is missing or dev template. Emails will fall back to log printing.",
      );
    }
  }

  onModuleInit() {
    if (this.queue instanceof InMemoryQueueService) {
      this.queue.registerProcessor("send-notification", async (payload: any) => {
        await this.sendEmail(payload.orgId, payload.kind, payload.recipientEmail, payload.payload);
      });
    }
  }

  async sendEmail(
    orgId: string,
    kind: string,
    recipientEmail: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Enqueuing email dispatch: To=${recipientEmail}, Kind=${kind}`);

    const subject = this.getEmailSubject(kind, payload);
    const html = this.getEmailHtml(kind, payload);

    // Save notification to database outbox
    const outboxRecord = await this.prisma.notificationOutbox.create({
      data: {
        org_id: orgId || "00000000-0000-0000-0000-000000000000",
        kind,
        recipient_email: recipientEmail,
        payload,
        status: "pending",
      },
    });

    if (!this.resend) {
      this.logger.log(
        `[Email Output Mock LOG] To: ${recipientEmail} | Subject: "${subject}" | Content Preview: ${html.slice(0, 150)}...`,
      );
      await this.prisma.notificationOutbox.update({
        where: { id: outboxRecord.id },
        data: { status: "sent", sent_at: new Date() },
      });
      return;
    }

    try {
      await this.resend.emails.send({
        from: "Lokality AI Recruitment <recruitment@lokality.ai>",
        to: recipientEmail,
        subject,
        html,
      });

      await this.prisma.notificationOutbox.update({
        where: { id: outboxRecord.id },
        data: { status: "sent", sent_at: new Date() },
      });
      this.logger.log(`Email successfully dispatched via Resend to ${recipientEmail}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Resend email delivery failed: ${msg}`);
      await this.prisma.notificationOutbox.update({
        where: { id: outboxRecord.id },
        data: { status: "failed", error: msg },
      });
    }
  }

  private getEmailSubject(kind: string, payload: any): string {
    switch (kind) {
      case "candidate_welcome":
        return `Welcome to Lokality: Application Received`;
      case "interview_invitation":
        return `Action Required: Schedule your Lokality AI Interview for ${payload.role || "Job Position"}`;
      case "interview_reminder":
        return `Reminder: Your Lokality AI Interview is scheduled soon`;
      case "interview_report_ready":
        return `Lokality Grader: Assessment report for ${payload.candidateName} is ready`;
      default:
        return "Recruitment updates from Lokality AI";
    }
  }

  private getEmailHtml(kind: string, payload: any): string {
    switch (kind) {
      case "candidate_welcome":
        return `<h3>Dear ${payload.candidateName || "Candidate"},</h3>
                <p>We have successfully received your application for the <strong>${payload.role || "Job Position"}</strong> role.</p>
                <p>Our talent acquisition team will review your profile credentials and follow up regarding next steps shortly.</p>
                <p>Best regards,<br/>The Talent Acquisition Team</p>`;
      case "interview_invitation":
        return `<h3>Dear ${payload.candidateName || "Candidate"},</h3>
                <p>You have been invited to participate in an AI-assisted interview screening for the <strong>${payload.role || "Job Position"}</strong> position.</p>
                <p>Please enter the candidate portal using the link below to verify your device credentials and complete the interview session:</p>
                <p><a href="${process.env.APP_URL || "http://localhost:5173"}/candidate/prepare?id=${payload.interviewId}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:4px;">Enter Interview Room</a></p>
                <p>Best regards,<br/>Talent Team</p>`;
      case "interview_reminder":
        return `<h3>Dear ${payload.candidateName || "Candidate"},</h3>
                <p>This is a reminder that your scheduled Lokality AI Interview session will commence at <strong>${payload.scheduledAt}</strong>.</p>
                <p>Please ensure you are using a quiet space, have camera and microphone permissions allowed, and close other browser tabs to prevent integrity warnings.</p>
                <p>Best regards,<br/>Talent Team</p>`;
      case "interview_report_ready":
        return `<h3>Lokality AI Notification: Report Ready</h3>
                <p>AI candidate evaluation report for <strong>${payload.candidateName}</strong> has been finalized.</p>
                <p>Overall Assessment Score: <strong>${payload.score}/100</strong>.</p>
                <p><a href="${process.env.APP_URL || "http://localhost:5173"}/recruiter/reports/${payload.interviewId}">Open Recruiter Reports Dashboard</a></p>
                <p>Best regards,<br/>Lokality AI Engine</p>`;
      default:
        return `<p>This is an automated system email update regarding your application profile.</p>`;
    }
  }
}
