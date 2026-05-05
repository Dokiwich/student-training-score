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
<<<<<<< HEAD
};

const CLS_COLORS: Record<string, { bg: string; color: string }> = {
  EXCELLENT: { bg: '#ecfdf5', color: '#059669' },
  VERY_GOOD: { bg: '#eff6ff', color: '#2563eb' },
  GOOD: { bg: '#fffbeb', color: '#d97706' },
  AVERAGE: { bg: '#f3f4f6', color: '#6b7280' },
  WEAK: { bg: '#fef2f2', color: '#dc2626' },
  POOR: { bg: '#fef2f2', color: '#dc2626' },
=======
>>>>>>> b667618330bd5ac598dc4a5e41537d57ede4ff57
};

export function AdvisorSummary() {
  const { data: session } = useSession();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const customJwt = (session as any)?.customJwt;
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (customJwt) headers['Authorization'] = `Bearer ${customJwt}`;
<<<<<<< HEAD
        const res = await fetch(`${API_BASE}/scoring/students`, { headers, credentials: 'include' });
        if (res.ok) { const json = await res.json(); setStudents(json.data || []); }
      } finally { setIsLoading(false); }
=======

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
>>>>>>> b667618330bd5ac598dc4a5e41537d57ede4ff57
    };
    fetchData();
  }, [session]);

  const stats = useMemo(() => {
    const total = students.length;
    const submitted = students.filter(s => s.status !== 'NO_SHEET' && s.status !== 'DRAFT').length;
    const unsubmitted = total - submitted;
    const submittedPct = total > 0 ? Math.round((submitted / total) * 100) : 0;
    
    const byClass: Record<string, number> = {};
    students.forEach((s) => { const cls = s.classification || 'NONE'; byClass[cls] = (byClass[cls] || 0) + 1; });
    const avgScore = total > 0 ? (students.reduce((sum, s) => sum + (s.finalTotal || s.advisorTotal || 0), 0) / total).toFixed(1) : '0';
    
    return { total, submitted, unsubmitted, submittedPct, byClass, avgScore };
  }, [students]);

