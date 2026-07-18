import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Folder, FileText, CornerDownRight, AlertTriangle } from 'lucide-react';
import type { Category, Criterion, CriteriaSelection } from './types';
import { buildCriteriaIdSet, isRootCriterion, isOrphanCriterion } from './types';
interface CriteriaTreeProps {
  categories: Category[];
  criteria: Criterion[];
  selectedItem: CriteriaSelection | null;
  onSelect: (item: CriteriaSelection) => void;
}

export function CriteriaTree({ categories, criteria, selectedItem, onSelect }: CriteriaTreeProps) {
  const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const criteriaIds = useMemo(() => buildCriteriaIdSet(criteria), [criteria]);

  return (
    <div className="flex flex-col gap-1 w-full pb-8">
      {sortedCategories.map(cat => (
        <CategoryNode 
          key={cat.id} 
          category={cat} 
          criteria={criteria}
          criteriaIds={criteriaIds}
          selectedItem={selectedItem} 
          onSelect={onSelect} 
        />
      ))}
      
      {sortedCategories.length === 0 && (
        <div className="text-center p-8 text-muted-foreground text-[14px]">
          Chưa có cấu trúc tiêu chí. Hãy bắt đầu bằng cách thêm Nhóm.
        </div>
      )}
    </div>
  );
}

interface CategoryNodeProps {
  category: Category;
  criteria: Criterion[];
  criteriaIds: Set<number>;
  selectedItem: CriteriaSelection | null;
  onSelect: (item: CriteriaSelection) => void;
}

function CategoryNode({ category, criteria, criteriaIds, selectedItem, onSelect }: CategoryNodeProps) {
  const [expanded, setExpanded] = useState(true);
  
  const isSelected = selectedItem?.type === 'category' && selectedItem?.id === category.id;
  
  // Root criteria: no parent OR parent doesn't exist (orphan treated as root)
  const rootCriteria = criteria
    .filter(c => c.category_id === category.id && isRootCriterion(c, criteriaIds))
    .sort((a, b) => (a.sort_order - b.sort_order) || a.code.localeCompare(b.code, undefined, { numeric: true }));


  return (
    <div className="flex flex-col">
      {/* Category Row */}
      <div 
        className={`flex items-center gap-2 px-2 py-1.5 rounded-[6px] cursor-pointer group transition-colors select-none ${
          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-surface-muted text-foreground'
        }`}
        onClick={() => onSelect({ type: 'category', id: category.id })}
      >
        <button 
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className={`p-0.5 rounded-[4px] text-muted-foreground hover:bg-surface-hover ${isSelected ? 'hover:bg-primary/20' : ''}`}
        >
          {expanded ? <ChevronDown className="w-4 h-4" strokeWidth={1.5} /> : <ChevronRight className="w-4 h-4" strokeWidth={1.5} />}
        </button>
        
        <Folder className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
        
        <span className="text-[14px] font-[590] truncate flex-1 leading-none pt-0.5">
          {category.name}
        </span>
        
        <span className={`text-[12px] font-[510] ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
          {category.max_score}đ
        </span>
      </div>

      {/* Children */}
      {expanded && (
        <div className="flex flex-col ml-5 pl-2 border-l border-border mt-1 mb-2 gap-0.5">
          {rootCriteria.length > 0 ? (
            rootCriteria.map(c => (
              <CriterionNode 
                key={c.id} 
                criterion={c} 
                allCriteria={criteria}
                criteriaIds={criteriaIds}
                selectedItem={selectedItem} 
                onSelect={onSelect} 
                level={1}
              />
            ))
          ) : (
            <div className="text-[13px] text-muted-foreground italic pl-6 py-1">Trống</div>
          )}
        </div>
      )}
    </div>
  );
}

interface CriterionNodeProps {
  criterion: Criterion;
  allCriteria: Criterion[];
  criteriaIds: Set<number>;
  selectedItem: CriteriaSelection | null;
  onSelect: (item: CriteriaSelection) => void;
  level: number;
}

function CriterionNode({ criterion, allCriteria, criteriaIds, selectedItem, onSelect, level }: CriterionNodeProps) {
  const [expanded, setExpanded] = useState(true);
  
  const isSelected = selectedItem?.type === 'criterion' && selectedItem?.id === criterion.id;
  const isOrphan = isOrphanCriterion(criterion, criteriaIds);
  
  const children = allCriteria
    .filter(c => c.parent_id === criterion.id)
    .sort((a, b) => (a.sort_order - b.sort_order) || a.code.localeCompare(b.code, undefined, { numeric: true }));
  
  const hasChildren = children.length > 0;

  return (
    <div className="flex flex-col">
      <div 
        className={`flex items-start gap-2 px-2 py-1.5 rounded-[6px] cursor-pointer group transition-colors select-none ${
          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-surface-muted text-foreground'
        } ${isOrphan ? 'ring-1 ring-warning/40' : ''}`}
        onClick={() => onSelect({ type: 'criterion', id: criterion.id })}
      >
        <div className="flex items-center mt-0.5 w-4 h-4 flex-shrink-0">
          {hasChildren ? (
            <button 
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className={`p-0.5 -ml-0.5 rounded-[4px] text-muted-foreground hover:bg-surface-hover ${isSelected ? 'hover:bg-primary/20' : ''}`}
            >
              {expanded ? <ChevronDown className="w-4 h-4" strokeWidth={1.5} /> : <ChevronRight className="w-4 h-4" strokeWidth={1.5} />}
            </button>
          ) : (
            level > 1 ? (
              <CornerDownRight className={`w-3.5 h-3.5 ml-0.5 ${isSelected ? 'text-primary/50' : 'text-muted-foreground/30'}`} strokeWidth={1.5} />
            ) : (
              <FileText className={`w-3.5 h-3.5 ml-0.5 ${isSelected ? 'text-primary/50' : 'text-muted-foreground/30'}`} strokeWidth={1.5} />
            )
          )}
        </div>
        
        <div className="flex flex-col flex-1 min-w-0 pt-0.5">
          <div className="flex justify-between items-baseline gap-2 w-full">
            <span className={`text-[12px] font-[590] flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
              {criterion.code}
            </span>
            <span className={`text-[12px] font-[590] flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
              {hasChildren ? '' : `${criterion.point}đ`}
            </span>
          </div>
          <span className={`text-[13px] font-[400] leading-[1.4] break-words pr-2 mt-0.5 ${isSelected ? 'text-primary font-medium' : 'text-foreground'}`}>
            {criterion.content}
          </span>
          {isOrphan && (
            <span className="flex items-center gap-1 mt-1 text-[11px] text-warning font-[510]">
              <AlertTriangle className="w-3 h-3" strokeWidth={2} />
              Tiêu chí mồ côi (parent_id: {criterion.parent_id} không tồn tại)
            </span>
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="flex flex-col ml-4 pl-2 border-l border-border mt-0.5 gap-0.5">
          {children.map(c => (
            <CriterionNode 
              key={c.id} 
              criterion={c} 
              allCriteria={allCriteria}
              criteriaIds={criteriaIds}
              selectedItem={selectedItem} 
              onSelect={onSelect} 
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
