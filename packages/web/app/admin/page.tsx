'use client';

import React, { useState, useEffect } from 'react';
import { UserMenu } from '../components/UserMenu';
import { useSession } from 'next-auth/react';

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
      if (res.ok) {
        alert(data.message);
        setEditingCriterion(null);
        fetchData();
      } else {
        alert(data.message);
      }
    } catch {
      alert('Loi khi sua tieu chi');
    }
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
      alert('Loi khi them tieu chi');
    }
  };

  const handleDeleteCriterion = async (id: number, code: string) => {
    if (!confirm(`Xác nhận xóa tiêu chí "${code}"?`)) return;
    try {
      const res = await fetch('/api/admin/criteria', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const data = await res.json(); alert(data.message);
      if (res.ok) fetchData();
    } catch {
      alert('Loi khi xoa tieu chi');
    }
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
      alert('Loi khi them muc');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Xác nhận xóa mục "${name}"? Tất cả tiêu chí trong mục này cũng sẽ bị xóa.`)) return;
    try {
      const res = await fetch('/api/admin/criteria', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _type: 'category', id }) });
      const data = await res.json(); alert(data.message);
      if (res.ok) fetchData();
    } catch {
      alert('Loi khi xoa muc');
    }
  };

  if (!session) return <div className="p-8 text-center text-gray-500">Dang tai...</div>;
  if (!isAdmin) return <div className="p-8 text-center text-black font-bold">Loi: Khong co quyen truy cap!</div>;

  // Group criteria by category
  const criteriaByCategory: Record<string, Criterion[]> = {};
  criteria.forEach((c) => {
    if (!criteriaByCategory[c.category_id]) criteriaByCategory[c.category_id] = [];
    criteriaByCategory[c.category_id].push(c);
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-black">Trang Quan Tri He Thong</h1>
          <p className="text-sm text-gray-500">Quan ly cau hinh tieu chi cham diem</p>
        </div>
        <UserMenu />
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {loading ? (
          <p className="text-gray-500 text-center py-10">Dang tai du lieu...</p>
        ) : (
          <div>
            {/* Actions bar */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-black">Quan ly Tieu Chi Cham Diem</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddCategoryForm(!showAddCategoryForm)}
                  className="px-4 py-2 text-sm font-bold border border-gray-300 text-black hover:bg-gray-50"
                >
                  {showAddCategoryForm ? 'Dong' : 'Them muc'}
                </button>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-4 py-2 text-sm font-bold bg-black text-white hover:bg-gray-800"
                >
                  {showAddForm ? 'Dong' : 'Them tieu chi'}
                </button>
              </div>
            </div>

            {/* Add category form */}
            {showAddCategoryForm && (
              <form onSubmit={handleAddCategory} className="mb-6 border border-gray-200 p-4 bg-gray-50">
                <h3 className="font-bold text-sm mb-3">Them muc moi</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input type="text" placeholder="Ma muc (VD: 7)" value={newCatCode} onChange={(e) => setNewCatCode(e.target.value)}
                    className="px-3 py-2 border border-gray-300 text-sm outline-none focus:border-black" />
                  <input type="text" placeholder="Ten muc" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                    className="px-3 py-2 border border-gray-300 text-sm flex-1 outline-none focus:border-black" />
                  <input type="number" step="0.1" placeholder="Diem toi da" value={newCatMaxScore} onChange={(e) => setNewCatMaxScore(e.target.value)}
                    className="px-3 py-2 border border-gray-300 text-sm w-32 outline-none focus:border-black" />
                  <button type="submit" className="px-4 py-2 bg-black text-white text-sm font-bold hover:bg-gray-800">THEM</button>
                </div>
              </form>
            )}

            {/* Add criterion form */}
            {showAddForm && (
              <form onSubmit={handleAddCriterion} className="mb-6 border border-gray-200 p-4 bg-gray-50">
                <h3 className="font-bold text-sm mb-3">Them tieu chi moi</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <input type="text" placeholder="Ma tieu chi (VD: 1.2.3)" value={newCode} onChange={(e) => setNewCode(e.target.value)}
                    className="px-3 py-2 border border-gray-300 text-sm outline-none focus:border-black" />
                  <input type="number" step="0.1" placeholder="Diem toi da" value={newMaxPoints} onChange={(e) => setNewMaxPoints(e.target.value)}
                    className="px-3 py-2 border border-gray-300 text-sm outline-none focus:border-black" />
                  <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)}
                    className="px-3 py-2 border border-gray-300 text-sm outline-none focus:border-black">
                    <option value="">-- Chon muc --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.code} - {cat.name}</option>
                    ))}
                  </select>
                  <input type="number" placeholder="Parent ID (de trong neu la goc)" value={newParentId} onChange={(e) => setNewParentId(e.target.value)}
                    className="px-3 py-2 border border-gray-300 text-sm outline-none focus:border-black" />
                </div>
                <textarea placeholder="Noi dung tieu chi" value={newContent} onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 text-sm outline-none focus:border-black mb-3 min-h-[60px]" />
                <button type="submit" className="px-4 py-2 bg-black text-white text-sm font-bold hover:bg-gray-800">THEM TIEU CHI</button>
              </form>
            )}

            {/* Categories & Criteria */}
            {categories.map((cat) => (
              <div key={cat.id} className="mb-6 border border-gray-200">
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                  <div>
                    <span className="font-bold text-black text-sm">[{cat.code}]</span>
                    <span className="ml-2 text-sm text-gray-700">{cat.name}</span>
                    <span className="ml-2 text-xs text-gray-400">(Toi da: {cat.max_score} diem)</span>
                  </div>
                  <button onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="text-xs px-3 py-1 border border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-black">
                    Xoa muc
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-white text-gray-500 text-xs uppercase border-b border-gray-200">
                        <th className="px-4 py-2 w-16">ID</th>
                        <th className="px-4 py-2 w-24">Ma</th>
                        <th className="px-4 py-2">Noi dung</th>
                        <th className="px-4 py-2 w-24 text-center">Diem max</th>
                        <th className="px-4 py-2 w-20 text-center">Parent</th>
                        <th className="px-4 py-2 w-32 text-center">Thao tac</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(criteriaByCategory[cat.id] || []).map((item) => (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-400 text-xs">{item.id}</td>
                          <td className="px-4 py-2 font-mono font-bold text-black">{item.code}</td>
                          <td className="px-4 py-2 text-gray-700 max-w-md" title={item.content}>
                            <span className="line-clamp-2">{item.content}</span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className="font-bold text-black">{item.max_points}</span>
                          </td>
                          <td className="px-4 py-2 text-center text-gray-400 text-xs">
                            {item.parent_id || '-'}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => setEditingCriterion(item)}
                                className="text-xs px-2 py-1 border border-gray-300 text-black hover:bg-gray-100 font-bold">
                                Sua
                              </button>
                              <button onClick={() => handleDeleteCriterion(item.id, item.code)}
                                className="text-xs px-2 py-1 border border-gray-300 text-gray-600 hover:bg-gray-100">
                                Xoa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!(criteriaByCategory[cat.id] || []).length && (
                        <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-400 text-sm">Chua co tieu chi</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingCriterion && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-black">Sua tieu chi [{editingCriterion.code}]</h3>
              <button onClick={() => setEditingCriterion(null)} className="text-gray-400 hover:text-black text-lg font-bold">X</button>
            </div>
            <form onSubmit={handleSaveCriterion} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-bold text-black mb-1">Ma tieu chi</label>
                <input type="text" value={editingCriterion.code}
                  onChange={(e) => setEditingCriterion({ ...editingCriterion, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 text-sm outline-none focus:border-black" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold text-black mb-1">Noi dung</label>
                <textarea value={editingCriterion.content}
                  onChange={(e) => setEditingCriterion({ ...editingCriterion, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 text-sm outline-none focus:border-black min-h-[100px]" />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-bold text-black mb-1">Diem toi da</label>
                <input type="number" step="0.1" min="0" value={editingCriterion.max_points}
                  onChange={(e) => setEditingCriterion({ ...editingCriterion, max_points: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 text-sm outline-none focus:border-black font-bold" />
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
