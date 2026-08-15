import "next-auth";

declare module "next-auth" {
  interface Session {
    customJwt?: string;
    user: {
      id: string;
      role: string;
      studentId: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role?: string;
    session_version?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    studentId?: string;
    session_version?: number;
    customJwt?: string;
  }
}
