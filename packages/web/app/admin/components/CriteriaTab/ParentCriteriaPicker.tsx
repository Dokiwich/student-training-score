import React from 'react';

interface ParentCriteriaPickerProps {
  categoryId: string;
  currentCriterionId: string | number;
  value: string;
  onChange: (value: string) => void;
  criteria: any[];
}

export function ParentCriteriaPicker({ categoryId, currentCriterionId, value, onChange, criteria }: ParentCriteriaPickerProps) {
  // Only show criteria in the same category
  let availableParents = criteria.filter(c => c.category_id === categoryId);
  
  // Filter out itself
  availableParents = availableParents.filter(c => c.id !== currentCriterionId);
  
  // Also filter out any criteria that are children of the current criterion (to prevent circular references)
  // Simple 1-level check since the tree is max 2 levels deep based on current logic
  availableParents = availableParents.filter(c => c.parent_id !== currentCriterionId);
  
  // Also, a parent should ideally not have a parent itself (limit tree depth to 2: root -> parent -> child)
  availableParents = availableParents.filter(c => !c.parent_id);

  // Sort them
  availableParents.sort((a, b) => (a.sort_order - b.sort_order) || a.code.localeCompare(b.code, undefined, { numeric: true }));

  return (
    <select 
      value={value || ''} 
      onChange={(e) => onChange(e.target.value)}
      disabled={!categoryId}
      className="px-3 py-2 bg-surface border border-border rounded-[6px] text-[14px] text-foreground outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/20 transition-all disabled:opacity-60 disabled:bg-surface-muted"
    >
      <option value="">-- Không có (Tiêu chí gốc) --</option>
      {availableParents.map(c => (
        <option key={c.id} value={c.id}>
          {c.code} - {c.content.length > 50 ? c.content.substring(0, 50) + '...' : c.content}
        </option>
      ))}
    </select>
  );
}
