import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import type { Category, Criterion, CriteriaVersion } from './types';
import { buildCriteriaIdSet, isRootCriterion } from './types';

interface StudentCriteriaPreviewProps {
  version: CriteriaVersion;
  categories: Category[];
  criteria: Criterion[];
  onClose: () => void;
}

export function StudentCriteriaPreview({ version, categories, criteria, onClose }: StudentCriteriaPreviewProps) {
  // Fix SMELL-7: Avoid Set([undefined]) if categories is empty
  const [expandedTabs, setExpandedTabs] = useState<Set<string>>(() => {
    const initialSet = new Set<string>();
    if (categories.length > 0) {
      initialSet.add(categories[0].id);
    }
    return initialSet;
  });

  const criteriaIds = useMemo(() => buildCriteriaIdSet(criteria), [criteria]);

  const toggleTab = (tabId: string) => {
    setExpandedTabs(prev => {
      const next = new Set(prev);
      if (next.has(tabId)) next.delete(tabId);
      else next.add(tabId);
      return next;
    });
  };

  const renderCriterionRow = (item: Criterion, depth: number = 0) => {
    const children = criteria
      .filter(c => c.parent_id === item.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.code.localeCompare(b.code, undefined, { numeric: true }));

    const hasChildren = children.length > 0;
    const isLeaf = !hasChildren;
    
    // Indentation based on depth
    const paddingLeft = depth === 0 ? '16px' : `${16 + depth * 24}px`;

    return (
      <React.Fragment key={item.id}>
        <div className={`flex border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors ${depth === 0 ? 'bg-[#F1F5F9]/30' : 'bg-white'}`}>
          <div className="flex-1 py-3 pr-4 flex flex-col justify-center" style={{ paddingLeft }}>
            <div className="flex items-start gap-2">
              <span className={`font-[600] shrink-0 ${depth === 0 ? 'text-[#334155]' : 'text-[#64748B]'}`}>
                {item.code}.
              </span>
              <span className={`text-[14px] leading-[1.5] ${depth === 0 ? 'font-[590] text-[#1F2937]' : 'font-[400] text-[#374151]'}`}>
                {item.content}
                {item.require_evidence === 1 && (
                  <span className="text-[#DC2626] ml-1 font-[600]" title="Bắt buộc có minh chứng">*</span>
                )}
              </span>
            </div>
          </div>
          
          <div className="w-[120px] py-3 px-4 flex items-center justify-center border-l border-[#E5E7EB]">
            <span className="text-[14px] font-[590] text-[#64748B]">
              {item.point}
            </span>
          </div>
          
          <div className="w-[120px] py-3 px-4 flex items-center justify-center border-l border-[#E5E7EB]">
            {isLeaf ? (
              <input 
                type="text" 
                disabled
                placeholder="0"
                className="w-[60px] h-8 text-center bg-[#F1F5F9] border border-[#D1D5DB] rounded-[6px] text-[14px] font-[590] text-[#94A3B8] outline-none cursor-not-allowed"
              />
            ) : (
              <span className="text-[13px] text-[#94A3B8] italic">-</span>
            )}
          </div>
          
          <div className="w-[140px] py-3 px-4 flex items-center justify-center border-l border-[#E5E7EB]">
            {isLeaf && item.require_evidence === 1 ? (
              <button disabled className="text-[12px] font-[510] text-[#94A3B8] bg-[#F1F5F9] border border-[#E2E8F0] px-2 py-1 rounded-[4px] cursor-not-allowed">
                Tải lên
              </button>
            ) : (
              <span className="text-[13px] text-[#94A3B8] italic">-</span>
            )}
          </div>
        </div>
        
        {hasChildren && (
          <div className="flex flex-col w-full">
            {children.map(child => renderCriterionRow(child, depth + 1))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-h-[1000px] bg-white border border-[#E5E7EB] rounded-[12px] overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-[#E5E7EB] bg-[#F8FAFC]">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-[6px] hover:bg-[#E2E8F0] text-[#64748B] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
          
          <div className="flex flex-col">
            <h2 className="text-[18px] font-[590] text-[#1F2937] leading-[1.2]">
              Xem trước giao diện Sinh viên: {version.name || 'Bộ tiêu chí'}
            </h2>
            <p className="text-[13px] text-[#64748B] font-[400] mt-0.5">
              Giao diện mô phỏng cách hiển thị phiếu chấm điểm đối với sinh viên.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-[#F8FAFC]">
        <div className="max-w-[1000px] mx-auto bg-white border border-[#E5E7EB] rounded-[12px] shadow-sm overflow-hidden flex flex-col">
          
          <div className="bg-[#FEF2F2] px-6 py-4 border-b border-[#FECACA]">
            <h1 className="text-[18px] font-[700] text-[#991B1B] text-center uppercase">
              PHIẾU ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN SINH VIÊN
            </h1>
            <p className="text-center text-[#7F1D1D] text-[13px] mt-1 font-[510]">
              {version.semesters?.name || 'Học kỳ mẫu'}
            </p>
          </div>

          <div className="flex flex-col">
            {categories.map((cat, idx) => {
              const isExpanded = expandedTabs.has(cat.id);
              const rootCriteria = criteria
                .filter(c => c.category_id === cat.id && isRootCriterion(c, criteriaIds))
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.code.localeCompare(b.code, undefined, { numeric: true }));

              return (
                <div key={cat.id} className="flex flex-col border-b border-[#E5E7EB] last:border-b-0">
                  <div 
                    onClick={() => toggleTab(cat.id)}
                    className="flex justify-between items-center px-4 py-3 bg-[#F1F5F9] cursor-pointer hover:bg-[#E2E8F0] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#B91C1C] text-white text-[12px] font-[700]">
                        {idx + 1}
                      </span>
                      <h3 className="text-[15px] font-[600] text-[#1F2937] uppercase">
                        {cat.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[13px] font-[590] text-[#64748B]">
                        Tối đa: <span className="text-[#B91C1C]">{cat.max_score}đ</span>
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-[#64748B]" strokeWidth={2} />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[#64748B]" strokeWidth={2} />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="flex flex-col">
                      <div className="flex bg-[#F8FAFC] border-b border-[#E5E7EB]">
                        <div className="flex-1 py-2 px-4 font-[600] text-[12px] text-[#64748B] uppercase">
                          Nội dung đánh giá
                        </div>
                        <div className="w-[120px] py-2 px-4 font-[600] text-[12px] text-[#64748B] uppercase text-center border-l border-[#E5E7EB]">
                          Khung điểm
                        </div>
                        <div className="w-[120px] py-2 px-4 font-[600] text-[12px] text-[#B91C1C] uppercase text-center border-l border-[#E5E7EB]">
                          SV Tự chấm
                        </div>
                        <div className="w-[140px] py-2 px-4 font-[600] text-[12px] text-[#64748B] uppercase text-center border-l border-[#E5E7EB]">
                          Minh chứng
                        </div>
                      </div>
                      
                      <div className="flex flex-col">
                        {rootCriteria.length > 0 ? (
                          rootCriteria.map(c => renderCriterionRow(c, 0))
                        ) : (
                          <div className="p-8 text-center text-[#94A3B8] text-[13px] italic bg-white">
                            Chưa có tiêu chí nào trong nhóm này
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
