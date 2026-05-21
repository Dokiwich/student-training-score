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

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!isPasswordValid) return null;

        const mappedRole = user.role;

        return {
          id: user.id,
          name: user.full_name,
          email: user.student_id || user.email, // we map student_id to Auth's email field for ease, fallback to actual email for DEPT/ADMIN
          role: mappedRole, 
        } as { id: string; name: string; email: string; role: string; };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
        token.studentId = user.email;
      }
      if (!token.customJwt && token.id && token.role) {
         token.customJwt = jwt.sign(
           { id: token.id, role: token.role, studentId: token.studentId },
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
