'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Sinh viên',
  CLASS_PRESIDENT: 'Lớp trưởng',
  CLASS_COMMITTEE: 'Ban cán sự',
  ADVISOR: 'Cố vấn học tập',
};

export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
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
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-3 cursor-pointer rounded-xl px-3 py-2 transition-all hover:bg-gray-100 active:scale-[0.98]"
        id="user-menu-button"
      >
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold text-gray-900 leading-tight">{name}</p>
          <p className="text-xs text-gray-500 font-medium">{roleLabel}</p>
        </div>
        <div className="relative">
          {/* Avatar with initials */}
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-md border-2 border-white transition-transform duration-300 group-hover:scale-110 group-hover:shadow-lg">
            {initials}
          </div>
          {/* Online Badge */}
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
        </div>
        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 animate-fade-in origin-top-right">
          {/* User info section */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900">{name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{roleLabel}</p>
            {user.studentId && (
              <p className="text-xs text-gray-400 mt-0.5">MSSV: {user.studentId}</p>
            )}
          </div>

          {/* Navigation links */}
          <div className="px-2 py-2 border-b border-gray-100 space-y-0.5 text-sm font-medium">
             {role === 'STUDENT' ? (
               <>
                <Link 
                  href="/student" 
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  🏠 Trang chủ (Tự chấm)
                </Link>
                <Link 
                  href="/student/history" 
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  📜 Lịch sử đánh giá
                </Link>
               </>
             ) : (
               <Link 
                 href={role === 'CLASS_PRESIDENT' ? '/class-president' : '/advisor'} 
                 className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
                 onClick={() => setOpen(false)}
               >
                 👔 Bảng điều khiển
               </Link>
             )}
          </div>

          {/* Logout */}
          <div className="px-2 py-2">
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              id="logout-button"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
