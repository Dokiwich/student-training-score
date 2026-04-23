import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ROLE_REDIRECTS: Record<string, string> = {
  STUDENT: '/student',
  CLASS_PRESIDENT: '/class-president',
  CLASS_COMMITTEE: '/class-president',
  ADVISOR: '/advisor',
  SCHOOL_ADMIN: '/admin',
  SUPER_ADMIN: '/admin',
};

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as string;
    const path = req.nextUrl.pathname;

    // Root "/" → redirect to role-based dashboard
    if (path === '/') {
      const destination = ROLE_REDIRECTS[role] || '/student';
      return NextResponse.redirect(new URL(destination, req.url));
    }

    // Admin routes
    if (path.startsWith('/admin') && role !== 'SCHOOL_ADMIN' && role !== 'SUPER_ADMIN') {
      const destination = ROLE_REDIRECTS[role] || '/student';
      return NextResponse.redirect(new URL(destination, req.url));
    }
    // Class president routes
    if (path.startsWith('/class-president') && role !== 'CLASS_COMMITTEE' && role !== 'CLASS_PRESIDENT') {
      const destination = ROLE_REDIRECTS[role] || '/student';
      return NextResponse.redirect(new URL(destination, req.url));
    }
    // Advisor routes
    if (path.startsWith('/advisor') && role !== 'ADVISOR') {
      const destination = ROLE_REDIRECTS[role] || '/student';
      return NextResponse.redirect(new URL(destination, req.url));
    }
    // Student routes
    if (path.startsWith('/student') && role !== 'STUDENT') {
      const destination = ROLE_REDIRECTS[role] || '/student';
      return NextResponse.redirect(new URL(destination, req.url));
    }
  },
  {
    pages: {
      signIn: '/login',
    },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  // Protect all dashboard routes + root. Login page remains public.
  matcher: ["/", "/admin/:path*", "/student/:path*", "/class-president/:path*", "/advisor/:path*"],
};
