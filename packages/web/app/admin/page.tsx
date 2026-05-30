'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '../components/DashboardLayout';
import { useSession } from 'next-auth/react';

import { UsersTab } from './UsersTab';
import { SemestersTab } from './SemestersTab';
import { DepartmentsTab } from './DepartmentsTab';
import { ClassesTab } from './ClassesTab';
import { AdminDashboardTab } from './AdminDashboardTab';
import { AdminStudentsTab } from './AdminStudentsTab';

interface Category {
  id: string; code: string; name: string; max_score: number; sort_order: number;
}

interface Criterion {
  id: number; code: string; content: string; max_points: number; parent_id: number | null; category_id: string; is_active: number;
}

type AdminTab = 'criteria' | 'departments' | 'classes' | 'users' | 'semesters' | 'dashboard' | 'students';

export default function AdminPage() {
  return (
    <Suspense fallback={
      <DashboardLayout pageTitle="Quản trị hệ thống" pageSubtitle="Đang tải dữ liệu...">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#5e6ad2', animation: 'spin 0.7s linear infinite' }} />
        </div>
      </DashboardLayout>
    }>
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as AdminTab | null;

  const activeTab: AdminTab = tabParam || 'criteria';
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCriterion, setEditingCriterion] = useState<Criterion | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
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

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      const res = await fetch('/api/admin/criteria', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _type: 'category', id: editingCategory.id, code: editingCategory.code, name: editingCategory.name, max_score: editingCategory.max_score }) });
      const data = await res.json();
      if (res.ok) { alert(data.message); setEditingCategory(null); fetchData(); } else { alert(data.message); }
    } catch { alert('Lỗi khi sửa mục'); }
  };

  const handleAddCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newContent) return alert('Vui lòng nhập đầy đủ mã và nội dung');
    try {
      const res = await fetch('/api/admin/criteria', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: newCode, content: newContent, max_points: parseFloat(newMaxPoints) || 0, parent_id: newParentId ? parseInt(newParentId) : null, category_id: newCategoryId || (categories[0]?.id || '') }) });
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
    if (!newCatCode || !newCatName) return alert('Vui lòng nhập đầy đủ mã và tên mục');
    try {
      const res = await fetch('/api/admin/criteria', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _type: 'category', code: newCatCode, name: newCatName, max_score: parseFloat(newCatMaxScore) || 0 }) });
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

  if (!session) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#5e6ad2', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );
  if (!isAdmin) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ padding: 32, textAlign: 'center', color: '#dc2626', fontWeight: 700, background: '#fff', borderRadius: 16, border: '1px solid #fecaca' }}>
        Bạn không có quyền truy cập trang này!
      </div>
    </div>
  );

  // Group criteria by category
  const criteriaByCategory: Record<string, Criterion[]> = {};
  criteria.forEach((c) => { if (!criteriaByCategory[c.category_id]) criteriaByCategory[c.category_id] = []; criteriaByCategory[c.category_id].push(c); });

  return (
    <DashboardLayout pageTitle="Quản trị Hệ thống" pageSubtitle="Quản lý cấu hình hệ thống đánh giá rèn luyện">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {activeTab === 'dashboard' && <AdminDashboardTab />}
        {activeTab === 'students' && <AdminStudentsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'departments' && <DepartmentsTab />}
        {activeTab === 'classes' && <ClassesTab />}
        {activeTab === 'semesters' && <SemestersTab />}

        {activeTab === 'criteria' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin"></div>
                  <span className="text-sky-600 text-sm">Đang tải dữ liệu...</span>
                </div>
              </div>
            ) : (
              <div>
                <div className="dashboard-card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Quản lý Tiêu Chí Chấm Điểm</h2>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={() => setShowAddCategoryForm(!showAddCategoryForm)}
                      className="btn-secondary"
                    >
                      {showAddCategoryForm ? 'Đóng' : '+ Thêm mục mới'}
                    </button>
                    <button
                      onClick={() => setShowAddForm(!showAddForm)}
                      className="btn-primary"
                    >
                      {showAddForm ? 'Đóng' : '+ Thêm tiêu chí'}
                    </button>
                  </div>
                </div>

                {/* Add category form */}
                {showAddCategoryForm && (
                  <form onSubmit={handleAddCategory} className="dashboard-card" style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Thêm mục lớn mới</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      <input type="text" placeholder="Số thứ tự (VD: 1, 2, 3...)" value={newCatCode} onChange={(e) => setNewCatCode(e.target.value)} className="form-input" style={{ width: 200 }} />
                      <input type="text" placeholder="Tên mục" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="form-input" style={{ flex: 1, minWidth: 250 }} />
                      <input type="number" step="0.1" placeholder="Điểm tối đa" value={newCatMaxScore} onChange={(e) => setNewCatMaxScore(e.target.value)} className="form-input" style={{ width: 150 }} />
                      <button type="submit" className="btn-primary">Lưu mục lớn</button>
                    </div>
                  </form>
                )}

                {/* Add criterion form */}
                {showAddForm && (
                  <form onSubmit={handleAddCriterion} className="dashboard-card" style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Thêm tiêu chí mới</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 16 }}>
                      <div>
                        <label className="form-label">Mã tiêu chí *</label>
                        <input type="text" placeholder="VD: 1.1 hoặc 1.1.1" value={newCode} onChange={(e) => setNewCode(e.target.value)} className="form-input" />
                      </div>
                      <div>
                        <label className="form-label">Điểm tối đa *</label>
                        <input type="number" step="0.1" placeholder="Nhập số điểm..." value={newMaxPoints} onChange={(e) => setNewMaxPoints(e.target.value)} className="form-input" />
                      </div>
                      <div>
                        <label className="form-label">Thuộc mục lớn *</label>
                        <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)} className="form-select">
                          <option value="">-- Vui lòng chọn mục lớn --</option>
                          {categories.map((cat) => <option key={cat.id} value={cat.id}>Mục {cat.code.replace(/CAT/i, '')} - {cat.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Tiêu chí cha</label>
                        <select value={newParentId} onChange={(e) => setNewParentId(e.target.value)} className="form-select">
                          <option value="">-- Không có (Tiêu chí gốc) --</option>
                          {newCategoryId && (criteriaByCategory[newCategoryId] || []).map((c) => <option key={c.id} value={c.id}>{c.code} - {c.content.substring(0, 40)}...</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label className="form-label">Nội dung đánh giá *</label>
                      <textarea placeholder="Nhập chi tiết nội dung tiêu chí..." value={newContent} onChange={(e) => setNewContent(e.target.value)} className="form-input" style={{ minHeight: 80, resize: 'vertical' }} />
                    </div>
                    <button type="submit" className="btn-primary">Lưu tiêu chí</button>
                  </form>
                )}

                {/* Categories & Criteria */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>
                  {categories.map((cat) => (
                    <div key={cat.id} className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', backgroundColor: '#eff6ff', padding: '4px 8px', borderRadius: 6, fontSize: 13 }}>Mục {cat.code.replace(/CAT/i, '')}</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{cat.name}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: 4, background: '#fff' }}>(Tối đa: {cat.max_score} đ)</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setEditingCategory(cat)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Sửa mục</button>
                          <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="btn-danger" style={{ padding: '6px 12px', fontSize: 12 }}>Xóa mục</button>
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 700 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
                              <th style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, width: 80 }}>Mã</th>
                              <th style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Nội dung đánh giá</th>
                              <th style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, width: 100, textAlign: 'center' }}>Điểm</th>
                              <th style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, width: 120, textAlign: 'center' }}>Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(criteriaByCategory[cat.id] || []).map((item) => (
                              <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>{item.code}</td>
                                <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-primary)' }}>{item.content}</td>
                                <td style={{ padding: '12px 20px', textAlign: 'center' }}><span style={{ fontWeight: 700, backgroundColor: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: 6, fontSize: 12 }}>{item.max_points}</span></td>
                                <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                    <button onClick={() => setEditingCriterion(item)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>Sửa</button>
                                    <button onClick={() => handleDeleteCriterion(item.id, item.code)} className="btn-danger" style={{ padding: '4px 10px', fontSize: 11 }}>Xóa</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {!(criteriaByCategory[cat.id] || []).length && (
                              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm font-medium bg-gray-50/50">Chưa có tiêu chí nào trong mục này.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editingCriterion && (
        <div className="fixed inset-0 bg-sky-900/30 backdrop-blur-sm z-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-sky-100 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-sky-50 bg-sky-50/30 flex justify-between items-center">
              <h3 className="font-bold text-sky-800 text-lg">Sửa tiêu chí <span className="bg-sky-100 px-2 py-0.5 rounded text-sky-600">{editingCriterion.code}</span></h3>
              <button onClick={() => setEditingCriterion(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <form onSubmit={handleSaveCriterion} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Mã tiêu chí</label>
                <input type="text" value={editingCriterion.code}
                  onChange={(e) => setEditingCriterion({ ...editingCriterion, code: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Nội dung</label>
                <textarea value={editingCriterion.content}
                  onChange={(e) => setEditingCriterion({ ...editingCriterion, content: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all min-h-[120px]" />
              </div>
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Điểm tối đa</label>
                <input type="number" step="0.1" min="0" value={editingCriterion.max_points}
                  onChange={(e) => setEditingCriterion({ ...editingCriterion, max_points: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all font-bold text-sky-700 bg-sky-50" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingCriterion(null)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Hủy bỏ</button>
                <button type="submit" className="px-6 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-sm rounded-xl transition-colors">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 bg-sky-900/30 backdrop-blur-sm z-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-sky-100 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-sky-50 bg-sky-50/30 flex justify-between items-center">
              <h3 className="font-bold text-sky-800 text-lg">Sửa mục <span className="bg-sky-100 px-2 py-0.5 rounded text-sky-600">{editingCategory.code}</span></h3>
              <button onClick={() => setEditingCategory(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Mã mục</label>
                <input type="text" value={editingCategory.code}
                  onChange={(e) => setEditingCategory({ ...editingCategory, code: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Tên mục</label>
                <input type="text" value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all" />
              </div>
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Điểm tối đa</label>
                <input type="number" step="0.1" min="0" value={editingCategory.max_score}
                  onChange={(e) => setEditingCategory({ ...editingCategory, max_score: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all font-bold text-sky-700 bg-sky-50" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingCategory(null)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Hủy bỏ</button>
                <button type="submit" className="px-6 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-sm rounded-xl transition-colors">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
