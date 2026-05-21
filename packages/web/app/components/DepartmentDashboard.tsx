'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';

const API_BASE = '/proxy-api';

interface DepartmentStats {
  total: number;
  submitted: number;
  finalized: number;
  avgScore: number;
  byClassification: Record<string, number>;
  byClass: {
    className: string;
    classCode: string;
    total: number;
    submitted: number;
    finalized: number;
    avgScore: number;
    byClassification: Record<string, number>;
  }[];
}

interface DeptStudent {
  id: string;
  studentCode: string | null;
  name: string;
  className: string;
  classCode: string;
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

const CLS_COLORS: Record<string, { bg: string; color: string }> = {
  EXCELLENT: { bg: '#ecfdf5', color: '#059669' },
  VERY_GOOD: { bg: '#eff6ff', color: '#2563eb' },
  GOOD: { bg: '#fffbeb', color: '#d97706' },
  AVERAGE: { bg: '#f3f4f6', color: '#6b7280' },
  WEAK: { bg: '#fef2f2', color: '#dc2626' },
  POOR: { bg: '#fef2f2', color: '#dc2626' },
};

export function DepartmentDashboard() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'summary' | 'classes'>('summary');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  
  const [students, setStudents] = useState<DeptStudent[]>([]);
  const [stats, setStats] = useState<DepartmentStats | null>(null);
  const [departmentInfo, setDepartmentInfo] = useState<{name: string, code: string} | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const customJwt = (session as any)?.customJwt;
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (customJwt) headers['Authorization'] = `Bearer ${customJwt}`;
        
        // Fetch stats
        const statsRes = await fetch(`${API_BASE}/department/stats`, { headers, credentials: 'include' });
        if (statsRes.ok) { 
          const json = await statsRes.json(); 
          setStats(json.stats);
          if (json.department) setDepartmentInfo(json.department);
        }
        
