'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DataTable } from './DataTable';
import { ScoringForm } from './ScoringForm';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';

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
  byMonth: { month: string; count: number }[];
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
  academicYear?: string;
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

interface SemesterItem {
  id: string;
  code: string;
  name: string;
  is_active: number;
}

interface ComparisonData {
  semesterId: string;
  semesterName: string;
  semesterCode: string;
  byClassification: Record<string, number>;
  total: number;
  avgScore: number;
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  EXCELLENT: 'Xuất sắc',
  VERY_GOOD: 'Giỏi',
  GOOD: 'Khá',
  AVERAGE: 'Trung bình',
  WEAK: 'Yếu',
  POOR: 'Kém',
};

const CLS_COLORS: Record<string, { bg: string; color: string; chart: string }> = {
  EXCELLENT: { bg: '#ecfdf5', color: '#059669', chart: '#10b981' },
  VERY_GOOD: { bg: '#eff6ff', color: '#2563eb', chart: '#3b82f6' },
  GOOD: { bg: '#fffbeb', color: '#d97706', chart: '#f59e0b' },
  AVERAGE: { bg: '#f3f4f6', color: '#6b7280', chart: '#9ca3af' },
  WEAK: { bg: '#fef2f2', color: '#dc2626', chart: '#ef4444' },
  POOR: { bg: '#fef2f2', color: '#dc2626', chart: '#dc2626' },
};

const CLS_KEYS = ['EXCELLENT', 'VERY_GOOD', 'GOOD', 'AVERAGE', 'WEAK', 'POOR'];

/* ═══════════════════════════════════════════════════
   DONUT CHART COMPONENT (Pure SVG)
   ═══════════════════════════════════════════════════ */
