import React, { useState } from 'react';
import { X, FilePlus, Edit3, Loader2 } from 'lucide-react';
import type { CriteriaVersion } from './types';

interface CriteriaSetCreateFormProps {
  versions: CriteriaVersion[];
  onClose: () => void;
  onSuccess: (newVersion?: CriteriaVersion) => void;
}

export function CriteriaSetCreateForm({ versions, onClose, onSuccess }: CriteriaSetCreateFormProps) {
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const [cloneFromId, setCloneFromId] = useState('');

  const handleSubmit = async () => {
    if (mode === 'edit') {
      if (!selectedVersionId) return alert('Vui lòng chọn một phiên bản để tiếp tục!');
      const v = versions.find(x => x.id === selectedVersionId);
      if (v) onSuccess(v);
      return;
    }

    if (!name.trim()) return alert('Vui lòng nhập tên bộ tiêu chí!');

    setIsApplying(true);
    try {
      const res = await fetch('/api/admin/criteria-versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), cloneFromId: cloneFromId || undefined })
      });
      const resData = await res.json();
      if (res.ok) {
        onSuccess(resData.data as CriteriaVersion);
      } else {
        alert(resData.message || 'Có lỗi xảy ra');
      }
    } catch {
      alert('Lỗi kết nối');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-150 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-surface rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-5 border-b border-border">
          <div>
            <h3 className="text-[18px] font-[590] text-foreground leading-[1.2]">
              Tạo hoặc chỉnh sửa bộ tiêu chí
            </h3>
            <p className="text-[14px] text-muted-foreground font-[400] mt-1">
              Thiết lập thông tin và phương thức khởi tạo bộ tiêu chí.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-hover text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Method Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => setMode('create')}
              className={`flex gap-3 p-4 rounded-[8px] cursor-pointer border-[1.5px] transition-all ${
                mode === 'create' 
                  ? 'border-primary bg-danger/10' 
                  : 'border-border hover:border-input bg-surface'
              }`}
            >
              <div className={`mt-0.5 ${mode === 'create' ? 'text-primary' : 'text-muted-foreground'}`}>
                <FilePlus className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-1">
                <span className={`text-[15px] font-[510] ${mode === 'create' ? 'text-danger' : 'text-foreground'}`}>
                  Tạo bộ tiêu chí mới
                </span>
                <span className="text-[13px] text-muted-foreground leading-[1.4]">
                  Bắt đầu với một bộ tiêu chí hoàn toàn mới.
                </span>
              </div>
            </div>

            <div
              onClick={() => setMode('edit')}
              className={`flex gap-3 p-4 rounded-[8px] cursor-pointer border-[1.5px] transition-all ${
                mode === 'edit' 
                  ? 'border-primary bg-danger/10' 
                  : 'border-border hover:border-input bg-surface'
              }`}
            >
              <div className={`mt-0.5 ${mode === 'edit' ? 'text-primary' : 'text-muted-foreground'}`}>
                <Edit3 className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-1">
                <span className={`text-[15px] font-[510] ${mode === 'edit' ? 'text-danger' : 'text-foreground'}`}>
                  Chỉnh sửa bản có sẵn
                </span>
                <span className="text-[13px] text-muted-foreground leading-[1.4]">
                  Chọn một bộ tiêu chí đã có để xem và sửa đổi.
                </span>
              </div>
            </div>
          </div>

          <hr className="border-border" />

          {/* Dynamic Form */}
          {mode === 'create' ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-[510] text-foreground">
                  Tên bộ tiêu chí <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Bộ tiêu chí đánh giá rèn luyện năm 2024"
                  className="px-3 py-2.5 bg-surface border border-border rounded-[6px] text-[15px] text-foreground outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-[510] text-foreground">
                  Mô tả
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nhập mô tả..."
                  rows={3}
                  className="px-3 py-2.5 bg-surface border border-border rounded-[6px] text-[15px] text-foreground outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/20 transition-all resize-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-[510] text-[var(--foreground)]">
                  Sao chép từ (Tùy chọn)
                </label>
                <select
                  value={cloneFromId}
                  onChange={(e) => setCloneFromId(e.target.value)}
                  className="px-3 py-2.5 bg-surface border border-[var(--border)] rounded-[6px] text-[15px] text-[var(--foreground)] outline-none focus:border-[var(--danger-foreground)] focus:ring-[3px] focus:ring-[var(--danger-bg)] transition-all"
                >
                  <option value="">-- Bắt đầu từ mẫu trống --</option>
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name || v.semesters?.code || 'Bộ tiêu chí chưa đặt tên'}
                    </option>
                  ))}
                </select>
                <span className="text-[12px] text-[#64748B]">
                  Hệ thống sẽ sao chép toàn bộ danh mục và tiêu chí từ phiên bản đã chọn sang phiên bản mới này.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-[510] text-foreground">
                  Chọn bộ tiêu chí <span className="text-danger">*</span>
                </label>
                <select
                  value={selectedVersionId}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  className="px-3 py-2.5 bg-surface border border-border rounded-[6px] text-[15px] text-foreground outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/20 transition-all"
                >
                  <option value="">-- Chọn bộ tiêu chí --</option>
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name || v.semesters?.code || 'Bộ tiêu chí chưa đặt tên'}
                    </option>
                  ))}
                </select>
              </div>

              {selectedVersionId && (
                <div className="p-4 bg-surface-muted border border-border rounded-[6px] flex flex-col gap-2">
                  <p className="text-[13px] text-muted-foreground">
                    Thông tin phiên bản:
                  </p>
                  <p className="text-[14px] font-[510] text-foreground">
                    {versions.find(x => x.id === selectedVersionId)?.name || 'Chưa đặt tên'}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    Học kỳ áp dụng: {versions.find(x => x.id === selectedVersionId)?.semesters?.code || 'Không có'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-surface-muted px-6 py-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-surface border border-border text-foreground hover:bg-surface-hover rounded-[6px] text-[14px] font-[510] transition-colors focus:ring-[3px] focus:ring-border outline-none"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={isApplying || (mode === 'create' ? !name.trim() : !selectedVersionId)}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-[6px] text-[14px] font-[510] transition-colors border border-transparent focus:ring-[3px] focus:ring-primary/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplying && <Loader2 className="w-4 h-4 animate-spin" />}
            Tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}
