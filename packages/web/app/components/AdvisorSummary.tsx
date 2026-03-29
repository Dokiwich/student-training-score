'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';

const API_BASE = 'http://localhost:3000/api';

// =============================================
// TYPES
// =============================================
interface StudentSummary {
  id: string;
  studentCode: string | null;
  name: string;
  status: string;
  studentTotal: number | null;
  classTotal: number | null;
  advisorTotal: number | null;
  finalTotal: number | null;
  classification: string | null;
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  EXCELLENT: 'Xuất sắc',
  VERY_GOOD: 'Giỏi',
  GOOD: 'Khá',
  AVERAGE: 'Trung bình',
  WEAK: 'Yếu',
  POOR: 'Kém',
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  EXCELLENT: 'text-purple-700 bg-purple-50',
  VERY_GOOD: 'text-green-700 bg-green-50',
  GOOD: 'text-blue-700 bg-blue-50',
  AVERAGE: 'text-yellow-700 bg-yellow-50',
  WEAK: 'text-orange-700 bg-orange-50',
  POOR: 'text-red-700 bg-red-50',
};

// =============================================
// MAIN COMPONENT
// =============================================
export function AdvisorSummary() {
  const { data: session } = useSession();
  const token = (session as { customJwt?: string })?.customJwt || '';

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  // FETCH
  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
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
    fetchData();
  }, [token]);

  // STATS
  const stats = useMemo(() => {
    const total = students.length;
    const byClass: Record<string, number> = {};
    students.forEach((s) => {
      const cls = s.classification || 'NONE';
      byClass[cls] = (byClass[cls] || 0) + 1;
    });
    const avgScore =
      total > 0
        ? (
          students.reduce((sum, s) => sum + (s.finalTotal || s.advisorTotal || 0), 0) / total
        ).toFixed(1)
        : '0';
    return { total, byClass, avgScore };
  }, [students]);

  // EXPORT CSV
  const exportCSV = () => {
    const header = ['STT', 'MSSV', 'Họ và Tên', 'Điểm SV', 'Điểm BCS', 'Điểm CVHT', 'Xếp loại', 'Ghi chú'];
    const rows = students.map((s, i) => [
      i + 1,
      s.studentCode || '',
      s.name,
      s.studentTotal ?? '',
      s.classTotal ?? '',
      s.advisorTotal ?? '',
      s.classification ? CLASSIFICATION_LABELS[s.classification] || '' : '',
      notes[s.id] || '',
    ]);

    const BOM = '\uFEFF';
    const csv = BOM + [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bang_tong_hop_diem_ren_luyen.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // LOADING
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 skeleton rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* STATS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Sĩ số</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-sm">
          <p className="text-xs text-indigo-500 uppercase tracking-wider font-bold">Điểm TB lớp</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{stats.avgScore}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4 shadow-sm">
          <p className="text-xs text-green-500 uppercase tracking-wider font-bold">Xuất sắc + Giỏi</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {(stats.byClass['EXCELLENT'] || 0) + (stats.byClass['VERY_GOOD'] || 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm">
          <p className="text-xs text-red-500 uppercase tracking-wider font-bold">Yếu + Kém</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {(stats.byClass['WEAK'] || 0) + (stats.byClass['POOR'] || 0)}
          </p>
        </div>
      </div>

      {/* EXPORT BUTTON */}
      <div className="flex justify-end">
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors shadow-sm"
          id="export-csv-btn"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Xuất Excel (CSV)
        </button>
      </div>

      {/* EXCEL-STYLE TABLE */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-indigo-600 text-white text-xs uppercase tracking-wider">
                <th className="p-3 w-12 text-center border-r border-indigo-500">STT</th>
                <th className="p-3 w-28 border-r border-indigo-500">MSSV</th>
                <th className="p-3 border-r border-indigo-500">Họ và Tên</th>
                <th className="p-3 w-20 text-center border-r border-indigo-500">Điểm SV</th>
                <th className="p-3 w-20 text-center border-r border-indigo-500">Điểm BCS</th>
                <th className="p-3 w-20 text-center border-r border-indigo-500">Điểm CVHT</th>
                <th className="p-3 w-24 text-center border-r border-indigo-500">Xếp loại</th>
                <th className="p-3">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    Chưa có dữ liệu sinh viên
                  </td>
                </tr>
              ) : (
                students.map((student, index) => {
                  const clsColor = student.classification
                    ? CLASSIFICATION_COLORS[student.classification] || ''
                    : '';
                  const clsLabel = student.classification
                    ? CLASSIFICATION_LABELS[student.classification] || ''
                    : '';

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        }`}
                    >
                      <td className="p-3 text-center text-gray-500 font-medium border-r border-gray-100 text-sm">
                        {index + 1}
                      </td>
                      <td className="p-3 font-mono text-sm text-gray-700 border-r border-gray-100">
                        {student.studentCode || '—'}
                      </td>
                      <td className="p-3 font-medium text-gray-900 text-sm border-r border-gray-100">
                        {student.name}
                      </td>
                      <td className="p-3 text-center font-bold text-sm border-r border-gray-100">
                        {student.studentTotal ?? '—'}
                      </td>
                      <td className="p-3 text-center font-bold text-sm border-r border-gray-100">
                        {student.classTotal ?? '—'}
                      </td>
                      <td className="p-3 text-center font-bold text-sm border-r border-gray-100">
                        {student.advisorTotal ?? '—'}
                      </td>
                      <td className="p-3 text-center border-r border-gray-100">
                        {clsLabel ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${clsColor}`}>
                            {clsLabel}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          placeholder="Nhập ghi chú..."
                          value={notes[student.id] || ''}
                          onChange={(e) =>
                            setNotes((prev) => ({ ...prev, [student.id]: e.target.value }))
                          }
                          className="w-full text-sm border-0 bg-transparent outline-none placeholder-gray-300 focus:bg-yellow-50 focus:ring-1 focus:ring-yellow-300 rounded px-1 py-0.5 transition-colors"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
