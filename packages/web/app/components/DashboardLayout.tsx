'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { APP_BRANDING } from '../../lib/branding';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { 
  CheckCircle, ClipboardCheck, Check, XCircle, ShieldCheck, 
  MessageSquare, MessageSquareCheck, Calendar, Clock, Info,
  Bell, ChevronDown, ChevronUp, CheckCircle2, Circle, FileText,
  Users, BarChart2, Briefcase, Settings, Box, UserCog,
  LayoutDashboard, BookOpen, Building, AlertCircle, Menu, LogOut
} from 'lucide-react';
import { PageHeader } from './ui/PageHeader';
import { UserMenu } from './UserMenu';
import { useSemester } from '../providers/SemesterProvider';
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
  start_date?: string;
  end_date?: string;
}

const SEM_STATUS_META: Record<string, { label: string; color: string; dot: string; getDeadline?: (s: SemesterInfo) => string | null | undefined }> = {
  UPCOMING:          { label: 'Chưa bắt đầu',   color: 'var(--muted-foreground)', dot: 'var(--muted-foreground)', getDeadline: (s) => s.start_date },
  STUDENT_SCORING:   { label: 'Sinh viên đang tự đánh giá',   color: 'var(--info-foreground)', dot: 'var(--info)', getDeadline: (s) => s.student_deadline },
  CLASS_REVIEWING:   { label: 'Ban cán sự đang đánh giá',   color: 'var(--warning-foreground)', dot: 'var(--warning)', getDeadline: (s) => s.class_committee_deadline },
  ADVISOR_REVIEWING: { label: 'CVHT đang đánh giá',  color: 'var(--warning-foreground)', dot: 'var(--warning)', getDeadline: (s) => s.advisor_deadline },
  SCHOOL_REVIEWING:  { label: 'Chờ Trường duyệt', color: 'var(--info-foreground)', dot: 'var(--info)', getDeadline: (s) => s.school_deadline },
  FINALIZED:         { label: 'Đã hoàn tất',         color: 'var(--success-foreground)', dot: 'var(--success)' },
  LOCKED:            { label: 'Đã kết thúc',          color: 'var(--muted-foreground)', dot: 'var(--muted-foreground)' },
};

// removed useSemesterStatus in favor of SemesterProvider

