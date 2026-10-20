import { BadRequestException, HttpException } from "@nestjs/common";
import { ErrorCaptureFilter } from "./error-capture.filter";

const host = (req: any, res: any) =>
  ({ switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) }) as any;

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("ErrorCaptureFilter", () => {
  let prisma: { errorEvent: { create: jest.Mock } };
  let filter: ErrorCaptureFilter;
  const req = {
    method: "POST",
    originalUrl: "/api/interviews/session/end",
    headers: {},
    user: { userId: "u1", orgFromProfile: "org-1" },
  };

  beforeEach(() => {
    prisma = { errorEvent: { create: jest.fn().mockResolvedValue({}) } };
    filter = new ErrorCaptureFilter(prisma as any);
    jest.spyOn((filter as any).logger, "error").mockImplementation(() => {});
    jest.spyOn((filter as any).logger, "warn").mockImplementation(() => {});
  });

  it("passes client errors (4xx) through unchanged and does not record them", () => {
    const res = makeRes();
    filter.catch(new BadRequestException("Select at least one candidate."), host(req, res));

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Select at least one candidate." }),
    );
    expect(prisma.errorEvent.create).not.toHaveBeenCalled();
  });

  it("records unexpected errors, hides internals from the caller and returns a request id", () => {
    const res = makeRes();
    filter.catch(new Error("connection to database lost: password=secret"), host(req, res));

    expect(res.status).toHaveBeenCalledWith(500);
    const sent = res.json.mock.calls[0][0];
    expect(sent.message).toBe("Internal server error");
    expect(sent.message).not.toContain("secret");
    expect(typeof sent.requestId).toBe("string");
    expect(prisma.errorEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        org_id: "org-1",
        actor_id: "u1",
        source: "backend",
        request_id: sent.requestId,
        context: { method: "POST", url: "/api/interviews/session/end", status: 500 },
      }),
    });
  });

  it("records explicit 5xx HttpExceptions too, keeping their message", () => {
    const res = makeRes();
    filter.catch(new HttpException("Upstream unavailable", 503), host(req, res));

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0].message).toBe("Upstream unavailable");
    expect(prisma.errorEvent.create).toHaveBeenCalledTimes(1);
  });

  it("never throws when storing the event fails", () => {
    prisma.errorEvent.create.mockRejectedValue(new Error("db down"));
    const res = makeRes();
    expect(() => filter.catch(new Error("boom"), host(req, res))).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("is rate limited so an outage cannot flood the table", () => {
    for (let i = 0; i < 50; i++) filter.catch(new Error(`boom ${i}`), host(req, makeRes()));
    expect(prisma.errorEvent.create).toHaveBeenCalledTimes(30);
  });
});
