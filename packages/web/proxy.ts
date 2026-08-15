import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  // Protect all dashboard routes + root. Login page remains public.
  matcher: [
    "/",
    "/admin/:path*",
    "/student/:path*",
    "/class-president/:path*",
    "/advisor/:path*",
    "/department/:path*",
  ],
};
