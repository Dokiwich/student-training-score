'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef, Suspense } from 'react';
import './dashboard.css';

// ─── Trạng thái học kỳ ───────────────────────────────────────────────────────
interface SemesterInfo {
  id: string;
  code: string;
  name: string;
  academic_year: string;
  status: string;
  student_deadline?: string | null;
  class_committee_deadline?: string | null;
  advisor_deadline?: string | null;
  school_deadline?: string | null;
}

const SEM_STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  UPCOMING:          { label: 'Sắp diễn ra',   color: '#60a5fa', dot: '#3b82f6' }, // blue-400
  STUDENT_SCORING:   { label: 'SV đang chấm',   color: '#fbbf24', dot: '#f59e0b' }, // amber-400
  CLASS_REVIEWING:   { label: 'Lớp đang xét',   color: '#fbbf24', dot: '#f59e0b' },
  ADVISOR_REVIEWING: { label: 'CVHT đang xét',  color: '#a78bfa', dot: '#8b5cf6' }, // violet-400
  SCHOOL_REVIEWING:  { label: 'Trường đang xét', color: '#22d3ee', dot: '#06b6d4' }, // cyan-400
  FINALIZED:         { label: 'Đã chốt',         color: '#34d399', dot: '#10b981' }, // emerald-400
  LOCKED:            { label: 'Đã khóa',          color: '#9ca3af', dot: '#6b7280' }, // gray-400
};