function SemesterBadge({ semester }: { semester: SemesterInfo | null }) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    if (!semester) return;
    const meta = SEM_STATUS_META[semester.status];
    const targetDateStr = meta?.getDeadline ? meta.getDeadline(semester) : null;
    
    if (!targetDateStr) {
      if (semester.status === 'FINALIZED' || semester.status === 'LOCKED') {
        setTimeLeft('Đã hoàn tất');
      } else {
        setTimeLeft('Chưa thiết lập thời hạn');
      }
      setIsOverdue(false);
      return;
    }

    const targetDate = new Date(targetDateStr).getTime();
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const diff = targetDate - now;
      if (diff <= 0) {
        setIsOverdue(true);
        const over = Math.abs(diff);
        const overHours = Math.floor(over / (1000 * 60 * 60));
        const overDays = Math.floor(overHours / 24);
        if (overDays > 0) setTimeLeft(`Đã quá hạn ${overDays} ngày`);
        else if (overHours > 0) setTimeLeft(`Đã quá hạn ${overHours} giờ`);
        else setTimeLeft(`Đã quá hạn`);
        return;
      }
      setIsOverdue(false);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) setTimeLeft(`Còn ${days} ngày ${hours} giờ`);
      else if (hours > 0) setTimeLeft(`Còn ${hours} giờ ${minutes} phút`);
      else setTimeLeft(`Còn ${minutes} phút`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [semester]);

  if (!semester) return null;

  const meta = SEM_STATUS_META[semester.status] || { label: semester.status, color: 'var(--muted-foreground)', dot: 'var(--muted-foreground)' };
  const isPulsing = ['STUDENT_SCORING', 'CLASS_REVIEWING', 'ADVISOR_REVIEWING', 'SCHOOL_REVIEWING'].includes(semester.status);
  const semesterName = semester.name.replace(semester.academic_year, '').replace(/năm học/i, '').replace('-', '').trim();
  const isDeadlineSoon = !isOverdue && timeLeft.includes('giờ') && !timeLeft.includes('ngày');

  return (
    <div className="flex flex-col xl:flex-row items-center justify-center gap-1 xl:gap-3 shrink-0">
      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs">
        <span className="font-semibold text-foreground">{semesterName}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground hidden sm:inline">Năm học {semester.academic_year}</span>
        <span className="text-muted-foreground sm:hidden">{semester.academic_year}</span>
      </div>
      
      <div className="hidden xl:block w-px h-3.5 bg-border" />

      <div className="flex items-center gap-2 text-[11px] sm:text-xs">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${isPulsing ? 'animate-pulse' : ''}`} style={{ backgroundColor: meta.dot }} />
          <span className="font-medium truncate max-w-[150px] sm:max-w-none" style={{ color: meta.color }}>
            {meta.label}
          </span>
        </div>
        {timeLeft && (
          <>
            <span className="text-muted-foreground hidden sm:inline">·</span>
            <div className={`flex items-center gap-1 font-medium whitespace-nowrap ${isOverdue ? 'text-danger' : (isDeadlineSoon ? 'text-warning-foreground' : 'text-muted-foreground')}`}>
              <Clock size={12} className="shrink-0" />
              <span>{timeLeft}</span>
            </div>
          </>
        )}
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
  SCORE_SUBMITTED: { icon: <CheckCircle size={16} />, color: '#10b981' },
  SCORE_REVIEWED: { icon: <ClipboardCheck size={16} />, color: '#d4af37' },
  SCORE_APPROVED: { icon: <Check size={16} />, color: '#10b981' },
  SCORE_REJECTED: { icon: <XCircle size={16} />, color: '#991b1b' },
  SCORE_FINALIZED: { icon: <ShieldCheck size={16} />, color: '#10b981' },
  APPEAL_SUBMITTED: { icon: <MessageSquare size={16} />, color: '#d4af37' },
  APPEAL_RESOLVED: { icon: <MessageSquareCheck size={16} />, color: '#10b981' },
  SCORING_OPENED: { icon: <Calendar size={16} />, color: '#991b1b' },
  DEADLINE_REMINDER: { icon: <Clock size={16} />, color: '#f59e0b' },
  SYSTEM_ANNOUNCEMENT: { icon: <Info size={16} />, color: '#2563eb' },
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
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function useNotifications(intervalMs = 60000) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const lastFetchedAtRef = useRef<number>(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      isFetchingRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!session?.user || isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/api/notifications?limit=10', { 
        cache: 'no-store',
        signal: abortControllerRef.current.signal
      });
      
      if (!mountedRef.current) return;

      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
        setUnreadCount(json.unreadCount || 0);
        lastFetchedAtRef.current = Date.now();
      }
    } catch (err: any) { 
      if (err.name !== 'AbortError') {
        // silent fail for non-abort errors
      }
    } finally {
      isFetchingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [session]);

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
        if (mountedRef.current) {
          setUnreadCount(json.unreadCount || 0);
          if (ids) {
            setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, isRead: true } : n));
          } else {
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
          }
        }
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    
    // Initial fetch if it's been a while or first time
    if (Date.now() - lastFetchedAtRef.current > 10000) {
      fetchNotifications();
    }
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (Date.now() - lastFetchedAtRef.current > 15000) {
          fetchNotifications();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    }, intervalMs);

    return () => { 
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, fetchNotifications, session]);

  return { notifications, unreadCount, loading, markAsRead, refetch: fetchNotifications };
}

function NotificationBell() {
  const { notifications, unreadCount, loading, markAsRead } = useNotifications(60000);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) markAsRead([item.id]);
  };

  const defaultMeta = { icon: <Bell size={14} />, color: '#6b7280' };

  return (
    <div className="relative" ref={panelRef}>
      <button
        className="p-2 rounded-full hover:bg-surface-muted text-muted-foreground transition-colors relative"
        onClick={() => setOpen(!open)}
        aria-label="Thông báo"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-primary-foreground ring-2 ring-surface">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface rounded-lg shadow-xl border border-border z-50 overflow-hidden flex flex-col max-h-[80vh]">
          <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-surface-muted">
            <h3 className="font-semibold text-sm text-foreground">Thông báo</h3>
            {unreadCount > 0 && (
              <button onClick={() => markAsRead()} className="text-xs text-primary hover:text-primary-hover font-medium">
                Đánh dấu đã đọc
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1 p-0">
            {loading ? (
              <div className="p-8 flex justify-center">
                <div className="animate-spin h-5 w-5 border-2 border-border border-t-primary rounded-full" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 flex flex-col items-center text-center text-muted-foreground">
                <Bell size={32} className="mb-2 opacity-20" />
                <span className="text-sm">Chưa có thông báo nào</span>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((n) => {
                  const meta = NOTIF_TYPE_META[n.type] || defaultMeta;
                  return (
                    <div
                      key={n.id}
                      className={`p-4 flex gap-3 cursor-pointer hover:bg-surface-muted transition-colors ${!n.isRead ? 'bg-primary-light/30' : ''}`}
                      onClick={() => handleItemClick(n)}
                    >
                      <div className="shrink-0 mt-0.5" style={{ color: meta.color }}>
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.isRead ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.content}</p>
                        <p className="text-[10px] text-muted-foreground mt-1.5">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && <div className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Navigation ────────────────────────────────────────────────────────────────
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
    { label: 'Tổng quan', href: '/student/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'Tự chấm điểm', href: '/student', sectionLabel: 'Đánh giá', icon: <ClipboardCheck size={18} /> },
    { label: 'Lịch sử đánh giá', href: '/student/history', icon: <Clock size={18} /> },
    { label: 'Khiếu nại', href: '/student/appeals', icon: <MessageSquare size={18} /> },
  ],
  CLASS_COMMITTEE: [
    { label: 'Tổng quan', href: '/class-president/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'Phiếu của tôi', href: '/student', sectionLabel: 'Cá nhân', icon: <ClipboardCheck size={18} /> },
    { label: 'Lịch sử đánh giá', href: '/student/history', icon: <Clock size={18} /> },
    { label: 'Khiếu nại cá nhân', href: '/student/appeals', icon: <MessageSquare size={18} /> },
    
    { label: 'Quản lý đánh giá lớp', href: '/class-president', sectionLabel: 'Lớp học', icon: <Users size={18} /> },
  ],
  ADVISOR: [
    { label: 'Tổng quan', href: '/advisor/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'Danh sách lớp', href: '/advisor/classes', sectionLabel: 'Quản lý', icon: <Users size={18} /> },
    { label: 'Phiếu chờ duyệt', href: '/advisor/reviews', icon: <Clock size={18} /> },
    { label: 'Khiếu nại', href: '/advisor/appeals', icon: <MessageSquare size={18} /> },
  ],
  DEPARTMENT: [
    { label: 'Tổng quan', href: '/department/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'Danh sách lớp', href: '/department/dashboard?view=classes', sectionLabel: 'Quản lý', icon: <BookOpen size={18} /> },
    { label: 'Khiếu nại', href: '/department/appeals', icon: <MessageSquare size={18} /> },
  ],
  SCHOOL_ADMIN: [
    { label: 'Tổng quan', href: '/admin?tab=dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'Học kỳ', href: '/admin?tab=semesters', sectionLabel: 'Cấu hình', icon: <Calendar size={18} /> },
    { label: 'Quản lý Tiêu chí', href: '/admin?tab=criteria', icon: <Settings size={18} /> },
    { label: 'Khoa', href: '/admin?tab=departments', sectionLabel: 'Tổ chức', icon: <Building size={18} /> },
    { label: 'Lớp học', href: '/admin?tab=classes', icon: <BookOpen size={18} /> },
    { label: 'Người dùng', href: '/admin?tab=users', icon: <UserCog size={18} /> },
    { label: 'Khiếu nại', href: '/admin/appeals', sectionLabel: 'Giám sát', icon: <MessageSquare size={18} /> },
  ],
};

interface DashboardLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  pageSubtitle?: string;
  topBarExtra?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

function SidebarNavList({ navItems, isDesktopCollapsed, setSidebarOpen }: { navItems: NavItem[], isDesktopCollapsed: boolean, setSidebarOpen: (v: boolean) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString();
  const currentUrl = pathname + (queryString ? `?${queryString}` : '');

  return (
    <div className="py-4">
      {navItems.map((item, idx) => {
        const isActive = item.href.includes('?') ? item.href === currentUrl : pathname === item.href && !queryString;
        
        return (
          <div key={`${item.href}-${idx}`}>
            {item.sectionLabel && !isDesktopCollapsed && (
              <div className="px-6 py-2 mt-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {item.sectionLabel}
              </div>
            )}
            <Link
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-6 py-2.5 mx-2 my-1 rounded-md transition-colors ${
                isActive 
                  ? 'bg-primary-light text-primary font-medium' 
                  : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
              }`}
              title={isDesktopCollapsed ? item.label : undefined}
            >
              <span className={`shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                {item.icon}
              </span>
              {!isDesktopCollapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardLayout({
  children,
  pageTitle,
  pageSubtitle,
  topBarExtra,
  breadcrumbs,
}: DashboardLayoutProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const { semester: activeSemester } = useSemester();

  // Handle mobile route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!session?.user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center">
          <div className="animate-spin h-8 w-8 border-4 border-border border-t-primary rounded-full mb-4" />
          <p className="text-muted-foreground text-sm font-medium">Đang tải hệ thống...</p>
        </div>
      </div>
    );
  }

  const user = session.user as { name?: string; role?: string; studentId?: string };
  const role = user.role || 'STUDENT';
  const navItems = ROLE_NAV[role] || ROLE_NAV.STUDENT;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden font-sans">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Top Header */}
      <header className="h-14 sm:h-16 bg-surface border-b border-border flex items-center justify-between px-3 sm:px-6 shrink-0 z-50">
        {/* Left: Branding & Mobile Menu */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-surface-muted shrink-0"
            aria-label="Mở menu"
          >
            <Menu size={20} />
          </button>
          
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
              <img src="/assets/dash/logom.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-bold text-primary truncate max-w-[100px] sm:max-w-none">{APP_BRANDING.shortName}</span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden md:block truncate">{APP_BRANDING.englishName}</span>
            </div>
          </div>
        </div>

        {/* Center: Semester Info */}
        <div className="hidden md:flex flex-1 items-center justify-center px-4 overflow-hidden">
          <SemesterBadge semester={activeSemester} />
        </div>

        {/* Right: Notifications & User Profile */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <NotificationBell />
          <div className="hidden sm:block h-6 w-px bg-border mx-1" />
          <UserMenu />
        </div>
      </header>

      {/* Mobile Semester Info Drawer/Bar (shown below header on mobile) */}
      <div className="md:hidden bg-surface border-b border-border py-2 px-3 shrink-0 flex justify-center">
        <SemesterBadge semester={activeSemester} />
      </div>

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <aside 
          className={`absolute lg:static inset-y-0 left-0 z-40 flex flex-col bg-surface border-r border-border transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } ${isDesktopCollapsed ? 'w-20' : 'w-64'}`}
        >
          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
            <Suspense fallback={null}>
              <SidebarNavList navItems={navItems} isDesktopCollapsed={isDesktopCollapsed} setSidebarOpen={setSidebarOpen} />
            </Suspense>
          </nav>

          {/* Collapse toggle (Desktop only) */}
          <div className="hidden lg:flex border-t border-border p-2">
            <button
              onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
              className="flex w-full items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors"
              title={isDesktopCollapsed ? "Mở rộng" : "Thu gọn"}
              aria-label={isDesktopCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            >
              {isDesktopCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>
        </aside>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto h-full flex flex-col">
            <PageHeader 
              title={pageTitle} 
              description={pageSubtitle} 
              actions={topBarExtra}
              breadcrumbs={breadcrumbs} 
            />
            <div className="mt-6 flex-1">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Temporary polyfills for missing lucide icons in the import
function ChevronLeft({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>;
}
function ChevronRight({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>;
}
