import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ROLE_REDIRECTS: Record<string, string> = {
  STUDENT: '/student',
  CLASS_COMMITTEE: '/class-president',
  CLASS_PRESIDENT: '/class-president',
  ADVISOR: '/advisor',
  DEPARTMENT: '/department',
  SCHOOL_ADMIN: '/admin',
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
    if (path.startsWith('/admin') && role !== 'SCHOOL_ADMIN') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Department routes
    if (path.startsWith('/department') && role !== 'DEPARTMENT' && role !== 'SCHOOL_ADMIN') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Class president routes
    if (path.startsWith('/class-president') && role !== 'CLASS_COMMITTEE' && role !== 'CLASS_PRESIDENT') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Advisor routes
    if (path.startsWith('/advisor') && role !== 'ADVISOR') {
      const destination = ROLE_REDIRECTS[role] || '/student';
      return NextResponse.redirect(new URL(destination, req.url));
    }
    // Student routes — allow CLASS_COMMITTEE and ADVISOR to access /student
    // for self-scoring ("Phiếu của bản thân")
    if (path.startsWith('/student') && role !== 'STUDENT' && role !== 'CLASS_COMMITTEE' && role !== 'ADVISOR') {
      const destination = ROLE_REDIRECTS[role] || '/student';
      return NextResponse.redirect(new URL(destination, req.url));
    }
  },
  {
    pages: {
      signIn: '/login',
    },
    callbacks: {
      authorized: ({ token }) => !!token?.role,
    },
  }
);

export const config = {
  // Protect all dashboard routes + root. Login page remains public.
  matcher: ["/", "/admin/:path*", "/student/:path*", "/class-president/:path*", "/advisor/:path*", "/department/:path*"],
};