function useSemesterStatus(intervalMs = 30000) {
  const [semester, setSemester] = useState<SemesterInfo | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSemester = async () => {
    try {
      const res = await fetch('/api/semester/active', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setSemester(json.data);
          setLastUpdated(new Date());
        }
      }
    } catch { /* silent fail */ }
  };

  useEffect(() => {
    fetchSemester();
    timerRef.current = setInterval(fetchSemester, intervalMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [intervalMs]);

  return { semester, lastUpdated, refetch: fetchSemester };
}

function SemesterBadge({ semester, collapsed }: { semester: SemesterInfo | null; collapsed: boolean }) {
  if (!semester) return (
    <div className="sidebar-brand-subtitle">{collapsed ? '' : 'Đang tải...'}</div>
  );

  const meta = SEM_STATUS_META[semester.status] || { label: semester.status, color: '#6b7280', dot: '#d1d5db' };
  const isPulsing = ['STUDENT_SCORING', 'CLASS_REVIEWING', 'ADVISOR_REVIEWING', 'SCHOOL_REVIEWING'].includes(semester.status);

  if (collapsed) return null;

  return (
    <div style={{ padding: '8px 0 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Semester name — avoid repeating academic_year if already in the name */}
      <div style={{ fontSize: 11, fontWeight: 600, color: '#f8fafc', opacity: 0.9, letterSpacing: '0.02em' }}>
        {semester.name.includes(semester.academic_year) ? semester.name : `${semester.name} — ${semester.academic_year}`}
      </div>
      {/* Live status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: meta.dot,
          display: 'inline-block', flexShrink: 0,
          animation: isPulsing ? 'semPulse 1.8s ease-in-out infinite' : 'none',
          boxShadow: isPulsing ? `0 0 0 0 ${meta.dot}` : 'none',
        }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          {meta.label}
        </span>
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Sinh viên',
  CLASS_COMMITTEE: 'Ban cán sự',
  ADVISOR: 'Cố vấn học tập',
  DEPARTMENT: 'Khoa',
  SCHOOL_ADMIN: 'Quản trị viên',
};

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  sectionLabel?: string;
}

const ROLE_NAV: Record<string, NavItem[]> = {
  STUDENT: [
    {
      label: 'Tự chấm điểm',
      href: '/student',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    },
    {
      label: 'Lịch sử đánh giá',
      href: '/student/history',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
  ],
  CLASS_COMMITTEE: [
    {
      label: 'Phiếu của bản thân',
      href: '/student',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    },
    {
      label: 'Tất cả sinh viên',
      href: '/class-president',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: 'Sinh viên đã chấm',
      href: '/class-president?filter=scored',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
    {
      label: 'Sinh viên chưa chấm',
      href: '/class-president?filter=unscored',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: 'Sinh viên chưa nộp',
      href: '/class-president?filter=pending',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
  ],
  ADVISOR: [
    {
      label: 'Tất cả sinh viên',
      href: '/advisor',
      sectionLabel: 'Danh sách',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },

    {
      label: 'Chờ duyệt',
      href: '/advisor?filter=unscored',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: 'Đã duyệt',
      href: '/advisor?filter=scored',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    },
    {
      label: 'Chưa nộp',
      href: '/advisor?filter=pending',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
    {
      label: 'Thống kê lớp',
      href: '/advisor?filter=summary',
      sectionLabel: 'Tổng quan',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
  ],
  DEPARTMENT: [
    {
      label: 'Dashboard',
      href: '/department',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      label: 'Biểu đồ thống kê',
      href: '/department?view=charts',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      sectionLabel: 'Tổng quan',
    },
    {
      label: 'Danh sách sinh viên',
      href: '/department?view=students',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      sectionLabel: 'Quản lý',
    },
    {
      label: 'Quản lý lớp & SV',
      href: '/department?view=manage',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      ),
    },
  ],
  SCHOOL_ADMIN: [
    {
      label: 'Tổng quan',
      href: '/admin?tab=dashboard',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      label: 'Danh sách sinh viên',
      href: '/admin?tab=students',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      sectionLabel: 'Quản lý',
    },
    {
      label: 'Tiêu chí chấm điểm',
      href: '/admin?tab=criteria',
      sectionLabel: 'Cấu hình',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
    {
      label: 'Học kỳ',
      href: '/admin?tab=semesters',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      label: 'Quản lý Khoa',
      href: '/admin?tab=departments',
      sectionLabel: 'Dữ liệu',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      label: 'Quản lý Lớp',
      href: '/admin?tab=classes',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: 'Người dùng',
      href: '/admin?tab=users',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
  ],
};



interface DashboardLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  pageSubtitle?: string;
  /** Extra badges/info shown in the top bar */
  topBarExtra?: React.ReactNode;
}

function SidebarNavList({ navItems, isDesktopCollapsed }: { navItems: NavItem[], isDesktopCollapsed: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString();
  const currentUrl = pathname + (queryString ? `?${queryString}` : '');

  return (
    <>
      {navItems.map((item) => {
        // Handle root paths vs parameterized paths
        const isActive = item.href.includes('?') 
          ? item.href === currentUrl
          : pathname === item.href && !queryString;

        return (
          <div key={item.href}>
            {item.sectionLabel && !isDesktopCollapsed && (
              <div className="sidebar-section-label" style={{ marginTop: 12 }}><span>{item.sectionLabel}</span></div>
            )}
            <Link
              href={item.href}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              title={isDesktopCollapsed ? item.label : undefined}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-item-text">{item.label}</span>
            </Link>
          </div>
        );
      })}
    </>
  );
}

export function DashboardLayout({
  children,
  pageTitle,
  pageSubtitle,
  topBarExtra,
}: DashboardLayoutProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const { semester: activeSemester } = useSemesterStatus(30000); // poll every 30s

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!session?.user) {
    return (
      <div className="dashboard-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '3px solid #e5e7eb', borderTopColor: '#5e6ad2',
              animation: 'spin 0.7s linear infinite', margin: '0 auto 12px'
            }} />
            <p style={{ color: '#9ca3af', fontSize: 13, fontWeight: 500 }}>Đang tải...</p>
          </div>
        </div>
      </div>
    );
  }

  const user = session.user as { name?: string; role?: string; studentId?: string };
  const name = user.name || 'Người dùng';
  const role = user.role || 'STUDENT';
  const roleLabel = ROLE_LABELS[role] || role;
  const navItems = ROLE_NAV[role] || ROLE_NAV.STUDENT;
  const initial = name.split(' ').pop()?.[0]?.toUpperCase() || '?';

  return (
    <div className="dashboard-shell">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''} ${isDesktopCollapsed ? 'collapsed' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: isDesktopCollapsed ? 'center' : 'flex-start', justifyContent: isDesktopCollapsed ? 'center' : 'space-between', width: '100%', flexDirection: isDesktopCollapsed ? 'column' : 'row', gap: isDesktopCollapsed ? 8 : 0 }}>
            <div className="sidebar-brand-icon">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
              </svg>
            </div>
            <button 
              className="sidebar-collapse-btn" 
              onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
              title={isDesktopCollapsed ? "Mở rộng" : "Thu gọn"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isDesktopCollapsed ? (
                  <polyline points="9 18 15 12 9 6" />
                ) : (
                  <polyline points="15 18 9 12 15 6" />
                )}
              </svg>
            </button>
          </div>
          {/* Live semester status — real-time polling */}
          <SemesterBadge semester={activeSemester} collapsed={isDesktopCollapsed} />
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <Suspense fallback={null}>
            <SidebarNavList navItems={navItems} isDesktopCollapsed={isDesktopCollapsed} />
          </Suspense>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <div className="sidebar-user-avatar">{initial}</div>
            <div className="sidebar-user-text">
              <div className="sidebar-user-name">{name}</div>
              <div className="sidebar-user-role">{roleLabel}</div>
            </div>
          </div>
          <button
            className="sidebar-logout-btn"
            onClick={() => signOut({ callbackUrl: '/login' })}
            id="sidebar-logout"
            title={isDesktopCollapsed ? "Đăng xuất" : undefined}
          >
            <span className="sidebar-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            <span className="sidebar-logout-text">Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={`dashboard-main ${isDesktopCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Mobile Header (Only visible on small screens) */}
        <div className="mobile-header-only">
          <button
            className="topbar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', cursor: 'pointer' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{pageTitle}</div>
        </div>

        {/* Content */}
        <div className="dashboard-content">
          <div className="desktop-page-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>{pageTitle}</h1>
              {pageSubtitle && <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0 0' }}>{pageSubtitle}</p>}
            </div>
            {topBarExtra && <div>{topBarExtra}</div>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
