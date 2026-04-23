'use client';
import React, { useState, useEffect, useCallback } from 'react';

interface UserItem { id: string; student_id: string | null; email: string; full_name: string; phone: string | null; role: string; class_id: string | null; department_id: string | null; className: string; departmentName: string; is_active: number; }
interface Dept { id: string; code: string; name: string; }
interface ClassItem { id: string; code: string; name: string; }

const ROLE_LABELS: Record<string, string> = { STUDENT: 'Sinh viên', CLASS_COMMITTEE: 'Ban cán sự', ADVISOR: 'Cố vấn', SCHOOL_ADMIN: 'Admin' };
const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  STUDENT: { bg: '#eff6ff', color: '#2563eb' },
  CLASS_COMMITTEE: { bg: '#fef3c7', color: '#d97706' },
  ADVISOR: { bg: '#ecfdf5', color: '#059669' },
  SCHOOL_ADMIN: { bg: 'var(--accent-light)', color: 'var(--accent)' },
};

export function UsersTab() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editDeptId, setEditDeptId] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRole) params.set('role', filterRole);
      if (filterDept) params.set('departmentId', filterDept);
      const [ur, dr, cr] = await Promise.all([
        fetch(`/api/admin/users?${params}`), fetch('/api/admin/departments'), fetch('/api/admin/classes'),
      ]);
      if (ur.ok) { const j = await ur.json(); setUsers(j.data || []); }
      if (dr.ok) { const j = await dr.json(); setDepts(j.data || []); }
      if (cr.ok) { const j = await cr.json(); setClasses(j.data || []); }
    } finally { setLoading(false); }
  }, [filterRole, filterDept]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const startEdit = (u: UserItem) => { setEditing(u); setEditRole(u.role); setEditClassId(u.class_id || ''); setEditDeptId(u.department_id || ''); };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const r = await fetch('/api/admin/users', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, role: editRole, class_id: editClassId, department_id: editDeptId }),
      });
      const d = await r.json();
      if (r.ok) { setEditing(null); fetchAll(); } else { alert(d.message); }
    } catch { alert('Lỗi kết nối'); }
  };

  const handleDelete = async (u: UserItem) => {
    if (!confirm(`Xác nhận xóa người dùng "${u.full_name}"?`)) return;
    try {
      const r = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id }) });
      const d = await r.json(); alert(d.message);
      if (r.ok) fetchAll();
    } catch { alert('Lỗi kết nối'); }
  };

  const filtered = users.filter(u => !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || (u.student_id || '').includes(search) || u.email.includes(search));

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>;

  return (
    <div>
      <div className="dashboard-card-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="dashboard-card-title">Quản lý Người dùng</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{filtered.length} / {users.length} người dùng</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input type="text" placeholder="Tìm kiếm tên, MSSV, email..." value={search} onChange={e => setSearch(e.target.value)} className="form-input" style={{ flex: 1, minWidth: 200, maxWidth: 300 }} />
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="form-select" style={{ width: 160 }}>
          <option value="">Tất cả vai trò</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="form-select" style={{ width: 180 }}>
          <option value="">Tất cả khoa</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="dashboard-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>STT</th>
                <th style={{ width: 100 }}>MSSV</th>
                <th>Họ tên</th>
                <th>Email</th>
                <th style={{ width: 110 }}>Vai trò</th>
                <th>Lớp</th>
                <th>Khoa</th>
                <th style={{ width: 80, textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Không tìm thấy</td></tr>
              ) : filtered.map((u, i) => {
                const rc = ROLE_COLORS[u.role] || { bg: '#f3f4f6', color: '#6b7280' };
                return (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{u.student_id || '-'}</td>
                    <td style={{ fontWeight: 500 }}>{u.full_name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{u.email}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: rc.bg, color: rc.color }}>{ROLE_LABELS[u.role] || u.role}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{u.className || '-'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{u.departmentName || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button onClick={() => startEdit(u)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>Sửa</button>
                        <button onClick={() => handleDelete(u)} className="btn-danger" style={{ padding: '4px 10px', fontSize: 11 }}>Xóa</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-header-title">Chỉnh sửa: {editing.full_name}</h3>
              <button onClick={() => setEditing(null)} className="modal-close-btn">✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Vai trò</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} className="form-select">
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Khoa</label>
                <select value={editDeptId} onChange={e => setEditDeptId(e.target.value)} className="form-select">
                  <option value="">-- Không chọn --</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Lớp</label>
                <select value={editClassId} onChange={e => setEditClassId(e.target.value)} className="form-select">
                  <option value="">-- Không chọn --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setEditing(null)} className="btn-secondary">Hủy</button>
              <button onClick={handleSave} className="btn-primary">Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
