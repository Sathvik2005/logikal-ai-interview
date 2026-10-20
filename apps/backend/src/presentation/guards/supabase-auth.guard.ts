import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
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
      request.user = await buildRequestUser(this.prisma, claims);
      return true;
    } catch (err) {
      throw new UnauthorizedException(
        `Authorization failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
