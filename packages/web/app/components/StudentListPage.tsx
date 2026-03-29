'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { UserMenu } from './UserMenu';

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
// BADGE HELPERS
// =============================================
const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  NO_SHEET: { label: 'Chưa tạo phiếu', color: 'text-gray-400', dot: 'bg-gray-300' },
  DRAFT: { label: 'Đang nháp', color: 'text-gray-500', dot: 'bg-gray-400' },
  STUDENT_SUBMITTED: { label: 'SV đã nộp', color: 'text-blue-600', dot: 'bg-blue-500' },
  CLASS_REVIEWING: { label: 'BCS đang xét', color: 'text-yellow-600', dot: 'bg-yellow-500' },
  CLASS_REVIEWED: { label: 'BCS đã duyệt', color: 'text-green-600', dot: 'bg-green-500' },
  CLASS_REJECTED: { label: 'BCS trả lại', color: 'text-red-600', dot: 'bg-red-500' },
  ADVISOR_REVIEWING: { label: 'CVHT đang xét', color: 'text-yellow-600', dot: 'bg-yellow-500' },
  ADVISOR_APPROVED: { label: 'CVHT đã duyệt', color: 'text-emerald-600', dot: 'bg-emerald-500' },
  ADVISOR_REJECTED: { label: 'CVHT trả lại', color: 'text-red-600', dot: 'bg-red-500' },
  FINALIZED: { label: 'Đã chốt sổ', color: 'text-purple-600', dot: 'bg-purple-500' },
};

const CLASSIFICATION_CONFIG: Record<string, { label: string; emoji: string; bg: string }> = {
  EXCELLENT: { label: 'Xuất sắc', emoji: '💎', bg: 'bg-purple-100 text-purple-700 border-purple-200' },
  VERY_GOOD: { label: 'Giỏi', emoji: '⭐', bg: 'bg-green-100 text-green-700 border-green-200' },
  GOOD: { label: 'Khá', emoji: '👍', bg: 'bg-blue-100 text-blue-700 border-blue-200' },
  AVERAGE: { label: 'TB', emoji: '😐', bg: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  WEAK: { label: 'Yếu', emoji: '⚠️', bg: 'bg-orange-100 text-orange-700 border-orange-200' },
  POOR: { label: 'Kém', emoji: '❌', bg: 'bg-red-100 text-red-700 border-red-200' },
};

// =============================================
// PROPS
// =============================================
interface StudentListPageProps {
  role: 'CLASS_PRESIDENT' | 'ADVISOR';
}

const ROLE_META = {
  CLASS_PRESIDENT: {
    title: '👔 Ban Cán Sự — Danh sách sinh viên',
    subtitle: 'Xét duyệt điểm rèn luyện HK1 — 2026',
    basePath: '/class-president',
    scoreCol: 'classTotal' as const,
    scoreLabel: 'Điểm BCS',
    accent: 'green',
  },
  ADVISOR: {
    title: '👨‍🏫 Cố vấn — Danh sách sinh viên',
    subtitle: 'Xét duyệt điểm rèn luyện HK1 — 2026',
    basePath: '/advisor',
    scoreCol: 'advisorTotal' as const,
    scoreLabel: 'Điểm CVHT',
    accent: 'purple',
  },
};

// =============================================
// MAIN COMPONENT
// =============================================
export function StudentListPage({ role }: StudentListPageProps) {
  const { data: session } = useSession();
  const token = (session as { customJwt?: string })?.customJwt || '';
  const router = useRouter();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const meta = ROLE_META[role];

  // FETCH
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

  // FILTER + SEARCH
  const filtered = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.studentCode || '').includes(search);
      const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [students, search, statusFilter]);

  // UNIQUE STATUSES for filter dropdown
  const uniqueStatuses = useMemo(() => {
    const set = new Set(students.map((s) => s.status));
    return Array.from(set);
  }, [students]);

  // STATS
  const stats = useMemo(() => {
    const total = students.length;
    const submitted = students.filter((s) => s.status !== 'NO_SHEET' && s.status !== 'DRAFT').length;
    const approved = students.filter((s) => ['ADVISOR_APPROVED', 'FINALIZED'].includes(s.status)).length;
    return { total, submitted, approved };
  }, [students]);

  // LOADING
  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="h-8 w-80 skeleton mb-2" />
            <div className="h-4 w-60 skeleton" />
          </div>
          <div className="h-10 w-10 skeleton rounded-full" />
        </div>
        <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 skeleton mb-3 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{meta.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{meta.subtitle}</p>
        </div>
        <UserMenu />
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Tổng sinh viên</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
          <p className="text-xs text-blue-500 uppercase tracking-wider font-bold">Đã nộp phiếu</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{stats.submitted}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4 shadow-sm">
          <p className="text-xs text-green-500 uppercase tracking-wider font-bold">Đã hoàn tất</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{stats.approved}</p>
        </div>
      </div>

      {/* SEARCH + FILTER */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="🔍 Tìm mã SV, tên..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none flex-1"
          id="search-students"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
          id="filter-status"
        >
          <option value="ALL">Tất cả trạng thái</option>
          {uniqueStatuses.map((s) => (
            <option key={s} value={s}>
              {STATUS_CONFIG[s]?.label || s}
            </option>
          ))}
        </select>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                <th className="p-4 w-12 text-center">STT</th>
                <th className="p-4">Sinh viên</th>
                <th className="p-4 w-24 text-center">Điểm SV</th>
                <th className="p-4 w-24 text-center">{meta.scoreLabel}</th>
                <th className="p-4 w-28 text-center">Xếp loại</th>
                <th className="p-4 w-36">Trạng thái</th>
                <th className="p-4 w-28 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    {search || statusFilter !== 'ALL'
                      ? 'Không tìm thấy sinh viên phù hợp'
                      : 'Chưa có sinh viên nào trong lớp'}
                  </td>
                </tr>
              ) : (
                filtered.map((student, index) => {
                  const statusCfg = STATUS_CONFIG[student.status] || STATUS_CONFIG.NO_SHEET;
                  const classCfg = student.classification
                    ? CLASSIFICATION_CONFIG[student.classification]
                    : null;
                  const score = student[meta.scoreCol];

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                      onClick={() => {
                        if (student.formId) {
                          router.push(`${meta.basePath}/${student.studentCode}`);
                        }
                      }}
                    >
                      <td className="p-4 text-center text-gray-400 font-medium">
                        {index + 1}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-indigo-700 font-bold border border-indigo-300 shadow-sm text-sm">
                            {student.name.split(' ').pop()?.[0] || '?'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{student.name}</p>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">
                              {student.studentCode}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-lg font-bold text-gray-700">
                          {student.studentTotal ?? '—'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-lg font-bold text-gray-700">
                          {score ?? '—'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {classCfg ? (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold border ${classCfg.bg}`}
                          >
                            {classCfg.emoji} {classCfg.label}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`flex items-center gap-1.5 text-xs font-bold ${statusCfg.color}`}>
                          <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {student.formId ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`${meta.basePath}/${student.studentCode}`);
                            }}
                            className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            Chấm ➔
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-500">
            Hiển thị <strong className="text-gray-700">{filtered.length}</strong> /{' '}
            <strong className="text-gray-700">{students.length}</strong> sinh viên
          </p>
        </div>
      </div>
    </div>
  );
}
