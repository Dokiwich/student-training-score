'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DataTable } from './DataTable';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

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

interface DeptClass {
  id: string;
  code: string;
  name: string;
  studentCount: number;
}

interface ClassStudent {
  enrollmentId: string;
  id: string;
  student_id: string | null;
  full_name: string;
  email: string;
  role: string;
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
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'summary' | 'classes' | 'manage'>(
    tabParam === 'manage' ? 'manage' : tabParam === 'classes' ? 'classes' : 'summary'
  );
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [students, setStudents] = useState<DeptStudent[]>([]);
  const [stats, setStats] = useState<DepartmentStats | null>(null);
  const [departmentInfo, setDepartmentInfo] = useState<{name: string, code: string} | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Tab "Quản lý sinh viên" state
  const [deptClasses, setDeptClasses] = useState<DeptClass[]>([]);
  const [manageClassId, setManageClassId] = useState('');
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newSvName, setNewSvName] = useState('');
  const [newSvEmail, setNewSvEmail] = useState('');
  const [newSvPassword, setNewSvPassword] = useState('');
  const [newSvMssv, setNewSvMssv] = useState('');
  const [manageSearch, setManageSearch] = useState('');

  // Import Excel state (Khoa)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<{ rowIndex: number; student_id?: string; full_name: string; email: string; password: string; class_code?: string }[]>([]);
  const [importResults, setImportResults] = useState<{ rowIndex: number; success: boolean; message: string; full_name?: string }[] | null>(null);
  const [importStats, setImportStats] = useState<{ successCount: number; errorCount: number; total: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session?.user) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const customJwt = (session as any)?.customJwt;
        if (!customJwt) return;

        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customJwt}`,
        };
        
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

  // Fetch department classes for manage tab
  useEffect(() => {
    if (activeTab === 'manage') {
      fetch('/api/department/classes')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(j => setDeptClasses(j.data || []))
        .catch(() => {});
    }
  }, [activeTab]);

  // Fetch students for selected class in manage tab
  useEffect(() => {
    if (activeTab === 'manage' && manageClassId) {
      setLoadingStudents(true);
      fetch(`/api/department/users?classId=${manageClassId}`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(j => setClassStudents(j.data || []))
        .catch(() => setClassStudents([]))
        .finally(() => setLoadingStudents(false));
    } else {
      setClassStudents([]);
    }
  }, [activeTab, manageClassId]);

  const handleAddStudent = async () => {
    if (!newSvName || !newSvEmail || !newSvPassword || !manageClassId) {
      return alert('Vui lòng nhập đầy đủ: Họ tên, Email, Mật khẩu');
    }
    try {
      const r = await fetch('/api/department/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newSvName,
          email: newSvEmail,
          password: newSvPassword,
          student_id: newSvMssv || undefined,
          class_id: manageClassId,
        }),
      });
      const d = await r.json();
      if (r.ok) {
        alert('Thêm sinh viên thành công');
        setShowAddStudentModal(false);
        setNewSvName(''); setNewSvEmail(''); setNewSvPassword(''); setNewSvMssv('');
        // Refresh
        const r2 = await fetch(`/api/department/users?classId=${manageClassId}`);
        if (r2.ok) { const j = await r2.json(); setClassStudents(j.data || []); }
      } else {
        alert(d.message);
      }
    } catch { alert('Lỗi kết nối'); }
  };

  const handleDeleteStudent = async (enrollment: ClassStudent) => {
    if (!confirm(`Xác nhận xóa "${enrollment.full_name}" khỏi lớp?`)) return;
    try {
      const r = await fetch('/api/department/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId: enrollment.enrollmentId }),
      });
      const d = await r.json();
      alert(d.message);
      if (r.ok) {
        setClassStudents(prev => prev.filter(s => s.enrollmentId !== enrollment.enrollmentId));
      }
    } catch { alert('Lỗi kết nối'); }
  };

  // === IMPORT EXCEL (KHOA) ===
  const downloadDeptTemplate = () => {
    import('xlsx').then((XLSX) => {
      const templateData = [
        { 'MSSV': '22AV001', 'Họ tên': 'Nguyễn Văn A', 'Email': '22av001@student.edu.vn', 'Mật khẩu': '123456', 'Lớp': '' },
        { 'MSSV': '22AV002', 'Họ tên': 'Trần Thị B', 'Email': '22av002@student.edu.vn', 'Mật khẩu': '123456', 'Lớp': '' },
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 30 }, { wch: 12 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'SinhVien');
      XLSX.writeFile(wb, 'mau_import_sinh_vien.xlsx');
    });
  };

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportResults(null);
    setImportStats(null);

    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

    const columnMap: Record<string, string> = {
      'MSSV': 'student_id', 'mssv': 'student_id', 'Mã SV': 'student_id',
      'Họ tên': 'full_name', 'Ho ten': 'full_name', 'Họ và tên': 'full_name',
      'Email': 'email', 'email': 'email',
      'Mật khẩu': 'password', 'Mat khau': 'password', 'Password': 'password',
      'Lớp': 'class_code', 'Mã lớp': 'class_code', 'Class': 'class_code',
    };

    const parsed = jsonData.map((row, i) => {
      const mapped: any = { rowIndex: i + 2 };
      for (const [key, value] of Object.entries(row)) {
        const normalKey = columnMap[key.trim()];
        if (normalKey) mapped[normalKey] = String(value).trim();
      }
      return mapped;
    }).filter((r: any) => r.full_name || r.email);

    setImportData(parsed);
  };

  const handleDeptImport = async () => {
    if (importData.length === 0) return;
    setIsImporting(true);
    setImportResults(null);
    try {
      const r = await fetch('/api/department/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: importData, classId: manageClassId || undefined }),
      });
      const d = await r.json();
      if (r.ok) {
        setImportResults(d.results || []);
        setImportStats({ successCount: d.successCount, errorCount: d.errorCount, total: d.total });
        // Refresh class student list if a class is selected
        if (manageClassId) {
          const r2 = await fetch(`/api/department/users?classId=${manageClassId}`);
          if (r2.ok) { const j = await r2.json(); setClassStudents(j.data || []); }
        }
      } else {
        alert(d.message);
      }
    } catch {
      alert('Lỗi kết nối khi import');
    } finally {
      setIsImporting(false);
    }
  };

  const resetDeptImport = () => {
    setImportData([]);
    setImportResults(null);
    setImportStats(null);
    setImportFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

  const filteredStudents = useMemo(() => {
    let result = selectedClass === 'ALL' 
      ? students 
      : students.filter(s => s.classCode === selectedClass);
      
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(term) || 
        (s.studentCode && s.studentCode.toLowerCase().includes(term))
      );
    }
    return result;
  }, [students, selectedClass, searchTerm]);

  const filteredManageStudents = useMemo(() => {
    if (!manageSearch.trim()) return classStudents;
    const term = manageSearch.toLowerCase();
    return classStudents.filter(s =>
      s.full_name.toLowerCase().includes(term) ||
      (s.student_id && s.student_id.toLowerCase().includes(term)) ||
      s.email.toLowerCase().includes(term)
    );
  }, [classStudents, manageSearch]);

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
  const classStatsColumns = useMemo(() => [
    { header: 'STT', width: 60, align: 'center' as const, render: (_c: any, i: number) => <span style={{ color: 'var(--text-muted)' }}>{i + 1}</span> },
    { header: 'Lớp', render: (c: any) => (
        <>
          <div style={{ fontWeight: 600 }}>{c.classCode}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.className}</div>
        </>
      )
    },
    { header: 'Sĩ số', align: 'center' as const, render: (c: any) => <span style={{ fontWeight: 600 }}>{c.total}</span> },
    { header: 'Đã nộp', align: 'center' as const, render: (c: any) => <span style={{ color: c.submitted < c.total ? 'var(--danger)' : 'var(--success)' }}>{c.submitted} ({c.total > 0 ? Math.round(c.submitted / c.total * 100) : 0}%)</span> },
    { header: 'Đã duyệt', align: 'center' as const, render: (c: any) => <span style={{ color: c.finalized < c.total ? 'var(--warning-dark)' : 'var(--success)' }}>{c.finalized}</span> },
    { header: 'Điểm TB', align: 'center' as const, render: (c: any) => <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{c.avgScore}</span> },
    { header: 'XS/Giỏi', align: 'center' as const, render: (c: any) => <span>{(c.byClassification['EXCELLENT'] || 0) + (c.byClassification['VERY_GOOD'] || 0)}</span> },
    { header: 'Khá/TB', align: 'center' as const, render: (c: any) => <span>{(c.byClassification['GOOD'] || 0) + (c.byClassification['AVERAGE'] || 0)}</span> },
    { header: 'Yếu/Kém', align: 'center' as const, render: (c: any) => <span>{(c.byClassification['WEAK'] || 0) + (c.byClassification['POOR'] || 0)}</span> },
  ], []);

  const classStatsFooter = stats ? (
    <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
      <td colSpan={2} style={{ textAlign: 'center', padding: '12px' }}>TỔNG CỘNG</td>
      <td style={{ textAlign: 'center', color: 'var(--text-primary)' }}>{stats.total}</td>
      <td style={{ textAlign: 'center', color: 'var(--success)' }}>{stats.submitted}</td>
      <td style={{ textAlign: 'center', color: 'var(--success)' }}>{stats.finalized}</td>
      <td style={{ textAlign: 'center', color: 'var(--accent)' }}>{stats.avgScore}</td>
      <td style={{ textAlign: 'center' }}>{(stats.byClassification['EXCELLENT'] || 0) + (stats.byClassification['VERY_GOOD'] || 0)}</td>
      <td style={{ textAlign: 'center' }}>{(stats.byClassification['GOOD'] || 0) + (stats.byClassification['AVERAGE'] || 0)}</td>
      <td style={{ textAlign: 'center' }}>{(stats.byClassification['WEAK'] || 0) + (stats.byClassification['POOR'] || 0)}</td>
    </tr>
  ) : null;

  const manageStudentsColumns = useMemo(() => [
    { header: 'STT', width: 50, align: 'center' as const, render: (_s: any, i: number) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</span> },
    { header: 'MSSV', width: 110, render: (s: any) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.student_id || '-'}</span> },
    { header: 'Họ và Tên', render: (s: any) => <span style={{ fontWeight: 500 }}>{s.full_name}</span> },
    { header: 'Email', render: (s: any) => <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s.email}</span> },
    { header: 'Thao tác', width: 80, align: 'center' as const, render: (s: any) => (
        <button
          onClick={() => handleDeleteStudent(s)}
          style={{
            padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
            border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#fee2e2'; }}
          onMouseOut={e => { e.currentTarget.style.background = '#fef2f2'; }}
        >
          Xóa
        </button>
      )
    }
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Info */}
      <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{departmentInfo?.name || 'Khoa'}</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Tổng hợp kết quả đánh giá điểm rèn luyện sinh viên</p>
        </div>
        
        {/* Export button */}
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
        <button onClick={() => setActiveTab('summary')} className={`dashboard-tab ${activeTab === 'summary' ? 'active' : ''}`}>
          Thống kê tổng quan
        </button>
        <button onClick={() => setActiveTab('classes')} className={`dashboard-tab ${activeTab === 'classes' ? 'active' : ''}`}>
          Chi tiết lớp học
        </button>
        <button onClick={() => setActiveTab('manage')} className={`dashboard-tab ${activeTab === 'manage' ? 'active' : ''}`}>
          Quản lý sinh viên
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

          <div style={{ marginTop: 24 }}>
            <DataTable
              title="Thống kê theo lớp"
              columns={classStatsColumns}
              data={stats.byClass}
              footer={classStatsFooter}
              onRowClick={(c: any) => {
                setSelectedClass(c.classCode);
                setActiveTab('classes');
              }}
              rowTitle={(c: any) => `Xem chi tiết lớp ${c.classCode}`}
            />
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
              style={{ width: 200 }}
            >
              <option value="ALL">-- Tất cả các lớp --</option>
              {stats.byClass.map(c => (
                <option key={c.classCode} value={c.classCode}>{c.classCode} - {c.className}</option>
              ))}
            </select>
            
            <div style={{ position: 'relative', marginLeft: 12, flex: 1, maxWidth: 300 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="Tìm tên hoặc MSSV..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', fontSize: 13, padding: '8px 10px 8px 32px', border: '1px solid var(--border)', borderRadius: 8, outline: 'none' }} />
            </div>

            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Hiển thị {filteredStudents.length} kết quả
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

      {/* Tab: Quản lý sinh viên */}
      {activeTab === 'manage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filter bar */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#f9fafb', padding: 16, borderRadius: 8, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)' }}>Chọn lớp:</span>
            <select
              value={manageClassId}
              onChange={(e) => setManageClassId(e.target.value)}
              className="form-input"
              style={{ width: 240 }}
            >
              <option value="">-- Chọn lớp --</option>
              {deptClasses.map(c => (
                <option key={c.id} value={c.id}>{c.code} - {c.name} ({c.studentCount} SV)</option>
              ))}
            </select>

            {manageClassId && (
              <>
                <div style={{ position: 'relative', flex: 1, maxWidth: 280, minWidth: 180 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input type="text" placeholder="Tìm tên, MSSV..." value={manageSearch} onChange={(e) => setManageSearch(e.target.value)}
                    style={{ width: '100%', fontSize: 13, padding: '8px 10px 8px 32px', border: '1px solid var(--border)', borderRadius: 8, outline: 'none' }} />
                </div>

                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                  <button
                    onClick={() => { setShowImportModal(true); resetDeptImport(); }}
                    style={{
                      padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                      border: '1px solid #e0e7ff', background: '#eef2ff', color: '#4f46e5',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#e0e7ff'; }}
                    onMouseOut={e => { e.currentTarget.style.background = '#eef2ff'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Import Excel
                  </button>
                  <button
                    onClick={() => setShowAddStudentModal(true)}
                    style={{
                      padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                      border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#059669'; }}
                    onMouseOut={e => { e.currentTarget.style.background = '#10b981'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Thêm sinh viên
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Student list */}
          {!manageClassId ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <div>Vui lòng chọn lớp để quản lý sinh viên</div>
            </div>
          ) : loadingStudents ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải danh sách...</div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <DataTable
                title=""
                subtitle={`${filteredManageStudents.length} sinh viên`}
                columns={manageStudentsColumns}
                data={filteredManageStudents}
                emptyMessage="Chưa có sinh viên nào trong lớp"
              />
            </div>
          )}
        </div>
      )}

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3 className="modal-header-title">Thêm sinh viên vào lớp</h3>
              <button onClick={() => setShowAddStudentModal(false)} className="modal-close-btn">✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Họ tên *</label>
                <input type="text" className="form-input" value={newSvName} onChange={e => setNewSvName(e.target.value)} placeholder="Nhập họ tên sinh viên" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">MSSV</label>
                <input type="text" className="form-input" value={newSvMssv} onChange={e => setNewSvMssv(e.target.value)} placeholder="Nhập mã số sinh viên" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Email *</label>
                <input type="email" className="form-input" value={newSvEmail} onChange={e => setNewSvEmail(e.target.value)} placeholder="Nhập email" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Mật khẩu *</label>
                <input type="password" className="form-input" value={newSvPassword} onChange={e => setNewSvPassword(e.target.value)} placeholder="Nhập mật khẩu" />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAddStudentModal(false)} className="btn-secondary">Hủy</button>
              <button onClick={handleAddStudent} className="btn-primary">Thêm sinh viên</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Excel Modal (Khoa) */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 750, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 className="modal-header-title">📥 Import sinh viên từ Excel</h3>
              <button onClick={() => setShowImportModal(false)} className="modal-close-btn">✕</button>
            </div>
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
              {!importResults && (
                <>
                  {manageClassId && (
                    <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#15803d', fontWeight: 500 }}>
                      ✅ Lớp đã chọn: <strong>{deptClasses.find(c => c.id === manageClassId)?.code}</strong> — Sinh viên sẽ được thêm vào lớp này (trừ khi file có cột Lớp riêng)
                    </div>
                  )}
                  {!manageClassId && (
                    <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#92400e', fontWeight: 500 }}>
                      ⚠ Chưa chọn lớp — File Excel cần có cột "Lớp" (mã lớp) để xác định lớp cho từng sinh viên
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button onClick={downloadDeptTemplate}
                      style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Tải file mẫu (.xlsx)
                    </button>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: '2px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', background: importFileName ? '#f0fdf4' : '#fafafa', borderColor: importFileName ? '#86efac' : '#d1d5db', transition: 'all 0.2s' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={importFileName ? '#16a34a' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span style={{ fontSize: 13, color: importFileName ? '#16a34a' : '#6b7280', fontWeight: 500 }}>
                          {importFileName || 'Chọn file .xlsx hoặc .xls'}
                        </span>
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportFileSelect} style={{ display: 'none' }} />
                      </label>
                    </div>
                  </div>

                  {importData.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: 0 }}>Xem trước: {importData.length} dòng dữ liệu</p>
                        <button onClick={resetDeptImport} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Chọn file khác</button>
                      </div>
                      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 300 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Dòng</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>MSSV</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Họ tên</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Email</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Lớp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importData.map((row, i) => {
                              const hasError = !row.full_name || !row.email || !row.password;
                              return (
                                <tr key={i} style={{ background: hasError ? '#fef2f2' : 'transparent' }}>
                                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', color: '#9ca3af' }}>{row.rowIndex}</td>
                                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace' }}>{row.student_id || '-'}</td>
                                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', fontWeight: 500, color: !row.full_name ? '#dc2626' : '#1f2937' }}>{row.full_name || '⚠ Thiếu'}</td>
                                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', color: !row.email ? '#dc2626' : '#6b7280' }}>{row.email || '⚠ Thiếu'}</td>
                                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{row.class_code || (manageClassId ? '← Lớp đã chọn' : '⚠ Chưa có')}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {importResults && importStats && (
                <div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>{importStats.successCount}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>Thành công</div>
                    </div>
                    <div style={{ flex: 1, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626' }}>{importStats.errorCount}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#b91c1c' }}>Lỗi</div>
                    </div>
                    <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#475569' }}>{importStats.total}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Tổng cộng</div>
                    </div>
                  </div>
                  {importStats.errorCount > 0 && (
                    <div style={{ overflowX: 'auto', border: '1px solid #fecaca', borderRadius: 8, maxHeight: 250 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#fef2f2', position: 'sticky', top: 0 }}>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #fecaca' }}>Dòng</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #fecaca' }}>Họ tên</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #fecaca' }}>Lý do lỗi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResults.filter(r => !r.success).map((r, i) => (
                            <tr key={i}>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid #fee2e2', color: '#9ca3af' }}>{r.rowIndex}</td>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid #fee2e2', fontWeight: 500 }}>{r.full_name || '-'}</td>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid #fee2e2', color: '#dc2626' }}>{r.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              {!importResults ? (
                <>
                  <button onClick={() => setShowImportModal(false)} className="btn-secondary">Hủy</button>
                  <button onClick={handleDeptImport} className="btn-primary" disabled={importData.length === 0 || isImporting} style={{ opacity: importData.length === 0 || isImporting ? 0.5 : 1 }}>
                    {isImporting ? 'Đang nhập...' : `Nhập ${importData.length} sinh viên`}
                  </button>
                </>
              ) : (
                <button onClick={() => setShowImportModal(false)} className="btn-primary">Đóng</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
