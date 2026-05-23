import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import jwt from 'jsonwebtoken';

export async function GET(req: any) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'super-secret-key' });
  const envSecret = process.env.NEXTAUTH_SECRET;
  
  let decodedCustom = null;
  let customJwtError = null;
  if (token?.customJwt) {
    try {
      decodedCustom = jwt.verify(token.customJwt as string, process.env.NEXTAUTH_SECRET || 'super-secret-key');
    } catch (e: any) {
      customJwtError = e.message;
    }
  }

  return NextResponse.json({
    envSecret,
    token_exists: !!token,
    has_customJwt: !!token?.customJwt,
    decodedCustom,
    customJwtError
  });
}
