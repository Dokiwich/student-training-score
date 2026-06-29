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

interface Category {
  id: string; code: string; name: string; max_score: number; sort_order: number;
}

interface Criterion {
  id: number; code: string; content: string; point: number; parent_id: number | null; category_id: string; is_active: number; sort_order: number;
}

type AdminTab = 'criteria' | 'departments' | 'classes' | 'users' | 'semesters' | 'dashboard';

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
  const [versions, setVersions] = useState<any[]>([]);
  const [activeVersion, setActiveVersion] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Preview popup
  const [previewVersion, setPreviewVersion] = useState<any>(null);
  const [previewCategories, setPreviewCategories] = useState<Category[]>([]);
  const [previewCriteria, setPreviewCriteria] = useState<Criterion[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Add/Edit Category popup
  const [showCategoryPopup, setShowCategoryPopup] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ code: '', name: '', max_score: '0', criteria_version_id: '' });

  // Add/Edit Criterion popup
  const [showCriterionPopup, setShowCriterionPopup] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<Criterion | null>(null);
  const [critForm, setCritForm] = useState({ code: '', content: '', point: '0', parent_id: '', category_id: '', criteria_version_id: '' });
  const [popupCategories, setPopupCategories] = useState<Category[]>([]);
  const [popupCriteria, setPopupCriteria] = useState<Criterion[]>([]);

  // Pre-Edit Popup
  const [showPreEditPopup, setShowPreEditPopup] = useState(false);
  const [preEditTab, setPreEditTab] = useState<'edit' | 'create'>('edit');
  const [selectedVersionToEdit, setSelectedVersionToEdit] = useState('');
  const [newVersionSemester, setNewVersionSemester] = useState('');
  const [newVersionSource, setNewVersionSource] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [semestersList, setSemestersList] = useState<any[]>([]);

  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === 'SCHOOL_ADMIN';

  // Fetch versions list
  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/criteria');
      if (res.ok) {
        const json = await res.json();
        setVersions(json.versions || []);
        setActiveVersion(json.activeVersion || null);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const fetchSemesters = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/semesters');
      if (res.ok) {
        const json = await res.json();
        setSemestersList(json.data || []);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (isAdmin && activeTab === 'criteria') {
      fetchVersions();
      fetchSemesters();
    }
  }, [isAdmin, fetchVersions, fetchSemesters, activeTab]);

  // Fetch data for a specific version (for preview or popup category list)
  const fetchVersionData = useCallback(async (versionId: string) => {
    const res = await fetch(`/api/admin/criteria?versionId=${versionId}`);
    if (res.ok) {
      const json = await res.json();
      return { categories: json.categories || [], criteria: json.data || [] };
    }
    return { categories: [], criteria: [] };
  }, []);

  // Open preview popup
  const openPreview = async (version: any) => {
    setPreviewVersion(version);
    setPreviewLoading(true);
    const data = await fetchVersionData(version.id);
    setPreviewCategories(data.categories);
    setPreviewCriteria(data.criteria);
    setPreviewLoading(false);
  };

  // Load categories for popup when version changes
  const loadPopupCategories = useCallback(async (versionId: string) => {
    if (!versionId) { setPopupCategories([]); setPopupCriteria([]); return; }
    const data = await fetchVersionData(versionId);
    setPopupCategories(data.categories);
    setPopupCriteria(data.criteria);
  }, [fetchVersionData]);

  // Open Add Category popup
  const openAddCategory = () => {
    setEditingCategory(null);
    setCatForm({ code: '', name: '', max_score: '0', criteria_version_id: previewVersion?.id || versions[0]?.id || '' });
    setShowCategoryPopup(true);
  };

  // Open Edit Category popup
  const openEditCategory = (cat: Category, versionId: string) => {
    setEditingCategory(cat);
    setCatForm({ code: cat.code, name: cat.name, max_score: String(cat.max_score), criteria_version_id: versionId });
    setShowCategoryPopup(true);
  };

  // Open Add Criterion popup
  const openAddCriterion = () => {
    setEditingCriterion(null);
    const defaultVid = previewVersion?.id || versions[0]?.id || '';
    setCritForm({ code: '', content: '', point: '0', parent_id: '', category_id: '', criteria_version_id: defaultVid });
    if (defaultVid) loadPopupCategories(defaultVid);
    setShowCriterionPopup(true);
  };

  // Open Edit Criterion popup
  const openEditCriterion = (item: Criterion, versionId: string) => {
    setEditingCriterion(item);
    setCritForm({
      code: item.code, content: item.content, point: String(item.point),
      parent_id: item.parent_id ? String(item.parent_id) : '', category_id: item.category_id,
      criteria_version_id: versionId,
    });
    loadPopupCategories(versionId);
    setShowCriterionPopup(true);
  };

  // Save Category (add or edit)
  const handleSaveCategory = async () => {
    if (!catForm.code || !catForm.name) return alert('Vui lòng nhập đầy đủ mã và tên mục');
    if (!catForm.criteria_version_id) return alert('Vui lòng chọn phiên bản');
    try {
      if (editingCategory) {
        const res = await fetch('/api/admin/criteria', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _type: 'category', id: editingCategory.id, code: catForm.code, name: catForm.name, max_score: catForm.max_score }) });
        const d = await res.json();
        if (res.ok) { alert(d.message); } else { alert(d.message); return; }
      } else {
        const res = await fetch('/api/admin/criteria', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _type: 'category', code: catForm.code, name: catForm.name, max_score: catForm.max_score, criteria_version_id: catForm.criteria_version_id }) });
        const d = await res.json();
        if (res.ok) { alert(d.message); } else { alert(d.message); return; }
      }
      setShowCategoryPopup(false);
      fetchVersions();
      if (previewVersion) openPreview(previewVersion);
    } catch { alert('Lỗi kết nối'); }
  };

  // Save Criterion (add or edit)
  const handleSaveCriterion = async () => {
    if (!critForm.code || !critForm.content) return alert('Vui lòng nhập đầy đủ mã và nội dung');
    if (!critForm.criteria_version_id) return alert('Vui lòng chọn phiên bản');
    if (!critForm.category_id) return alert('Vui lòng chọn mục lớn');
    try {
      if (editingCriterion) {
        const res = await fetch('/api/admin/criteria', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingCriterion.id, code: critForm.code, content: critForm.content, point: critForm.point, category_id: critForm.category_id, parent_id: critForm.parent_id || null }) });
        const d = await res.json();
        if (res.ok) { alert(d.message); } else { alert(d.message); return; }
      } else {
        const res = await fetch('/api/admin/criteria', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: critForm.code, content: critForm.content, point: critForm.point, parent_id: critForm.parent_id || null, category_id: critForm.category_id }) });
        const d = await res.json();
        if (res.ok) { alert(d.message); } else { alert(d.message); return; }
      }
      setShowCriterionPopup(false);
      fetchVersions();
      if (previewVersion) openPreview(previewVersion);
    } catch { alert('Lỗi kết nối'); }
  };

  // Delete
  const handleDeleteCriterion = async (id: number, code: string) => {
    if (!confirm(`Xác nhận xóa tiêu chí "${code}"?\n\nCẢNH BÁO: Hành động này sẽ XÓA VĨNH VIỄN cả tiêu chí này VÀ TOÀN BỘ các tiêu chí con thuộc về nó!`)) return;
    try {
      const res = await fetch('/api/admin/criteria', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const d = await res.json(); alert(d.message);
      if (res.ok) { fetchVersions(); if (previewVersion) openPreview(previewVersion); }
    } catch { alert('Lỗi khi xóa'); }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Xác nhận xóa mục "${name}"? Tất cả tiêu chí trong mục này cũng sẽ bị xóa.`)) return;
    try {
      const res = await fetch('/api/admin/criteria', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _type: 'category', id }) });
      const d = await res.json(); alert(d.message);
      if (res.ok) { fetchVersions(); if (previewVersion) openPreview(previewVersion); }
    } catch { alert('Lỗi khi xóa'); }
  };

  const toggleVersionStatus = async (e: React.MouseEvent, id: string, currentStatus: number) => {
    e.stopPropagation();
    const targetStatus = currentStatus === 1 ? 0 : 1;
    const actionName = targetStatus === 1 ? 'kích hoạt' : 'hủy kích hoạt';
    
    if (!confirm(`Bạn có chắc chắn muốn ${actionName} phiên bản này?`)) return;

    try {
      const res = await fetch('/api/admin/criteria', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _type: 'version', id, is_active: targetStatus })
      });
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.message || `Lỗi khi ${actionName} phiên bản`);
        return;
      }
      
      fetchVersions();
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối khi cập nhật trạng thái phiên bản');
    }
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

  // Group criteria by category and sort them in a tree structure for preview
  const previewByCategory: Record<string, Criterion[]> = {};
  const groupedCat: Record<string, Criterion[]> = {};
  previewCriteria.forEach((c) => {
    if (!groupedCat[c.category_id]) groupedCat[c.category_id] = [];
    groupedCat[c.category_id].push(c);
  });

  Object.keys(groupedCat).forEach(catId => {
    const list = groupedCat[catId];
    const childrenMap = new Map<number | null, Criterion[]>();
    const ids = new Set(list.map(c => c.id));
    
    list.forEach(c => {
      const pid = (!c.parent_id || !ids.has(c.parent_id)) ? null : c.parent_id;
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(c);
    });
    
    childrenMap.forEach(childList => {
      childList.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.code.localeCompare(b.code, undefined, { numeric: true }));
    });
    
    const sortedFlat: Criterion[] = [];
    const traverse = (pid: number | null) => {
      (childrenMap.get(pid) || []).forEach(c => {
        sortedFlat.push(c);
        traverse(c.id);
      });
    };
    traverse(null);
    previewByCategory[catId] = sortedFlat;
  });

  return (
    <DashboardLayout pageTitle="Quản trị Hệ thống" pageSubtitle="Quản lý cấu hình hệ thống đánh giá rèn luyện">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {activeTab === 'dashboard' && <AdminDashboardTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'departments' && <DepartmentsTab />}
        {activeTab === 'classes' && <ClassesTab />}
        {activeTab === 'semesters' && <SemestersTab />}

        {activeTab === 'criteria' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-4 border-red-100 border-t-red-500 animate-spin"></div>
                  <span className="text-red-600 text-sm">Đang tải dữ liệu...</span>
                </div>
              </div>
            ) : (
              <div>
                {/* Header */}
                <div className="dashboard-card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Quản lý Tiêu Chí Chấm Điểm</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{versions.length} phiên bản tiêu chí</p>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => {
                      setSelectedVersionToEdit(versions[0]?.id || '');
                      setShowPreEditPopup(true);
                    }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      Chỉnh sửa và Tạo
                    </button>
                  </div>
                </div>

                {/* Versions Grids - Split into Active and Inactive */}
                {versions.length === 0 ? (
                  <div className="dashboard-card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', opacity: 0.4 }}><path d="M9 12h6M12 9v6M3 12a9 9 0 1118 0 9 9 0 01-18 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <p style={{ fontWeight: 600, fontSize: 15 }}>Chưa có phiên bản tiêu chí nào</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {/* Active Versions Section */}
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#16a34a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        Đang áp dụng (Active)
                      </h3>
                      {versions.filter(v => v.is_active === 1).length === 0 ? (
                        <div style={{ padding: '20px', background: '#f8fafc', borderRadius: 12, color: '#64748b', fontSize: 14, textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                          Chưa có phiên bản nào đang áp dụng. Vui lòng kích hoạt một phiên bản bên dưới!
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                          {versions.filter(v => v.is_active === 1).map((v) => (
                            <div
                              key={v.id}
                              onClick={() => openPreview(v)}
                              style={{
                                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                                border: '2px solid #22c55e',
                                borderRadius: 16,
                                padding: 20,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                position: 'relative',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(34,197,94,0.15)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                              <div style={{ position: 'absolute', top: 12, right: 12 }}>
                                <button
                                  onClick={(e) => toggleVersionStatus(e, v.id, v.is_active)}
                                  style={{ background: '#fff', color: '#ef4444', border: '1px solid #fca5a5', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                >
                                  Hủy kích hoạt
                                </button>
                              </div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: '#166534', lineHeight: 1.2, marginBottom: 8, paddingRight: 80 }}>
                                {v.name || v.semesters?.code || 'Bộ tiêu chí chưa đặt tên'}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d', marginBottom: 4 }}>
                                Phiên bản mẫu
                              </div>
                              {v.semesters?.name && (
                                <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                  {v.semesters.name}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ height: 1, background: '#e2e8f0' }}></div>

                    {/* Inactive Versions Section */}
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#64748b', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        Chưa áp dụng / Bản nháp
                      </h3>
                      {versions.filter(v => v.is_active !== 1).length === 0 ? (
                        <div style={{ padding: '20px', background: '#f8fafc', borderRadius: 12, color: '#94a3b8', fontSize: 14, textAlign: 'center', border: '1px dashed #e2e8f0' }}>
                          Không có phiên bản nháp nào.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                          {versions.filter(v => v.is_active !== 1).map((v) => (
                            <div
                              key={v.id}
                              onClick={() => openPreview(v)}
                              style={{
                                background: '#fff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 16,
                                padding: 20,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                position: 'relative',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.06)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                              <div style={{ position: 'absolute', top: 12, right: 12 }}>
                                <button
                                  onClick={(e) => toggleVersionStatus(e, v.id, v.is_active)}
                                  style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                >
                                  Kích hoạt
                                </button>
                              </div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: '#334155', lineHeight: 1.2, marginBottom: 8, paddingRight: 80 }}>
                                {v.name || v.semesters?.code || 'Bộ tiêu chí chưa đặt tên'}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                                Phiên bản mẫu
                              </div>
                              {v.semesters?.name && (
                                <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                  {v.semesters.name}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ========== PRE-EDIT POPUP ========== */}
      {showPreEditPopup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-100 flex items-center justify-center p-4" onClick={() => setShowPreEditPopup(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Quản lý Bộ tiêu chí</h3>

            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
              <button
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${preEditTab === 'edit' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setPreEditTab('edit')}
              >Sửa bản có sẵn</button>
              <button
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${preEditTab === 'create' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setPreEditTab('create')}
              >Tạo bản mẫu mới</button>
            </div>

            {preEditTab === 'edit' ? (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Chọn bộ tiêu chí để chỉnh sửa</label>
                <select
                  value={selectedVersionToEdit}
                  onChange={e => setSelectedVersionToEdit(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm"
                >
                  <option value="">-- Chọn bộ tiêu chí --</option>
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>{v.name || v.semesters?.code || 'Bộ tiêu chí chưa đặt tên'}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tên bộ tiêu chí (Bắt buộc)</label>
                  <input
                    type="text"
                    value={newVersionSemester} // Using this state variable for 'name' to minimize diff
                    onChange={e => setNewVersionSemester(e.target.value)}
                    placeholder="VD: Bộ tiêu chí đánh giá rèn luyện năm 2024"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mô tả (Không bắt buộc)</label>
                  <textarea
                    value={newVersionSource} // Using this state variable for 'description'
                    onChange={e => setNewVersionSource(e.target.value)}
                    placeholder="Mô tả thêm về bộ tiêu chí này..."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm resize-none h-20"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowPreEditPopup(false)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm">Hủy</button>
              <button
                onClick={async () => {
                  if (preEditTab === 'edit') {
                    if (!selectedVersionToEdit) return alert('Vui lòng chọn phiên bản!');
                    const v = versions.find(x => x.id === selectedVersionToEdit);
                    if (v) openPreview(v);
                    setShowPreEditPopup(false);
                  } else {
                    if (!newVersionSemester) return alert('Vui lòng nhập tên bộ tiêu chí!');
                    setIsApplying(true);
                    try {
                      const res = await fetch('/api/admin/criteria-versions', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: newVersionSemester, description: newVersionSource })
                      });
                      const d = await res.json();
                      if (res.ok) {
                        alert(d.message);
                        setShowPreEditPopup(false);
                        setNewVersionSemester('');
                        setNewVersionSource('');
                        await fetchVersions();
                        const newVid = d.data?.id;
                        if (newVid) {
                          openPreview({ id: newVid, name: newVersionSemester });
                        }
                      } else {
                        alert(d.message);
                      }
                    } catch { alert('Lỗi kết nối'); }
                    finally { setIsApplying(false); }
                  }
                }}
                disabled={isApplying}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm flex items-center gap-2"
              >
                {isApplying ? 'Đang xử lý...' : 'Tiếp tục →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== PREVIEW / PROFESSIONAL EDITOR POPUP ========== */}
      {previewVersion && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-100 flex items-center justify-center p-4" onClick={() => setPreviewVersion(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(135deg, #fef2f2, #fff)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                  Chỉnh sửa: {previewVersion.name || previewVersion.semesters?.code || 'Bộ tiêu chí chưa đặt tên'}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={openAddCategory} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors">+ Thêm mục lớn</button>
                <button onClick={openAddCriterion} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">+ Thêm tiêu chí</button>
                <div style={{ width: 1, height: 24, background: '#e2e8f0', margin: '0 4px' }} />
                <button onClick={() => setPreviewVersion(null)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b', fontSize: 18, fontWeight: 700 }}>✕</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ overflow: 'auto', flex: 1, padding: '16px 24px 24px' }}>
              {previewLoading ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #fecaca', borderTopColor: '#ef4444', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
                  Đang tải...
                </div>
              ) : previewCategories.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontWeight: 500 }}>Phiên bản này chưa có dữ liệu tiêu chí.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {previewCategories.map((cat) => (
                    <div key={cat.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e2e8f0' }}>
                        <span style={{ fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '3px 8px', borderRadius: 6, fontSize: 12 }}>Mục {cat.code.replace(/CAT/i, '')}</span>
                        <span style={{ fontWeight: 600, fontSize: 14, color: '#334155' }}>{cat.name}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>Tối đa: {cat.max_score} đ</span>
                        <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
                          <button onClick={() => openEditCategory(cat, previewVersion.id)} className="text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded text-xs font-semibold">Sửa</button>
                          <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="text-red-600 hover:text-red-800 bg-red-50 px-2 py-1 rounded text-xs font-semibold">Xóa</button>
                        </div>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <th style={{ padding: '10px 16px', fontSize: 11, color: '#94a3b8', fontWeight: 600, textAlign: 'left', width: 70 }}>Mã</th>
                            <th style={{ padding: '10px 16px', fontSize: 11, color: '#94a3b8', fontWeight: 600, textAlign: 'left' }}>Nội dung đánh giá</th>
                            <th style={{ padding: '10px 16px', fontSize: 11, color: '#94a3b8', fontWeight: 600, textAlign: 'center', width: 60 }}>Điểm</th>
                            <th style={{ padding: '10px 16px', fontSize: 11, color: '#94a3b8', fontWeight: 600, textAlign: 'center', width: 100 }}>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(previewByCategory[cat.id] || []).map((item) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#dc2626' }}>{item.code}</td>
                              <td style={{ padding: '10px 16px', fontSize: 13, color: '#334155' }}>{item.content}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'center' }}><span style={{ fontWeight: 700, background: '#f1f5f9', padding: '3px 10px', borderRadius: 6, fontSize: 12 }}>{item.point}</span></td>
                              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: 6, justifyItems: 'center', justifyContent: 'center' }}>
                                  <button onClick={() => openEditCriterion(item, previewVersion.id)} className="text-blue-500 hover:text-blue-700 text-xs font-semibold">Sửa</button>
                                  <button onClick={() => handleDeleteCriterion(item.id, item.code)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Xóa</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {!(previewByCategory[cat.id] || []).length && (
                            <tr><td colSpan={4} style={{ padding: '20px 16px', textAlign: 'center', color: '#cbd5e1', fontSize: 13 }}>Chưa có tiêu chí nào</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== ADD/EDIT CATEGORY POPUP ========== */}
      {showCategoryPopup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-110 flex items-center justify-center p-4" onClick={() => setShowCategoryPopup(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#fef2f2' }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#991b1b', margin: 0 }}>{editingCategory ? 'Sửa mục lớn' : 'Thêm mục lớn mới'}</h3>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'none' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Phiên bản *</label>
                <select
                  value={catForm.criteria_version_id}
                  onChange={(e) => setCatForm({ ...catForm, criteria_version_id: e.target.value })}
                  disabled={true}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc' }}
                >
                  <option value="">-- Chọn phiên bản --</option>
                  {versions.map((v) => <option key={v.id} value={v.id}>Phiên bản {v.version}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Mã mục *</label>
                  <input type="text" placeholder="VD: 1, 2, 3..." value={catForm.code} onChange={(e) => setCatForm({ ...catForm, code: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Điểm tối đa</label>
                  <input type="number" step="0.1" min="0" value={catForm.max_score} onChange={(e) => setCatForm({ ...catForm, max_score: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', fontWeight: 700, color: '#dc2626' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Tên mục *</label>
                <input type="text" placeholder="VD: Ý thức học tập..." value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none' }} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowCategoryPopup(false)} style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#64748b', background: '#f1f5f9', border: 'none', borderRadius: 10, cursor: 'pointer' }}>Hủy bỏ</button>
              <button onClick={handleSaveCategory} style={{ padding: '10px 24px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 10, cursor: 'pointer' }}>{editingCategory ? 'Lưu thay đổi' : 'Thêm mục'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== ADD/EDIT CRITERION POPUP ========== */}
      {showCriterionPopup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-110 flex items-center justify-center p-4" onClick={() => setShowCriterionPopup(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#fef2f2' }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#991b1b', margin: 0 }}>{editingCriterion ? `Sửa tiêu chí ${editingCriterion.code}` : 'Thêm tiêu chí mới'}</h3>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '60vh', overflow: 'auto' }}>
              {/* Version */}
              <div style={{ display: 'none' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Phiên bản *</label>
                <select
                  value={critForm.criteria_version_id}
                  onChange={() => { }}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none' }}
                >
                  <option value="">-- Chọn phiên bản --</option>
                  {versions.map((v) => <option key={v.id} value={v.id}>Phiên bản {v.version}</option>)}
                </select>
              </div>
              {/* Category */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Thuộc mục lớn *</label>
                <select
                  value={critForm.category_id}
                  onChange={(e) => setCritForm({ ...critForm, category_id: e.target.value, parent_id: '' })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none' }}
                >
                  <option value="">-- Chọn mục lớn --</option>
                  {popupCategories.map((cat) => <option key={cat.id} value={cat.id}>Mục {cat.code.replace(/CAT/i, '')} - {cat.name}</option>)}
                </select>
              </div>
              {/* Code + Max points */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Mã tiêu chí *</label>
                  <input type="text" placeholder="VD: 1.1 hoặc 1.1.1" value={critForm.code} onChange={(e) => setCritForm({ ...critForm, code: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Điểm tối đa</label>
                  <input type="number" step="0.1" min="0" value={critForm.point} onChange={(e) => setCritForm({ ...critForm, point: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', fontWeight: 700, color: '#dc2626' }} />
                </div>
              </div>
              {/* Parent criterion */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Tiêu chí cha (tùy chọn)</label>
                <select
                  value={critForm.parent_id}
                  onChange={(e) => setCritForm({ ...critForm, parent_id: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none' }}
                >
                  <option value="">-- Không có (Tiêu chí gốc) --</option>
                  {critForm.category_id && popupCriteria.filter(c => c.category_id === critForm.category_id && c.id !== editingCriterion?.id).map((c) => <option key={c.id} value={c.id}>{c.code} - {c.content.substring(0, 40)}...</option>)}
                </select>
              </div>
              {/* Content */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Nội dung đánh giá *</label>
                <textarea placeholder="Nhập chi tiết nội dung tiêu chí..." value={critForm.content} onChange={(e) => setCritForm({ ...critForm, content: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', minHeight: 100, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowCriterionPopup(false)} style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#64748b', background: '#f1f5f9', border: 'none', borderRadius: 10, cursor: 'pointer' }}>Hủy bỏ</button>
              <button onClick={handleSaveCriterion} style={{ padding: '10px 24px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 10, cursor: 'pointer' }}>{editingCriterion ? 'Lưu thay đổi' : 'Thêm tiêu chí'}</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
