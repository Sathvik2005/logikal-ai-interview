import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { buildRequestUser, verifyAccessToken } from "./token-verifier";

export { DEFAULT_ORG_ID } from "./token-verifier";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers["authorization"];

    if (!authHeader) {
      throw new UnauthorizedException("Missing authorization header");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Invalid authorization format. Bearer token expected.");
    }

    const token = authHeader.split(" ")[1];
    try {
      const claims = await verifyAccessToken(token);
      // Trusted values only: role/org come from the database, not from user-editable token metadata.
      const user = await buildRequestUser(this.prisma, claims);
      // A recruiter must belong to an organization; without one every query would fall into the shared
      // default organization. (Admins may be global, e.g. the platform super admin.) Dev/test keep the fallback.
      if (
        process.env.NODE_ENV === "production" &&
        user.role === "recruiter" &&
        !user.orgFromProfile
      ) {
        throw new ForbiddenException("Your account is not assigned to an organization.");
      }
      request.user = user;
      return true;
    } catch (err) {
      throw new UnauthorizedException(
        `Authorization failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
