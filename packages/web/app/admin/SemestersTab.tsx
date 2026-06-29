'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { DataTable } from '../components/DataTable';
import { Check, CheckCircle2, Circle, Copy, Loader2 } from 'lucide-react';

interface Semester { id: string; code: string; name: string; academic_year: string; semester_number: number; start_date: string; end_date: string; student_deadline: string; class_committee_deadline: string; advisor_deadline: string; school_deadline: string; status: string; is_active: number; criteriaCount?: number; categoryCount?: number; hasVersion?: boolean; }

const STATUS_LABELS: Record<string, string> = { UPCOMING: 'Sắp tới', STUDENT_SCORING: 'SV chấm', CLASS_REVIEWING: 'Lớp xét', ADVISOR_REVIEWING: 'CVHT xét', SCHOOL_REVIEWING: 'Trường xét', FINALIZED: 'Đã chốt', LOCKED: 'Khóa' };
const DATE_FIELDS = [
  { key: 'start_date', label: 'Ngày bắt đầu' },
  { key: 'student_deadline', label: 'Hạn SV nộp' },
  { key: 'class_committee_deadline', label: 'Hạn BCS xét' },
  { key: 'advisor_deadline', label: 'Hạn CVHT duyệt' },
  { key: 'school_deadline', label: 'Hạn trường chốt' },
  { key: 'end_date', label: 'Ngày kết thúc' }
] as const;
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  UPCOMING: { bg: '#fef2f2', color: '#ef4444' }, // red-50, red-500
  STUDENT_SCORING: { bg: '#fffbeb', color: '#f59e0b' }, // amber-50, amber-500
  CLASS_REVIEWING: { bg: '#fffbeb', color: '#f59e0b' },
  ADVISOR_REVIEWING: { bg: '#f5f3ff', color: '#8b5cf6' }, // violet-50, violet-500
  SCHOOL_REVIEWING: { bg: '#ecfeff', color: '#06b6d4' }, // cyan-50, cyan-500
  FINALIZED: { bg: '#ecfdf5', color: '#10b981' }, // emerald-50, emerald-500
  LOCKED: { bg: '#f3f4f6', color: '#6b7280' }, // gray-100, gray-500
};

function fmtDate(d: string) { if (!d) return '-'; return new Date(d).toLocaleDateString('vi-VN'); }

