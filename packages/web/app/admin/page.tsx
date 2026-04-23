'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '../components/DashboardLayout';
import { DepartmentsTab } from './DepartmentsTab';
import { ClassesTab } from './ClassesTab';
import { UsersTab } from './UsersTab';
import { SemestersTab } from './SemestersTab';
import { ListTree, Building2, GraduationCap, UserPlus, CalendarDays } from 'lucide-react';

interface Category {
  id: string; code: string; name: string; max_score: number; sort_order: number;
}

interface Criterion {
  id: number; code: string; content: string; max_points: number; parent_id: number | null; category_id: string; is_active: number;
}

type AdminTab = 'criteria' | 'departments' | 'classes' | 'users' | 'semesters';

const TAB_CONFIG: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'criteria', label: 'Tiêu chí', icon: <ListTree size={18} /> },
  { id: 'departments', label: 'Khoa', icon: <Building2 size={18} /> },
  { id: 'classes', label: 'Lớp', icon: <GraduationCap size={18} /> },
  { id: 'users', label: 'Người dùng', icon: <UserPlus size={18} /> },
  { id: 'semesters', label: 'Học kỳ', icon: <CalendarDays size={18} /> },
];

export default function AdminPage() {
  return (
    <Suspense fallback={<DashboardLayout pageTitle="Quản trị hệ thống"><p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Đang tải...</p></DashboardLayout>}>
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as AdminTab | null;

  const [activeTab, setActiveTab] = useState<AdminTab>(tabParam || 'criteria');
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCriterion, setEditingCriterion] = useState<Criterion | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newMaxPoints, setNewMaxPoints] = useState('0');
  const [newParentId, setNewParentId] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatMaxScore, setNewCatMaxScore] = useState('0');

  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === 'SCHOOL_ADMIN';

  // Sync tab from URL
  useEffect(() => { if (tabParam && TAB_CONFIG.some(t => t.id === tabParam)) setActiveTab(tabParam); }, [tabParam]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/criteria');
      if (res.ok) { const json = await res.json(); setCriteria(json.data || []); setCategories(json.categories || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isAdmin && activeTab === 'criteria') fetchData(); }, [isAdmin, fetchData, activeTab]);

  const handleSaveCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCriterion) return;
    try {
      const res = await fetch('/api/admin/criteria', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingCriterion) });
      const data = await res.json();
      if (res.ok) { alert(data.message); setEditingCriterion(null); fetchData(); } else { alert(data.message); }
    } catch { alert('Lỗi khi sửa tiêu chí'); }
  };

  const handleAddCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newContent) return alert('Nhập đầy đủ mã và nội dung');
    try {
      const res = await fetch('/api/admin/criteria', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCode, content: newContent, max_points: parseFloat(newMaxPoints) || 0, parent_id: newParentId ? parseInt(newParentId) : null, category_id: newCategoryId || (categories[0]?.id || '') })
      });
      const data = await res.json();
      if (res.ok) { alert(data.message); setNewCode(''); setNewContent(''); setNewMaxPoints('0'); setNewParentId(''); setShowAddForm(false); fetchData(); } else { alert(data.message); }
    } catch { alert('Lỗi khi thêm tiêu chí'); }
  };

  const handleDeleteCriterion = async (id: number, code: string) => {
    if (!confirm(`Xác nhận xóa tiêu chí "${code}"?`)) return;
    try {
      const res = await fetch('/api/admin/criteria', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const data = await res.json(); alert(data.message);
      if (res.ok) fetchData();
    } catch { alert('Lỗi khi xóa tiêu chí'); }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatCode || !newCatName) return alert('Nhập đầy đủ mã và tên mục');
    try {
      const res = await fetch('/api/admin/criteria', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _type: 'category', code: newCatCode, name: newCatName, max_score: parseFloat(newCatMaxScore) || 0 })
      });
      const data = await res.json();
      if (res.ok) { alert(data.message); setNewCatCode(''); setNewCatName(''); setNewCatMaxScore('0'); setShowAddCategoryForm(false); fetchData(); } else { alert(data.message); }
    } catch { alert('Lỗi khi thêm mục'); }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Xác nhận xóa mục "${name}"? Tất cả tiêu chí trong mục này cũng sẽ bị xóa.`)) return;
    try {
      const res = await fetch('/api/admin/criteria', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _type: 'category', id }) });
      const data = await res.json(); alert(data.message);
      if (res.ok) fetchData();
    } catch { alert('Lỗi khi xóa mục'); }
  };

  if (!session) {
    return (
      <DashboardLayout pageTitle="Quản trị hệ thống" pageSubtitle="Quản lý toàn bộ hệ thống chấm điểm">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Đang tải...</p>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout pageTitle="Quản trị hệ thống">
        <div className="dashboard-card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 16 }}>Không có quyền truy cập!</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>Bạn cần quyền quản trị viên để xem trang này.</p>
        </div>
      </DashboardLayout>
    );
  }

  const criteriaByCategory: Record<string, Criterion[]> = {};
  criteria.forEach((c) => {
    if (!criteriaByCategory[c.category_id]) criteriaByCategory[c.category_id] = [];
    criteriaByCategory[c.category_id].push(c);
  });

  return (
    <DashboardLayout pageTitle="Quản trị hệ thống" pageSubtitle="Quản lý toàn bộ hệ thống chấm điểm">
      {/* Tab navigation */}
      <div className="admin-tabs">
        {TAB_CONFIG.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}>
            <span style={{ marginRight: 6 }}>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'departments' && <DepartmentsTab />}
      {activeTab === 'classes' && <ClassesTab />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'semesters' && <SemestersTab />}

      {activeTab === 'criteria' && (
        loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Đang tải dữ liệu...</p>
        ) : (
          <div>
            <div className="dashboard-card-header" style={{ marginBottom: 20 }}>
              <h2 className="dashboard-card-title">Quản lý Tiêu Chí Chấm Điểm</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAddCategoryForm(!showAddCategoryForm)} className="btn-secondary">
                  {showAddCategoryForm ? 'Đóng' : '+ Thêm mục'}
                </button>
                <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
                  {showAddForm ? 'Đóng' : '+ Thêm tiêu chí'}
                </button>
              </div>
            </div>

            {showAddCategoryForm && (
              <form onSubmit={handleAddCategory} className="dashboard-card" style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Thêm mục mới</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <input type="text" placeholder="Mã mục (VD: 7)" value={newCatCode} onChange={(e) => setNewCatCode(e.target.value)} className="form-input" style={{ flex: '0 0 140px' }} />
                  <input type="text" placeholder="Tên mục" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="form-input" style={{ flex: 1, minWidth: 200 }} />
                  <input type="number" step="0.1" placeholder="Điểm" value={newCatMaxScore} onChange={(e) => setNewCatMaxScore(e.target.value)} className="form-input" style={{ flex: '0 0 120px' }} />
                  <button type="submit" className="btn-primary">Thêm</button>
                </div>
              </form>
            )}

            {showAddForm && (
              <form onSubmit={handleAddCriterion} className="dashboard-card" style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Thêm tiêu chí mới</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <input type="text" placeholder="Mã tiêu chí (VD: 1.2.3)" value={newCode} onChange={(e) => setNewCode(e.target.value)} className="form-input" />
                  <input type="number" step="0.1" placeholder="Điểm" value={newMaxPoints} onChange={(e) => setNewMaxPoints(e.target.value)} className="form-input" />
                  <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)} className="form-select">
                    <option value="">-- Chọn mục --</option>
                    {categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.code} - {cat.name}</option>))}
                  </select>
                  <input type="number" placeholder="Parent ID (để trống nếu là gốc)" value={newParentId} onChange={(e) => setNewParentId(e.target.value)} className="form-input" />
                </div>
                <textarea placeholder="Nội dung tiêu chí" value={newContent} onChange={(e) => setNewContent(e.target.value)} className="form-input" style={{ minHeight: 60, marginBottom: 12 }} />
                <button type="submit" className="btn-primary">Thêm tiêu chí</button>
              </form>
            )}

            {categories.map((cat) => (
              <div key={cat.id} className="dashboard-card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-inset)', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 13 }}>[{cat.code}]</span>
                    <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{cat.name}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>(Điểm: {cat.max_score} điểm)</span>
                  </div>
                  <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="btn-danger" style={{ padding: '4px 12px', fontSize: 11 }}>Xóa mục</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="dashboard-table">
                    <thead><tr>
                      <th style={{ width: 60 }}>ID</th><th style={{ width: 100 }}>Mã</th><th>Nội dung</th>
                      <th style={{ width: 90, textAlign: 'center' }}>Điểm</th><th style={{ width: 80, textAlign: 'center' }}>Parent</th>
                      <th style={{ width: 120, textAlign: 'center' }}>Thao tác</th>
                    </tr></thead>
                    <tbody>
                      {(criteriaByCategory[cat.id] || []).map((item) => (
                        <tr key={item.id}>
                          <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{item.id}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{item.code}</td>
                          <td style={{ maxWidth: 400 }}><span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.content}</span></td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>{item.max_points}</td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{item.parent_id || '-'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button onClick={() => setEditingCriterion(item)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>Sửa</button>
                              <button onClick={() => handleDeleteCriterion(item.id, item.code)} className="btn-danger" style={{ padding: '4px 10px', fontSize: 11 }}>Xóa</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!(criteriaByCategory[cat.id] || []).length && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24, fontSize: 13 }}>Chưa có tiêu chí</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Edit Modal */}
      {editingCriterion && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-header-title">Sửa tiêu chí [{editingCriterion.code}]</h3>
              <button onClick={() => setEditingCriterion(null)} className="modal-close-btn">✕</button>
            </div>
            <form onSubmit={handleSaveCriterion}>
              <div className="modal-body">
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Mã tiêu chí</label>
                  <input type="text" value={editingCriterion.code} onChange={(e) => setEditingCriterion({ ...editingCriterion, code: e.target.value })} className="form-input" />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Nội dung</label>
                  <textarea value={editingCriterion.content} onChange={(e) => setEditingCriterion({ ...editingCriterion, content: e.target.value })} className="form-input" style={{ minHeight: 100 }} />
                </div>
                <div>
                  <label className="form-label">Điểm</label>
                  <input type="number" step="0.1" min="0" value={editingCriterion.max_points} onChange={(e) => setEditingCriterion({ ...editingCriterion, max_points: parseFloat(e.target.value) || 0 })} className="form-input" style={{ fontWeight: 600 }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setEditingCriterion(null)} className="btn-secondary">Hủy</button>
                <button type="submit" className="btn-primary">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
