'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import './dashboard.css';

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Sinh viên',
  CLASS_PRESIDENT: 'Ban cán sự',
  CLASS_COMMITTEE: 'Ban cán sự',
  ADVISOR: 'Cố vấn học tập',
  SCHOOL_ADMIN: 'Quản trị viên',
  SUPER_ADMIN: 'Quản trị cấp cao',
};

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
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
  CLASS_PRESIDENT: [
    {
      label: 'Danh sách chấm',
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
  ],
  ADVISOR: [
    {
      label: 'Bảng tổng hợp',
      href: '/advisor',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      ),
    },
  ],
  SCHOOL_ADMIN: [
    {
      label: 'Quản lý tiêu chí',
      href: '/admin',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ],
};

// Also alias CLASS_COMMITTEE and SUPER_ADMIN
ROLE_NAV.CLASS_COMMITTEE = ROLE_NAV.CLASS_PRESIDENT;
ROLE_NAV.SUPER_ADMIN = ROLE_NAV.SCHOOL_ADMIN;

interface DashboardLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  pageSubtitle?: string;
  /** Extra badges/info shown in the top bar */
  topBarExtra?: React.ReactNode;
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

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!session?.user) {
    return (
      <div className="dashboard-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Đang tải...</p>
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
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
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
          <div className="sidebar-brand-title">Hệ thống Đánh giá Rèn luyện</div>
          <div className="sidebar-brand-subtitle">HK1 — 2025-2026</div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Chức năng</div>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <div className="sidebar-user-avatar">{initial}</div>
            <div>
              <div className="sidebar-user-name">{name}</div>
              <div className="sidebar-user-role">{roleLabel}</div>
            </div>
          </div>
          <button
            className="sidebar-logout-btn"
            onClick={() => signOut({ callbackUrl: '/login' })}
            id="sidebar-logout"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="dashboard-main">
        {/* Top bar */}
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <button
              className="topbar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div>
              <div className="topbar-title">{pageTitle}</div>
              {pageSubtitle && <div className="topbar-subtitle">{pageSubtitle}</div>}
            </div>
          </div>
          <div className="topbar-right">
            {topBarExtra}
            <span className="topbar-badge">
              <span className="topbar-badge-dot" />
              Hệ thống hoạt động
            </span>
          </div>
        </header>

        {/* Content */}
        <div className="dashboard-content">
          {children}
        </div>
      </div>
    </div>
  );
}
