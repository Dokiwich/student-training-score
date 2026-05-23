import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "@student-score/database";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Tài khoản Sinh viên / Lớp trưởng / Cố vấn",
      credentials: {
        username: { label: "Tài khoản", type: "text", placeholder: "123" },
        password: { label: "Mật khẩu", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }
        
        // Try finding by student_id first, then by email
        let user = await prisma.users.findFirst({
          where: { student_id: credentials.username }
        });
        
        if (!user) {
          user = await prisma.users.findFirst({
            where: { email: credentials.username }
          });
        }
        
        if (!user) {
          return null;
        }

        if (user.locked_until && user.locked_until > new Date()) {
          throw new Error("ACCOUNT_LOCKED");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!isPasswordValid) {
          const newAttempts = (user.failed_login_attempts || 0) + 1;
          const updates: any = { failed_login_attempts: newAttempts };
          
          if (newAttempts >= 5) {
            updates.locked_until = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
          }
          
          await prisma.users.update({
            where: { id: user.id },
            data: updates
          });
          
          throw new Error("INVALID_CREDENTIALS");
        }

        // Reset failed attempts on success
        if (user.failed_login_attempts > 0 || user.locked_until) {
          await prisma.users.update({
            where: { id: user.id },
            data: { failed_login_attempts: 0, locked_until: null }
          });
        }

        const mappedRole = user.role;

        return {
          id: user.id,
          name: user.full_name,
          email: user.student_id || user.email, // we map student_id to Auth's email field for ease, fallback to actual email for DEPT/ADMIN
          role: mappedRole, 
          session_version: user.session_version
        } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
        token.studentId = user.email;
        token.session_version = (user as any).session_version || 1;
      } else if (token.id) {
        // Validate session_version against database for subsequent requests
        const dbUser = await prisma.users.findUnique({
          where: { id: token.id as string },
          select: { session_version: true }
        });
        if (!dbUser || dbUser.session_version !== token.session_version) {
          return {}; // Invalidate token
        }
      }

      if (!token.customJwt && token.id && token.role) {
         token.customJwt = jwt.sign(
           { id: token.id, role: token.role, studentId: token.studentId, session_version: token.session_version },
           process.env.NEXTAUTH_SECRET || "super-secret-key",
           { expiresIn: '1d' }
         );
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as { role?: unknown }).role = token.role;
        (session.user as { id?: unknown }).id = token.id;
        (session.user as { studentId?: unknown }).studentId = token.studentId;
        (session as { customJwt?: unknown }).customJwt = token.customJwt;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || "super-secret-key"
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
