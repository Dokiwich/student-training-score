import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { getToken } from 'next-auth/jwt';

import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    try {
      const secret = process.env.NEXTAUTH_SECRET || "super-secret-key";
      
      console.log('--- JWT AUTH GUARD ---');
      const authHeader = request.headers.authorization;
      
      let tokenValue = null;

      // 1. Check for customJwt injected via Bearer Token
      if (authHeader && authHeader.startsWith('Bearer ')) {
        tokenValue = authHeader.split(' ')[1];
        console.log('Using Bearer Token');
        
        const decoded = jwt.verify(tokenValue, secret);
        request.user = decoded; // { id, role, studentId }
        return true;
      }
      
      // 2. Fallback to native NextAuth getToken if no Bearer token
      console.log('Headers cookie:', request.headers.cookie);
      const token = await getToken({ req: request, secret });
      console.log('Decrypted token:', token);

      if (!token) {
        console.error('Token null or invalid. Secret used:', secret);
        throw new UnauthorizedException('Token trong cookie không hợp lệ, không tồn tại hoặc đã hết hạn');
      }

      request.user = token; 
      return true;
    } catch (error) {
      console.error('JwtAuthGuard catch error:', error);
      throw new UnauthorizedException('Lỗi xác thực Token NextAuth');
    }
  }
}

