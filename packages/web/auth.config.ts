import type { NextAuthConfig } from "next-auth";

const ROLE_REDIRECTS: Record<string, string> = {
  STUDENT: '/student/dashboard',
  CLASS_COMMITTEE: '/class-president/dashboard',
  ADVISOR: '/advisor/dashboard',
  DEPARTMENT: '/department/dashboard',
  SCHOOL_ADMIN: '/admin',
};

export default {
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const path = nextUrl.pathname;
      const role = (auth?.user as any)?.role as string | undefined;
      const isLoggedIn = !!role;

      // Public routes — let through
      if (path === '/login' || path === '/forgot-password') return true;

      // Not logged in → redirect to login
      if (!isLoggedIn) return false;

      // Root "/" → redirect to role-based dashboard
      if (path === '/') {
        const destination = ROLE_REDIRECTS[role!] || '/student';
        return Response.redirect(new URL(destination, nextUrl));
      }

      // Handle deleted base pages to prevent 404 for old bookmarks
      if (path === '/advisor') return Response.redirect(new URL('/advisor/dashboard', nextUrl));
      if (path === '/department') return Response.redirect(new URL('/department/dashboard', nextUrl));
      if (path === '/class-president') return Response.redirect(new URL('/class-president/dashboard', nextUrl));

      // Admin routes
      if (path.startsWith('/admin') && role !== 'SCHOOL_ADMIN') {
        return Response.redirect(new URL('/', nextUrl));
      }
      // Department routes
      if (path.startsWith('/department') && role !== 'DEPARTMENT' && role !== 'SCHOOL_ADMIN') {
        return Response.redirect(new URL('/', nextUrl));
      }
      // Class president routes
      if (path.startsWith('/class-president') && role !== 'CLASS_COMMITTEE') {
        return Response.redirect(new URL('/', nextUrl));
      }
      // Advisor routes
      if (path.startsWith('/advisor') && role !== 'ADVISOR') {
        const destination = ROLE_REDIRECTS[role!] || '/student';
        return Response.redirect(new URL(destination, nextUrl));
      }
      // Student routes — allow CLASS_COMMITTEE and ADVISOR to access /student
      // for self-scoring ("Phiếu của bản thân")
      if (path.startsWith('/student') && role !== 'STUDENT' && role !== 'CLASS_COMMITTEE' && role !== 'ADVISOR') {
        const destination = ROLE_REDIRECTS[role!] || '/student';
        return Response.redirect(new URL(destination, nextUrl));
      }

      return true;
    },
  },
  providers: [], // Providers added in full auth.ts
} satisfies NextAuthConfig;
