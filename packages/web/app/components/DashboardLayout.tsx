'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
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
  UPCOMING:          { label: 'Sắp diễn ra',   color: '#60a5fa', dot: '#b91c1c' }, // blue-400
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
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    color: '#059669',
  },
  SCORE_REVIEWED: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    color: '#991b1b',
  },
  SCORE_APPROVED: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    color: '#059669',
  },
  SCORE_REJECTED: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    color: '#dc2626',
  },
  SCORE_FINALIZED: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    color: '#10b981',
  },
  APPEAL_SUBMITTED: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    ),
    color: '#d97706',
  },
  APPEAL_RESOLVED: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    ),
    color: '#059669',
  },
  SCORING_OPENED: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    color: '#991b1b',
  },
  DEADLINE_REMINDER: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    color: '#d97706',
  },
  SYSTEM_ANNOUNCEMENT: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    color: '#6b7280',
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
  const { notifications, unreadCount, loading, markAsRead } = useNotifications(30000);
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

  const defaultMeta = { icon: <span style={{ fontSize: 14 }}>🔔</span>, color: '#6b7280' };

  return (
    <div className="sidebar-notif-wrapper" ref={panelRef}>
      <button
        className={`sidebar-notif-btn ${collapsed ? 'collapsed' : ''}`}
        onClick={() => setOpen(!open)}
        title="Thông báo"
        id="sidebar-notification-bell"
      >
        <span className="sidebar-notif-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
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
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
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
    {
      label: 'Khiếu nại',
      href: '/student/appeals',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
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
      label: 'Lịch sử đánh giá',
      href: '/student/history',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: 'Khiếu nại',
      href: '/student/appeals',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
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
      label: 'Lớp học',
      href: '/department?view=classes',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      ),
      sectionLabel: 'Quản lý',
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