export function SemestersTab() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Semester | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [showApplyPopup, setShowApplyPopup] = useState(false);
  const [selectedSemesterToApply, setSelectedSemesterToApply] = useState('');
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersionToApply, setSelectedVersionToApply] = useState('');
  const [form, setForm] = useState({ code: '', name: '', academic_year: '2025-2026', semester_number: '1', start_date: '', end_date: '', student_deadline: '', class_committee_deadline: '', advisor_deadline: '', school_deadline: '', status: 'UPCOMING' });

  const fetchVersions = async () => {
    try {
      const r = await fetch('/api/admin/criteria-versions');
      if (r.ok) {
        const j = await r.json();
        setVersions(j.data || []);
        if (j.data && j.data.length > 0) {
          setSelectedVersionToApply(j.data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch('/api/admin/semesters');
      if (r.ok) { const j = await r.json(); setSemesters(j.data || []); }
    } finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const timer = setInterval(() => fetchAll(true), 30000); // Tự động cập nhật mỗi 30s
    return () => clearInterval(timer);
  }, [fetchAll]);

  const resetForm = () => { setForm({ code: '', name: '', academic_year: '2025-2026', semester_number: '1', start_date: '', end_date: '', student_deadline: '', class_committee_deadline: '', advisor_deadline: '', school_deadline: '', status: 'UPCOMING' }); setShowForm(false); setEditing(null); };

  const startEdit = (s: Semester) => {
    setEditing(s);
    setForm({
      code: s.code, name: s.name, academic_year: s.academic_year,
      semester_number: String(s.semester_number), status: s.status,
      start_date: s.start_date?.slice(0, 10) || '', end_date: s.end_date?.slice(0, 10) || '',
      student_deadline: s.student_deadline?.slice(0, 10) || '', class_committee_deadline: s.class_committee_deadline?.slice(0, 10) || '',
      advisor_deadline: s.advisor_deadline?.slice(0, 10) || '', school_deadline: s.school_deadline?.slice(0, 10) || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name) return alert('Nhập đầy đủ thông tin');
    
    for (let i = 0; i < DATE_FIELDS.length - 1; i++) {
      const d1 = form[DATE_FIELDS[i].key as keyof typeof form];
      const d2 = form[DATE_FIELDS[i+1].key as keyof typeof form];
      if (d1 && d2 && d1 > d2) {
        return alert(`Lỗi: ${DATE_FIELDS[i].label} không được sau ${DATE_FIELDS[i+1].label}!`);
      }
    }
    
    const method = editing ? 'PUT' : 'POST';
    // status bị loại bỏ vì được auto-compute theo thời gian thực
    const { status: _status, ...formWithoutStatus } = form;
    const body = editing ? { id: editing.id, ...formWithoutStatus, semester_number: parseInt(form.semester_number) } : { ...formWithoutStatus, semester_number: parseInt(form.semester_number) };
    try {
      const r = await fetch('/api/admin/semesters', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) { resetForm(); fetchAll(); } else { alert(d.message); }
    } catch { alert('Lỗi kết nối'); }
  };

  const activateSemester = async (id: string) => {
    if (!confirm('Bạn có chắc muốn kích hoạt học kỳ này (các học kỳ khác sẽ bị vô hiệu hóa)?')) return;
    try {
      const r = await fetch('/api/admin/semesters', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'activate' }) });
      const d = await r.json();
      if (r.ok) { fetchAll(); } else { alert(d.message); }
    } catch { alert('Lỗi kết nối'); }
  };

  const deactivateSemester = async (id: string) => {
    if (!confirm('Bạn có chắc muốn hủy kích hoạt học kỳ này?')) return;
    try {
      const r = await fetch('/api/admin/semesters', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'deactivate' }) });
      const d = await r.json();
      if (r.ok) { fetchAll(); } else { alert(d.message); }
    } catch { alert('Lỗi kết nối'); }
  };

  const applyCriteria = async (semesterId: string, semesterName: string, sourceVersionId: string) => {
    setApplyingId(semesterId);
    try {
      const r = await fetch('/api/admin/semesters/apply-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetSemesterId: semesterId, sourceVersionId }),
      });
      const d = await r.json();
      if (r.ok) {
        alert(`${d.message}`);
        fetchAll();
      } else {
        alert(`${d.message}`);
      }
    } catch {
      alert('Lỗi kết nối');
    } finally {
      setApplyingId(null);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>;

  const columns = [
    { header: 'STT', width: 50, render: (_s: Semester, i: number) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</span> },
    { header: 'Mã', width: 120, render: (s: Semester) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>{s.code}</span> },
    { header: 'Tên', render: (s: Semester) => <span style={{ fontWeight: 500 }}>{s.name}</span> },
    { header: 'Năm học', width: 100, render: (s: Semester) => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.academic_year}</span> },
    { header: 'Bắt đầu', width: 100, render: (s: Semester) => <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtDate(s.start_date)}</span> },
    { header: 'Kết thúc', width: 100, render: (s: Semester) => <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtDate(s.end_date)}</span> },
    {
      header: 'Trạng thái', width: 110, align: 'center' as const, render: (s: Semester) => {
        const sc = STATUS_COLORS[s.status] || { bg: '#f3f4f6', color: '#6b7280' };
        return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: sc.bg, color: sc.color }}>{STATUS_LABELS[s.status] || s.status}</span>;
      }
    },
    {
      header: 'Tiêu chí', width: 100, align: 'center' as const, render: (s: Semester) => {
        if (s.criteriaCount && s.criteriaCount > 0) {
          return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: '#ecfdf5', color: '#10b981' }}><Check size={12} strokeWidth={2.5} /> {s.criteriaCount} TC</span>;
        }
        return <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 9999, background: '#fef2f2', color: '#ef4444' }}>Chưa có</span>;
      }
    },
    {
      header: 'Kích hoạt', width: 80, align: 'center' as const, render: (s: Semester) => (
        Number(s.is_active) === 1 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#10b981', fontWeight: 600, fontSize: 12 }}><CheckCircle2 size={14} strokeWidth={2} /> Active</span> : <span style={{ display: 'inline-flex', alignItems: 'center', color: '#d1d5db', fontSize: 12 }}><Circle size={14} strokeWidth={2} /></span>
      )
    },
    {
      header: 'Thao tác', width: 220, align: 'center' as const, render: (s: Semester) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          {Number(s.is_active) !== 1 && <button onClick={() => activateSemester(s.id)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11, borderColor: '#10b981', color: '#10b981' }}>Kích hoạt</button>}
          {Number(s.is_active) === 1 && <button onClick={() => deactivateSemester(s.id)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11, borderColor: '#8a8f98', color: '#62666d' }}>Hủy kích hoạt</button>}
          <button onClick={() => startEdit(s)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>Sửa</button>
        </div>
      )
    }
  ];

  return (
    <div>
      {showForm && (
        <form onSubmit={handleSubmit} className="dashboard-card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{editing ? 'Sửa học kỳ' : 'Thêm học kỳ mới'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div><label className="form-label">Mã học kỳ</label><input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="form-input" placeholder="VD: HK1_2025" /></div>
            <div><label className="form-label">Tên</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="form-input" placeholder="Học kỳ 1" /></div>
            <div><label className="form-label">Năm học</label><input type="text" value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })} className="form-input" /></div>
            <div><label className="form-label">Học kỳ số</label><input type="number" min="1" max="3" value={form.semester_number} onChange={e => setForm({ ...form, semester_number: e.target.value })} className="form-input" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            {DATE_FIELDS.map(f => (
              <div key={f.key}>
                <label className="form-label">{f.label}</label>
                <input type="date" value={form[f.key as keyof typeof form] as string} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="form-input" />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn-primary">{editing ? 'Lưu' : 'Thêm'}</button>
            {editing && <button type="button" onClick={resetForm} className="btn-secondary">Hủy</button>}
          </div>
        </form>
      )}

      <DataTable
        title="Quản lý Học kỳ"
        subtitle={`${semesters.length} học kỳ`}
        headerActions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowApplyPopup(true); fetchVersions(); }} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Copy size={16} /> Áp dụng Tiêu chí
            </button>
            <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="btn-primary">
              {showForm ? 'Đóng' : '+ Thêm học kỳ'}
            </button>
          </div>
        }
        columns={columns}
        data={semesters}
        loading={loading}
      />

      {/* Apply Criteria Popup */}
      {showApplyPopup && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Áp dụng Bộ tiêu chí</h3>
            <p className="text-sm text-gray-500 mb-5">Chọn phiên bản tiêu chí và học kỳ để sao chép toàn bộ mục và tiêu chí.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Phiên bản nguồn</label>
              <select
                value={selectedVersionToApply}
                onChange={e => setSelectedVersionToApply(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-medium text-gray-700"
              >
                <option value="">-- Chọn phiên bản --</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name || 'Bộ tiêu chí chưa đặt tên'}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Học kỳ đích</label>
              <select
                value={selectedSemesterToApply}
                onChange={e => setSelectedSemesterToApply(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-medium text-gray-700"
              >
                <option value="">-- Chọn học kỳ --</option>
                {semesters.filter(s => !s.criteriaCount || s.criteriaCount === 0).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.academic_year})</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowApplyPopup(false); setSelectedSemesterToApply(''); }}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={async () => {
                  if (!selectedVersionToApply) return alert('Vui lòng chọn phiên bản nguồn');
                  if (!selectedSemesterToApply) return alert('Vui lòng chọn học kỳ đích');
                  const semesterName = semesters.find(s => s.id === selectedSemesterToApply)?.name || '';
                  await applyCriteria(selectedSemesterToApply, semesterName, selectedVersionToApply);
                  setShowApplyPopup(false);
                  setSelectedSemesterToApply('');
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-sm transition-colors flex items-center gap-2"
                disabled={applyingId !== null}
              >
                {applyingId !== null && <Loader2 size={16} className="animate-spin" />}
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
