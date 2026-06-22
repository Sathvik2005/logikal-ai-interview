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

@WebSocketGateway({ cors: { origin: "*" }, namespace: "interview" })
export class InterviewGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(InterviewGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly interviewEngine: InterviewEngineService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Realtime client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Realtime client disconnected: ${client.id}`);
  }

  @SubscribeMessage("join-session")
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; role: "candidate" | "recruiter" },
  ) {
    client.join(data.sessionId);
    this.logger.log(`Client [${client.id}] joined room: ${data.sessionId} as ${data.role}`);
    client.emit("joined", { status: "success", room: data.sessionId });
  }

  @SubscribeMessage("candidate-speech")
  async handleCandidateSpeech(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; text: string },
  ) {
    this.logger.log(`Speech input for session [${data.sessionId}]: ${data.text}`);

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
  handleWaveformData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; values: number[] },
  ) {
    client.to(data.sessionId).emit("live-waveform", { values: data.values });
  }
}
