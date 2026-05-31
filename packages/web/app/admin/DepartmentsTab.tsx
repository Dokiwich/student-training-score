'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { DataTable } from '../components/DataTable';

interface Dept { id: string; code: string; name: string; is_active: number; classCount: number; userCount: number; }

export function DepartmentsTab() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Dept | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(1);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/departments');
      if (r.ok) { const j = await r.json(); setDepts(j.data || []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const resetForm = () => { setCode(''); setName(''); setIsActive(1); setShowForm(false); setEditing(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return alert('Nhập đầy đủ mã và tên khoa');
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { id: editing.id, code, name, is_active: isActive } : { code, name, is_active: isActive };
    try {
      const r = await fetch('/api/admin/departments', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (r.ok) { resetForm(); fetch_(); } else { alert(d.message); }
    } catch { alert('Lỗi kết nối'); }
  };

  const handleDelete = async (dept: Dept) => {
    if (!confirm(`Xác nhận xóa khoa "${dept.name}"?`)) return;
    try {
      const r = await fetch('/api/admin/departments', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: dept.id }),
      });
      const d = await r.json();
      alert(d.message);
      if (r.ok) fetch_();
    } catch { alert('Lỗi kết nối'); }
  };

  const startEdit = (dept: Dept) => { setEditing(dept); setCode(dept.code); setName(dept.name); setIsActive(dept.is_active); setShowForm(true); };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>;

  const columns = [
    { header: 'STT', width: 60, render: (_d: Dept, i: number) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</span> },
    { header: 'Mã khoa', width: 120, render: (d: Dept) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{d.code}</span> },
    { header: 'Tên khoa', render: (d: Dept) => <span style={{ fontWeight: 500 }}>{d.name}</span> },
    { header: 'Số lớp', width: 90, align: 'center' as const, render: (d: Dept) => <span style={{ background: 'var(--accent-light)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>{d.classCount}</span> },
    { header: 'Số users', width: 90, align: 'center' as const, render: (d: Dept) => <span style={{ fontSize: 12 }}>{d.userCount}</span> },
    { header: 'Trạng thái', width: 100, align: 'center' as const, render: (d: Dept) => (
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
          background: d.is_active ? 'var(--success-bg)' : '#f3f4f6',
          color: d.is_active ? 'var(--success)' : 'var(--text-muted)',
          border: `1px solid ${d.is_active ? 'var(--success-border)' : '#e5e7eb'}` }}>
          {d.is_active ? 'Hoạt động' : 'Ẩn'}
        </span>
      )
    },
    { header: 'Thao tác', width: 140, align: 'center' as const, render: (d: Dept) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          <button onClick={() => startEdit(d)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>Sửa</button>
          <button onClick={() => handleDelete(d)} className="btn-danger" style={{ padding: '4px 10px', fontSize: 11 }}>Xóa</button>
        </div>
      )
    }
  ];

  return (
    <div>
      {showForm && (
        <form onSubmit={handleSubmit} className="dashboard-card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            {editing ? `Sửa khoa [${editing.code}]` : 'Thêm khoa mới'}
          </h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 160px' }}>
              <label className="form-label">Mã khoa</label>
              <input type="text" placeholder="VD: CNTT" value={code} onChange={e => setCode(e.target.value)} className="form-input" />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">Tên khoa</label>
              <input type="text" placeholder="VD: Công nghệ thông tin" value={name} onChange={e => setName(e.target.value)} className="form-input" />
            </div>
            <div style={{ flex: '0 0 140px' }}>
              <label className="form-label">Trạng thái</label>
              <select value={isActive} onChange={e => setIsActive(Number(e.target.value))} className="form-input">
                <option value={1}>Hoạt động</option>
                <option value={0}>Ẩn</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn-primary">{editing ? 'Lưu' : 'Thêm'}</button>
              {editing && <button type="button" onClick={resetForm} className="btn-secondary">Hủy</button>}
            </div>
          </div>
        </form>
      )}

      <DataTable
        title="Quản lý Khoa"
        subtitle={`Tổng cộng ${depts.length} khoa`}
        headerActions={
          <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="btn-primary">
            {showForm ? 'Đóng' : '+ Thêm khoa'}
          </button>
        }
        columns={columns}
        data={depts}
        loading={loading}
      />
    </div>
  );
}
