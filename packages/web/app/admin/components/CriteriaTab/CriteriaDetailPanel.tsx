import React, { useState, useEffect } from 'react';
import { Save, Trash2, X, Loader2, AlertCircle } from 'lucide-react';
import { ConfirmActionDialog } from './ConfirmActionDialog';
import { ParentCriteriaPicker } from './ParentCriteriaPicker';
import type {
  CriteriaSelection,
  CriteriaItemType,
  Category,
  Criterion,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  CreateCriterionPayload,
  UpdateCriterionPayload,
  DeleteCategoryPayload,
  DeleteCriterionPayload,
} from './types';

interface CriteriaDetailPanelProps {
  versionId: string;
  selectedItem: CriteriaSelection | null;
  categories: Category[];
  criteria: Criterion[];
  onSaved: (item: CriteriaSelection) => void;
  onDeleted: () => void;
  onCancel: () => void;
}

// Internal form state — includes UI-only fields like _type that are never sent to API
interface CategoryFormState {
  _type: 'category';
  id?: string;
  code: string;
  name: string;
  max_score: string;
  criteria_version_id: string;
  sort_order: string;
}

interface CriterionFormState {
  _type: 'criterion';
  id?: number;
  code: string;
  content: string;
  point: string;
  parent_id: string;
  category_id: string;
  sort_order: string;
  // Fields loaded from DB for display, not sent back on save
  score_type?: string;
  score_options?: number[] | null;
  require_evidence?: number;
  evidence_guide?: string | null;
  description?: string | null;
}

type FormState = CategoryFormState | CriterionFormState | Record<string, never>;

function isCategoryForm(f: FormState): f is CategoryFormState {
  return '_type' in f && f._type === 'category';
}

function isCriterionForm(f: FormState): f is CriterionFormState {
  return '_type' in f && f._type === 'criterion';
}

