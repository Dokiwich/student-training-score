import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as string;
    const path = req.nextUrl.pathname;

    // Admin routes
    if (path.startsWith('/admin') && role !== 'SCHOOL_ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Class president routes
    if (path.startsWith('/class-president') && role !== 'CLASS_COMMITTEE' && role !== 'CLASS_PRESIDENT') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Advisor routes
    if (path.startsWith('/advisor') && role !== 'ADVISOR') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Student routes
    if (path.startsWith('/student') && role !== 'STUDENT') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|api).*)"],
};
