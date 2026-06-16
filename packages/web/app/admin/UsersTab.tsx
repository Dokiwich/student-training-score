'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { DataTable } from '../components/DataTable'; interface UserItem { id: string; student_id: string | null; email: string; full_name: string; phone: string | null; role: string; class_id: string | null; department_id: string | null; className: string; departmentName: string; is_active: number; }
interface Dept { id: string; code: string; name: string; }
interface ClassItem { id: string; code: string; name: string; department_id?: string; }

const ROLE_LABELS: Record<string, string> = { STUDENT: 'Sinh viên', CLASS_COMMITTEE: 'Ban cán sự', ADVISOR: 'Cố vấn', SCHOOL_ADMIN: 'Admin', DEPARTMENT: 'Khoa' };
const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  STUDENT: { bg: '#eff6ff', color: '#2563eb' },
  CLASS_COMMITTEE: { bg: '#fef3c7', color: '#d97706' },
  ADVISOR: { bg: '#ecfdf5', color: '#059669' },
  SCHOOL_ADMIN: { bg: 'var(--accent-light)', color: 'var(--accent)' },
  DEPARTMENT: { bg: '#f3e8ff', color: '#7c3aed' },
};

interface ImportRow {
  rowIndex: number;
  student_id?: string;
  full_name: string;
  email: string;
  password: string;
  role: string;
  department_code?: string;
  class_code?: string;
}

interface ImportResult {
  rowIndex: number;
  success: boolean;
  message: string;
  student_id?: string;
  full_name?: string;
}

