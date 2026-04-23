'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';

const API_BASE = '/proxy-api';

interface StudentSummary {
  id: string;
  studentCode: string | null;
  name: string;
  className?: string;
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

export function AdvisorSummary() {
  const { data: session } = useSession();

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!session?.user) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const customJwt = (session as any)?.customJwt;
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (customJwt) headers['Authorization'] = `Bearer ${customJwt}`;

        const res = await fetch(`${API_BASE}/scoring/students`, {
          headers,
          credentials: 'include',
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
  }, [session]);

  const stats = useMemo(() => {
    const total = students.length;
    const byClass: Record<string, number> = {};
    students.forEach((s) => {
      const cls = s.classification || 'NONE';
      byClass[cls] = (byClass[cls] || 0) + 1;
    });
    const avgScore =
      total > 0
        ? (students.reduce((sum, s) => sum + (s.finalTotal || s.advisorTotal || 0), 0) / total).toFixed(1)
        : '0';
    return { total, byClass, avgScore };
  }, [students]);

  const exportCSV = () => {
    const header = ['STT', 'MSSV', 'Họ và Tên', 'Lớp', 'Điểm SV', 'Điểm BCS', 'Điểm CVHT', 'Xếp loại', 'Ghi chú'];
    const rows = students.map((s, i) => [
      i + 1,
      s.studentCode || '',
      s.name,
      s.className || '',
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
    a.download = 'bang_tong_hop_diem_ren_luyen.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Si so</p>
          <p className="text-2xl font-bold text-black mt-1">{stats.total}</p>
        </div>
        <div className="border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Diem TB lop</p>
          <p className="text-2xl font-bold text-black mt-1">{stats.avgScore}</p>
        </div>
        <div className="border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Xuat sac + Gioi</p>
          <p className="text-2xl font-bold text-black mt-1">
            {(stats.byClass['EXCELLENT'] || 0) + (stats.byClass['VERY_GOOD'] || 0)}
          </p>
        </div>
        <div className="border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Yeu + Kem</p>
          <p className="text-2xl font-bold text-black mt-1">
            {(stats.byClass['WEAK'] || 0) + (stats.byClass['POOR'] || 0)}
          </p>
        </div>
      </div>

      {/* EXPORT */}
      <div className="flex justify-end">
        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-black text-white text-sm font-bold hover:bg-gray-800 transition-colors"
          id="export-csv-btn"
        >
          Xuất Excel (CSV)
        </button>
      </div>

      {/* TABLE */}
      <div className="border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-black text-white text-xs uppercase tracking-wider">
                <th className="p-3 w-12 text-center border-r border-gray-700">STT</th>
                <th className="p-3 w-28 border-r border-gray-700">MSSV</th>
                <th className="p-3 border-r border-gray-700">Họ và Tên</th>
                <th className="p-3 w-24 border-r border-gray-700">Lớp</th>
                <th className="p-3 w-20 text-center border-r border-gray-700">Điểm SV</th>
                <th className="p-3 w-20 text-center border-r border-gray-700">Điểm BCS</th>
                <th className="p-3 w-20 text-center border-r border-gray-700">Điểm CVHT</th>
                <th className="p-3 w-24 text-center border-r border-gray-700">Xếp loại</th>
                <th className="p-3">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">Chua co du lieu sinh vien</td>
                </tr>
              ) : (
                students.map((student, index) => {
                  const clsLabel = student.classification ? CLASSIFICATION_LABELS[student.classification] || '' : '';

                  return (
                    <tr key={student.id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="p-3 text-center text-gray-500 text-sm border-r border-gray-100">{index + 1}</td>
                      <td className="p-3 font-mono text-sm text-gray-700 border-r border-gray-100">{student.studentCode || '-'}</td>
                      <td className="p-3 font-medium text-black text-sm border-r border-gray-100">{student.name}</td>
                      <td className="p-3 text-sm text-gray-600 border-r border-gray-100">{student.className || '-'}</td>
                      <td className="p-3 text-center font-bold text-sm border-r border-gray-100">{student.studentTotal ?? '-'}</td>
                      <td className="p-3 text-center font-bold text-sm border-r border-gray-100">{student.classTotal ?? '-'}</td>
                      <td className="p-3 text-center font-bold text-sm border-r border-gray-100">{student.advisorTotal ?? '-'}</td>
                      <td className="p-3 text-center border-r border-gray-100">
                        {clsLabel ? (
                          <span className="px-2 py-0.5 text-xs font-bold bg-gray-100 text-black">{clsLabel}</span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          placeholder="Nhập ghi chú..."
                          value={notes[student.id] || ''}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [student.id]: e.target.value }))}
                          className="w-full text-sm border-0 bg-transparent outline-none placeholder-gray-300 focus:bg-gray-50 px-1 py-0.5"
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
