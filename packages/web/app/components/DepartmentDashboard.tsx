'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DataTable } from './DataTable';
import { ScoringForm } from './ScoringForm';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { StatusBadge } from './ui/StatusBadge';

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
  VERY_GOOD: { bg: '#fef2f2', color: '#991b1b', chart: '#b91c1c' },
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
    <div className="flex flex-col items-center gap-4">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx={cx} cy={cy} r={radius} fill="none" className="stroke-muted" strokeWidth={strokeWidth} />
        {arcs.length === 1 ? (
          /* Single segment = full circle (SVG arc can't draw 360°) */
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke={arcs[0].color} strokeWidth={strokeWidth} style={{ transition: 'all 0.5s ease' }}>
            <title>{arcs[0].label}: {arcs[0].value} ({(arcs[0].pct * 100).toFixed(1)}%)</title>
          </circle>
        ) : (
          arcs.map((arc, i) => (
            <path key={i} d={arc.path} fill="none" stroke={arc.color} strokeWidth={strokeWidth} strokeLinecap="round" style={{ transition: 'all 0.5s ease' }}>
              <title>{arc.label}: {arc.value} ({(arc.pct * 100).toFixed(1)}%)</title>
            </path>
          ))
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="28" fontWeight="800" className="fill-foreground">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" className="fill-muted-foreground" fontWeight="500">Sinh viên</text>
      </svg>
      <div className="flex flex-wrap gap-2 justify-center">
        {segments.filter(s => s.value > 0).map(s => (
          <div key={s.key} className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
            <span>{s.label}: <strong className="text-foreground">{s.value}</strong></span>
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
  const semColors = ['#6366f1', '#991b1b', '#f59e0b'];

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
            <stop offset="0%" stopColor="#991b1b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#991b1b" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid */}
        {[0, 0.5, 1].map((pct, i) => {
          const y = chartH - pad - pct * (chartH - pad * 2);
          return <line key={i} x1={pad} y1={y} x2={chartW - pad} y2={y} stroke="#e2e8f0" strokeDasharray="4,4" />;
        })}
        <path d={areaPath} fill="url(#areaGrad)" />
        <path d={linePath} fill="none" stroke="#991b1b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#991b1b" strokeWidth="2" />
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
  const [newSvRole, setNewSvRole] = useState('STUDENT');
  const [editingStudent, setEditingStudent] = useState<ClassStudent & { role: string, studentCode?: string | null } | null>(null);
  const [editSvRole, setEditSvRole] = useState('STUDENT');
  const [manageSearch, setManageSearch] = useState('');

  // Add class modal state
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  const [newClassYear, setNewClassYear] = useState(new Date().getFullYear().toString());
  const [editClassData, setEditClassData] = useState<{id: string, code: string, name: string, academic_year: string} | null>(null);

  // Import Excel state (Khoa)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<{ rowIndex: number; student_id?: string; full_name: string; email: string; password: string; class_code?: string; role?: string }[]>([]);
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

  // Fetch department classes
  useEffect(() => {
    if (!session?.user || !selectedSemesterId) return;
    fetch(`/api/department/classes?semesterId=${selectedSemesterId}`).then(r => r.ok ? r.json() : Promise.reject()).then(j => setDeptClasses(j.data || [])).catch(() => {});
  }, [session, selectedSemesterId]);

  // Fetch students for selected class in classes view
  useEffect(() => {
    if (activeView === 'classes' && manageClassId && selectedSemesterId) {
      setLoadingStudents(true);
      fetch(`/api/department/users?classId=${manageClassId}&semesterId=${selectedSemesterId}`).then(r => r.ok ? r.json() : Promise.reject()).then(j => setClassStudents(j.data || [])).catch(() => setClassStudents([])).finally(() => setLoadingStudents(false));
    } else { setClassStudents([]); }
  }, [activeView, manageClassId, selectedSemesterId]);

  // Sync selectedClass from URL class param
  useEffect(() => {
    if (classParam) setSelectedClass(classParam);
  }, [classParam]);

  // --- Handlers ---
  const refreshClasses = async () => {
    try {
      const r = await fetch(`/api/department/classes?semesterId=${selectedSemesterId}`);
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

  const handleEditClass = async () => {
    if (!editClassData?.code?.trim() || !editClassData?.name?.trim()) return alert('Vui lòng nhập mã lớp và tên lớp');
    try {
      const r = await fetch('/api/department/classes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editClassData.id, code: editClassData.code.trim(), name: editClassData.name.trim(), academic_year: editClassData.academic_year?.trim() }),
      });
      const d = await r.json();
      if (r.ok) {
        alert('Cập nhật lớp thành công');
        setEditClassData(null);
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
      const r = await fetch('/api/department/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: newSvName, email: newSvEmail, password: newSvPassword, student_id: newSvMssv || undefined, class_id: manageClassId, role: newSvRole }) });
      const d = await r.json();
      if (r.ok) { alert('Thêm sinh viên thành công'); setShowAddStudentModal(false); setNewSvName(''); setNewSvEmail(''); setNewSvPassword(''); setNewSvMssv(''); setNewSvRole('STUDENT'); const r2 = await fetch(`/api/department/users?classId=${manageClassId}&semesterId=${selectedSemesterId}`); if (r2.ok) { const j = await r2.json(); setClassStudents(j.data || []); } } else { alert(d.message); }
    } catch { alert('Lỗi kết nối'); }
  };

  const handleEditStudentSave = async () => {
    if (!editingStudent || !editingStudent.full_name || !editingStudent.email) return alert('Vui lòng nhập đầy đủ');
    try {
      const r = await fetch('/api/department/users', { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          id: editingStudent.id, 
          full_name: editingStudent.full_name, 
          email: editingStudent.email, 
          student_id: editingStudent.studentCode || undefined, 
          class_id: manageClassId, 
          role: editSvRole 
        }) 
      });
      const d = await r.json();
      if (r.ok) { 
        alert('Cập nhật sinh viên thành công'); 
        setEditingStudent(null); 
        const r2 = await fetch(`/api/department/users?classId=${manageClassId}&semesterId=${selectedSemesterId}`); 
        if (r2.ok) { const j = await r2.json(); setClassStudents(j.data || []); } 
      } else { alert(d.message); }
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
        ['MSSV', 'Họ và tên', 'Email Trường', 'Mật Khẩu', 'Lớp', 'Vai trò'],
        // Row 10+: Sample data
        [`${sampleCode}001`, 'Nguyễn Văn A', `${sampleCode.toLowerCase()}001@student.edu.vn`, `Sv@${sampleCode}001`, sampleCode, 'STUDENT'],
        [`${sampleCode}002`, 'Trần Thị B', `${sampleCode.toLowerCase()}002@student.edu.vn`, `Sv@${sampleCode}002`, sampleCode, 'CLASS_COMMITTEE'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // Column widths
      ws['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 32 }, { wch: 18 }, { wch: 10 }, { wch: 16 }];

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
      'Vai trò': 'role', 'Vai tro': 'role', 'Role': 'role',
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

    const roleMap: Record<string, string> = {
      'sinh viên': 'STUDENT', 'sv': 'STUDENT', 'student': 'STUDENT',
      'ban cán sự': 'CLASS_COMMITTEE', 'bcs': 'CLASS_COMMITTEE', 'class_committee': 'CLASS_COMMITTEE',
    };

    const parsed = jsonData.map((row, i) => {
      const mapped: any = { rowIndex: headerRowIndex + i + 2 }; // +2: header=1 row, 0-indexed
      for (const [key, value] of Object.entries(row)) {
        const normalKey = columnMap[key.trim()];
        if (normalKey) mapped[normalKey] = String(value).trim();
      }
      if (mapped.role) {
        const roleLower = mapped.role.toLowerCase();
        mapped.role = roleMap[roleLower] || mapped.role.toUpperCase();
      } else {
        mapped.role = 'STUDENT';
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
      if (r.ok) { setImportResults(d.results || []); setImportStats({ successCount: d.successCount, errorCount: d.errorCount, total: d.total }); if (manageClassId) { const r2 = await fetch(`/api/department/users?classId=${manageClassId}&semesterId=${selectedSemesterId}`); if (r2.ok) { const j = await r2.json(); setClassStudents(j.data || []); } } } else { alert(d.message); }
    } catch { alert('Lỗi kết nối khi import'); } finally { setIsImporting(false); }
  };

  const resetDeptImport = () => { setImportData([]); setImportResults(null); setImportStats(null); setImportFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const exportData = (reportType: 'summary' | 'detailed' | 'unsubmitted') => {
    let dataToExport = students;
    let fileName = 'Bao_Cao';
    let header: string[] = [];
    let rows: any[][] = [];

    if (reportType === 'summary') {
      if (!stats) return alert('Không có dữ liệu thống kê');
      header = ['Lớp', 'Sĩ số', 'Đã nộp', 'Đã duyệt', 'Điểm TB', 'Xuất sắc', 'Giỏi', 'Khá', 'TB', 'Yếu', 'Kém'];
      rows = stats.byClass.map(c => [
        c.classCode, c.total, c.submitted, c.finalized, c.avgScore,
        c.byClassification['EXCELLENT'] || 0,
        c.byClassification['VERY_GOOD'] || 0,
        c.byClassification['GOOD'] || 0,
        c.byClassification['AVERAGE'] || 0,
        c.byClassification['WEAK'] || 0,
        c.byClassification['POOR'] || 0
      ]);
      fileName = 'Bao_Cao_Tong_Hop_Khoa';
    } else if (reportType === 'detailed') {
      dataToExport = selectedClass === 'ALL' ? students : students.filter(s => s.classCode === selectedClass);
      if (dataToExport.length === 0) return alert('Không có dữ liệu để xuất');
      header = ['STT', 'MSSV', 'Họ và Tên', 'Lớp', 'Điểm SV', 'Điểm BCS', 'Điểm CVHT', 'Điểm Cuối', 'Xếp loại'];
      rows = dataToExport.map((s, i) => [
        i + 1, s.studentCode || '', s.name, s.className || '', 
        s.studentTotal ?? '', s.classTotal ?? '', s.advisorTotal ?? '', s.finalTotal ?? '',
        s.classification ? CLASSIFICATION_LABELS[s.classification] || '' : ''
      ]);
      fileName = selectedClass === 'ALL' ? 'Chi_Tiet_Khoa' : `Chi_Tiet_Lop_${selectedClass}`;
    } else if (reportType === 'unsubmitted') {
      dataToExport = selectedClass === 'ALL' ? students : students.filter(s => s.classCode === selectedClass);
      const unsubmitted = dataToExport.filter(s => s.status === 'UPCOMING');
      if (unsubmitted.length === 0) return alert('Không có sinh viên nào chưa nộp');
      header = ['STT', 'MSSV', 'Họ và Tên', 'Lớp', 'Trạng thái'];
      rows = unsubmitted.map((s, i) => [
        i + 1, s.studentCode || '', s.name, s.className || '', 'Chưa nộp'
      ]);
      fileName = selectedClass === 'ALL' ? 'DS_Chua_Nop_Khoa' : `DS_Chua_Nop_${selectedClass}`;
    }

    import('xlsx').then((XLSX) => {
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ThongKe');
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    });
  };

  const filteredStudents = useMemo(() => {
    let result = selectedClass === 'ALL' ? students : students.filter(s => s.classCode === selectedClass);
    if (searchTerm.trim()) { const term = searchTerm.toLowerCase(); result = result.filter(s => s.name.toLowerCase().includes(term) || (s.studentCode && s.studentCode.toLowerCase().includes(term))); }
    return result;
  }, [students, selectedClass, searchTerm]);

  const filteredManageStudents = useMemo(() => {
    let result = classStudents;
    if (manageSearch.trim()) {
      const term = manageSearch.toLowerCase();
      result = result.filter(s => s.full_name.toLowerCase().includes(term) || (s.student_id && s.student_id.toLowerCase().includes(term)) || s.email.toLowerCase().includes(term));
    }
    return result.map(cs => {
      const scoreData = students.find(s => s.id === cs.id);
      return {
        ...cs,
        status: scoreData?.status || 'NO_SHEET',
        studentTotal: scoreData?.studentTotal ?? null,
        classTotal: scoreData?.classTotal ?? null,
        advisorTotal: scoreData?.advisorTotal ?? null,
        classification: scoreData?.classification || null,
        name: scoreData?.name || cs.full_name,
        studentCode: scoreData?.studentCode || cs.student_id,
      };
    });
  }, [classStudents, manageSearch, students]);

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
    { header: 'STT', width: 60, align: 'center' as const, render: (_c: any, i: number) => <span style={{ color: 'var(--muted-foreground)' }}>{i + 1}</span> },
    { header: 'Lớp', render: (c: any) => (<><div style={{ fontWeight: 600 }}>{c.classCode}</div><div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{c.className}</div></>) },
    { header: 'Sĩ số', align: 'center' as const, render: (c: any) => <span style={{ fontWeight: 600 }}>{c.total}</span> },
    { header: 'Đã nộp', align: 'center' as const, render: (c: any) => <span style={{ color: c.submitted < c.total ? 'var(--danger)' : 'var(--success)' }}>{c.submitted} ({c.total > 0 ? Math.round(c.submitted / c.total * 100) : 0}%)</span> },
    { header: 'Đã duyệt', align: 'center' as const, render: (c: any) => <span style={{ color: c.finalized < c.total ? 'var(--warning-foreground)' : 'var(--success)' }}>{c.finalized}</span> },
    { header: 'Điểm TB', align: 'center' as const, render: (c: any) => <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{c.avgScore}</span> },
    { header: 'XS/Giỏi', align: 'center' as const, render: (c: any) => <span>{(c.byClassification['EXCELLENT'] || 0) + (c.byClassification['VERY_GOOD'] || 0)}</span> },
    { header: 'Khá/TB', align: 'center' as const, render: (c: any) => <span>{(c.byClassification['GOOD'] || 0) + (c.byClassification['AVERAGE'] || 0)}</span> },
    { header: 'Yếu/Kém', align: 'center' as const, render: (c: any) => <span>{(c.byClassification['WEAK'] || 0) + (c.byClassification['POOR'] || 0)}</span> },
  ];

  const classStatsFooter = stats ? (
    <tr style={{ background: 'var(--surface-muted)', fontWeight: 700 }}>
      <td colSpan={2} style={{ textAlign: 'center', padding: '12px' }}>TỔNG CỘNG</td>
      <td style={{ textAlign: 'center', color: 'var(--foreground)' }}>{stats.total}</td>
      <td style={{ textAlign: 'center', color: 'var(--success)' }}>{stats.submitted}</td>
      <td style={{ textAlign: 'center', color: 'var(--success)' }}>{stats.finalized}</td>
      <td style={{ textAlign: 'center', color: 'var(--accent)' }}>{stats.avgScore}</td>
      <td style={{ textAlign: 'center' }}>{(stats.byClassification['EXCELLENT'] || 0) + (stats.byClassification['VERY_GOOD'] || 0)}</td>
      <td style={{ textAlign: 'center' }}>{(stats.byClassification['GOOD'] || 0) + (stats.byClassification['AVERAGE'] || 0)}</td>
      <td style={{ textAlign: 'center' }}>{(stats.byClassification['WEAK'] || 0) + (stats.byClassification['POOR'] || 0)}</td>
    </tr>
  ) : null;

  const manageStudentsColumns = [
    { header: 'STT', width: 40, align: 'center' as const, render: (_s: any, i: number) => <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>{i + 1}</span> },
    { header: 'MSSV', width: 90, render: (s: any) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.student_id || '-'}</span> },
    { header: 'Họ và Tên', render: (s: any) => <span style={{ fontWeight: 500 }}>{s.full_name}</span> },
    { header: 'Trạng thái', width: 90, align: 'center' as const, render: (s: any) => {
      return <StatusBadge status={s.status} />;
    }},
    { header: 'Vai trò', width: 90, align: 'center' as const, render: (s: any) => {
      const roleLabel = s.role === 'CLASS_COMMITTEE' ? 'Ban cán sự' : s.role === 'ADVISOR' ? 'Cố vấn' : 'Sinh viên';
      const rc = s.role === 'CLASS_COMMITTEE' ? { bg: '#fef3c7', color: '#d97706' } : s.role === 'ADVISOR' ? { bg: '#ecfdf5', color: '#059669' } : { bg: '#eff6ff', color: '#2563eb' };
      return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: rc.bg, color: rc.color }}>{roleLabel}</span>;
    }},
    { header: 'Điểm CVHT', width: 80, align: 'center' as const, render: (s: any) => <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{s.advisorTotal ?? '-'}</span> },
    { header: 'Xếp loại', width: 90, align: 'center' as const, render: (s: any) => {
      const clsLabel = s.classification ? CLASSIFICATION_LABELS[s.classification] || '' : '';
      const clsColor = CLS_COLORS[s.classification || ''] || { bg: '#f3f4f6', color: '#6b7280' };
      return clsLabel ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: clsColor.bg, color: clsColor.color }}>{clsLabel}</span> : <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>-</span>;
    }},
    { header: 'Thao tác', width: 140, align: 'center' as const, render: (s: any) => (
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
        <button onClick={() => { setEditingStudent(s); setEditSvRole(s.role); }} className="px-2 py-1 text-[11px] font-semibold rounded-md border border-border bg-surface hover:bg-surface-muted text-foreground transition-colors">Sửa</button>
        <button onClick={() => setSelectedStudentForEdit(s)} className="px-2 py-1 text-[11px] font-semibold rounded-md border border-info-border bg-info-bg hover:bg-info/10 text-info-foreground transition-colors">Phiếu</button>
        <button onClick={() => handleDeleteStudent(s)} className="px-2 py-1 text-[11px] font-semibold rounded-md border border-danger-border bg-danger-bg hover:bg-danger/10 text-danger-foreground transition-colors">Xóa</button>
      </div>
    ) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ══════ Header with semester selector ══════ */}
      <Card>
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">{departmentInfo?.name || 'Khoa'}</h2>
            <p className="text-sm text-muted-foreground mt-1">Tổng hợp kết quả đánh giá điểm rèn luyện sinh viên</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            {/* Semester selector */}
            <select value={selectedSemesterId} onChange={e => setSelectedSemesterId(e.target.value)} className="min-w-[12rem] bg-surface border border-border text-foreground text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors">
              {semesters.map(s => (
                <option key={s.id} value={s.id}>{s.name} {Number(s.is_active) === 1 ? '(Active)' : ''}</option>
              ))}
            </select>
            {/* Class filter for export */}
            {stats && (
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="min-w-[12rem] max-w-xs bg-surface border border-border text-foreground text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors">
                <option value="ALL">Tất cả các lớp</option>
                {stats.byClass.map(c => (
                  <option key={c.classCode} value={c.classCode}>{c.classCode} - {c.className}</option>
                ))}
              </select>
            )}
            {/* Export button */}
            <div className="relative">
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm" id="export-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Xuất báo cáo
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)}></div>
                  <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <button onClick={() => { exportData('summary'); setShowExportMenu(false); }} className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-surface-muted transition-colors flex items-center gap-2">
                      <span className="text-success-foreground bg-success/10 font-mono text-[10px] px-1 py-0.5 rounded">XLSX</span> Báo cáo tổng hợp
                    </button>
                    <button onClick={() => { exportData('detailed'); setShowExportMenu(false); }} className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-surface-muted transition-colors flex items-center gap-2 border-t border-border/50">
                      <span className="text-info-foreground bg-info/10 font-mono text-[10px] px-1 py-0.5 rounded">XLSX</span> Danh sách chi tiết
                    </button>
                    <button onClick={() => { exportData('unsubmitted'); setShowExportMenu(false); }} className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-surface-muted transition-colors flex items-center gap-2 border-t border-border/50">
                      <span className="text-danger-foreground bg-danger/10 font-mono text-[10px] px-1 py-0.5 rounded">XLSX</span> DS Sinh viên chưa nộp
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ══════ VIEW: Dashboard (default) ══════ */}
      {activeView === 'dashboard' && stats && (
        <div className="flex flex-col gap-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-gradient-to-br from-emerald-100 to-emerald-500 rounded-xl p-5 sm:p-6 text-emerald-950 shadow-sm">
              <div className="text-sm font-semibold mb-2 opacity-90">Tổng Sinh viên</div>
              <div className="text-3xl sm:text-4xl font-black">{stats.total}</div>
            </div>
            <div className="bg-gradient-to-br from-primary-light to-primary rounded-xl p-5 sm:p-6 text-primary-foreground shadow-sm">
              <div className="text-sm font-semibold mb-2 opacity-90">Điểm trung bình</div>
              <div className="text-3xl sm:text-4xl font-black">{stats.avgScore}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-100 to-purple-500 rounded-xl p-5 sm:p-6 text-purple-950 shadow-sm">
              <div className="text-sm font-semibold mb-2 opacity-90">Xuất sắc / Giỏi</div>
              <div className="text-3xl sm:text-4xl font-black">{(stats.byClassification['EXCELLENT'] || 0) + (stats.byClassification['VERY_GOOD'] || 0)}</div>
            </div>
            <div className="bg-gradient-to-br from-amber-100 to-amber-500 rounded-xl p-5 sm:p-6 text-amber-950 shadow-sm">
              <div className="text-sm font-semibold mb-2 opacity-90">Đã nộp / Đã duyệt</div>
              <div className="text-2xl sm:text-3xl font-black">{stats.submitted} / {stats.finalized}</div>
            </div>
          </div>

          {/* Donut + Class table side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 sm:gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Phân loại rèn luyện</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center pb-6">
                <DonutChart data={stats.byClassification} total={stats.total} />
              </CardContent>
            </Card>
            <div className="min-w-0">
              <DataTable
                title="Thống kê theo lớp"
                columns={classStatsColumns}
                data={stats.byClass}
                footer={classStatsFooter}
                onRowClick={(c: any) => {
                  const cls = deptClasses.find(x => x.code === c.classCode);
                  if (cls) {
                    setManageClassId(cls.id);
                    router.push(`/department?view=classes`);
                  }
                }}
                rowTitle={(c: any) => `Nhấn để xem chi tiết lớp ${c.classCode}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* ══════ VIEW: Charts ══════ */}
      {activeView === 'charts' && stats && (
        <div className="flex flex-col gap-6">
          {/* Bar chart */}
          <Card>
            <CardHeader>
              <CardTitle>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-2 align-middle"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                So sánh phân loại qua 3 học kỳ
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              <BarChart comparison={comparison} />
            </CardContent>
          </Card>

          {/* Donut chart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Phân loại HK hiện tại</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center pb-6">
                <DonutChart data={stats.byClassification} total={stats.total} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-2 align-middle"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  Thống kê nộp phiếu theo tháng
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <MonthlyChart data={stats.byMonth || []} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ══════ VIEW: Classes (drill-down: class list → student list) ══════ */}
      {activeView === 'classes' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Breadcrumb when viewing a class's students ── */}
          {manageClassId && (() => {
            const currentClass = deptClasses.find(c => c.id === manageClassId);
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted-foreground)' }}>
                <button
                  onClick={() => { setManageClassId(''); setManageSearch(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: 13, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  Danh sách lớp
                </button>
                <span style={{ color: 'var(--muted-foreground)' }}>›</span>
                <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{currentClass ? `${currentClass.code} - ${currentClass.name}` : ''}</span>
              </div>
            );
          })()}

          {/* ── Class list (when no class selected) ── */}
          {!manageClassId && (
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">Danh sách Lớp học</h3>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>{deptClasses.length} lớp đang hoạt động · Click vào lớp để quản lý sinh viên</p>
                </div>
                <button onClick={() => setShowAddClassModal(true)} className="btn-primary" style={{ fontSize: 12 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Thêm lớp
                </button>
              </div>
              {deptClasses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted-foreground)', fontSize: 13 }}>Chưa có lớp nào. Nhấn "Thêm lớp" để tạo mới.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-surface-muted border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-bold">
                      <tr>
                        <th className="px-6 py-4 text-center w-16">STT</th>
                        <th className="px-6 py-4 w-32">Mã lớp</th>
                        <th className="px-6 py-4">Tên lớp</th>
                        <th className="px-6 py-4 text-center w-24">Năm học</th>
                        <th className="px-6 py-4 text-center w-20">Sĩ số</th>
                        <th className="px-6 py-4 text-center w-28">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {deptClasses.map((cls, i) => (
                        <tr
                          key={cls.id}
                          onClick={() => setManageClassId(cls.id)}
                          className="hover:bg-surface-muted cursor-pointer transition-colors group"
                        >
                          <td className="px-6 py-4 text-center text-sm font-medium text-muted-foreground">{i + 1}</td>
                          <td className="px-6 py-4 font-mono font-semibold text-sm text-primary">{cls.code}</td>
                          <td className="px-6 py-4 font-medium text-sm text-foreground">{cls.name}</td>
                          <td className="px-6 py-4 text-center text-sm text-muted-foreground">{cls.academicYear || '-'}</td>
                          <td className="px-6 py-4 text-center text-sm font-semibold text-foreground">{cls.studentCount}</td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditClassData({ id: cls.id, code: cls.code, name: cls.name, academic_year: cls.academicYear || '' }); }}
                                className="px-3 py-1 bg-surface border border-border text-foreground hover:bg-surface-muted rounded text-xs font-medium transition-colors"
                              >Sửa</button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls); }}
                                className="px-3 py-1 bg-danger text-danger-foreground hover:bg-danger/90 rounded text-xs font-medium transition-colors disabled:opacity-50"
                                disabled={cls.studentCount > 0}
                                title={cls.studentCount > 0 ? 'Phải xóa hết SV trước' : 'Xóa lớp'}
                              >Xóa</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Student management (when a class is selected) ── */}
          {manageClassId && (
            <div className="dashboard-card" style={{ padding: 0 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 16, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--muted-foreground)' }}>Sinh viên trong lớp</span>
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
              </div>
              <div style={{ padding: 16 }}>
                {loadingStudents ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)' }}>Đang tải danh sách...</div>
                ) : (
                  <DataTable title="" subtitle={`${filteredManageStudents.length} sinh viên`} columns={manageStudentsColumns} data={filteredManageStudents} emptyMessage="Chưa có sinh viên nào trong lớp" />
                )}
              </div>
            </div>
          )}
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
              <h3 className="modal-header-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={18} strokeWidth={2} /> Phiếu điểm rèn luyện:{' '}
                <span style={{ color: 'var(--accent)' }}>{selectedStudentForEdit.name}</span>
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted-foreground)', marginLeft: 8 }}>({selectedStudentForEdit.studentCode})</span>
              </h3>
              <button
                onClick={() => setSelectedStudentForEdit(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', color: 'var(--muted-foreground)' }}
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

      {/* Edit Class Modal */}
      {editClassData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header"><h3 className="modal-header-title">Sửa lớp học</h3><button onClick={() => setEditClassData(null)} className="modal-close-btn">✕</button></div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}><label className="form-label">Mã lớp *</label><input type="text" className="form-input" value={editClassData.code} onChange={e => setEditClassData({ ...editClassData, code: e.target.value })} /></div>
              <div style={{ marginBottom: 16 }}><label className="form-label">Tên lớp *</label><input type="text" className="form-input" value={editClassData.name} onChange={e => setEditClassData({ ...editClassData, name: e.target.value })} /></div>
              <div style={{ marginBottom: 16 }}><label className="form-label">Năm học</label><input type="text" className="form-input" value={editClassData.academic_year} onChange={e => setEditClassData({ ...editClassData, academic_year: e.target.value })} /></div>
            </div>
            <div className="modal-footer"><button onClick={() => setEditClassData(null)} className="btn-secondary">Hủy</button><button onClick={handleEditClass} className="btn-primary">Lưu thay đổi</button></div>
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
              <div style={{ marginBottom: 16 }}><label className="form-label">Vai trò *</label><select className="form-select" value={newSvRole} onChange={e => setNewSvRole(e.target.value)}><option value="STUDENT">Sinh viên</option><option value="CLASS_COMMITTEE">Ban cán sự</option><option value="ADVISOR">Cố vấn học tập</option></select></div>
            </div>
            <div className="modal-footer"><button onClick={() => setShowAddStudentModal(false)} className="btn-secondary">Hủy</button><button onClick={handleAddStudent} className="btn-primary">Thêm sinh viên</button></div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header"><h3 className="modal-header-title">Chỉnh sửa thông tin</h3><button onClick={() => setEditingStudent(null)} className="modal-close-btn">✕</button></div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}><label className="form-label">Họ tên *</label><input type="text" className="form-input" value={editingStudent.full_name} onChange={e => setEditingStudent({...editingStudent, full_name: e.target.value})} placeholder="Nhập họ tên" /></div>
              <div style={{ marginBottom: 16 }}><label className="form-label">MSSV</label><input type="text" className="form-input" value={editingStudent.studentCode || ''} onChange={e => setEditingStudent({...editingStudent, studentCode: e.target.value})} placeholder="Nhập MSSV" /></div>
              <div style={{ marginBottom: 16 }}><label className="form-label">Email *</label><input type="email" className="form-input" value={editingStudent.email} onChange={e => setEditingStudent({...editingStudent, email: e.target.value})} placeholder="Nhập email" /></div>
              <div style={{ marginBottom: 16 }}><label className="form-label">Vai trò *</label><select className="form-select" value={editSvRole} onChange={e => setEditSvRole(e.target.value)}><option value="STUDENT">Sinh viên</option><option value="CLASS_COMMITTEE">Ban cán sự</option><option value="ADVISOR">Cố vấn học tập</option></select></div>
            </div>
            <div className="modal-footer"><button onClick={() => setEditingStudent(null)} className="btn-secondary">Hủy</button><button onClick={handleEditStudentSave} className="btn-primary">Lưu thay đổi</button></div>
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
                  {manageClassId && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#15803d', fontWeight: 500 }}><CheckCircle size={14} strokeWidth={2} /> Lớp đã chọn: <strong>{deptClasses.find(c => c.id === manageClassId)?.code}</strong></div>}
                  {!manageClassId && <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#92400e', fontWeight: 500 }}>⚠ Chưa chọn lớp — File cần cột &quot;Lớp&quot;</div>}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button onClick={downloadDeptTemplate} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
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
                      <div className="overflow-x-auto border border-border rounded-lg max-h-[300px]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-surface-muted sticky top-0 text-muted-foreground"><tr>
                            <th className="px-3 py-2 font-semibold border-b border-border">Dòng</th>
                            <th className="px-3 py-2 font-semibold border-b border-border">MSSV</th>
                            <th className="px-3 py-2 font-semibold border-b border-border">Họ tên</th>
                            <th className="px-3 py-2 font-semibold border-b border-border">Email</th>
                            <th className="px-3 py-2 font-semibold border-b border-border">Vai trò</th>
                            <th className="px-3 py-2 font-semibold border-b border-border">Lớp</th>
                          </tr></thead>
                          <tbody>{importData.map((row, i) => {
                            const hasError = !row.full_name || !row.email || !row.password;
                            return (<tr key={i} className={hasError ? 'bg-danger/10' : 'bg-transparent'}>
                              <td className="px-3 py-1.5 border-b border-border text-muted-foreground">{row.rowIndex}</td>
                              <td className="px-3 py-1.5 border-b border-border font-mono">{row.student_id || '-'}</td>
                              <td className={`px-3 py-1.5 border-b border-border font-medium ${!row.full_name ? 'text-danger' : 'text-foreground'}`}>{row.full_name || '⚠ Thiếu'}</td>
                              <td className={`px-3 py-1.5 border-b border-border ${!row.email ? 'text-danger' : 'text-muted-foreground'}`}>{row.email || '⚠ Thiếu'}</td>
                              <td className="px-3 py-1.5 border-b border-border">
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {row.role === 'CLASS_COMMITTEE' ? 'Ban cán sự' : (row.role === 'STUDENT' ? 'Sinh viên' : row.role)}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 border-b border-border text-muted-foreground">{row.class_code || (manageClassId ? '← Lớp đã chọn' : '⚠ Chưa có')}</td>
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