export function UsersTab() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const urlRole = searchParams.get('role');
  const [filterRole, setFilterRole] = useState(urlRole || '');
  const [filterDept, setFilterDept] = useState('');

  // Sync filterRole with URL param when navigating
  useEffect(() => {
    setFilterRole(urlRole || '');
  }, [urlRole]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editStudentId, setEditStudentId] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newFullname, setNewFullname] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('STUDENT');
  const [newStudentId, setNewStudentId] = useState('');
  const [newDeptId, setNewDeptId] = useState('');
  const [newClassId, setNewClassId] = useState('');

  // Filtered classes based on selected department
  const filteredNewClasses = newDeptId
    ? classes.filter(c => c.department_id === newDeptId)
    : classes;
  const filteredEditClasses = editDeptId
    ? classes.filter(c => c.department_id === editDeptId)
    : classes;

  // Auto-set department when selecting a class (Add modal)
  const handleNewClassChange = (classId: string) => {
    setNewClassId(classId);
    if (classId) {
      const cls = classes.find(c => c.id === classId);
      if (cls?.department_id && cls.department_id !== newDeptId) {
        setNewDeptId(cls.department_id);
      }
    }
  };

  // Auto-set department when selecting a class (Edit modal)
  const handleEditClassChange = (classId: string) => {
    setEditClassId(classId);
    if (classId) {
      const cls = classes.find(c => c.id === classId);
      if (cls?.department_id && cls.department_id !== editDeptId) {
        setEditDeptId(cls.department_id);
      }
    }
  };

  // When changing department, reset class if it doesn't belong to the new department
  const handleNewDeptChange = (deptId: string) => {
    setNewDeptId(deptId);
    if (deptId && newClassId) {
      const cls = classes.find(c => c.id === newClassId);
      if (cls && cls.department_id !== deptId) {
        setNewClassId('');
      }
    }
  };

  const handleEditDeptChange = (deptId: string) => {
    setEditDeptId(deptId);
    if (deptId && editClassId) {
      const cls = classes.find(c => c.id === editClassId);
      if (cls && cls.department_id !== deptId) {
        setEditClassId('');
      }
    }
  };

  // Import Excel state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [importStats, setImportStats] = useState<{ successCount: number; errorCount: number; total: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const startEdit = (u: UserItem) => { setEditing(u); setEditRole(u.role); setEditClassId(u.class_id || ''); setEditDeptId(u.department_id || ''); setEditStudentId(u.student_id || ''); };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const r = await fetch('/api/admin/users', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, role: editRole, class_id: editClassId, department_id: editDeptId, student_id: editStudentId }),
      });
      const d = await r.json();
      if (r.ok) { setEditing(null); fetchAll(); } else { alert(d.message); }
    } catch { alert('Lỗi kết nối'); }
  };

  const handleAddUser = async () => {
    if (!newFullname || !newEmail || !newPassword || !newRole) {
      return alert('Vui lòng nhập đầy đủ thông tin bắt buộc (Họ tên, Email, Mật khẩu, Vai trò)');
    }
    try {
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newFullname,
          email: newEmail,
          password: newPassword,
          role: newRole,
          student_id: newStudentId,
          department_id: newDeptId,
          class_id: newClassId
        }),
      });
      const d = await r.json();
      if (r.ok) {
        setShowAddModal(false);
        setNewFullname('');
        setNewEmail('');
        setNewPassword('');
        setNewStudentId('');
        setNewRole('STUDENT');
        setNewDeptId('');
        setNewClassId('');
        fetchAll();
        alert('Thêm tài khoản thành công');
      } else {
        alert(d.message);
      }
    } catch {
      alert('Lỗi kết nối');
    }
  };

  const handleDelete = async (u: UserItem) => {
    if (!confirm(`Xác nhận xóa người dùng "${u.full_name}"?`)) return;
    try {
      const r = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id }) });
      const d = await r.json(); alert(d.message);
      if (r.ok) fetchAll();
    } catch { alert('Lỗi kết nối'); }
  };

  // === EXCEL IMPORT FUNCTIONS ===

  const downloadTemplate = () => {
    import('xlsx').then((XLSX) => {
      const templateData = [
        { 'MSSV': '22AV1101001', 'Họ tên': 'Nguyễn Văn A', 'Email': 'example@student.edu.vn', 'Mật khẩu': '123456', 'Vai trò': 'STUDENT', 'Khoa': 'CNTT', 'Lớp': '22AV1101' },
        { 'MSSV': '', 'Họ tên': 'Trần Thị B', 'Email': 'cv.22av@edu.vn', 'Mật khẩu': '123456', 'Vai trò': 'ADVISOR', 'Khoa': 'CNTT', 'Lớp': '' },
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DanhSach');
      XLSX.writeFile(wb, 'mau_import_nguoi_dung.xlsx');
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      'MSSV': 'student_id',
      'mssv': 'student_id',
      'Mã SV': 'student_id',
      'Họ tên': 'full_name',
      'Ho ten': 'full_name',
      'Họ và tên': 'full_name',
      'Email': 'email',
      'email': 'email',
      'Mật khẩu': 'password',
      'Mat khau': 'password',
      'Password': 'password',
      'Vai trò': 'role',
      'Vai tro': 'role',
      'Role': 'role',
      'Khoa': 'department_code',
      'Mã khoa': 'department_code',
      'Department': 'department_code',
      'Lớp': 'class_code',
      'Mã lớp': 'class_code',
      'Class': 'class_code',
    };

    const roleMap: Record<string, string> = {
      'sinh viên': 'STUDENT',
      'sv': 'STUDENT',
      'student': 'STUDENT',
      'ban cán sự': 'CLASS_COMMITTEE',
      'bcs': 'CLASS_COMMITTEE',
      'class_committee': 'CLASS_COMMITTEE',
      'cố vấn': 'ADVISOR',
      'cvht': 'ADVISOR',
      'advisor': 'ADVISOR',
      'khoa': 'DEPARTMENT',
      'department': 'DEPARTMENT',
      'admin': 'SCHOOL_ADMIN',
      'school_admin': 'SCHOOL_ADMIN',
    };

    const parsed: ImportRow[] = jsonData.map((row, i) => {
      const mapped: any = { rowIndex: i + 2 }; // +2: header=1, 0-indexed
      for (const [key, value] of Object.entries(row)) {
        const normalKey = columnMap[key.trim()];
        if (normalKey) {
          mapped[normalKey] = String(value).trim();
        }
      }
      // Normalize role
      if (mapped.role) {
        const roleLower = mapped.role.toLowerCase();
        mapped.role = roleMap[roleLower] || mapped.role.toUpperCase();
      } else {
        mapped.role = 'STUDENT';
      }
      return mapped as ImportRow;
    }).filter(r => r.full_name || r.email); // Remove completely empty rows

    setImportData(parsed);
  };

  const handleImport = async () => {
    if (importData.length === 0) return;
    setIsImporting(true);
    setImportResults(null);
    try {
      const r = await fetch('/api/admin/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: importData }),
      });
      const d = await r.json();
      if (r.ok) {
        setImportResults(d.results || []);
        setImportStats({ successCount: d.successCount, errorCount: d.errorCount, total: d.total });
        fetchAll(); // Refresh the user list
      } else {
        alert(d.message);
      }
    } catch {
      alert('Lỗi kết nối khi import');
    } finally {
      setIsImporting(false);
    }
  };

  const resetImport = () => {
    setImportData([]);
    setImportResults(null);
    setImportStats(null);
    setImportFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filtered = users.filter(u => !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || (u.student_id || '').includes(search) || u.email.includes(search));

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>;

  const columns = [
    { header: 'STT', width: 50, render: (_u: UserItem, i: number) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</span> },
    { header: 'MSSV', width: 100, render: (u: UserItem) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{u.student_id || '-'}</span> },
    { header: 'Họ tên', render: (u: UserItem) => <span style={{ fontWeight: 500 }}>{u.full_name}</span> },
    { header: 'Email', render: (u: UserItem) => <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{u.email}</span> },
    {
      header: 'Vai trò', width: 110, render: (u: UserItem) => {
        const rc = ROLE_COLORS[u.role] || { bg: '#f3f4f6', color: '#6b7280' };
        return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: rc.bg, color: rc.color }}>{ROLE_LABELS[u.role] || u.role}</span>;
      }
    },
    { header: 'Lớp', render: (u: UserItem) => <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{u.className || '-'}</span> },
    { header: 'Khoa', render: (u: UserItem) => <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{u.departmentName || '-'}</span> },
    {
      header: 'Thao tác', width: 80, align: 'center' as const, render: (u: UserItem) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          <button onClick={() => startEdit(u)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>Sửa</button>
          <button onClick={() => handleDelete(u)} className="btn-danger" style={{ padding: '4px 10px', fontSize: 11 }}>Xóa</button>
        </div>
      )
    }
  ];

  return (
    <div>
      <DataTable
        title="Quản lý Người dùng"
        subtitle={`${filtered.length} / ${users.length} người dùng`}
        headerActions={
          <>
            <button
              onClick={() => { setShowImportModal(true); resetImport(); }}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                border: '1px solid #e0e7ff', background: '#eef2ff', color: '#4f46e5',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#e0e7ff'; }}
              onMouseOut={e => { e.currentTarget.style.background = '#eef2ff'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              Import Excel
            </button>
            <button className="btn-primary" onClick={() => setShowAddModal(true)}>
              Thêm tài khoản
            </button>
          </>
        }
        filters={
          <>
            <input type="text" placeholder="Tìm kiếm tên, MSSV, email..." value={search} onChange={e => setSearch(e.target.value)} className="form-input" style={{ flex: 1, minWidth: 200, maxWidth: 300 }} />
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="form-select" style={{ width: 160 }}>
              <option value="">Tất cả vai trò</option>
              {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="form-select" style={{ width: 180 }}>
              <option value="">Tất cả khoa</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </>
        }
        columns={columns}
        data={filtered}
        loading={loading}
      />

      {/* Edit Modal */}
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
                <label className="form-label">MSSV</label>
                <input type="text" className="form-input" value={editStudentId} onChange={e => setEditStudentId(e.target.value)} placeholder="Nhập mã số sinh viên" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Khoa</label>
                <select value={editDeptId} onChange={e => handleEditDeptChange(e.target.value)} className="form-select">
                  <option value="">-- Không chọn --</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Lớp {editDeptId && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(lọc theo khoa)</span>}</label>
                <select value={editClassId} onChange={e => handleEditClassChange(e.target.value)} className="form-select">
                  <option value="">-- Không chọn --</option>
                  {filteredEditClasses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
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

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 className="modal-header-title">Thêm tài khoản mới</h3>
              <button onClick={() => setShowAddModal(false)} className="modal-close-btn">✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Họ tên *</label>
                <input type="text" className="form-input" value={newFullname} onChange={e => setNewFullname(e.target.value)} placeholder="Nhập họ tên" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Email *</label>
                <input type="email" className="form-input" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Nhập email" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Mật khẩu *</label>
                <input type="password" className="form-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nhập mật khẩu" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Vai trò *</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} className="form-select">
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">MSSV (Tùy chọn)</label>
                <input type="text" className="form-input" value={newStudentId} onChange={e => setNewStudentId(e.target.value)} placeholder="Nhập mã số sinh viên" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Khoa (Tùy chọn)</label>
                <select value={newDeptId} onChange={e => handleNewDeptChange(e.target.value)} className="form-select">
                  <option value="">-- Không chọn --</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Lớp (Tùy chọn) {newDeptId && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(lọc theo khoa)</span>}</label>
                <select value={newClassId} onChange={e => handleNewClassChange(e.target.value)} className="form-select">
                  <option value="">-- Không chọn --</option>
                  {filteredNewClasses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary">Hủy</button>
              <button onClick={handleAddUser} className="btn-primary">Thêm tài khoản</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 className="modal-header-title">Import dữ liệu từ Excel</h3>
              <button onClick={() => setShowImportModal(false)} className="modal-close-btn">✕</button>
            </div>
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
              {/* Step 1: Download template + upload */}
              {!importResults && (
                <>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={downloadTemplate}
                      style={{
                        padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                        border: '1px solid #d1d5db', background: '#fff', color: '#374151',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                      Tải file mẫu (.xlsx)
                    </button>

                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                          border: '2px dashed #d1d5db', borderRadius: 8, cursor: 'pointer',
                          background: importFileName ? '#f0fdf4' : '#fafafa',
                          borderColor: importFileName ? '#86efac' : '#d1d5db',
                          transition: 'all 0.2s',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={importFileName ? '#16a34a' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                        <span style={{ fontSize: 13, color: importFileName ? '#16a34a' : '#6b7280', fontWeight: 500 }}>
                          {importFileName || 'Chọn file .xlsx hoặc .xls'}
                        </span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleFileSelect}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Preview data */}
                  {importData.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: 0 }}>
                          Xem trước: {importData.length} dòng dữ liệu
                        </p>
                        <button
                          onClick={resetImport}
                          style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          Chọn file khác
                        </button>
                      </div>

                      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 350 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Dòng</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>MSSV</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Họ tên</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Email</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Vai trò</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Khoa</th>
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
                                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#f3f4f6', color: '#374151' }}>
                                      {ROLE_LABELS[row.role] || row.role}
                                    </span>
                                  </td>
                                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{row.department_code || '-'}</td>
                                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{row.class_code || '-'}</td>
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

              {/* Step 2: Import results */}
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
                    <div style={{ overflowX: 'auto', border: '1px solid #fecaca', borderRadius: 8, maxHeight: 300 }}>
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
                  <button
                    onClick={handleImport}
                    className="btn-primary"
                    disabled={importData.length === 0 || isImporting}
                    style={{ opacity: importData.length === 0 || isImporting ? 0.5 : 1 }}
                  >
                    {isImporting ? 'Đang nhập...' : `Nhập ${importData.length} dòng dữ liệu`}
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
