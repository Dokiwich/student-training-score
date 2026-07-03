'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const ROLE_REDIRECTS: Record<string, string> = {
  STUDENT: '/student',
  CLASS_COMMITTEE: '/class-president',
  ADVISOR: '/advisor',
  DEPARTMENT: '/department',
  SCHOOL_ADMIN: '/admin',
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.replace('/login');
      return;
    }

    const role = (session.user as { role?: string })?.role || 'STUDENT';
    const destination = ROLE_REDIRECTS[role] || '/student';
    router.replace(destination);
  }, [session, status, router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ color: '#9ca3af', fontSize: 14 }}>Đang chuyển hướng...</p>
    </div>
  );
}
