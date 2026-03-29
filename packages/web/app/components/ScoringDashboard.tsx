'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { UserMenu } from './UserMenu';
import { ScoringForm } from './ScoringForm';

const API_BASE = 'http://localhost:3000/api';

// =============================================
// TYPES
// =============================================
interface StudentRow {
  id: string;
  studentCode: string | null;
  name: string;
  email: string;
  formId: string | null;
  status: string;
  studentTotal: number | null;
  classTotal: number | null;
  advisorTotal: number | null;
  finalTotal: number | null;
  classification: string | null;
}

// =============================================
// BADGE CONFIG
// =============================================
const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  NO_SHEET: { label: 'Chưa tạo', color: 'text-gray-400', dot: 'bg-gray-300' },
  DRAFT: { label: 'Nháp', color: 'text-gray-500', dot: 'bg-gray-400' },
  STUDENT_SUBMITTED: { label: 'SV nộp', color: 'text-blue-600', dot: 'bg-blue-500' },
  CLASS_REVIEWING: { label: 'Đang xét', color: 'text-yellow-600', dot: 'bg-yellow-500' },
  CLASS_REVIEWED: { label: 'Đã duyệt', color: 'text-green-600', dot: 'bg-green-500' },
  CLASS_REJECTED: { label: 'Trả lại', color: 'text-red-600', dot: 'bg-red-500' },
  ADVISOR_REVIEWING: { label: 'CVHT xét', color: 'text-yellow-600', dot: 'bg-yellow-500' },
  ADVISOR_APPROVED: { label: 'CVHT duyệt', color: 'text-emerald-600', dot: 'bg-emerald-500' },
  ADVISOR_REJECTED: { label: 'CVHT trả', color: 'text-red-600', dot: 'bg-red-500' },
  FINALIZED: { label: 'Chốt sổ', color: 'text-purple-600', dot: 'bg-purple-500' },
};

// =============================================
// PROPS
// =============================================
interface ScoringDashboardProps {
  role: 'CLASS_PRESIDENT' | 'ADVISOR';
  showHeader?: boolean; // Mặc định là true nếu dùng độc lập
}

const ROLE_META = {
  CLASS_PRESIDENT: {
    title: '👔 Ban Cán Sự Chấm Điểm',
    subtitle: 'Xét duyệt rèn luyện HK1 — 2026',
    scoreCol: 'classTotal' as const,
    accent: 'green',
  },
  ADVISOR: {
    title: '👨‍🏫 Cố Vấn Duyệt Điểm',
    subtitle: 'Xét duyệt rèn luyện HK1 — 2026',
    scoreCol: 'advisorTotal' as const,
    accent: 'purple',
  },
};

