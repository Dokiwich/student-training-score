'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { DataTable } from '../components/DataTable';

interface Semester { id: string; code: string; name: string; academic_year: string; semester_number: number; start_date: string; end_date: string; student_deadline: string; class_committee_deadline: string; advisor_deadline: string; school_deadline: string; status: string; is_active: number; }

const STATUS_LABELS: Record<string, string> = { UPCOMING: 'Sắp tới', STUDENT_SCORING: 'SV chấm', CLASS_REVIEWING: 'Lớp xét', ADVISOR_REVIEWING: 'CVHT xét', SCHOOL_REVIEWING: 'Trường xét', FINALIZED: 'Đã chốt', LOCKED: 'Khóa' };
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  UPCOMING: { bg: '#eff6ff', color: '#2563eb' },
  STUDENT_SCORING: { bg: '#fef3c7', color: '#d97706' },
  CLASS_REVIEWING: { bg: '#fef3c7', color: '#d97706' },
  ADVISOR_REVIEWING: { bg: '#fef3c7', color: '#d97706' },
  SCHOOL_REVIEWING: { bg: 'var(--accent-light)', color: 'var(--accent)' },
  FINALIZED: { bg: 'var(--success-bg)', color: 'var(--success)' },
  LOCKED: { bg: '#f3f4f6', color: '#6b7280' },
};

function fmtDate(d: string) { if (!d) return '-'; return new Date(d).toLocaleDateString('vi-VN'); }

export function SemestersTab() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Semester | null>(null);
  const [form, setForm] = useState({ code: '', name: '', academic_year: '2025-2026', semester_number: '1', start_date: '', end_date: '', student_deadline: '', class_committee_deadline: '', advisor_deadline: '', school_deadline: '', status: 'UPCOMING' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/semesters');
      if (r.ok) { const j = await r.json(); setSemesters(j.data || []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { id: editing.id, ...form, semester_number: parseInt(form.semester_number) } : { ...form, semester_number: parseInt(form.semester_number) };
    try {
      const r = await fetch('/api/admin/semesters', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) { resetForm(); fetchAll(); } else { alert(d.message); }
    } catch { alert('Lỗi kết nối'); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>;

  const columns = [
    { header: 'STT', width: 50, render: (_s: Semester, i: number) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</span> },
    { header: 'Mã', width: 120, render: (s: Semester) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>{s.code}</span> },
    { header: 'Tên', render: (s: Semester) => <span style={{ fontWeight: 500 }}>{s.name}</span> },
    { header: 'Năm học', width: 100, render: (s: Semester) => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.academic_year}</span> },
    { header: 'Bắt đầu', width: 100, render: (s: Semester) => <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtDate(s.start_date)}</span> },
    { header: 'Kết thúc', width: 100, render: (s: Semester) => <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtDate(s.end_date)}</span> },
    { header: 'Trạng thái', width: 110, align: 'center' as const, render: (s: Semester) => {
        const sc = STATUS_COLORS[s.status] || { bg: '#f3f4f6', color: '#6b7280' };
        return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: sc.bg, color: sc.color }}>{STATUS_LABELS[s.status] || s.status}</span>;
      }
    },
    { header: 'Thao tác', width: 80, align: 'center' as const, render: (s: Semester) => (
        <button onClick={() => startEdit(s)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>Sửa</button>
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
            {editing && <div><label className="form-label">Trạng thái</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="form-select">
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div><label className="form-label">Ngày bắt đầu</label><input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="form-input" /></div>
            <div><label className="form-label">Ngày kết thúc</label><input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="form-input" /></div>
            <div><label className="form-label">Hạn SV nộp</label><input type="date" value={form.student_deadline} onChange={e => setForm({ ...form, student_deadline: e.target.value })} className="form-input" /></div>
            <div><label className="form-label">Hạn BCS xét</label><input type="date" value={form.class_committee_deadline} onChange={e => setForm({ ...form, class_committee_deadline: e.target.value })} className="form-input" /></div>
            <div><label className="form-label">Hạn CVHT duyệt</label><input type="date" value={form.advisor_deadline} onChange={e => setForm({ ...form, advisor_deadline: e.target.value })} className="form-input" /></div>
            <div><label className="form-label">Hạn trường chốt</label><input type="date" value={form.school_deadline} onChange={e => setForm({ ...form, school_deadline: e.target.value })} className="form-input" /></div>
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
          <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="btn-primary">{showForm ? 'Đóng' : '+ Thêm học kỳ'}</button>
        }
        columns={columns}
        data={semesters}
        loading={loading}
      />
    </div>
  );
}
