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
        <div className={`flex border-b border-border hover:bg-surface-hover transition-colors ${depth === 0 ? 'bg-surface-muted/30' : 'bg-surface'}`}>
          <div className="flex-1 py-3 pr-4 flex flex-col justify-center" style={{ paddingLeft }}>
            <div className="flex items-start gap-2">
              <span className={`font-[600] shrink-0 ${depth === 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                {item.code}.
              </span>
              <span className={`text-[14px] leading-[1.5] ${depth === 0 ? 'font-[590] text-foreground' : 'font-[400] text-foreground'}`}>
                {item.content}
                {item.require_evidence === 1 && (
                  <span className="text-danger ml-1 font-[600]" title="Bắt buộc có minh chứng">*</span>
                )}
              </span>
            </div>
          </div>
          
          <div className="w-[120px] py-3 px-4 flex items-center justify-center border-l border-border">
            <span className="text-[14px] font-[590] text-muted-foreground">
              {item.point}
            </span>
          </div>
          
          <div className="w-[120px] py-3 px-4 flex items-center justify-center border-l border-border">
            {isLeaf ? (
              <input 
                type="text" 
                disabled
                placeholder="0"
                className="w-[60px] h-8 text-center bg-surface-muted border border-border rounded-[6px] text-[14px] font-[590] text-muted-foreground outline-none cursor-not-allowed"
              />
            ) : (
              <span className="text-[13px] text-muted-foreground italic">-</span>
            )}
          </div>
          
          <div className="w-[140px] py-3 px-4 flex items-center justify-center border-l border-border">
            {isLeaf && item.require_evidence === 1 ? (
              <button disabled className="text-[12px] font-[510] text-muted-foreground bg-surface-muted border border-border px-2 py-1 rounded-[4px] cursor-not-allowed">
                Tải lên
              </button>
            ) : (
              <span className="text-[13px] text-muted-foreground italic">-</span>
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
    <div className="flex flex-col h-[calc(100vh-80px)] max-h-[1000px] bg-surface border border-border rounded-[12px] overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-surface-muted">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-[6px] hover:bg-surface-hover text-muted-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
          
          <div className="flex flex-col">
            <h2 className="text-[18px] font-[590] text-foreground leading-[1.2]">
              Xem trước giao diện Sinh viên: {version.name || 'Bộ tiêu chí'}
            </h2>
            <p className="text-[13px] text-muted-foreground font-[400] mt-0.5">
              Giao diện mô phỏng cách hiển thị phiếu chấm điểm đối với sinh viên.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-surface-muted">
        <div className="max-w-[1000px] mx-auto bg-surface border border-border rounded-[12px] shadow-sm overflow-hidden flex flex-col">
          
          <div className="bg-primary/10 px-6 py-4 border-b border-primary/20">
            <h1 className="text-[18px] font-[700] text-primary text-center uppercase">
              PHIẾU ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN SINH VIÊN
            </h1>
            <p className="text-center text-primary/80 text-[13px] mt-1 font-[510]">
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
                <div key={cat.id} className="flex flex-col border-b border-border last:border-b-0">
                  <div 
                    onClick={() => toggleTab(cat.id)}
                    className="flex justify-between items-center px-4 py-3 bg-surface-muted cursor-pointer hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-[12px] font-[700]">
                        {idx + 1}
                      </span>
                      <h3 className="text-[15px] font-[600] text-foreground uppercase">
                        {cat.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[13px] font-[590] text-muted-foreground">
                        Tối đa: <span className="text-primary">{cat.max_score}đ</span>
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="flex flex-col">
                      <div className="flex bg-surface border-b border-border">
                        <div className="flex-1 py-2 px-4 font-[600] text-[12px] text-muted-foreground uppercase">
                          Nội dung đánh giá
                        </div>
                        <div className="w-[120px] py-2 px-4 font-[600] text-[12px] text-muted-foreground uppercase text-center border-l border-border">
                          Khung điểm
                        </div>
                        <div className="w-[120px] py-2 px-4 font-[600] text-[12px] text-primary uppercase text-center border-l border-border">
                          SV Tự chấm
                        </div>
                        <div className="w-[140px] py-2 px-4 font-[600] text-[12px] text-muted-foreground uppercase text-center border-l border-border">
                          Minh chứng
                        </div>
                      </div>
                      
                      <div className="flex flex-col">
                        {rootCriteria.length > 0 ? (
                          rootCriteria.map(c => renderCriterionRow(c, 0))
                        ) : (
                          <div className="p-8 text-center text-muted-foreground text-[13px] italic bg-surface">
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
