'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { 
  CheckCircle, ClipboardCheck, Check, XCircle, ShieldCheck, 
  MessageSquare, MessageSquareCheck, Calendar, Clock, Info,
  Bell, ChevronDown, ChevronUp, CheckCircle2, Circle, FileText,
  Users, BarChart2, Briefcase, Settings, Box, UserCog,
  LayoutDashboard, BookOpen, Building, AlertCircle
} from 'lucide-react';
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
  UPCOMING:          { label: 'Sắp diễn ra',   color: '#f87171', dot: '#b91c1c' }, // red-400
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
    // Bỏ polling liên tục cho semester/active vì dữ liệu rất ít thay đổi
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

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
      {/* Semester name */}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#facc15', letterSpacing: '0.02em', textTransform: 'uppercase', lineHeight: 1.2 }}>
        {semester.name.replace(semester.academic_year, '').replace(/năm học/i, '').replace('-', '').trim()}
      </div>
      <div style={{ fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.02em' }}>
        Năm học {semester.academic_year}
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

// ─── Notifications ─────────────────────────────────────────────────────────────
interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  data: any;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

const NOTIF_TYPE_META: Record<string, { icon: React.ReactNode; color: string }> = {
  SCORE_SUBMITTED: {
    icon: <CheckCircle size={16} strokeWidth={2} />,
    color: '#10b981', // Emerald
  },
  SCORE_REVIEWED: {
    icon: <ClipboardCheck size={16} strokeWidth={2} />,
    color: '#7170ff', // Accent Violet
  },
  SCORE_APPROVED: {
    icon: <Check size={16} strokeWidth={2} />,
    color: '#10b981', // Emerald
  },
  SCORE_REJECTED: {
    icon: <XCircle size={16} strokeWidth={2} />,
    color: '#8a8f98', // Subtle
  },
  SCORE_FINALIZED: {
    icon: <ShieldCheck size={16} strokeWidth={2} />,
    color: '#10b981', // Emerald
  },
  APPEAL_SUBMITTED: {
    icon: <MessageSquare size={16} strokeWidth={2} />,
    color: '#5e6ad2', // Brand Indigo
  },
  APPEAL_RESOLVED: {
    icon: <MessageSquareCheck size={16} strokeWidth={2} />,
    color: '#10b981', // Emerald
  },
  SCORING_OPENED: {
    icon: <Calendar size={16} strokeWidth={2} />,
    color: '#5e6ad2', // Brand Indigo
  },
  DEADLINE_REMINDER: {
    icon: <Clock size={16} strokeWidth={2} />,
    color: '#5e6ad2', // Brand Indigo
  },
  SYSTEM_ANNOUNCEMENT: {
    icon: <Info size={16} strokeWidth={2} />,
    color: '#62666d', // Muted
  },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} tuần trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function useNotifications(intervalMs = 30000) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=30', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
        setUnreadCount(json.unreadCount || 0);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const markAsRead = useCallback(async (ids?: string[]) => {
    try {
      const body = ids ? { ids } : { markAllRead: true };
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = await res.json();
        setUnreadCount(json.unreadCount || 0);
        // Update local state
        if (ids) {
          setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, isRead: true } : n));
        } else {
          setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        }
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    timerRef.current = setInterval(fetchNotifications, intervalMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [intervalMs, fetchNotifications]);

  return { notifications, unreadCount, loading, markAsRead, refetch: fetchNotifications };
}

function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const { notifications, unreadCount, loading, markAsRead } = useNotifications(60000);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Mark as read when opening
  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      markAsRead([item.id]);
    }
  };

  const defaultMeta = { icon: <Bell size={14} strokeWidth={2} />, color: '#62666d' };

  return (
    <div className="sidebar-notif-wrapper" ref={panelRef}>
      <button
        className={`sidebar-notif-btn ${collapsed ? 'collapsed' : ''}`}
        onClick={() => setOpen(!open)}
        title="Thông báo"
        id="sidebar-notification-bell"
      >
        <span className="sidebar-notif-icon">
          <Bell size={18} strokeWidth={2} />
          {unreadCount > 0 && (
            <span className="sidebar-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </span>
        {!collapsed && <span className="sidebar-notif-label">Thông báo</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span className="notif-dropdown-title">Thông báo</span>
            {unreadCount > 0 && (
              <button
                className="notif-mark-all-btn"
                onClick={() => markAsRead()}
              >
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          <div className="notif-dropdown-body">
            {loading ? (
              <div className="notif-empty">
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #e5e7eb', borderTopColor: '#991b1b', animation: 'spin 0.7s linear infinite' }} />
              </div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty">
                <Bell size={32} strokeWidth={1.5} color="#d0d6e0" />
                <span>Chưa có thông báo nào</span>
              </div>
            ) : (
              notifications.map((n) => {
                const meta = NOTIF_TYPE_META[n.type] || defaultMeta;
                return (
                  <div
                    key={n.id}
                    className={`notif-item ${!n.isRead ? 'unread' : ''}`}
                    onClick={() => handleItemClick(n)}
                  >
                    <div className="notif-item-icon" style={{ color: meta.color, background: `${meta.color}14` }}>
                      {meta.icon}
                    </div>
                    <div className="notif-item-body">
                      <div className="notif-item-title">{n.title}</div>
                      <div className="notif-item-content">{n.content}</div>
                      <div className="notif-item-time">{timeAgo(n.createdAt)}</div>
                    </div>
                    {!n.isRead && <div className="notif-item-dot" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
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
      icon: <ClipboardCheck size={18} strokeWidth={2} />,
    },
    {
      label: 'Lịch sử đánh giá',
      href: '/student/history',
      icon: <Clock size={18} strokeWidth={2} />,
    },
    {
      label: 'Khiếu nại',
      href: '/student/appeals',
      icon: <MessageSquare size={18} strokeWidth={2} />,
    },
  ],
  CLASS_COMMITTEE: [
    {
      label: 'Phiếu của bản thân',
      href: '/student',
      icon: <ClipboardCheck size={18} strokeWidth={2} />,
    },
    {
      label: 'Lịch sử đánh giá',
      href: '/student/history',
      icon: <Clock size={18} strokeWidth={2} />,
    },
    {
      label: 'Khiếu nại',
      href: '/student/appeals',
      icon: <MessageSquare size={18} strokeWidth={2} />,
    },
    {
      label: 'Tất cả sinh viên',
      href: '/class-president',
      icon: <Users size={18} strokeWidth={2} />,
    },
    {
      label: 'Sinh viên đã chấm',
      href: '/class-president?filter=scored',
      icon: <CheckCircle size={18} strokeWidth={2} />,
    },
    {
      label: 'Sinh viên chưa chấm',
      href: '/class-president?filter=unscored',
      icon: <Clock size={18} strokeWidth={2} />,
    },
    {
      label: 'Sinh viên chưa nộp',
      href: '/class-president?filter=pending',
      icon: <AlertCircle size={18} strokeWidth={2} />,
    },
  ],
  ADVISOR: [
    {
      label: 'Tất cả sinh viên',
      href: '/advisor',
      sectionLabel: 'Danh sách',
      icon: <Users size={18} strokeWidth={2} />,
    },

    {
      label: 'Chờ duyệt',
      href: '/advisor?filter=unscored',
      icon: <Clock size={18} strokeWidth={2} />,
    },
    {
      label: 'Đã duyệt',
      href: '/advisor?filter=scored',
      icon: <Check size={18} strokeWidth={2} />,
    },
    {
      label: 'Chưa nộp',
      href: '/advisor?filter=pending',
      icon: <AlertCircle size={18} strokeWidth={2} />,
    },
    {
      label: 'Thống kê lớp',
      href: '/advisor?filter=summary',
      sectionLabel: 'Tổng quan',
      icon: <BarChart2 size={18} strokeWidth={2} />,
    },
    {
      label: 'Khiếu nại',
      href: '/advisor/appeals',
      icon: <MessageSquare size={18} strokeWidth={2} />,
    },
  ],
  DEPARTMENT: [
    {
      label: 'Dashboard',
      href: '/department',
      icon: <LayoutDashboard size={18} strokeWidth={2} />,
    },
    {
      label: 'Biểu đồ thống kê',
      href: '/department?view=charts',
      icon: <BarChart2 size={18} strokeWidth={2} />,
      sectionLabel: 'Tổng quan',
    },
    {
      label: 'Lớp học',
      href: '/department?view=classes',
      icon: <BookOpen size={18} strokeWidth={2} />,
      sectionLabel: 'Quản lý',
    },
    {
      label: 'Khiếu nại',
      href: '/department/appeals',
      sectionLabel: 'Phê duyệt',
      icon: <MessageSquare size={18} strokeWidth={2} />,
    },
  ],
  SCHOOL_ADMIN: [
    {
      label: 'Tổng quan',
      href: '/admin?tab=dashboard',
      icon: <LayoutDashboard size={18} strokeWidth={2} />,
    },

    {
      label: 'Tiêu chí chấm điểm',
      href: '/admin?tab=criteria',
      sectionLabel: 'Cấu hình',
      icon: <Settings size={18} strokeWidth={2} />,
    },
    {
      label: 'Học kỳ',
      href: '/admin?tab=semesters',
      icon: <Calendar size={18} strokeWidth={2} />,
    },
    {
      label: 'Quản lý Khoa',
      href: '/admin?tab=departments',
      sectionLabel: 'Dữ liệu',
      icon: <Building size={18} strokeWidth={2} />,
    },
    {
      label: 'Quản lý Lớp',
      href: '/admin?tab=classes',
      icon: <BookOpen size={18} strokeWidth={2} />,
    },
    {
      label: 'Người dùng',
      href: '/admin?tab=users',
      icon: <UserCog size={18} strokeWidth={2} />,
    },
    {
      label: 'Khiếu nại',
      href: '/admin/appeals',
      sectionLabel: 'Phê duyệt',
      icon: <MessageSquare size={18} strokeWidth={2} />,
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
  const { semester: activeSemester } = useSemesterStatus();

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
              border: '3px solid #e5e7eb', borderTopColor: '#991b1b',
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
        <div className="sidebar-brand" style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: isDesktopCollapsed ? '20px 16px' : '20px' }}>
          <div className="sidebar-brand-icon" style={{ marginBottom: 0 }}>
            <img src="/assets/dash/logom.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          
          {!isDesktopCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <SemesterBadge semester={activeSemester} collapsed={isDesktopCollapsed} />
            </div>
          )}

          <button 
            className="sidebar-collapse-btn" 
            onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
            title={isDesktopCollapsed ? "Mở rộng" : "Thu gọn"}
            style={{ marginTop: 0 }}
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

        {/* Nav */}
        <nav className="sidebar-nav">
          <Suspense fallback={null}>
            <SidebarNavList navItems={navItems} isDesktopCollapsed={isDesktopCollapsed} />
          </Suspense>
        </nav>

        {/* Notifications */}
        <div className="sidebar-notif-section">
          <NotificationBell collapsed={isDesktopCollapsed} />
        </div>

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
