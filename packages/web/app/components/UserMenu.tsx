'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Sinh viên',
  CLASS_PRESIDENT: 'Ban cán sự',
  CLASS_COMMITTEE: 'Ban cán sự',
  ADVISOR: 'Cố vấn học tập',
  SCHOOL_ADMIN: 'Quản trị viên',
  SUPER_ADMIN: 'Quản trị cấp cao',
};

export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!session?.user) return null;

  const user = session.user as { name?: string; role?: string; studentId?: string };
  const name = user.name || 'Người dùng';
  const role = user.role || '';
  const roleLabel = ROLE_LABELS[role] || role;

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-gray-200 hover:bg-gray-50 transition-colors text-sm"
          id="user-menu-button"
        >
          <span className="font-bold text-black">{name}</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-500 text-xs">{roleLabel}</span>
        </button>

        {open && (
          <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 py-1 z-50 animate-fade-in shadow-md">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-black">{name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{roleLabel}</p>
              {user.studentId && (
                <p className="text-xs text-gray-400 mt-0.5">MSSV: {user.studentId}</p>
              )}
            </div>

            <div className="px-2 py-1 border-b border-gray-100 text-sm">
              {role === 'STUDENT' ? (
                <>
                  <Link
                    href="/student"
                    className="block px-3 py-2 text-black hover:bg-gray-50"
                    onClick={() => setOpen(false)}
                  >
                    Trang tự chấm
                  </Link>
                  <Link
                    href="/student/history"
                    className="block px-3 py-2 text-black hover:bg-gray-50"
                    onClick={() => setOpen(false)}
                  >
                    Lịch sử đánh giá
                  </Link>
                </>
              ) : (
                <Link
                  href={
                    role === 'CLASS_PRESIDENT' || role === 'CLASS_COMMITTEE'
                      ? '/class-president'
                      : role === 'SCHOOL_ADMIN' || role === 'SUPER_ADMIN'
                      ? '/admin'
                      : '/advisor'
                  }
                  className="block px-3 py-2 text-black hover:bg-gray-50"
                  onClick={() => setOpen(false)}
                >
                  Bảng điều khiển
                </Link>
              )}
            </div>

            <div className="px-2 py-1">
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50"
                id="logout-button-menu"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        )}
      </div>
      
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="px-4 py-2 text-sm font-bold bg-black text-white hover:bg-gray-800 transition-colors"
        id="logout-button-direct"
      >
        Đăng xuất
      </button>
    </div>
  );
}
