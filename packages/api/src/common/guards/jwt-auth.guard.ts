import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, InternalServerErrorException, Logger } from '@nestjs/common';
import { getToken } from 'next-auth/jwt';

import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    try {
      const secret = process.env.NEXTAUTH_SECRET;
      if (!secret) {
        this.logger.error("Missing NEXTAUTH_SECRET environment variable");
        throw new InternalServerErrorException("Server configuration error: Missing NEXTAUTH_SECRET");
      }
      
      const authHeader = request.headers.authorization;
      
      let userFromBearer = null;

      // 1. Check for customJwt injected via Bearer Token
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const tokenValue = authHeader.split(' ')[1];
        try {
          userFromBearer = jwt.verify(tokenValue, secret);
        } catch (err) {
          this.logger.warn(`Bearer token verify failed, falling back to cookie: ${(err as Error).message}`);
        }
      }

      if (userFromBearer) {
        request.user = userFromBearer;
        return true;
      }
      
      // 2. Fallback to native NextAuth getToken if no Bearer token or if Bearer failed
      const token = await getToken({ req: request, secret });

      if (!token) {
        throw new UnauthorizedException('Token không hợp lệ, không tồn tại hoặc đã hết hạn');
      }

      request.user = token; 
      return true;
    } catch (error) {
      if (error instanceof InternalServerErrorException || error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('JwtAuthGuard catch error', error instanceof Error ? error.stack : String(error));
      throw new UnauthorizedException('Lỗi xác thực Token NextAuth');
    }
  }
}

