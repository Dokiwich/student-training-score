import 'next-auth';

declare module 'next-auth' {
  interface Session {
    customJwt?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    customJwt?: string;
  }
}