<<<<<<< HEAD
  const exportData = (type: 'csv' | 'excel' | 'pdf') => {
    const header = ['STT', 'MSSV', 'Họ và Tên', 'Lớp', 'Điểm SV', 'Điểm BCS', 'Điểm CVHT', 'Xếp loại', 'Ghi chú'];
    const rows = students.map((s, i) => [i + 1, s.studentCode || '', s.name, s.className || '', s.studentTotal ?? '', s.classTotal ?? '', s.advisorTotal ?? '', s.classification ? CLASSIFICATION_LABELS[s.classification] || '' : '', notes[s.id] || '']);
    
    if (type === 'csv') {
      const BOM = '\uFEFF';
      const csv = BOM + [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'bang_tong_hop.csv'; a.click();
      URL.revokeObjectURL(url);
    } else if (type === 'excel') {
      const tableHtml = `<html><head><meta charset="utf-8"></head><body><table border="1"><tr>${header.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
      const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'bang_tong_hop.xls'; a.click();
      URL.revokeObjectURL(url);
    } else if (type === 'pdf') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`<html><head><title>Bảng tổng hợp</title><style>body { font-family: sans-serif; } table { width: 100%; border-collapse: collapse; margin-top: 20px; } th, td { border: 1px solid #000; padding: 8px; text-align: left; } th { background-color: #f3f4f6; }</style></head><body><h2>Bảng tổng hợp điểm rèn luyện</h2><table><tr>${header.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table><script>window.print(); window.close();</script></body></html>`);
        printWindow.document.close();
      }
    }
    setShowExportMenu(false);
=======
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
>>>>>>> b667618330bd5ac598dc4a5e41537d57ede4ff57
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div className="skeleton" style={{ height: 140, borderRadius: 12 }} />
          <div className="skeleton" style={{ height: 140, borderRadius: 12 }} />
        </div>
        <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 400, borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={{ background: 'linear-gradient(135deg, #6ee7b7 0%, #10b981 100%)', borderRadius: 12, padding: 20, color: '#064e3b', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Sĩ số</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{stats.total}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%)', borderRadius: 12, padding: 20, color: '#1e3a8a', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Điểm trung bình lớp</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{stats.avgScore}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #d8b4fe 0%, #a855f7 100%)', borderRadius: 12, padding: 20, color: '#4c1d95', boxShadow: '0 4px 6px -1px rgba(168, 85, 247, 0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Xếp loại Xuất sắc/Giỏi</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{(stats.byClass['EXCELLENT'] || 0) + (stats.byClass['VERY_GOOD'] || 0)}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fca5a5 0%, #ef4444 100%)', borderRadius: 12, padding: 20, color: '#7f1d1d', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Yếu/Kém</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{(stats.byClass['WEAK'] || 0) + (stats.byClass['POOR'] || 0)}</div>
        </div>
      </div>

<<<<<<< HEAD
      {/* Export button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
        <button onClick={() => setShowExportMenu(!showExportMenu)} className="btn-primary" id="export-csv-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Xuất dữ liệu
=======
      {/* EXPORT */}
      <div className="flex justify-end">
        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-black text-white text-sm font-bold hover:bg-gray-800 transition-colors"
          id="export-csv-btn"
        >
          Xuất Excel (CSV)
>>>>>>> b667618330bd5ac598dc4a5e41537d57ede4ff57
        </button>
        {showExportMenu && (
          <div style={{ position: 'absolute', top: 40, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: 4, zIndex: 10, display: 'flex', flexDirection: 'column', minWidth: 120 }}>
            <button onClick={() => exportData('csv')} style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, borderRadius: 4, width: '100%', fontWeight: 500 }} className="hover:bg-gray-100">CSV (.csv)</button>
            <button onClick={() => exportData('excel')} style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, borderRadius: 4, width: '100%', fontWeight: 500 }} className="hover:bg-gray-100">Excel (.xls)</button>
            <button onClick={() => exportData('pdf')} style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, borderRadius: 4, width: '100%', fontWeight: 500 }} className="hover:bg-gray-100">PDF (.pdf)</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="dashboard-table" style={{ minWidth: 900 }}>
            <thead>
<<<<<<< HEAD
              <tr>
                <th style={{ width: 50, textAlign: 'center' }}>STT</th>
                <th style={{ width: 100 }}>MSSV</th>
                <th>Họ và Tên</th>
                <th style={{ width: 90 }}>Lớp</th>
                <th style={{ width: 80, textAlign: 'center' }}>Điểm SV</th>
                <th style={{ width: 80, textAlign: 'center' }}>Điểm BCS</th>
                <th style={{ width: 80, textAlign: 'center' }}>Điểm CVHT</th>
                <th style={{ width: 100, textAlign: 'center' }}>Xếp loại</th>
                <th>Ghi chú</th>
=======
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
>>>>>>> b667618330bd5ac598dc4a5e41537d57ede4ff57
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
<<<<<<< HEAD
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Chưa có dữ liệu sinh viên</td></tr>
              ) : students.map((student, index) => {
                const clsLabel = student.classification ? CLASSIFICATION_LABELS[student.classification] || '' : '';
                const clsColor = CLS_COLORS[student.classification || ''] || { bg: '#f3f4f6', color: '#6b7280' };
                return (
                  <tr key={student.id}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{index + 1}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{student.studentCode || '-'}</td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{student.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{student.className || '-'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{student.studentTotal ?? '-'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{student.classTotal ?? '-'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>{student.advisorTotal ?? '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {clsLabel ? (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: clsColor.bg, color: clsColor.color }}>{clsLabel}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>
                      )}
                    </td>
                    <td>
                      <input type="text" placeholder="Nhập ghi chú..." value={notes[student.id] || ''}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [student.id]: e.target.value }))}
                        className="form-input" style={{ border: 'none', background: 'transparent', fontSize: 12, padding: '4px 6px' }} />
                    </td>
                  </tr>
                );
              })}
=======
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
>>>>>>> b667618330bd5ac598dc4a5e41537d57ede4ff57
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
