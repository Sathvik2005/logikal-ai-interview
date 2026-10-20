import { InterviewGateway } from "./interview.gateway";

jest.mock("../guards/token-verifier", () => ({
  verifyAccessToken: jest.fn(),
  buildRequestUser: jest.fn(),
}));
import { buildRequestUser, verifyAccessToken } from "../guards/token-verifier";

const verify = verifyAccessToken as jest.Mock;
const buildUser = buildRequestUser as jest.Mock;

const makeClient = (auth: any = { token: "t" }) => {
  const emitted: Array<[string, any]> = [];
  const client: any = {
    id: "sock-1",
    data: {},
    handshake: { auth, headers: {} },
    emit: jest.fn((e: string, p: any) => emitted.push([e, p])),
    join: jest.fn(),
    disconnect: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  };
  client.emitted = emitted;
  return client;
};

describe("InterviewGateway access control", () => {
  let prisma: any;
  let engine: any;
  let gateway: InterviewGateway;
  let roomEmit: jest.Mock;

  const session = (over: any = {}) => ({
    id: "s1",
    interview: { org_id: "org-1", candidate: { user_id: "cand-user" }, ...over },
  });

  beforeEach(() => {
    prisma = { interviewSession: { findUnique: jest.fn().mockResolvedValue(session()) } };
    engine = {
      appendTurn: jest.fn().mockResolvedValue({ id: "t1", started_at: new Date() }),
      getNextQuestion: jest.fn().mockResolvedValue({ id: "t2", text: "Next?" }),
      recordEvent: jest.fn(),
    };
    gateway = new InterviewGateway(engine, prisma);
    roomEmit = jest.fn();
    (gateway as any).server = { to: jest.fn().mockReturnValue({ emit: roomEmit }) };
    jest.spyOn((gateway as any).logger, "log").mockImplementation(() => {});
    jest.spyOn((gateway as any).logger, "warn").mockImplementation(() => {});
    verify.mockReset().mockResolvedValue({ sub: "x" });
    buildUser.mockReset();
  });

  it("disconnects clients that present no token", async () => {
    const client = makeClient({});
    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.emitted[0][0]).toBe("unauthorized");
  });

  it("disconnects clients with an invalid token", async () => {
    verify.mockRejectedValue(new Error("invalid signature"));
    const client = makeClient();
    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it("lets the candidate join and act on their own session", async () => {
    buildUser.mockResolvedValue({ userId: "cand-user", role: "candidate" });
    const client = makeClient();
    await gateway.handleConnection(client);

    await gateway.handleJoinSession(client, { sessionId: "s1" });
    expect(client.join).toHaveBeenCalledWith("s1");

    await gateway.handleCandidateSpeech(client, { sessionId: "s1", text: "my answer" });
    expect(engine.appendTurn).toHaveBeenCalledWith("s1", "candidate", "my answer");
  });

  it("refuses another candidate's session (join and speak)", async () => {
    buildUser.mockResolvedValue({ userId: "someone-else", role: "candidate" });
    const client = makeClient();
    await gateway.handleConnection(client);

    await gateway.handleJoinSession(client, { sessionId: "s1" });
    expect(client.join).not.toHaveBeenCalled();
    expect(client.emitted.find(([e]: [string, any]) => e === "joined")?.[1]).toEqual({ status: "forbidden" });

    await gateway.handleCandidateSpeech(client, { sessionId: "s1", text: "injected" });
    expect(engine.appendTurn).not.toHaveBeenCalled();
  });

  it("lets a recruiter observe a session in their organization but not speak as the candidate", async () => {
    buildUser.mockResolvedValue({ userId: "rec", role: "recruiter", orgFromProfile: "org-1" });
    const client = makeClient();
    await gateway.handleConnection(client);

    await gateway.handleJoinSession(client, { sessionId: "s1" });
    expect(client.join).toHaveBeenCalledWith("s1");

    await gateway.handleCandidateSpeech(client, { sessionId: "s1", text: "pretend" });
    expect(engine.appendTurn).not.toHaveBeenCalled(); // no impersonating the candidate
  });

  it("refuses a recruiter from a different organization", async () => {
    buildUser.mockResolvedValue({ userId: "rec", role: "recruiter", orgFromProfile: "other-org" });
    const client = makeClient();
    await gateway.handleConnection(client);
    await gateway.handleJoinSession(client, { sessionId: "s1" });
    expect(client.join).not.toHaveBeenCalled();
  });

  it("ignores messages for sessions that do not exist and from sockets that never authenticated", async () => {
    buildUser.mockResolvedValue({ userId: "cand-user", role: "candidate" });
    const client = makeClient();
    await gateway.handleConnection(client);
    prisma.interviewSession.findUnique.mockResolvedValue(null);
    await gateway.handleProctorAlert(client, { sessionId: "nope", type: "tab_switch" });
    expect(engine.recordEvent).not.toHaveBeenCalled();

    const anon = makeClient({});
    await gateway.handleConnection(anon);
    await gateway.handleCandidateSpeech(anon, { sessionId: "s1", text: "x" });
    expect(engine.appendTurn).not.toHaveBeenCalled();
  });
});