// =============================================
// MAIN COMPONENT
// =============================================
export function ScoringDashboard({ role, showHeader = true }: ScoringDashboardProps) {
  const { data: session } = useSession();
  const token = (session as { customJwt?: string })?.customJwt || '';

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const meta = ROLE_META[role];

  // FETCH STUDENTS
  useEffect(() => {
    if (!token) return;
    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/scoring/students`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setStudents(json.data || []);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudents();
  }, [token]);

  // FILTERED
  const filtered = useMemo(() => {
    return students.filter((s) => {
      return (
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.studentCode || '').includes(search)
      );
    });
  }, [students, search]);

  // STATS
  const stats = useMemo(() => {
    const total = students.length;
    const submitted = students.filter((s) => s.status !== 'NO_SHEET' && s.status !== 'DRAFT').length;
    return { total, submitted };
  }, [students]);

  // Selected student info
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div className={`${showHeader ? 'h-screen' : 'h-[calc(100vh-200px)] min-h-[600px]'} flex flex-col bg-gray-50 rounded-xl overflow-hidden border border-gray-200 shadow-sm`}>
      {/* TOP BAR */}
      {showHeader && (
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{meta.title}</h1>
          <p className="text-xs text-gray-500">{meta.subtitle}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className="bg-gray-100 px-2.5 py-1 rounded-lg font-bold text-gray-600">
              {stats.total} SV
            </span>
            <span className="bg-blue-50 px-2.5 py-1 rounded-lg font-bold text-blue-600">
              {stats.submitted} đã nộp
            </span>
          </div>
          <UserMenu />
        </div>
      </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        {/* ────── LEFT SIDEBAR: STUDENT LIST ────── */}
        <div
          className={`bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all duration-300 ${
            sidebarCollapsed ? 'w-14' : 'w-80'
          }`}
        >
          {/* Sidebar header */}
          <div className="px-3 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
            {!sidebarCollapsed && (
              <input
                type="text"
                placeholder="🔍 Tìm SV..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50"
              />
            )}
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              title={sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}
            >
              <svg className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {/* Student list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : sidebarCollapsed ? (
              // Collapsed: just show avatars
              <div className="py-2 space-y-1">
                {filtered.map((student) => {
                  const isActive = student.id === selectedStudentId;
                  const initial = student.name.split(' ').pop()?.[0] || '?';
                  const statusCfg = STATUS_CONFIG[student.status] || STATUS_CONFIG.NO_SHEET;
                  return (
                    <button
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                      className={`w-full flex justify-center py-1.5 transition-colors ${
                        isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                      }`}
                      title={`${student.name} — ${statusCfg.label}`}
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        {initial}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              // Expanded: full student cards
              <div className="py-1">
                {filtered.map((student) => {
                  const isActive = student.id === selectedStudentId;
                  const initial = student.name.split(' ').pop()?.[0] || '?';
                  const statusCfg = STATUS_CONFIG[student.status] || STATUS_CONFIG.NO_SHEET;
                  const score = student[meta.scoreCol];

                  return (
                    <button
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                      className={`w-full text-left px-3 py-2.5 transition-all border-l-3 ${
                        isActive
                          ? 'bg-indigo-50/80 border-l-indigo-600'
                          : 'border-l-transparent hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-linear-to-br from-gray-100 to-gray-200 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-bold truncate ${isActive ? 'text-indigo-900' : 'text-gray-800'}`}>
                            {student.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-400 font-mono">{student.studentCode}</span>
                            <span className={`flex items-center gap-1 text-[10px] font-bold ${statusCfg.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                              {statusCfg.label}
                            </span>
                          </div>
                        </div>
                        {/* Score badge */}
                        <div className="shrink-0">
                          {score !== null && score !== undefined ? (
                            <span className="text-sm font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                              {score}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-6">Không tìm thấy SV</p>
                )}
              </div>
            )}
          </div>

          {/* Sidebar footer */}
          {!sidebarCollapsed && (
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50">
              <p className="text-[10px] text-gray-400 text-center">
                {filtered.length}/{students.length} sinh viên
              </p>
            </div>
          )}
        </div>

        {/* ────── RIGHT: SCORING FORM ────── */}
        <div className="flex-1 overflow-y-auto pt-4 px-4 scroll-smooth">
          {selectedStudent ? (
            <div className="max-w-7xl mx-auto pb-20">
              {/* Selected student header - STICKY */}
              <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-sm pb-4 mb-4">
                <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-5 py-3 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-md">
                    {selectedStudent.name.split(' ').pop()?.[0] || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{selectedStudent.name}</p>
                    <p className="text-xs text-gray-500">
                      MSSV: <span className="font-mono">{selectedStudent.studentCode}</span>
                      &nbsp;|&nbsp;Điểm SV: <strong>{selectedStudent.studentTotal ?? '—'}</strong>
                    </p>
                  </div>
                </div>
              </div>
              <ScoringForm
                key={selectedStudentId}
                forcedRole={role}
                studentId={selectedStudentId!}
                stickyTop="top-[80px]"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-700">Chọn sinh viên để chấm điểm</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Nhấp vào tên sinh viên ở thanh bên trái để bắt đầu chấm.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
