'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { UserMenu } from '../components/UserMenu';
import { DashboardLayout } from '../components/DashboardLayout';
import { useSession } from 'next-auth/react';
import { ListTree, Building2, GraduationCap, UserPlus, CalendarDays } from 'lucide-react';

import { UsersTab } from './UsersTab';
import { SemestersTab } from './SemestersTab';
import { DepartmentsTab } from './DepartmentsTab';
import { ClassesTab } from './ClassesTab';

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
    <Suspense fallback={
      <DashboardLayout pageTitle="Quản trị hệ thống" pageSubtitle="Đang tải dữ liệu...">
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin"></div>
            <span className="text-sky-600 text-sm">Đang tải dữ liệu...</span>
          </div>
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

  const [activeTab, setActiveTab] = useState<AdminTab>(tabParam || 'criteria');
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
      if (res.ok) {
        alert(data.message);
        setEditingCriterion(null);
        fetchData();
      } else {
        alert(data.message);
      }
    } catch {
      alert('Lỗi khi sửa tiêu chí');
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      const res = await fetch('/api/admin/criteria', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _type: 'category',
          id: editingCategory.id,
          code: editingCategory.code,
          name: editingCategory.name,
          max_score: editingCategory.max_score
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setEditingCategory(null);
        fetchData();
      } else {
        alert(data.message);
      }
    } catch {
      alert('Lỗi khi sửa mục');
    }
  };

  const handleAddCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newContent) return alert('Vui lòng nhập đầy đủ mã và nội dung');
    try {
      const res = await fetch('/api/admin/criteria', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCode, content: newContent, max_points: parseFloat(newMaxPoints) || 0, parent_id: newParentId ? parseInt(newParentId) : null, category_id: newCategoryId || (categories[0]?.id || '') })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setNewCode('');
        setNewContent('');
        setNewMaxPoints('0');
        setNewParentId('');
        setShowAddForm(false);
        fetchData();
      } else {
        alert(data.message);
      }
    } catch {
      alert('Lỗi khi thêm tiêu chí');
    }
  };

  const handleDeleteCriterion = async (id: number, code: string) => {
    if (!confirm(`Xác nhận xóa tiêu chí "${code}"?`)) return;
    try {
      const res = await fetch('/api/admin/criteria', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const data = await res.json(); alert(data.message);
      if (res.ok) fetchData();
    } catch {
      alert('Lỗi khi xóa tiêu chí');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatCode || !newCatName) return alert('Vui lòng nhập đầy đủ mã và tên mục');
    try {
      const res = await fetch('/api/admin/criteria', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _type: 'category', code: newCatCode, name: newCatName, max_score: parseFloat(newCatMaxScore) || 0 })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setNewCatCode('');
        setNewCatName('');
        setNewCatMaxScore('0');
        setShowAddCategoryForm(false);
        fetchData();
      } else {
        alert(data.message);
      }
    } catch {
      alert('Lỗi khi thêm mục');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Xác nhận xóa mục "${name}"? Tất cả tiêu chí trong mục này cũng sẽ bị xóa.`)) return;
    try {
      const res = await fetch('/api/admin/criteria', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _type: 'category', id }) });
      const data = await res.json(); alert(data.message);
      if (res.ok) fetchData();
    } catch {
      alert('Lỗi khi xóa mục');
    }
  };

  if (!session) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="w-10 h-10 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin"></div>
    </div>
  );
  if (!isAdmin) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="p-8 text-center text-red-600 font-bold bg-white rounded-2xl shadow-sm border border-red-100">
        Lỗi: Bạn không có quyền truy cập trang này!
      </div>
    </div>
  );

  // Group criteria by category
  const criteriaByCategory: Record<string, Criterion[]> = {};
  criteria.forEach((c) => {
    if (!criteriaByCategory[c.category_id]) criteriaByCategory[c.category_id] = [];
    criteriaByCategory[c.category_id].push(c);
  });

  return (
    <DashboardLayout pageTitle="Quản trị Hệ thống" pageSubtitle="Quản lý cấu hình tiêu chí chấm điểm">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
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
                {/* Actions bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <h2 className="text-xl font-bold text-gray-800">Quản lý Tiêu Chí Chấm Điểm</h2>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAddCategoryForm(!showAddCategoryForm)}
                      className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-sky-200 text-sky-700 hover:bg-sky-50 transition-colors shadow-sm"
                    >
                      {showAddCategoryForm ? 'Đóng' : 'Thêm mục mới'}
                    </button>
                    <button
                      onClick={() => setShowAddForm(!showAddForm)}
                      className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-sm"
                    >
                      {showAddForm ? 'Đóng' : 'Thêm tiêu chí'}
                    </button>
                  </div>
                </div>

                {/* Add category form */}
                {showAddCategoryForm && (
                  <form onSubmit={handleAddCategory} className="mb-8 border border-sky-100 rounded-2xl p-6 bg-white shadow-sm transition-all">
                    <h3 className="font-bold text-sky-800 text-lg mb-4">Thêm mục lớn mới</h3>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <input type="text" placeholder="Số thứ tự mục (VD: 1, 2, 3...)" value={newCatCode} onChange={(e) => setNewCatCode(e.target.value)}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all" />
                      <input type="text" placeholder="Tên mục" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm flex-1 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all" />
                      <input type="number" step="0.1" placeholder="Điểm" value={newCatMaxScore} onChange={(e) => setNewCatMaxScore(e.target.value)}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm w-32 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all" />
                      <button type="submit" className="px-6 py-2.5 bg-sky-600 text-white rounded-xl text-sm font-bold hover:bg-sky-700 transition-colors shadow-sm">THÊM MỤC</button>
                    </div>
                  </form>
                )}

                {/* Add criterion form */}
                {showAddForm && (
                  <form onSubmit={handleAddCriterion} className="mb-8 border border-sky-100 rounded-2xl p-6 bg-white shadow-sm transition-all">
                    <h3 className="font-bold text-sky-800 text-lg mb-4">Thêm tiêu chí mới</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Mã tiêu chí *</label>
                        <input type="text" placeholder="VD: 1.1 hoặc 1.1.1" value={newCode} onChange={(e) => setNewCode(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Điểm tối đa *</label>
                        <input type="number" step="0.1" placeholder="Nhập số điểm..." value={newMaxPoints} onChange={(e) => setNewMaxPoints(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Thuộc mục lớn *</label>
                        <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all">
                          <option value="">-- Vui lòng chọn mục lớn --</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>Mục {cat.code.replace(/CAT/i, '')} - {cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Tiêu chí cha (Chỉ chọn nếu đây là tiêu chí con)</label>
                        <select value={newParentId} onChange={(e) => setNewParentId(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all">
                          <option value="">-- Không có (Đây là tiêu chí gốc) --</option>
                          {newCategoryId && (criteriaByCategory[newCategoryId] || []).map((c) => (
                            <option key={c.id} value={c.id}>{c.code} - {c.content.substring(0, 40)}...</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Nội dung đánh giá *</label>
                      <textarea placeholder="Nhập chi tiết nội dung tiêu chí..." value={newContent} onChange={(e) => setNewContent(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all mb-4 min-h-[80px]" />
                    </div>
                    <button type="submit" className="px-6 py-2.5 bg-sky-600 text-white rounded-xl text-sm font-bold hover:bg-sky-700 transition-colors shadow-sm">THÊM TIÊU CHÍ</button>
                  </form>
                )}

                {/* Categories & Criteria */}
                <div className="space-y-6 pb-12">
                  {categories.map((cat) => (
                    <div key={cat.id} className="bg-white rounded-2xl border border-sky-100 shadow-sm overflow-hidden">
                      <div className="bg-sky-50/60 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-sky-100 gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sky-700 bg-sky-100 px-2 py-1 rounded-lg text-sm">Mục {cat.code.replace(/CAT/i, '')}</span>
                          <span className="font-semibold text-gray-800 text-sm">{cat.name}</span>
                          <span className="text-xs font-medium text-sky-600 bg-white px-2 py-1 rounded-md border border-sky-100">(Tối đa: {cat.max_score} điểm)</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingCategory(cat)}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-sky-200 text-sky-700 hover:bg-sky-50 transition-colors shrink-0">
                            Sửa mục này
                          </button>
                          <button onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors shrink-0">
                            Xóa mục này
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                          <thead>
                            <tr className="bg-white text-gray-500 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-100">
                              <th className="px-5 py-3 w-24">Mã</th>
                              <th className="px-5 py-3">Nội dung đánh giá</th>
                              <th className="px-5 py-3 w-28 text-center">Điểm</th>
                              <th className="px-5 py-3 w-36 text-center">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {(criteriaByCategory[cat.id] || []).map((item) => (
                              <tr key={item.id} className="hover:bg-sky-50/30 transition-colors group">
                                <td className="px-5 py-3 font-semibold text-sky-600 text-xs">{item.code}</td>
                                <td className="px-5 py-3 text-gray-700 max-w-md leading-relaxed" title={item.content}>
                                  <span className="line-clamp-2">{item.content}</span>
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <span className="font-bold text-gray-800 bg-gray-100 px-2.5 py-1 rounded-lg text-xs">{item.max_points}</span>
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <div className="flex gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingCriterion(item)}
                                      className="text-[11px] px-3 py-1.5 rounded-lg border border-sky-200 text-sky-700 font-semibold hover:bg-sky-50 transition-colors">
                                      Sửa
                                    </button>
                                    <button onClick={() => handleDeleteCriterion(item.id, item.code)}
                                      className="text-[11px] px-3 py-1.5 rounded-lg border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition-colors">
                                      Xóa
                                    </button>
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
        <div className="fixed inset-0 bg-sky-900/30 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
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
        <div className="fixed inset-0 bg-sky-900/30 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
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
