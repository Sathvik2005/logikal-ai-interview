import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/database/prisma.service";

/**
 * Object-level access check for endpoints that act on one interview or interview session.
 * Role checks (RolesGuard) say *what kind* of user may call a route; this says *which interview* they may touch:
 *  - candidate: only their own interview/session (never someone else's),
 *  - recruiter/admin: interviews in their own organization (users without an organization are not restricted by org).
 * The interview/session id is read from the route params (`sessionId`, `interviewId`, `id`) or the request body.
 * A request that targets no identifiable interview is refused for candidates.
 */
@Injectable()
export class InterviewAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;

    const params = req.params ?? {};
    const body = req.body ?? {};
    const sessionId: string | undefined = params.sessionId ?? body.sessionId;
    const interviewId: string | undefined = params.interviewId ?? body.interviewId ?? params.id;

    let interview: { org_id: string | null; candidate: { user_id: string | null } | null } | null =
      null;
    if (sessionId) {
      const session = await this.prisma.interviewSession.findUnique({
        where: { id: sessionId },
        include: { interview: { include: { candidate: { select: { user_id: true } } } } },
      });
      interview = session?.interview ?? null;
    } else if (interviewId) {
      interview = await this.prisma.interview.findUnique({
        where: { id: interviewId },
        include: { candidate: { select: { user_id: true } } },
      });
    } else {
      return user.role !== "candidate";
    }

    if (!interview) return user.role !== "candidate"; // let staff reach the handler's own "not found"
    if (user.role === "admin" || user.role === "recruiter") {
      return !user.orgFromProfile || !interview.org_id || interview.org_id === user.orgFromProfile;
    }
    return interview.candidate?.user_id === user.userId;
  }
}