function DonutChart({ data, total }: { data: Record<string, number>; total: number }) {
  const segments = CLS_KEYS.map(k => ({ key: k, value: data[k] || 0, color: CLS_COLORS[k]?.chart || '#ccc', label: CLASSIFICATION_LABELS[k] || k }));
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  const radius = 80;
  const cx = 100, cy = 100;
  const strokeWidth = 28;

  let startAngle = -90;
  const arcs = segments.filter(s => s.value > 0).map(s => {
    const pct = s.value / sum;
    const angle = pct * 360;
    const endAngle = startAngle + angle;
    const largeArc = angle > 180 ? 1 : 0;
    const x1 = cx + radius * Math.cos((startAngle * Math.PI) / 180);
    const y1 = cy + radius * Math.sin((startAngle * Math.PI) / 180);
    const x2 = cx + radius * Math.cos((endAngle * Math.PI) / 180);
    const y2 = cy + radius * Math.sin((endAngle * Math.PI) / 180);
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    startAngle = endAngle;
    return { ...s, path, pct };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        {arcs.map((arc, i) => (
          <path key={i} d={arc.path} fill="none" stroke={arc.color} strokeWidth={strokeWidth} strokeLinecap="round" style={{ transition: 'all 0.5s ease' }}>
            <title>{arc.label}: {arc.value} ({(arc.pct * 100).toFixed(1)}%)</title>
          </path>
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="28" fontWeight="800" fill="#0f172a">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" fill="#94a3b8" fontWeight="500">Sinh viên</text>
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {segments.filter(s => s.value > 0).map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#475569' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
            <span>{s.label}: <strong>{s.value}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   BAR CHART COMPONENT (Pure SVG — 3 semesters)
   ═══════════════════════════════════════════════════ */
function BarChart({ comparison }: { comparison: ComparisonData[] }) {
  if (!comparison.length) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Chưa có dữ liệu so sánh</div>;

  const categories = CLS_KEYS;
  const maxVal = Math.max(1, ...comparison.flatMap(c => categories.map(k => c.byClassification[k] || 0)));
  const barGroupWidth = 160;
  const chartW = categories.length * barGroupWidth + 60;
  const chartH = 240;
  const barW = 28;
  const semColors = ['#6366f1', '#0ea5e9', '#f59e0b'];

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={chartW} height={chartH + 70} viewBox={`0 0 ${chartW} ${chartH + 70}`} style={{ display: 'block', margin: '0 auto' }}>
        {/* Y-axis lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = chartH - pct * chartH;
          return (
            <g key={i}>
              <line x1="40" y1={y} x2={chartW - 10} y2={y} stroke="#e2e8f0" strokeDasharray={i === 0 ? '0' : '4,4'} />
              <text x="35" y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(maxVal * pct)}</text>
            </g>
          );
        })}
        {/* Bars */}
        {categories.map((cat, ci) => {
          const groupX = 50 + ci * barGroupWidth;
          return (
            <g key={cat}>
              {comparison.map((sem, si) => {
                const val = sem.byClassification[cat] || 0;
                const barH = (val / maxVal) * chartH;
                const x = groupX + si * (barW + 4) + (barGroupWidth - comparison.length * (barW + 4)) / 2;
                return (
                  <g key={si}>
                    <rect x={x} y={chartH - barH} width={barW} height={barH} rx={4} fill={semColors[si]} opacity={0.85} style={{ transition: 'all 0.5s ease' }}>
                      <title>{sem.semesterName}: {val}</title>
                    </rect>
                    {val > 0 && <text x={x + barW / 2} y={chartH - barH - 4} textAnchor="middle" fontSize="10" fontWeight="600" fill={semColors[si]}>{val}</text>}
                  </g>
                );
              })}
              <text x={groupX + barGroupWidth / 2} y={chartH + 16} textAnchor="middle" fontSize="10" fontWeight="500" fill="#475569">{CLASSIFICATION_LABELS[cat]}</text>
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
        {comparison.map((sem, i) => (
          <div key={sem.semesterId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#475569' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: semColors[i] }} />
            <span>{sem.semesterName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MONTHLY CHART (Area chart — Pure SVG)
   ═══════════════════════════════════════════════════ */
function MonthlyChart({ data }: { data: { month: string; count: number }[] }) {
  if (!data.length) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Chưa có dữ liệu</div>;

  const chartW = Math.max(400, data.length * 80);
  const chartH = 180;
  const pad = 40;
  const maxVal = Math.max(1, ...data.map(d => d.count));

  const points = data.map((d, i) => {
    const x = pad + (i / Math.max(1, data.length - 1)) * (chartW - pad * 2);
    const y = chartH - pad - ((d.count / maxVal) * (chartH - pad * 2));
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${chartH - pad} L ${points[0].x} ${chartH - pad} Z`;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={chartW} height={chartH + 10} viewBox={`0 0 ${chartW} ${chartH + 10}`} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid */}
        {[0, 0.5, 1].map((pct, i) => {
          const y = chartH - pad - pct * (chartH - pad * 2);
          return <line key={i} x1={pad} y1={y} x2={chartW - pad} y2={y} stroke="#e2e8f0" strokeDasharray="4,4" />;
        })}
        <path d={areaPath} fill="url(#areaGrad)" />
        <path d={linePath} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#0ea5e9" strokeWidth="2" />
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="600" fill="#0369a1">{p.count}</text>
            <text x={p.x} y={chartH - pad + 16} textAnchor="middle" fontSize="9" fill="#94a3b8">{p.month.substring(5)}/{p.month.substring(2, 4)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   MAIN DEPARTMENT DASHBOARD
   ═══════════════════════════════════════════════════ */
export function DepartmentDashboard() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewParam = searchParams.get('view');
  const activeView = viewParam || 'dashboard';
  const classParam = searchParams.get('class');

  const [selectedClass, setSelectedClass] = useState<string>(classParam || 'ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [students, setStudents] = useState<DeptStudent[]>([]);
  const [stats, setStats] = useState<DepartmentStats | null>(null);
  const [departmentInfo, setDepartmentInfo] = useState<{name: string, code: string} | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Semester state
  const [semesters, setSemesters] = useState<SemesterItem[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');

  // Comparison chart data
  const [comparison, setComparison] = useState<ComparisonData[]>([]);

  // Tab "Quản lý sinh viên" state
  const [deptClasses, setDeptClasses] = useState<DeptClass[]>([]);
  const [manageClassId, setManageClassId] = useState('');
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<DeptStudent | null>(null);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newSvName, setNewSvName] = useState('');
  const [newSvEmail, setNewSvEmail] = useState('');
  const [newSvPassword, setNewSvPassword] = useState('');
  const [newSvMssv, setNewSvMssv] = useState('');
  const [manageSearch, setManageSearch] = useState('');

  // Add class modal state
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  const [newClassYear, setNewClassYear] = useState(new Date().getFullYear().toString());

  // Import Excel state (Khoa)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<{ rowIndex: number; student_id?: string; full_name: string; email: string; password: string; class_code?: string }[]>([]);
  const [importResults, setImportResults] = useState<{ rowIndex: number; success: boolean; message: string; full_name?: string }[] | null>(null);
  const [importStats, setImportStats] = useState<{ successCount: number; errorCount: number; total: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getHeaders = useCallback((): HeadersInit | null => {
    const customJwt = (session as any)?.customJwt;
    if (!customJwt) return null;
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customJwt}` };
  }, [session]);

  // Fetch semesters on mount
  useEffect(() => {
    if (!session?.user) return;
    const headers = getHeaders();
    if (!headers) return;
    fetch(`${API_BASE}/department/semesters`, { headers, credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => {
        const semList: SemesterItem[] = j.data || [];
        setSemesters(semList);
        // Tìm HK active (is_active = 1); nếu không có thì lấy HK đầu tiên (mới nhất theo start_date desc)
        const active = semList.find((s) => Number(s.is_active) === 1);
        if (active) {
          setSelectedSemesterId(active.id);
        } else if (semList.length > 0) {
          setSelectedSemesterId(semList[0].id);
        }
      })
      .catch(() => {});
  }, [session, getHeaders]);

  // Fetch stats & students when semester changes
  useEffect(() => {
    if (!session?.user || !selectedSemesterId) return;
    const headers = getHeaders();
    if (!headers) return;
    setIsLoading(true);
    const semQ = `semesterId=${selectedSemesterId}`;
    Promise.all([
      fetch(`${API_BASE}/department/stats?${semQ}`, { headers, credentials: 'include' }),
      fetch(`${API_BASE}/department/students?${semQ}`, { headers, credentials: 'include' }),
    ]).then(async ([statsRes, studentsRes]) => {
      if (statsRes.ok) { const j = await statsRes.json(); setStats(j.stats); if (j.department) setDepartmentInfo(j.department); }
      if (studentsRes.ok) { const j = await studentsRes.json(); setStudents(j.data || []); }
    }).finally(() => setIsLoading(false));
  }, [session, selectedSemesterId, getHeaders]);

  // Fetch comparison data
  useEffect(() => {
    if (!session?.user || activeView !== 'charts') return;
    const headers = getHeaders();
    if (!headers) return;
    fetch(`${API_BASE}/department/stats/compare`, { headers, credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => setComparison(j.data || []))
      .catch(() => {});
  }, [session, activeView, getHeaders]);

  // Fetch department classes for students view (merged manage + students)
  useEffect(() => {
    if (activeView === 'students' || activeView === 'manage') {
      fetch('/api/department/classes').then(r => r.ok ? r.json() : Promise.reject()).then(j => setDeptClasses(j.data || [])).catch(() => {});
    }
  }, [activeView]);

  // Fetch students for selected class in manage section
  useEffect(() => {
    if ((activeView === 'students' || activeView === 'manage') && manageClassId) {
      setLoadingStudents(true);
      fetch(`/api/department/users?classId=${manageClassId}`).then(r => r.ok ? r.json() : Promise.reject()).then(j => setClassStudents(j.data || [])).catch(() => setClassStudents([])).finally(() => setLoadingStudents(false));
    } else { setClassStudents([]); }
  }, [activeView, manageClassId]);

  // Sync selectedClass from URL class param
  useEffect(() => {
    if (classParam) setSelectedClass(classParam);
  }, [classParam]);

  // --- Handlers ---
  const refreshClasses = async () => {
    try {
      const r = await fetch('/api/department/classes');
      if (r.ok) { const j = await r.json(); setDeptClasses(j.data || []); }
    } catch { /* ignore */ }
  };

  const handleAddClass = async () => {
    if (!newClassCode?.trim() || !newClassName?.trim()) return alert('Vui lòng nhập mã lớp và tên lớp');
    try {
      const r = await fetch('/api/department/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newClassCode.trim(), name: newClassName.trim(), academic_year: newClassYear.trim() }),
      });
      const d = await r.json();
      if (r.ok) {
        alert('Thêm lớp thành công');
        setShowAddClassModal(false); setNewClassCode(''); setNewClassName(''); setNewClassYear(new Date().getFullYear().toString());
        refreshClasses();
      } else { alert(d.message); }
    } catch { alert('Lỗi kết nối'); }
  };

  const handleDeleteClass = async (cls: DeptClass) => {
    if (!confirm(`Xác nhận xóa lớp "${cls.code} - ${cls.name}"?\n(Lớp phải không còn sinh viên nào)`)) return;
    try {
      const r = await fetch('/api/department/classes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: cls.id }),
      });
      const d = await r.json();
      alert(d.message);
      if (r.ok) refreshClasses();
    } catch { alert('Lỗi kết nối'); }
  };

  const handleAddStudent = async () => {
    if (!newSvName || !newSvEmail || !newSvPassword || !manageClassId) return alert('Vui lòng nhập đầy đủ');
    try {
      const r = await fetch('/api/department/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: newSvName, email: newSvEmail, password: newSvPassword, student_id: newSvMssv || undefined, class_id: manageClassId }) });
      const d = await r.json();
      if (r.ok) { alert('Thêm sinh viên thành công'); setShowAddStudentModal(false); setNewSvName(''); setNewSvEmail(''); setNewSvPassword(''); setNewSvMssv(''); const r2 = await fetch(`/api/department/users?classId=${manageClassId}`); if (r2.ok) { const j = await r2.json(); setClassStudents(j.data || []); } } else { alert(d.message); }
    } catch { alert('Lỗi kết nối'); }
  };

  const handleDeleteStudent = async (enrollment: ClassStudent) => {
    if (!confirm(`Xác nhận xóa "${enrollment.full_name}" khỏi lớp?`)) return;
    try {
      const r = await fetch('/api/department/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enrollmentId: enrollment.enrollmentId }) });
      const d = await r.json(); alert(d.message);
      if (r.ok) setClassStudents(prev => prev.filter(s => s.enrollmentId !== enrollment.enrollmentId));
    } catch { alert('Lỗi kết nối'); }
  };

  const downloadDeptTemplate = () => {
    import('xlsx').then((XLSX) => {
      const classCodes = deptClasses.map(c => c.code);
      const sampleCode = classCodes[0] || '23IT';
      const currentYear = new Date().getFullYear();
      const courseYears = `${currentYear - 3} - ${currentYear + 1}`;

      // Build sheet data matching the university template format
      const sheetData: (string | null)[][] = [
        // Row 1: Institution headers
        [null, 'BỘ GIÁO DỤC VÀ ĐÀO TẠO', null, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', null],
        // Row 2: University name + motto
        ['TRƯỜNG ĐẠI HỌC CÔNG NGHỆ MIỀN ĐÔNG', null, null, 'Độc Lập - Tự Do - Hạnh Phúc', null],
        // Row 3: decorative lines
        [null, '——————————————', null, '——o0o——', null],
        // Row 4: empty
        [],
        // Row 5: Khóa học
        [`Khóa học: ${courseYears}`],
        // Row 6: Bậc đào tạo
        ['Bậc đào tạo: Đại học'],
        // Row 7: Loại đào tạo
        ['Loại đào tạo: Chính Quy'],
        // Row 8: empty
        [],
        // Row 9: Table header
        ['MSSV', 'Họ và tên', 'Email Trường', 'Mật Khẩu', 'Lớp'],
        // Row 10+: Sample data
        [`${sampleCode}001`, 'Nguyễn Văn A', `${sampleCode.toLowerCase()}001@student.edu.vn`, `Sv@${sampleCode}001`, sampleCode],
        [`${sampleCode}002`, 'Trần Thị B', `${sampleCode.toLowerCase()}002@student.edu.vn`, `Sv@${sampleCode}002`, sampleCode],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // Column widths
      ws['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 32 }, { wch: 18 }, { wch: 10 }];

      // Merge cells for header area
      ws['!merges'] = [
        { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },  // BỘ GIÁO DỤC merge B1:C1
        { s: { r: 0, c: 3 }, e: { r: 0, c: 4 } },  // CỘNG HÒA merge D1:E1
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },  // TRƯỜNG merge A2:C2
        { s: { r: 1, c: 3 }, e: { r: 1, c: 4 } },  // Độc Lập merge D2:E2
        { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },  // dashes merge B3:C3
        { s: { r: 2, c: 3 }, e: { r: 2, c: 4 } },  // o0o merge D3:E3
        { s: { r: 4, c: 0 }, e: { r: 4, c: 2 } },  // Khóa học merge
        { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } },  // Bậc đào tạo merge
        { s: { r: 6, c: 0 }, e: { r: 6, c: 2 } },  // Loại đào tạo merge
      ];

      // Build workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'SinhVien');

      // Add a second sheet listing available class codes for reference
      if (classCodes.length > 0) {
        const classesData = deptClasses.map(c => ({ 'Mã lớp': c.code, 'Tên lớp': c.name, 'Sĩ số hiện tại': c.studentCount }));
        const wsClasses = XLSX.utils.json_to_sheet(classesData);
        wsClasses['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wsClasses, 'DanhSachLop');
      }

      XLSX.writeFile(wb, 'mau_import_sinh_vien.xlsx');
    });
  };

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportFileName(file.name); setImportResults(null); setImportStats(null);
    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer(); const wb = XLSX.read(data); const ws = wb.Sheets[wb.SheetNames[0]];

    // Column name mapping — supports both old simple format and new university template format
    const columnMap: Record<string, string> = {
      'MSSV': 'student_id', 'mssv': 'student_id', 'Mã SV': 'student_id',
      'Họ tên': 'full_name', 'Ho ten': 'full_name', 'Họ và tên': 'full_name',
      'Email': 'email', 'email': 'email', 'Email Trường': 'email', 'Email trường': 'email',
      'Mật khẩu': 'password', 'Mat khau': 'password', 'Password': 'password', 'Mật Khẩu': 'password',
      'Lớp': 'class_code', 'Mã lớp': 'class_code', 'Class': 'class_code',
    };

    // Auto-detect header row: scan rows to find the one containing "MSSV"
    const allRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
    let headerRowIndex = 0; // default: first row is header
    for (let r = 0; r < Math.min(allRows.length, 20); r++) {
      const row = allRows[r];
      if (row && row.some(cell => String(cell).trim() === 'MSSV')) {
        headerRowIndex = r;
        break;
      }
    }

    // Parse with detected header offset using range option
    const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { range: headerRowIndex, defval: '' });

    const parsed = jsonData.map((row, i) => {
      const mapped: any = { rowIndex: headerRowIndex + i + 2 }; // +2: header=1 row, 0-indexed
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
    setIsImporting(true); setImportResults(null);
    try {
      const r = await fetch('/api/department/bulk-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: importData, classId: manageClassId || undefined }) });
      const d = await r.json();
      if (r.ok) { setImportResults(d.results || []); setImportStats({ successCount: d.successCount, errorCount: d.errorCount, total: d.total }); if (manageClassId) { const r2 = await fetch(`/api/department/users?classId=${manageClassId}`); if (r2.ok) { const j = await r2.json(); setClassStudents(j.data || []); } } } else { alert(d.message); }
    } catch { alert('Lỗi kết nối khi import'); } finally { setIsImporting(false); }
  };

  const resetDeptImport = () => { setImportData([]); setImportResults(null); setImportStats(null); setImportFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const exportData = (type: 'csv' | 'excel' | 'pdf') => {
    const dataToExport = selectedClass === 'ALL' ? students : students.filter(s => s.classCode === selectedClass);
    const header = ['STT', 'MSSV', 'Họ và Tên', 'Lớp', 'Điểm SV', 'Điểm BCS', 'Điểm CVHT', 'Xếp loại'];
    const rows = dataToExport.map((s, i) => [i + 1, s.studentCode || '', s.name, s.className || '', s.studentTotal ?? '', s.classTotal ?? '', s.advisorTotal ?? '', s.classification ? CLASSIFICATION_LABELS[s.classification] || '' : '']);
    const fileName = selectedClass === 'ALL' ? 'thong_ke_khoa' : `thong_ke_lop_${selectedClass}`;
    if (type === 'csv') {
      const BOM = '\uFEFF'; const csv = BOM + [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${fileName}.csv`; a.click(); URL.revokeObjectURL(url);
    } else if (type === 'excel') {
      const tableHtml = `<html><head><meta charset="utf-8"></head><body><table border="1"><tr>${header.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
      const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${fileName}.xls`; a.click(); URL.revokeObjectURL(url);
    } else if (type === 'pdf') {
      const pw = window.open('', '_blank');
      if (pw) { pw.document.write(`<html><head><title>Thống kê ${departmentInfo?.name || 'Khoa'}</title><style>body{font-family:sans-serif}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #000;padding:8px;text-align:left}th{background:#f3f4f6}</style></head><body><h2>Thống kê - ${departmentInfo?.name || 'Khoa'}</h2><table><tr>${header.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table><script>window.print();window.close();<\/script></body></html>`); pw.document.close(); }
    }
    setShowExportMenu(false);
  };

  const filteredStudents = useMemo(() => {
    let result = selectedClass === 'ALL' ? students : students.filter(s => s.classCode === selectedClass);
    if (searchTerm.trim()) { const term = searchTerm.toLowerCase(); result = result.filter(s => s.name.toLowerCase().includes(term) || (s.studentCode && s.studentCode.toLowerCase().includes(term))); }
    return result;
  }, [students, selectedClass, searchTerm]);

  const filteredManageStudents = useMemo(() => {
    if (!manageSearch.trim()) return classStudents;
    const term = manageSearch.toLowerCase();
    return classStudents.filter(s => s.full_name.toLowerCase().includes(term) || (s.student_id && s.student_id.toLowerCase().includes(term)) || s.email.toLowerCase().includes(term));
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

  const classStatsColumns = [
    { header: 'STT', width: 60, align: 'center' as const, render: (_c: any, i: number) => <span style={{ color: 'var(--text-muted)' }}>{i + 1}</span> },
    { header: 'Lớp', render: (c: any) => (<><div style={{ fontWeight: 600 }}>{c.classCode}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.className}</div></>) },
    { header: 'Sĩ số', align: 'center' as const, render: (c: any) => <span style={{ fontWeight: 600 }}>{c.total}</span> },
    { header: 'Đã nộp', align: 'center' as const, render: (c: any) => <span style={{ color: c.submitted < c.total ? 'var(--danger)' : 'var(--success)' }}>{c.submitted} ({c.total > 0 ? Math.round(c.submitted / c.total * 100) : 0}%)</span> },
    { header: 'Đã duyệt', align: 'center' as const, render: (c: any) => <span style={{ color: c.finalized < c.total ? 'var(--warning-dark)' : 'var(--success)' }}>{c.finalized}</span> },
    { header: 'Điểm TB', align: 'center' as const, render: (c: any) => <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{c.avgScore}</span> },
    { header: 'XS/Giỏi', align: 'center' as const, render: (c: any) => <span>{(c.byClassification['EXCELLENT'] || 0) + (c.byClassification['VERY_GOOD'] || 0)}</span> },
    { header: 'Khá/TB', align: 'center' as const, render: (c: any) => <span>{(c.byClassification['GOOD'] || 0) + (c.byClassification['AVERAGE'] || 0)}</span> },
    { header: 'Yếu/Kém', align: 'center' as const, render: (c: any) => <span>{(c.byClassification['WEAK'] || 0) + (c.byClassification['POOR'] || 0)}</span> },
  ];

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

  const manageStudentsColumns = [
    { header: 'STT', width: 50, align: 'center' as const, render: (_s: any, i: number) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</span> },
    { header: 'MSSV', width: 110, render: (s: any) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.student_id || '-'}</span> },
    { header: 'Họ và Tên', render: (s: any) => <span style={{ fontWeight: 500 }}>{s.full_name}</span> },
    { header: 'Email', render: (s: any) => <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s.email}</span> },
    { header: 'Thao tác', width: 80, align: 'center' as const, render: (s: any) => (
      <button onClick={() => handleDeleteStudent(s)} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.background = '#fee2e2'; }} onMouseOut={e => { e.currentTarget.style.background = '#fef2f2'; }}>Xóa</button>
    ) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ══════ Header with semester selector ══════ */}
      <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{departmentInfo?.name || 'Khoa'}</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Tổng hợp kết quả đánh giá điểm rèn luyện sinh viên</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Semester selector */}
          <select value={selectedSemesterId} onChange={e => setSelectedSemesterId(e.target.value)} className="form-input" style={{ width: 220, fontWeight: 500, fontSize: 13 }}>
            {semesters.map(s => (
              <option key={s.id} value={s.id}>{s.name} {Number(s.is_active) === 1 ? '●' : ''}</option>
            ))}
          </select>
          {/* Class filter for export */}
          {stats && (
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="form-input" style={{ width: 200, fontWeight: 500, fontSize: 13 }}>
              <option value="ALL">Tất cả các lớp</option>
              {stats.byClass.map(c => (
                <option key={c.classCode} value={c.classCode}>{c.classCode} - {c.className}</option>
              ))}
            </select>
          )}
          {/* Export button */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="btn-primary" id="export-csv-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              Xuất báo cáo
            </button>
            {showExportMenu && (
              <div style={{ position: 'absolute', top: 40, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: 4, zIndex: 10, display: 'flex', flexDirection: 'column', minWidth: 150 }}>
                <button onClick={() => exportData('csv')} style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, borderRadius: 4, width: '100%', fontWeight: 500 }}>Xuất CSV</button>
                <button onClick={() => exportData('excel')} style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, borderRadius: 4, width: '100%', fontWeight: 500 }}>Xuất Excel</button>
                <button onClick={() => exportData('pdf')} style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, borderRadius: 4, width: '100%', fontWeight: 500 }}>In trang (PDF)</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════ VIEW: Dashboard (default) ══════ */}
      {activeView === 'dashboard' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{ background: 'linear-gradient(135deg, #6ee7b7 0%, #10b981 100%)', borderRadius: 12, padding: 20, color: '#064e3b', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Tổng Sinh viên</div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>{stats.total}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%)', borderRadius: 12, padding: 20, color: '#1e3a8a', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Điểm trung bình</div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>{stats.avgScore}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #d8b4fe 0%, #a855f7 100%)', borderRadius: 12, padding: 20, color: '#4c1d95', boxShadow: '0 4px 6px -1px rgba(168, 85, 247, 0.2)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Xuất sắc / Giỏi</div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>{(stats.byClassification['EXCELLENT'] || 0) + (stats.byClassification['VERY_GOOD'] || 0)}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)', borderRadius: 12, padding: 20, color: '#78350f', boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.2)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Đã nộp / Đã duyệt</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{stats.submitted} / {stats.finalized}</div>
            </div>
          </div>

          {/* Donut + Class table side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Phân loại rèn luyện</h3>
              <DonutChart data={stats.byClassification} total={stats.total} />
            </div>
            <div>
              <DataTable
                title="Thống kê theo lớp"
                columns={classStatsColumns}
                data={stats.byClass}
                footer={classStatsFooter}
                onRowClick={(c: any) => {
                  setSelectedClass(c.classCode);
                  router.push(`/department?view=students&class=${c.classCode}`);
                }}
                rowTitle={(c: any) => `Nhấn để xem chi tiết lớp ${c.classCode}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* ══════ VIEW: Charts ══════ */}
      {activeView === 'charts' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Bar chart */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 8 }}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
              So sánh phân loại qua 3 học kỳ
            </h3>
            <BarChart comparison={comparison} />
          </div>

          {/* Donut chart */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Phân loại HK hiện tại</h3>
              <DonutChart data={stats.byClassification} total={stats.total} />
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 6 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                Thống kê nộp phiếu theo tháng
              </h3>
              <MonthlyChart data={stats.byMonth || []} />
            </div>
          </div>
        </div>
      )}

      {/* ══════ VIEW: Manage ══════ */}
      {activeView === 'manage' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* ── Section 1: Quản lý Lớp ── */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <div>
                <h3 className="dashboard-card-title">Quản lý Lớp học</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>{deptClasses.length} lớp đang hoạt động</p>
              </div>
              <button onClick={() => setShowAddClassModal(true)} className="btn-primary" style={{ fontSize: 12 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Thêm lớp
              </button>
            </div>
            {deptClasses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>Chưa có lớp nào. Nhấn "Thêm lớp" để tạo mới.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="dashboard-table">
                  <thead><tr>
                    <th style={{ width: 50, textAlign: 'center' }}>STT</th>
                    <th style={{ width: 120 }}>Mã lớp</th>
                    <th>Tên lớp</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Năm học</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Sĩ số</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Thao tác</th>
                  </tr></thead>
                  <tbody>
                    {deptClasses.map((cls, i) => (
                      <tr key={cls.id}>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>{cls.code}</td>
                        <td style={{ fontWeight: 500 }}>{cls.name}</td>
                        <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>{cls.academicYear || '-'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{cls.studentCount}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeleteClass(cls)}
                            className="btn-danger"
                            style={{ padding: '4px 10px', fontSize: 11 }}
                            disabled={cls.studentCount > 0}
                            title={cls.studentCount > 0 ? 'Phải xóa hết SV trước' : 'Xóa lớp'}
                          >Xóa</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Section 2: Quản lý Sinh viên trong lớp ── */}
          <div className="dashboard-card" style={{ padding: 0 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 16, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)' }}>Sinh viên lớp:</span>
              <select value={manageClassId} onChange={(e) => setManageClassId(e.target.value)} className="form-input" style={{ width: 240 }}>
                <option value="">-- Chọn lớp --</option>
                {deptClasses.map(c => (<option key={c.id} value={c.id}>{c.code} - {c.name} ({c.studentCount} SV)</option>))}
              </select>
              {manageClassId && (
                <>
                  <div style={{ position: 'relative', flex: 1, maxWidth: 280, minWidth: 180 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input type="text" placeholder="Tìm tên, MSSV..." value={manageSearch} onChange={(e) => setManageSearch(e.target.value)} style={{ width: '100%', fontSize: 13, padding: '8px 10px 8px 32px', border: '1px solid var(--border)', borderRadius: 8, outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <button onClick={() => { setShowImportModal(true); resetDeptImport(); }} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #e0e7ff', background: '#eef2ff', color: '#4f46e5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.background = '#e0e7ff'; }} onMouseOut={e => { e.currentTarget.style.background = '#eef2ff'; }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Import Excel
                    </button>
                    <button onClick={() => setShowAddStudentModal(true)} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s' }} onMouseOver={e => { e.currentTarget.style.background = '#059669'; }} onMouseOut={e => { e.currentTarget.style.background = '#10b981'; }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      Thêm sinh viên
                    </button>
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: 16 }}>
              {!manageClassId ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  <div>Vui lòng chọn lớp để quản lý sinh viên</div>
                </div>
              ) : loadingStudents ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải danh sách...</div>
              ) : (
                <DataTable title="" subtitle={`${filteredManageStudents.length} sinh viên`} columns={manageStudentsColumns} data={filteredManageStudents} emptyMessage="Chưa có sinh viên nào trong lớp" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════ VIEW: Students ══════ */}
      {activeView === 'students' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* ── Section 3: Bảng điểm sinh viên ── */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#f9fafb', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)' }}>Lọc theo lớp:</span>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="form-input" style={{ width: 200 }}>
              <option value="ALL">-- Tất cả các lớp --</option>
              {stats.byClass.map(c => (<option key={c.classCode} value={c.classCode}>{c.classCode} - {c.className}</option>))}
            </select>
            <div style={{ position: 'relative', marginLeft: 12, flex: 1, maxWidth: 300 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Tìm tên hoặc MSSV..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', fontSize: 13, padding: '8px 10px 8px 32px', border: '1px solid var(--border)', borderRadius: 8, outline: 'none' }} />
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }}>Hiển thị {filteredStudents.length} kết quả</span>
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
                    <th style={{ width: 90, textAlign: 'center' }}>Phiếu</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr><td colSpan={selectedClass === 'ALL' ? 10 : 9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Chưa có dữ liệu</td></tr>
                  ) : filteredStudents.map((student, index) => {
                    const clsLabel = student.classification ? CLASSIFICATION_LABELS[student.classification] || '' : '';
                    const clsColor = CLS_COLORS[student.classification || ''] || { bg: '#f3f4f6', color: '#6b7280', chart: '#ccc' };
                    let statusLabel = '', statusColor = '';
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
                          {clsLabel ? (<span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: clsColor.bg, color: clsColor.color }}>{clsLabel}</span>) : (<span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => setSelectedStudentForEdit(student)}
                            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                            onMouseOver={e => { e.currentTarget.style.background = '#dbeafe'; }}
                            onMouseOut={e => { e.currentTarget.style.background = '#eff6ff'; }}
                          >
                            Xem phiếu
                          </button>
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

      {/* ══════ MODAL: Xem / Chỉnh sửa phiếu điểm (role DEPARTMENT) ══════ */}
      {selectedStudentForEdit && (
        <div className="modal-overlay" onClick={() => setSelectedStudentForEdit(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '1200px', width: '96vw', height: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-header-title">
                📋 Phiếu điểm rèn luyện:{' '}
                <span style={{ color: 'var(--accent)' }}>{selectedStudentForEdit.name}</span>
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>({selectedStudentForEdit.studentCode})</span>
              </h3>
              <button
                onClick={() => setSelectedStudentForEdit(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'var(--bg-page)' }}>
              <ScoringForm
                forcedRole="ADVISOR"
                studentId={selectedStudentForEdit.id}
                studentName={selectedStudentForEdit.name}
                viewMode="history"
                stickyTop="top-0"
                semesterId={selectedSemesterId}
                allowResetAnytime={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* (manage view removed — merged into students view above) */}

      {/* ══════ MODALS ══════ */}

      {/* Add Class Modal */}
      {showAddClassModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header"><h3 className="modal-header-title">Thêm lớp mới</h3><button onClick={() => setShowAddClassModal(false)} className="modal-close-btn">✕</button></div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}><label className="form-label">Mã lớp *</label><input type="text" className="form-input" value={newClassCode} onChange={e => setNewClassCode(e.target.value)} placeholder="VD: 23CNTT01" /></div>
              <div style={{ marginBottom: 16 }}><label className="form-label">Tên lớp *</label><input type="text" className="form-input" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="VD: Công nghệ thông tin K23 - Nhóm 1" /></div>
              <div style={{ marginBottom: 16 }}><label className="form-label">Năm học</label><input type="text" className="form-input" value={newClassYear} onChange={e => setNewClassYear(e.target.value)} placeholder="VD: 2025" /></div>
            </div>
            <div className="modal-footer"><button onClick={() => setShowAddClassModal(false)} className="btn-secondary">Hủy</button><button onClick={handleAddClass} className="btn-primary">Thêm lớp</button></div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header"><h3 className="modal-header-title">Thêm sinh viên vào lớp</h3><button onClick={() => setShowAddStudentModal(false)} className="modal-close-btn">✕</button></div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}><label className="form-label">Họ tên *</label><input type="text" className="form-input" value={newSvName} onChange={e => setNewSvName(e.target.value)} placeholder="Nhập họ tên" /></div>
              <div style={{ marginBottom: 16 }}><label className="form-label">MSSV</label><input type="text" className="form-input" value={newSvMssv} onChange={e => setNewSvMssv(e.target.value)} placeholder="Nhập MSSV" /></div>
              <div style={{ marginBottom: 16 }}><label className="form-label">Email *</label><input type="email" className="form-input" value={newSvEmail} onChange={e => setNewSvEmail(e.target.value)} placeholder="Nhập email" /></div>
              <div style={{ marginBottom: 16 }}><label className="form-label">Mật khẩu *</label><input type="password" className="form-input" value={newSvPassword} onChange={e => setNewSvPassword(e.target.value)} placeholder="Nhập mật khẩu" /></div>
            </div>
            <div className="modal-footer"><button onClick={() => setShowAddStudentModal(false)} className="btn-secondary">Hủy</button><button onClick={handleAddStudent} className="btn-primary">Thêm sinh viên</button></div>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 750, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header"><h3 className="modal-header-title">📥 Import sinh viên từ Excel</h3><button onClick={() => setShowImportModal(false)} className="modal-close-btn">✕</button></div>
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
              {!importResults && (
                <>
                  {manageClassId && <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#15803d', fontWeight: 500 }}>✅ Lớp đã chọn: <strong>{deptClasses.find(c => c.id === manageClassId)?.code}</strong></div>}
                  {!manageClassId && <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#92400e', fontWeight: 500 }}>⚠ Chưa chọn lớp — File cần cột &quot;Lớp&quot;</div>}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button onClick={downloadDeptTemplate} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Tải file mẫu
                    </button>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: '2px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', background: importFileName ? '#f0fdf4' : '#fafafa', borderColor: importFileName ? '#86efac' : '#d1d5db', transition: 'all 0.2s' }}>
                        <span style={{ fontSize: 13, color: importFileName ? '#16a34a' : '#6b7280', fontWeight: 500 }}>{importFileName || 'Chọn file .xlsx hoặc .xls'}</span>
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportFileSelect} style={{ display: 'none' }} />
                      </label>
                    </div>
                  </div>
                  {importData.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: 0 }}>Xem trước: {importData.length} dòng</p>
                        <button onClick={resetDeptImport} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Chọn file khác</button>
                      </div>
                      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 300 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead><tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Dòng</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>MSSV</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Họ tên</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Email</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Lớp</th>
                          </tr></thead>
                          <tbody>{importData.map((row, i) => {
                            const hasError = !row.full_name || !row.email || !row.password;
                            return (<tr key={i} style={{ background: hasError ? '#fef2f2' : 'transparent' }}>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', color: '#9ca3af' }}>{row.rowIndex}</td>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace' }}>{row.student_id || '-'}</td>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', fontWeight: 500, color: !row.full_name ? '#dc2626' : '#1f2937' }}>{row.full_name || '⚠ Thiếu'}</td>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', color: !row.email ? '#dc2626' : '#6b7280' }}>{row.email || '⚠ Thiếu'}</td>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{row.class_code || (manageClassId ? '← Lớp đã chọn' : '⚠ Chưa có')}</td>
                            </tr>);
                          })}</tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
              {importResults && importStats && (
                <div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, textAlign: 'center' }}><div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>{importStats.successCount}</div><div style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>Thành công</div></div>
                    <div style={{ flex: 1, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, textAlign: 'center' }}><div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626' }}>{importStats.errorCount}</div><div style={{ fontSize: 12, fontWeight: 600, color: '#b91c1c' }}>Lỗi</div></div>
                    <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, textAlign: 'center' }}><div style={{ fontSize: 28, fontWeight: 800, color: '#475569' }}>{importStats.total}</div><div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Tổng</div></div>
                  </div>
                  {importStats.errorCount > 0 && (
                    <div style={{ overflowX: 'auto', border: '1px solid #fecaca', borderRadius: 8, maxHeight: 250 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead><tr style={{ background: '#fef2f2', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #fecaca' }}>Dòng</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #fecaca' }}>Họ tên</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #fecaca' }}>Lý do</th>
                        </tr></thead>
                        <tbody>{importResults.filter(r => !r.success).map((r, i) => (
                          <tr key={i}><td style={{ padding: '6px 10px', borderBottom: '1px solid #fee2e2', color: '#9ca3af' }}>{r.rowIndex}</td><td style={{ padding: '6px 10px', borderBottom: '1px solid #fee2e2', fontWeight: 500 }}>{r.full_name || '-'}</td><td style={{ padding: '6px 10px', borderBottom: '1px solid #fee2e2', color: '#dc2626' }}>{r.message}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              {!importResults ? (
                <><button onClick={() => setShowImportModal(false)} className="btn-secondary">Hủy</button><button onClick={handleDeptImport} className="btn-primary" disabled={importData.length === 0 || isImporting} style={{ opacity: importData.length === 0 || isImporting ? 0.5 : 1 }}>{isImporting ? 'Đang nhập...' : `Nhập ${importData.length} sinh viên`}</button></>
              ) : (<button onClick={() => setShowImportModal(false)} className="btn-primary">Đóng</button>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
