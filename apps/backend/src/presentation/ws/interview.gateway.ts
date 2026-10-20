import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { InterviewEngineService } from "../../application/interview/interview-engine.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { buildRequestUser, verifyAccessToken } from "../guards/token-verifier";

type WsUser = Awaited<ReturnType<typeof buildRequestUser>>;

/**
 * Realtime channel for live interviews.
 * Every connection must present a valid access token (`auth: { token }` in the socket.io handshake), and every
 * message is checked against the session it targets: a candidate may only act on their own interview session;
 * recruiters/admins may observe sessions in their organization. The web app does not depend on this channel
 * today (it uses the HTTP API), so it is locked down rather than left open.
 *
 * Scaling note: rooms live in this process. If you run several backend instances and start using this channel,
 * add `@socket.io/redis-adapter` (ioredis is already a dependency) so rooms span instances.
 */
@WebSocketGateway({
  namespace: "interview",
  cors: {
    // Evaluated per request (env is loaded after decorators run). Without FRONTEND_URL any origin is allowed,
    // but the token requirement above still applies.
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
      cb(null, !process.env.FRONTEND_URL || !origin || origin === process.env.FRONTEND_URL),
  },
})
export class InterviewGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(InterviewGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly interviewEngine: InterviewEngineService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const raw =
      (client.handshake.auth as { token?: string } | undefined)?.token ??
      client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");
    // Messages can arrive while verification is still running, so handlers await this promise.
    client.data.auth = (async () => {
      if (!raw) throw new Error("missing token");
      return buildRequestUser(this.prisma, await verifyAccessToken(raw));
    })();
    try {
      await client.data.auth;
      this.logger.log(`Realtime client connected: ${client.id}`);
    } catch {
      this.logger.warn(`Rejected unauthenticated realtime client: ${client.id}`);
      client.emit("unauthorized", { message: "A valid access token is required." });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Realtime client disconnected: ${client.id}`);
  }

  /** The authenticated user for this socket, or null (and the socket is dropped) if it never authenticated. */
  private async userOf(client: Socket): Promise<WsUser | null> {
    try {
      return (await client.data.auth) as WsUser;
    } catch {
      client.disconnect(true);
      return null;
    }
  }

  /**
   * candidate: only their own interview session. recruiter/admin: sessions in their organization (read/observe).
   */
  private async canAccessSession(user: WsUser, sessionId: string, asCandidate: boolean) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { interview: { include: { candidate: { select: { user_id: true } } } } },
    });
    if (!session) return false;
    const iv = session.interview;
    const isOwnCandidate = iv.candidate?.user_id === user.userId;
    if (asCandidate) return isOwnCandidate; // candidate-originated events: never allow impersonation
    if (user.role === "admin" || user.role === "recruiter") {
      return !user.orgFromProfile || !iv.org_id || iv.org_id === user.orgFromProfile;
    }
    return isOwnCandidate;
  }

  @SubscribeMessage("join-session")
  async handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; role?: "candidate" | "recruiter" },
  ) {
    const user = await this.userOf(client);
    if (!user) return;
    if (!data?.sessionId || !(await this.canAccessSession(user, data.sessionId, false))) {
      client.emit("joined", { status: "forbidden" });
      return;
    }
    client.join(data.sessionId);
    this.logger.log(`Client [${client.id}] (${user.role}) joined room: ${data.sessionId}`);
    client.emit("joined", { status: "success", room: data.sessionId });
  }

  @SubscribeMessage("candidate-speech")
  async handleCandidateSpeech(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; text: string },
  ) {
    const user = await this.userOf(client);
    if (!user || !(await this.canAccessSession(user, data?.sessionId, true))) return;
    this.logger.log(`Speech input for session [${data.sessionId}]`);

    // 1. Log candidate speech turn in database
    const turn = await this.interviewEngine.appendTurn(data.sessionId, "candidate", data.text);

    // 2. Broadcast turn to recruiter rooms
    this.server.to(data.sessionId).emit("turn-appended", {
      id: turn.id,
      speaker: "candidate",
      text: data.text,
      startedAt: turn.started_at,
    });

    // 3. Generate and push next AI interviewer prompt
    try {
      this.server.to(data.sessionId).emit("status-update", { status: "thinking" });
      const nextQuestion = await this.interviewEngine.getNextQuestion(data.sessionId);

      this.server.to(data.sessionId).emit("turn-appended", {
        id: nextQuestion.id,
        speaker: "persona",
        text: nextQuestion.text,
        startedAt: new Date(),
      });
      this.server.to(data.sessionId).emit("status-update", { status: "speaking" });
    } catch (err) {
      this.logger.error(`Error generating next interviewer prompt: ${err}`);
      this.server.to(data.sessionId).emit("status-update", { status: "idle" });
    }
  }

  @SubscribeMessage("proctor-alert")
  async handleProctorAlert(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; type: string; payload?: any },
  ) {
    const user = await this.userOf(client);
    if (!user || !(await this.canAccessSession(user, data?.sessionId, true))) return;
    this.logger.log(`Realtime proctoring signal [${data.type}] in session [${data.sessionId}]`);

    // 1. Record event logs
    await this.interviewEngine.recordEvent(data.sessionId, data.type, data.payload);

    // 2. Relay alerts to the recruiter live monitor panel
    this.server.to(data.sessionId).emit("proctor-warning", {
      type: data.type,
      payload: data.payload || {},
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage("waveform-data")
  async handleWaveformData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; values: number[] },
  ) {
    const user = await this.userOf(client);
    if (!user || !(await this.canAccessSession(user, data?.sessionId, true))) return;
    client.to(data.sessionId).emit("live-waveform", { values: data.values });
  }
}