export function CriteriaDetailPanel({ versionId, selectedItem, categories, criteria, onSaved, onDeleted, onCancel }: CriteriaDetailPanelProps) {
  const [formData, setFormData] = useState<FormState>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormError(null);
    if (!selectedItem) {
      setFormData({});
      return;
    }

    if (selectedItem.type === 'category') {
      if (selectedItem.id === 'new') {
        setFormData({
          _type: 'category',
          code: '',
          name: '',
          max_score: '0',
          criteria_version_id: versionId,
          sort_order: '0',
        });
      } else {
        const cat = categories.find(c => c.id === selectedItem.id);
        if (cat) {
          setFormData({
            _type: 'category',
            id: cat.id,
            code: cat.code,
            name: cat.name,
            max_score: String(cat.max_score),
            criteria_version_id: versionId,
            sort_order: String(cat.sort_order || 0),
          });
        }
      }
    } else {
      if (selectedItem.id === 'new') {
        setFormData({
          _type: 'criterion',
          code: '',
          content: '',
          point: '0',
          parent_id: '',
          category_id: categories[0]?.id || '',
          sort_order: '0',
        });
      } else {
        const crit = criteria.find(c => c.id === selectedItem.id);
        if (crit) {
          setFormData({
            _type: 'criterion',
            id: crit.id,
            code: crit.code,
            content: crit.content,
            point: String(crit.point),
            parent_id: crit.parent_id ? String(crit.parent_id) : '',
            category_id: crit.category_id,
            sort_order: String(crit.sort_order || 0),
            score_type: crit.score_type,
            score_options: crit.score_options,
            require_evidence: crit.require_evidence,
            evidence_guide: crit.evidence_guide,
          });
        }
      }
    }
  }, [selectedItem, categories, criteria, versionId]);

  if (!selectedItem) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 text-[#94A3B8]">
        <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-[#CBD5E1]" strokeWidth={1.5} />
        </div>
        <p className="text-[15px] font-[510] text-[#1F2937]">Chưa chọn mục nào</p>
        <p className="text-[14px]">Chọn một nhóm hoặc tiêu chí bên trái để xem và chỉnh sửa chi tiết.</p>
      </div>
    );
  }

  const isNew = selectedItem.id === 'new';
  const typeLabel = selectedItem.type === 'category' ? 'Nhóm tiêu chí' : 'Tiêu chí đánh giá';
  const formType: CriteriaItemType = '_type' in formData && (formData as { _type: string })._type === 'category' ? 'category' : 'criterion';

  const handleSave = async () => {
    setFormError(null);

    // --- Validate BEFORE setting isSaving ---
    if (isCategoryForm(formData)) {
      if (!formData.code.trim() || !formData.name.trim()) {
        setFormError('Vui lòng nhập mã và tên nhóm.');
        return;
      }
    } else if (isCriterionForm(formData)) {
      if (!formData.code.trim() || !formData.content.trim()) {
        setFormError('Vui lòng nhập mã và nội dung tiêu chí.');
        return;
      }
      if (!formData.category_id) {
        setFormError('Vui lòng chọn nhóm cho tiêu chí.');
        return;
      }
    } else {
      return;
    }

    setIsSaving(true);
    try {
      const method = isNew ? 'POST' : 'PUT';
      let body: string;

      if (isCategoryForm(formData)) {
        if (isNew) {
          const payload: CreateCategoryPayload = {
            _type: 'category',
            code: formData.code,
            name: formData.name,
            max_score: formData.max_score,
            criteria_version_id: formData.criteria_version_id,
          };
          body = JSON.stringify(payload);
        } else {
          const payload: UpdateCategoryPayload = {
            _type: 'category',
            id: formData.id!,
            code: formData.code,
            name: formData.name,
            max_score: formData.max_score,
          };
          body = JSON.stringify(payload);
        }
      } else {
        // CriterionFormState
        const parsedParentId = formData.parent_id ? parseInt(formData.parent_id) : null;
        if (isNew) {
          const payload: CreateCriterionPayload = {
            code: formData.code,
            content: formData.content,
            point: formData.point,
            parent_id: parsedParentId,
            category_id: formData.category_id,
          };
          body = JSON.stringify(payload);
        } else {
          const payload: UpdateCriterionPayload = {
            id: formData.id!,
            code: formData.code,
            content: formData.content,
            point: formData.point,
            category_id: formData.category_id,
            parent_id: parsedParentId,
          };
          body = JSON.stringify(payload);
        }
      }

      const res = await fetch('/api/admin/criteria', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const resData = await res.json();
      if (!res.ok) {
        setFormError(resData.message || 'Có lỗi xảy ra.');
        return;
      }

      // Always return CriteriaSelection with .type
      const savedId = resData.data?.id ?? (isCategoryForm(formData) ? formData.id : formData.id);
      onSaved({ type: formType, id: savedId });
    } catch (e) {
      console.error(e);
      setFormError('Lỗi kết nối đến máy chủ.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      let body: string;
      if (isCategoryForm(formData)) {
        const payload: DeleteCategoryPayload = { _type: 'category', id: formData.id! };
        body = JSON.stringify(payload);
      } else if (isCriterionForm(formData)) {
        const payload: DeleteCriterionPayload = { id: formData.id! };
        body = JSON.stringify(payload);
      } else {
        return;
      }

      const res = await fetch('/api/admin/criteria', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const resData = await res.json();
      if (!res.ok) {
        setFormError(resData.message || 'Có lỗi xảy ra.');
        return;
      }

      setShowDeleteConfirm(false);
      onDeleted();
    } catch (e) {
      console.error(e);
      setFormError('Lỗi kết nối khi xóa.');
    } finally {
      setIsDeleting(false);
    }
  };

  const updateField = (key: string, value: string) => {
    setFormData(prev => ({ ...(prev as any), [key]: value }));
    setFormError(null);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Detail Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-[#E5E7EB]">
        <div>
          <h3 className="text-[16px] font-[590] text-[#1F2937] leading-[1.2]">
            {isNew ? `Thêm ${typeLabel.toLowerCase()}` : `Chỉnh sửa ${typeLabel.toLowerCase()}`}
          </h3>
          {!isNew && (
            <p className="text-[13px] text-[#64748B] font-[400] mt-0.5">
              ID: {isCategoryForm(formData) ? formData.id : isCriterionForm(formData) ? formData.id : ''}
            </p>
          )}
        </div>
        <button 
          onClick={onCancel}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F1F5F9] text-[#64748B] transition-colors"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Inline Error */}
      {formError && (
        <div className="mx-6 mt-4 px-3 py-2 bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] text-[13px] text-[#DC2626] font-[510]">
          {formError}
        </div>
      )}

      {/* Form Content */}
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-5">
        {isCategoryForm(formData) ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-[590] text-[#374151]">Mã nhóm <span className="text-[#DC2626]">*</span></label>
                <input 
                  type="text" 
                  value={formData.code} 
                  onChange={(e) => updateField('code', e.target.value)}
                  placeholder="VD: I, II, III..."
                  className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[14px] text-[#1F2937] outline-none focus:border-[#B91C1C] focus:ring-[3px] focus:ring-[#FEF2F2] transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-[590] text-[#374151]">Điểm tối đa</label>
                <input 
                  type="number" 
                  step="0.1" min="0" 
                  value={formData.max_score} 
                  onChange={(e) => updateField('max_score', e.target.value)}
                  className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[14px] font-[590] text-[#DC2626] outline-none focus:border-[#B91C1C] focus:ring-[3px] focus:ring-[#FEF2F2] transition-all"
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-[590] text-[#374151]">Tên nhóm <span className="text-[#DC2626]">*</span></label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="VD: Ý thức học tập..."
                className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[14px] text-[#1F2937] outline-none focus:border-[#B91C1C] focus:ring-[3px] focus:ring-[#FEF2F2] transition-all"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-[590] text-[#374151]">Thứ tự sắp xếp</label>
              <input 
                type="number" 
                value={formData.sort_order} 
                onChange={(e) => updateField('sort_order', e.target.value)}
                className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[14px] text-[#1F2937] outline-none focus:border-[#B91C1C] focus:ring-[3px] focus:ring-[#FEF2F2] transition-all"
              />
              <p className="text-[12px] text-[#94A3B8]">
                Thứ tự hiển thị trong danh sách. Chỉ dùng để sắp xếp trên giao diện, không gửi lên server.
              </p>
            </div>
          </>
        ) : isCriterionForm(formData) ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-[590] text-[#374151]">Thuộc nhóm <span className="text-[#DC2626]">*</span></label>
              <select 
                value={formData.category_id} 
                onChange={(e) => {
                  setFormData(prev => ({ ...(prev as any), category_id: e.target.value, parent_id: '' }));
                  setFormError(null);
                }}
                className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[14px] text-[#1F2937] outline-none focus:border-[#B91C1C] focus:ring-[3px] focus:ring-[#FEF2F2] transition-all"
              >
                <option value="">-- Chọn nhóm --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-[590] text-[#374151]">Tiêu chí cha (Nếu có)</label>
              <ParentCriteriaPicker 
                categoryId={formData.category_id}
                currentCriterionId={formData.id ?? ''}
                value={formData.parent_id}
                onChange={(val) => updateField('parent_id', val)}
                criteria={criteria}
              />
              <p className="text-[12px] text-[#64748B]">
                Nếu chọn tiêu chí cha, tiêu chí này sẽ trở thành tiêu chí con (lá). Tiêu chí cha sẽ không trực tiếp tính điểm.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-[590] text-[#374151]">Mã tiêu chí <span className="text-[#DC2626]">*</span></label>
                <input 
                  type="text" 
                  value={formData.code} 
                  onChange={(e) => updateField('code', e.target.value)}
                  placeholder="VD: 1.1"
                  className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[14px] text-[#1F2937] outline-none focus:border-[#B91C1C] focus:ring-[3px] focus:ring-[#FEF2F2] transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-[590] text-[#374151]">Điểm tối đa</label>
                <input 
                  type="number" 
                  step="0.1" min="0" 
                  value={formData.point} 
                  onChange={(e) => updateField('point', e.target.value)}
                  className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[14px] font-[590] text-[#DC2626] outline-none focus:border-[#B91C1C] focus:ring-[3px] focus:ring-[#FEF2F2] transition-all"
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-[590] text-[#374151]">Nội dung đánh giá <span className="text-[#DC2626]">*</span></label>
              <textarea 
                value={formData.content} 
                onChange={(e) => updateField('content', e.target.value)}
                placeholder="Nhập nội dung tiêu chí..."
                rows={4}
                className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[14px] text-[#1F2937] outline-none focus:border-[#B91C1C] focus:ring-[3px] focus:ring-[#FEF2F2] transition-all resize-none"
              />
            </div>

            {/* Read-only display of score_type and require_evidence */}
            {formData.id && (
              <div className="flex flex-wrap gap-3 text-[12px] text-[#64748B] bg-[#F8FAFC] p-3 rounded-[6px] border border-[#E5E7EB]">
                <span>Loại điểm: <strong className="text-[#1F2937]">{formData.score_type || 'RANGE'}</strong></span>
                <span>Yêu cầu minh chứng: <strong className="text-[#1F2937]">{formData.require_evidence === 1 ? 'Có' : 'Không'}</strong></span>
                {formData.score_options && formData.score_options.length > 0 && (
                  <span>Tùy chọn điểm: <strong className="text-[#1F2937]">[{formData.score_options.join(', ')}]</strong></span>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-[590] text-[#374151]">Thứ tự sắp xếp</label>
              <input 
                type="number" 
                value={formData.sort_order} 
                onChange={(e) => updateField('sort_order', e.target.value)}
                className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[14px] text-[#1F2937] outline-none focus:border-[#B91C1C] focus:ring-[3px] focus:ring-[#FEF2F2] transition-all"
              />
              <p className="text-[12px] text-[#94A3B8]">
                Thứ tự hiển thị trên cây. Chỉ dùng cho giao diện, không gửi lên server.
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-[#E5E7EB] bg-[#F8FAFC] flex justify-between gap-3">
        {!isNew ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#DC2626] text-[#DC2626] hover:bg-[#FEF2F2] rounded-[6px] text-[14px] font-[510] transition-colors focus:ring-[3px] focus:ring-[#FEF2F2] outline-none"
          >
            <Trash2 className="w-4 h-4" strokeWidth={2} />
            Xóa
          </button>
        ) : (
          <div></div>
        )}
        
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#F8FAFC] rounded-[6px] text-[14px] font-[510] transition-colors focus:ring-[3px] focus:ring-[#F1F5F9] outline-none"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-[6px] text-[14px] font-[510] transition-colors border border-transparent focus:ring-[3px] focus:ring-[#ECFDF5] outline-none disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" strokeWidth={2} />}
            Lưu thay đổi
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmActionDialog
          title="Xác nhận xóa"
          description={
            isCategoryForm(formData) 
              ? `Bạn có chắc chắn muốn xóa nhóm "${formData.name}"? Tất cả tiêu chí con bên trong cũng sẽ bị xóa vĩnh viễn.`
              : isCriterionForm(formData)
              ? `Bạn có chắc chắn muốn xóa tiêu chí "${formData.code}"?`
              : ''
          }
          isDestructive={true}
          confirmText="Xóa vĩnh viễn"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
