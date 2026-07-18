'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { LogOut, User, Key, HelpCircle, Laptop, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Sinh viên',
  CLASS_COMMITTEE: 'Ban cán sự',
  ADVISOR: 'Cố vấn học tập',
  DEPARTMENT: 'Khoa',
  SCHOOL_ADMIN: 'Quản trị viên',
};

export function UserMenu() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
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
  const initial = name.split(' ').pop()?.[0]?.toUpperCase() || '?';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 p-1.5 rounded-lg border border-transparent hover:bg-surface-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm">
          {initial}
        </div>
        <div className="hidden md:block text-left">
          <div className="text-sm font-semibold text-foreground leading-tight">{name}</div>
          <div className="text-[11px] text-muted-foreground">{roleLabel}</div>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-surface rounded-lg shadow-lg border border-border z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-border bg-surface-muted">
            <p className="text-sm font-semibold text-foreground truncate">{name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{roleLabel}</p>
            {user.studentId && (
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                {role === 'STUDENT' || role === 'CLASS_COMMITTEE' ? 'MSSV: ' : 'Email: '}
                {user.studentId}
              </p>
            )}
          </div>

          <div className="p-1.5 border-b border-border">
            <Link 
              href="/profile" 
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-muted rounded-md transition-colors"
            >
              <User size={16} />
              Hồ sơ cá nhân
            </Link>
            <Link 
              href="/profile?tab=security" 
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-muted rounded-md transition-colors"
            >
              <Key size={16} />
              Đổi mật khẩu
            </Link>
            
            <button 
              onClick={() => {
                setTheme(theme === 'dark' ? 'light' : 'dark');
              }}
              className="flex items-center justify-between w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-muted rounded-md transition-colors"
            >
              <div className="flex items-center gap-2">
                {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                Giao diện
              </div>
              <span className="text-xs">{theme === 'dark' ? 'Tối' : 'Sáng'}</span>
            </button>

            <Link 
              href="/help" 
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-muted rounded-md transition-colors"
            >
              <HelpCircle size={16} />
              Trung tâm trợ giúp
            </Link>
          </div>

          <div className="p-1.5">
            <button
              onClick={async () => {
                try {
                  await fetch('/api/auth/logout-all', { method: 'POST' });
                  signOut({ callbackUrl: '/login' });
                } catch (e) {
                  console.error(e);
                  signOut({ callbackUrl: '/login' });
                }
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-muted rounded-md transition-colors"
            >
              <Laptop size={16} />
              Đăng xuất mọi thiết bị
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-danger-bg rounded-md transition-colors font-medium mt-1"
            >
              <LogOut size={16} />
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
