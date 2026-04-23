'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Sinh viên',
  CLASS_COMMITTEE: 'Ban cán sự',
  ADVISOR: 'Cố vấn học tập',
  SCHOOL_ADMIN: 'Quản trị viên',
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
  const initial = name.split(' ').pop()?.[0]?.toUpperCase() || '?';

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', background: 'var(--bg-surface)',
          cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
        }}
        id="user-menu-button"
      >
        <div style={{
          width: 28, height: 28, borderRadius: 'var(--radius)',
          background: 'var(--accent)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
        }}>{initial}</div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{roleLabel}</div>
        </div>
      </button>

      {open && (
        <div className="animate-fade-in" style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 4,
          width: 220, background: 'var(--bg-surface)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)', zIndex: 50, overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{roleLabel}</p>
            {user.studentId && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>MSSV: {user.studentId}</p>
            )}
          </div>

          <div style={{ padding: 4, borderBottom: '1px solid var(--border-light)' }}>
            {role === 'STUDENT' ? (
              <>
                <Link href="/student" onClick={() => setOpen(false)}
                  style={{ display: 'block', padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', borderRadius: 'var(--radius)', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  Trang tự chấm
                </Link>
                <Link href="/student/history" onClick={() => setOpen(false)}
                  style={{ display: 'block', padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', borderRadius: 'var(--radius)', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  Lịch sử đánh giá
                </Link>
              </>
            ) : (
              <Link
                href={role === 'CLASS_COMMITTEE' ? '/class-president' : role === 'SCHOOL_ADMIN' ? '/admin' : '/advisor'}
                onClick={() => setOpen(false)}
                style={{ display: 'block', padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', borderRadius: 'var(--radius)', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                Bảng điều khiển
              </Link>
            )}
          </div>

          <div style={{ padding: 4 }}>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 12px',
                fontSize: 13, color: 'var(--danger)', background: 'none',
                border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
                fontFamily: 'inherit', transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              id="logout-button-menu"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
