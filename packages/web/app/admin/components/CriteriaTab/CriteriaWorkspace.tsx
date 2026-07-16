import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, CheckCircle2, Lock, Eye } from 'lucide-react';
import { CriteriaTree } from './CriteriaTree';
import { CriteriaDetailPanel } from './CriteriaDetailPanel';
import { StudentCriteriaPreview } from './StudentCriteriaPreview';
import type { CriteriaVersion, Category, Criterion, CriteriaSelection } from './types';

interface CriteriaWorkspaceProps {
  version: CriteriaVersion;
  onClose: () => void;
}

export function CriteriaWorkspace({ version, onClose }: CriteriaWorkspaceProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);

  const [selectedItem, setSelectedItem] = useState<CriteriaSelection | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/criteria?versionId=${version.id}`);
      if (res.ok) {
        const json = await res.json();
        setCategories(json.categories || []);
        setCriteria(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [version.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateNewCategory = () => {
    setSelectedItem({ type: 'category', id: 'new' });
  };

  const handleCreateNewCriterion = () => {
    setSelectedItem({ type: 'criterion', id: 'new' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-3">
        <Loader2 className="w-8 h-8 text-[#d0d6e0] animate-spin" />
        <span className="text-[#62666d] text-[15px] font-[510]">Đang tải dữ liệu không gian làm việc...</span>
      </div>
    );
  }

  if (previewMode) {
    return (
      <StudentCriteriaPreview 
        version={version}
        categories={categories}
        criteria={criteria}
        onClose={() => setPreviewMode(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-h-[1000px] bg-white border border-[#E5E7EB] rounded-[12px] overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
      {/* Workspace Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-[#E5E7EB] bg-[#F8FAFC]">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-[6px] hover:bg-[#E2E8F0] text-[#64748B] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-[590] text-[#1F2937] leading-[1.2]">
                {version.name || version.semesters?.code || 'Bộ tiêu chí chưa đặt tên'}
              </h2>
              {version.is_active === 1 ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0] text-[11px] font-[590]">
                  <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                  ĐANG ÁP DỤNG
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] text-[11px] font-[590]">
                  <Lock className="w-3 h-3" strokeWidth={2.5} />
                  BẢN NHÁP
                </span>
              )}
            </div>
            <p className="text-[13px] text-[#64748B] font-[400] mt-0.5">
              Học kỳ áp dụng: {version.semesters?.name || 'Không có'} — {categories.length} nhóm, {criteria.length} tiêu chí
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setPreviewMode(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#F8FAFC] rounded-[6px] text-[14px] font-[510] transition-colors focus:ring-[3px] focus:ring-[#F1F5F9] outline-none"
          >
            <Eye className="w-4 h-4" strokeWidth={1.5} />
            Xem trước giao diện SV
          </button>
          <div className="w-[1px] h-6 bg-[#E2E8F0]"></div>
          <button 
            onClick={handleCreateNewCategory}
            className="px-4 py-2 bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#F8FAFC] rounded-[6px] text-[14px] font-[510] transition-colors focus:ring-[3px] focus:ring-[#F1F5F9] outline-none"
          >
            Thêm nhóm (Category)
          </button>
          <button 
            onClick={handleCreateNewCriterion}
            className="px-4 py-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-[6px] text-[14px] font-[510] transition-colors border border-transparent focus:ring-[3px] focus:ring-[#FEF2F2] outline-none"
          >
            Thêm tiêu chí
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Tree (60%) */}
        <div className="w-[60%] flex flex-col border-r border-[#E5E7EB] bg-[#F8FAFC] overflow-hidden">
          <div className="flex-1 overflow-auto p-4">
            <CriteriaTree 
              categories={categories} 
              criteria={criteria} 
              selectedItem={selectedItem}
              onSelect={setSelectedItem}
            />
          </div>
        </div>

        {/* Right Pane: Details (40%) */}
        <div className="w-[40%] bg-white flex flex-col overflow-auto relative">
          <CriteriaDetailPanel 
            versionId={version.id}
            selectedItem={selectedItem}
            categories={categories}
            criteria={criteria}
            onSaved={(saved: CriteriaSelection) => {
              fetchData();
              setSelectedItem(saved);
            }}
            onDeleted={() => {
              fetchData();
              setSelectedItem(null);
            }}
            onCancel={() => setSelectedItem(null)}
          />
        </div>
      </div>
    </div>
  );
}
