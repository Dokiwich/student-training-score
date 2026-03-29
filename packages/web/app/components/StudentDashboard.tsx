'use client';

import { ScoringForm } from './ScoringForm';
import { UserMenu } from './UserMenu';

type Role = 'CLASS_PRESIDENT' | 'ADVISOR';

interface StudentDashboardProps {
  role: Role;
}

const ROLE_INFO = {
  CLASS_PRESIDENT: {
    title: 'Ban Cán Sự Chấm Điểm',
    subtitle: 'Học kỳ 1 — Năm học 2026',
    icon: (
      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    iconBg: 'bg-green-50',
  },
  ADVISOR: {
    title: 'Cố Vấn Học Tập Duyệt Điểm',
    subtitle: 'Học kỳ 1 — Năm học 2026',
    icon: (
      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
      </svg>
    ),
    iconBg: 'bg-purple-50',
  },
};

export function StudentDashboard({ role }: StudentDashboardProps) {
  const info = ROLE_INFO[role];

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${info.iconBg}`}>
            {info.icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{info.title}</h1>
            <p className="text-gray-500 text-sm font-medium mt-0.5">{info.subtitle}</p>
          </div>
        </div>

        {/* User Menu with real session data + logout */}
        <UserMenu />
      </div>

      {/* Main Form */}
      <ScoringForm forcedRole={role} />
    </div>
  );
}
