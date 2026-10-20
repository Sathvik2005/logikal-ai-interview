import { Injectable, Inject, Logger, OnModuleInit } from "@nestjs/common";
import { Resend } from "resend";
import { IQueueService, IQueueServiceToken } from "../common/queue/queue.service";
import { createHash } from "node:crypto";
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

  /**
   * Stable key for "this email about this event to this person". Queue delivery is at-least-once, so a retried
   * job must not send twice. Kinds without a natural event id get no key (never suppressed).
   */
  static dedupeKey(kind: string, recipientEmail: string, payload: any): string | null {
    const eventId = payload?.decisionId ?? payload?.interviewId ?? payload?.candidateId;
    if (!eventId) return null;
    const when = kind === "interview_reminder" ? (payload?.scheduledAt ?? "") : "";
    return createHash("sha256")
      .update([kind, recipientEmail.trim().toLowerCase(), eventId, when].join("|"))
      .digest("hex");
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

    // Save notification to the outbox (or pick up the existing row if this is a retry of the same event)
    const dedupeKey = NotificationService.dedupeKey(kind, recipientEmail, payload);
    let outboxRecord: { id: string; status: string };
    try {
      outboxRecord = await this.prisma.notificationOutbox.create({
        data: {
          org_id: orgId || "00000000-0000-0000-0000-000000000000",
          kind,
          recipient_email: recipientEmail,
          payload,
          status: "pending",
          dedupe_key: dedupeKey,
        },
      });
    } catch (err: any) {
      if (err?.code !== "P2002" || !dedupeKey) throw err;
      const existing = await this.prisma.notificationOutbox.findUnique({
        where: { dedupe_key: dedupeKey },
      });
      if (!existing) throw err;
      if (existing.status === "sent") {
        this.logger.warn(`Duplicate ${kind} to ${recipientEmail} suppressed (already sent).`);
        return;
      }
      outboxRecord = existing; // earlier attempt failed or never finished: retry on the same row
    }

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

    const fromName = process.env.EMAIL_FROM_NAME || "Lokality AI Recruitment";
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || "onboarding@resend.dev";
    let fromHeader = `${fromName} <${fromAddress}>`;

    try {
      await this.resend.emails.send({
        from: fromHeader,
        to: recipientEmail,
        subject,
        html,
      });

      await this.prisma.notificationOutbox.update({
        where: { id: outboxRecord.id },
        data: { status: "sent", sent_at: new Date() },
      });
      this.logger.log(`Email successfully dispatched via Resend to ${recipientEmail}`);
    } catch (err: any) {
      const originalMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Resend email delivery failed with sender [${fromHeader}]: ${originalMsg}`);

      const isSandboxPossible = fromAddress !== "onboarding@resend.dev";
      if (isSandboxPossible) {
        this.logger.warn(
          `Attempting sandbox mode fallback email dispatch via onboarding@resend.dev...`,
        );
        try {
          fromHeader = `${fromName} <onboarding@resend.dev>`;
          await this.resend.emails.send({
            from: fromHeader,
            to: recipientEmail,
            subject,
            html,
          });

          await this.prisma.notificationOutbox.update({
            where: { id: outboxRecord.id },
            data: {
              status: "sent",
              sent_at: new Date(),
              error: `Fallback used. Original error: ${originalMsg}`,
            },
          });
          this.logger.log(`Email successfully dispatched via Resend fallback to ${recipientEmail}`);
          return;
        } catch (fallbackErr: any) {
          const fallbackMsg =
            fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          this.logger.error(`Resend fallback email delivery failed: ${fallbackMsg}`);

          await this.prisma.notificationOutbox.update({
            where: { id: outboxRecord.id },
            data: {
              status: "failed",
              error: `Original: ${originalMsg} | Fallback: ${fallbackMsg}`,
            },
          });
          throw new Error(`Email delivery failed: ${fallbackMsg}`);
        }
      } else {
        await this.prisma.notificationOutbox.update({
          where: { id: outboxRecord.id },
          data: { status: "failed", error: originalMsg },
        });
        throw new Error(`Email delivery failed: ${originalMsg}`);
      }
    }
  }

  private getEmailSubject(kind: string, payload: any): string {
    switch (kind) {
      case "candidate_welcome":
        return `Welcome to Lokality: Application Received`;
      case "interview_invitation":
        return payload.scheduledAt
          ? `Your Lokality AI Interview for ${payload.role || "Job Position"} is scheduled`
          : `Action Required: Schedule your Lokality AI Interview for ${payload.role || "Job Position"}`;
      case "candidate_outcome":
        return payload.outcome === "hire"
          ? `Good news about your application for ${payload.role || "the position"}`
          : `An update on your application for ${payload.role || "the position"}`;
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
                ${payload.scheduledAt ? `<p><strong>When:</strong> ${new Date(payload.scheduledAt).toUTCString()}${payload.durationMinutes ? ` (about ${payload.durationMinutes} minutes)` : ""}</p>` : ""}
                <p>Please enter the candidate portal using the link below to verify your device credentials and complete the interview session:</p>
                <p><a href="${process.env.APP_URL || "http://localhost:5173"}/candidate/prepare?id=${payload.interviewId}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:4px;">Enter Interview Room</a></p>
                <p>Best regards,<br/>Talent Team</p>`;
      case "candidate_outcome": {
        const esc = (s: unknown) =>
          String(s ?? "").replace(
            /[&<>"]/g,
            (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
          );
        const intro =
          payload.outcome === "hire"
            ? `<p>Thank you for taking the time to interview for the <strong>${esc(payload.role || "open")}</strong> position. We are pleased to let you know that we would like to move forward with you.</p>`
            : `<p>Thank you for taking the time to interview for the <strong>${esc(payload.role || "open")}</strong> position. After careful consideration we have decided not to move forward with your application at this time.</p>`;
        return `<h3>Dear ${esc(payload.candidateName || "Candidate")},</h3>
                ${intro}
                ${payload.message ? `<p>${esc(payload.message)}</p>` : ""}
                <p>Best regards,<br/>The Talent Acquisition Team</p>`;
      }
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
