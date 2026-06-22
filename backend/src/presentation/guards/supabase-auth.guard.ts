import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid authorization format. Bearer token expected.');
    }

    const token = authHeader.split(' ')[1];
    try {
      const jwtSecret = process.env.JWT_SECRET;
      let decoded: any = null;

      if (jwtSecret && jwtSecret !== 'your-supabase-jwt-secret-used-for-validation' && jwtSecret.length > 5) {
        decoded = jwt.verify(token, jwtSecret);
      } else {
        // Fallback decode for local testing/development environments
        decoded = jwt.decode(token);
      }

      if (!decoded) {
        throw new UnauthorizedException('Invalid authorization token claims.');
      }

      // Populate request user scope
      request.user = {
        userId: decoded.sub,
        email: decoded.email,
        role: decoded.user_metadata?.role || 'candidate',
        orgId: decoded.user_metadata?.orgId || null,
        claims: decoded,
      };

      return true;
    } catch (err) {
      throw new UnauthorizedException(`Authorization failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
