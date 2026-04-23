'use client';
import React, { useState, useEffect, useCallback } from 'react';

interface ClassItem { id: string; code: string; name: string; department_id: string; departmentName: string; academic_year: string; is_active: number; studentCount: number; }
interface Dept { id: string; code: string; name: string; }

export function ClassesTab() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [filterDept, setFilterDept] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [deptId, setDeptId] = useState('');
  const [year, setYear] = useState('2025-2026');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cr, dr] = await Promise.all([
        fetch(`/api/admin/classes${filterDept ? `?departmentId=${filterDept}` : ''}`),
        fetch('/api/admin/departments'),
      ]);
      if (cr.ok) { const j = await cr.json(); setClasses(j.data || []); }
      if (dr.ok) { const j = await dr.json(); setDepts(j.data || []); }
    } finally { setLoading(false); }
  }, [filterDept]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetForm = () => { setCode(''); setName(''); setDeptId(''); setYear('2025-2026'); setShowForm(false); setEditing(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name || !deptId) return alert('Nhập đầy đủ thông tin');
    const method = editing ? 'PUT' : 'POST';
    const body = editing
      ? { id: editing.id, code, name, department_id: deptId, academic_year: year }
      : { code, name, department_id: deptId, academic_year: year };
    try {
      const r = await fetch('/api/admin/classes', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) { resetForm(); fetchAll(); } else { alert(d.message); }
    } catch { alert('Lỗi kết nối'); }
  };

  const handleDelete = async (cls: ClassItem) => {
    if (!confirm(`Xác nhận xóa lớp "${cls.name}"?`)) return;
    try {
      const r = await fetch('/api/admin/classes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cls.id }) });
      const d = await r.json(); alert(d.message);
      if (r.ok) fetchAll();
    } catch { alert('Lỗi kết nối'); }
  };

  const startEdit = (c: ClassItem) => { setEditing(c); setCode(c.code); setName(c.name); setDeptId(c.department_id); setYear(c.academic_year); setShowForm(true); };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>;

  return (
    <div>
      <div className="dashboard-card-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="dashboard-card-title">Quản lý Lớp</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Tổng cộng {classes.length} lớp</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="form-select" style={{ width: 200 }}>
            <option value="">Tất cả khoa</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="btn-primary">{showForm ? 'Đóng' : '+ Thêm lớp'}</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="dashboard-card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            {editing ? `Sửa lớp [${editing.code}]` : 'Thêm lớp mới'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div><label className="form-label">Mã lớp</label><input type="text" placeholder="VD: CNTT01" value={code} onChange={e => setCode(e.target.value)} className="form-input" /></div>
            <div><label className="form-label">Tên lớp</label><input type="text" placeholder="VD: CNTT K46" value={name} onChange={e => setName(e.target.value)} className="form-input" /></div>
            <div><label className="form-label">Khoa</label>
              <select value={deptId} onChange={e => setDeptId(e.target.value)} className="form-select">
                <option value="">-- Chọn khoa --</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><label className="form-label">Năm học</label><input type="text" placeholder="2025-2026" value={year} onChange={e => setYear(e.target.value)} className="form-input" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn-primary">{editing ? 'Lưu' : 'Thêm'}</button>
            {editing && <button type="button" onClick={resetForm} className="btn-secondary">Hủy</button>}
          </div>
        </form>
      )}

      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="dashboard-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>STT</th>
                <th style={{ width: 110 }}>Mã lớp</th>
                <th>Tên lớp</th>
                <th>Khoa</th>
                <th style={{ width: 100 }}>Năm học</th>
                <th style={{ width: 70, textAlign: 'center' }}>Sĩ số</th>
                <th style={{ width: 100, textAlign: 'center' }}>Trạng thái</th>
                <th style={{ width: 140, textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Chưa có lớp nào</td></tr>
              ) : classes.map((c, i) => (
                <tr key={c.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{c.code}</td>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{c.departmentName}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.academic_year}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ background: 'var(--accent-light)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>{c.studentCount}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: c.is_active ? 'var(--success-bg)' : '#f3f4f6', color: c.is_active ? 'var(--success)' : 'var(--text-muted)' }}>
                      {c.is_active ? 'Hoạt động' : 'Ẩn'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button onClick={() => startEdit(c)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>Sửa</button>
                      <button onClick={() => handleDelete(c)} className="btn-danger" style={{ padding: '4px 10px', fontSize: 11 }}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