        // Fetch students
        const studentsRes = await fetch(`${API_BASE}/department/students`, { headers, credentials: 'include' });
        if (studentsRes.ok) { 
          const json = await studentsRes.json(); 
          setStudents(json.data || []); 
        }
      } finally { setIsLoading(false); }
    };
    fetchData();
  }, [session]);

  const exportData = (type: 'csv' | 'excel' | 'pdf') => {
    const dataToExport = selectedClass === 'ALL' 
      ? students 
      : students.filter(s => s.classCode === selectedClass);
      
    const header = ['STT', 'MSSV', 'Họ và Tên', 'Lớp', 'Điểm SV', 'Điểm BCS', 'Điểm CVHT', 'Điểm Cấp Khoa', 'Xếp loại'];
    const rows = dataToExport.map((s, i) => [
      i + 1, 
      s.studentCode || '', 
      s.name, 
      s.className || '', 
      s.studentTotal ?? '', 
      s.classTotal ?? '', 
      s.advisorTotal ?? '', 
      s.finalTotal ?? '',
      s.classification ? CLASSIFICATION_LABELS[s.classification] || '' : ''
    ]);
    
    const fileName = selectedClass === 'ALL' ? 'thong_ke_khoa' : `thong_ke_lop_${selectedClass}`;
    
    if (type === 'csv') {
      const BOM = '\uFEFF';
      const csv = BOM + [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${fileName}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else if (type === 'excel') {
      const tableHtml = `<html><head><meta charset="utf-8"></head><body><table border="1"><tr>${header.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
      const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${fileName}.xls`; a.click();
      URL.revokeObjectURL(url);
    } else if (type === 'pdf') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`<html><head><title>Thống kê ${departmentInfo?.name || 'Khoa'}</title><style>body { font-family: sans-serif; } table { width: 100%; border-collapse: collapse; margin-top: 20px; } th, td { border: 1px solid #000; padding: 8px; text-align: left; } th { background-color: #f3f4f6; }</style></head><body><h2>Thống kê điểm rèn luyện - ${departmentInfo?.name || 'Khoa'}</h2>${selectedClass !== 'ALL' ? `<h3>Lớp: ${selectedClass}</h3>` : ''}<table><tr>${header.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table><script>window.print(); window.close();<\/script></body></html>`);
        printWindow.document.close();
      }
    }
    setShowExportMenu(false);
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

  const filteredStudents = selectedClass === 'ALL' 
    ? students 
    : students.filter(s => s.classCode === selectedClass);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Info */}
      <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{departmentInfo?.name || 'Khoa'}</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Tổng hợp kết quả đánh giá điểm rèn luyện sinh viên</p>
        </div>
        
        {/* Export button moved from Advisor */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowExportMenu(!showExportMenu)} className="btn-primary" id="export-csv-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Xuất báo cáo
          </button>
          {showExportMenu && (
            <div style={{ position: 'absolute', top: 40, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: 4, zIndex: 10, display: 'flex', flexDirection: 'column', minWidth: 150 }}>
              <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                {selectedClass === 'ALL' ? 'TOÀN KHOA' : `LỚP ${selectedClass}`}
              </div>
              <button onClick={() => exportData('csv')} style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, borderRadius: 4, width: '100%', fontWeight: 500 }}>Xuất CSV (.csv)</button>
              <button onClick={() => exportData('excel')} style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, borderRadius: 4, width: '100%', fontWeight: 500 }}>Xuất Excel (.xls)</button>
              <button onClick={() => exportData('pdf')} style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, borderRadius: 4, width: '100%', fontWeight: 500 }}>In trang (PDF)</button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button
          onClick={() => setActiveTab('summary')}
          className={`dashboard-tab ${activeTab === 'summary' ? 'active' : ''}`}
        >
          Thống kê tổng quan
        </button>
        <button
          onClick={() => setActiveTab('classes')}
          className={`dashboard-tab ${activeTab === 'classes' ? 'active' : ''}`}
        >
          Chi tiết lớp học
        </button>
      </div>

      {/* Tab: Thống kê tổng quan */}
      {activeTab === 'summary' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{ background: 'linear-gradient(135deg, #6ee7b7 0%, #10b981 100%)', borderRadius: 12, padding: 20, color: '#064e3b', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Tổng Sinh viên</div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>{stats.total}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%)', borderRadius: 12, padding: 20, color: '#1e3a8a', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Điểm trung bình (Khoa)</div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>{stats.avgScore}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #d8b4fe 0%, #a855f7 100%)', borderRadius: 12, padding: 20, color: '#4c1d95', boxShadow: '0 4px 6px -1px rgba(168, 85, 247, 0.2)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Xuất sắc/Giỏi</div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>{(stats.byClassification['EXCELLENT'] || 0) + (stats.byClassification['VERY_GOOD'] || 0)}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)', borderRadius: 12, padding: 20, color: '#78350f', boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.2)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Đã nộp phiếu / Đã duyệt</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{stats.submitted} / {stats.finalized}</div>
            </div>
          </div>

          <h3 style={{ margin: '10px 0 0', fontSize: 18, color: 'var(--text-primary)' }}>Thống kê theo lớp</h3>
          <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th style={{ width: 60, textAlign: 'center' }}>STT</th>
                    <th>Lớp</th>
                    <th style={{ textAlign: 'center' }}>Sĩ số</th>
                    <th style={{ textAlign: 'center' }}>Đã nộp</th>
                    <th style={{ textAlign: 'center' }}>Đã duyệt</th>
                    <th style={{ textAlign: 'center' }}>Điểm TB</th>
                    <th style={{ textAlign: 'center' }}>XS/Giỏi</th>
                    <th style={{ textAlign: 'center' }}>Khá/TB</th>
                    <th style={{ textAlign: 'center' }}>Yếu/Kém</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byClass.map((c, i) => (
                    <tr key={c.classCode}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.classCode}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.className}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.total}</td>
                      <td style={{ textAlign: 'center', color: c.submitted < c.total ? 'var(--danger)' : 'var(--success)' }}>
                        {c.submitted} ({Math.round(c.submitted / c.total * 100)}%)
                      </td>
                      <td style={{ textAlign: 'center', color: c.finalized < c.total ? 'var(--warning-dark)' : 'var(--success)' }}>
                        {c.finalized}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>{c.avgScore}</td>
                      <td style={{ textAlign: 'center' }}>{(c.byClassification['EXCELLENT'] || 0) + (c.byClassification['VERY_GOOD'] || 0)}</td>
                      <td style={{ textAlign: 'center' }}>{(c.byClassification['GOOD'] || 0) + (c.byClassification['AVERAGE'] || 0)}</td>
                      <td style={{ textAlign: 'center' }}>{(c.byClassification['WEAK'] || 0) + (c.byClassification['POOR'] || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Chi tiết lớp học */}
      {activeTab === 'classes' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#f9fafb', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)' }}>Lọc theo lớp:</span>
            <select 
              value={selectedClass} 
              onChange={(e) => setSelectedClass(e.target.value)}
              className="form-input" 
              style={{ width: 250 }}
            >
              <option value="ALL">-- Tất cả các lớp --</option>
              {stats.byClass.map(c => (
                <option key={c.classCode} value={c.classCode}>{c.classCode} - {c.className}</option>
              ))}
            </select>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 10 }}>
              Hiển thị {filteredStudents.length} sinh viên
            </span>
          </div>

          <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="dashboard-table" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={{ width: 50, textAlign: 'center' }}>STT</th>
                    <th style={{ width: 100 }}>MSSV</th>
                    <th>Họ và Tên</th>
                    {selectedClass === 'ALL' && <th style={{ width: 90 }}>Lớp</th>}
                    <th style={{ width: 80, textAlign: 'center' }}>Trạng thái</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Điểm SV</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Điểm BCS</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Điểm CVHT</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Xếp loại</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr><td colSpan={selectedClass === 'ALL' ? 9 : 8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Chưa có dữ liệu</td></tr>
                  ) : filteredStudents.map((student, index) => {
                    const clsLabel = student.classification ? CLASSIFICATION_LABELS[student.classification] || '' : '';
                    const clsColor = CLS_COLORS[student.classification || ''] || { bg: '#f3f4f6', color: '#6b7280' };
                    
                    let statusLabel = '';
                    let statusColor = '';
                    if (student.status === 'NO_SHEET' || student.status === 'DRAFT') { statusLabel = 'Chưa nộp'; statusColor = 'var(--text-muted)'; }
                    else if (student.status === 'STUDENT_SUBMITTED') { statusLabel = 'Chờ lớp duyệt'; statusColor = 'var(--warning-dark)'; }
                    else if (student.status === 'CLASS_REVIEWED' || student.status === 'ADVISOR_REVIEWING') { statusLabel = 'Chờ CVHT'; statusColor = 'var(--accent)'; }
                    else { statusLabel = 'Hoàn tất'; statusColor = 'var(--success)'; }

                    return (
                      <tr key={student.id}>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{index + 1}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{student.studentCode || '-'}</td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{student.name}</td>
                        {selectedClass === 'ALL' && <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{student.classCode}</td>}
                        <td style={{ textAlign: 'center', fontSize: 12, fontWeight: 500, color: statusColor }}>{statusLabel}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{student.studentTotal ?? '-'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{student.classTotal ?? '-'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>{student.advisorTotal ?? '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          {clsLabel ? (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: clsColor.bg, color: clsColor.color }}>{clsLabel}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
