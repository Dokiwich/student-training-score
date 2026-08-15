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
  const [isLocked, setIsLocked] = useState(false);
  const [lockedReason, setLockedReason] = useState<string | null>(null);
  const [usedCriteriaIds, setUsedCriteriaIds] = useState<number[]>([]);

  const [selectedItem, setSelectedItem] = useState<CriteriaSelection | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/criteria?versionId=${version.id}`);
      if (res.ok) {
        const json = await res.json();
        setCategories(json.categories || []);
        setCriteria(json.data || []);
        setIsLocked(!!json.isLocked);
        setLockedReason(json.lockedReason || null);
        setUsedCriteriaIds(json.usedCriteriaIds || []);
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
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
        <span className="text-muted-foreground text-[15px] font-[510]">Đang tải dữ liệu không gian làm việc...</span>
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
    <div className="flex flex-col h-[calc(100vh-80px)] max-h-250 bg-surface border border-border rounded-xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
      {/* Workspace Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-surface-muted">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-surface-hover text-muted-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-[590] text-foreground leading-[1.2]">
                {version.name || version.semesters?.code || 'Bộ tiêu chí chưa đặt tên'}
              </h2>
              {version.is_active === 1 ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-success/10 text-success border border-success/30 text-[11px] font-[590]">
                  <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                  ĐANG ÁP DỤNG
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-surface-muted text-muted-foreground border border-border text-[11px] font-[590]">
                  <Lock className="w-3 h-3" strokeWidth={2.5} />
                  BẢN NHÁP
                </span>
              )}
              {isLocked && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-[590]">
                  <Lock className="w-3 h-3" strokeWidth={2.5} />
                  ĐÃ KHÓA BẢO VỆ
                </span>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground font-normal mt-0.5">
              Học kỳ áp dụng: {version.semesters?.name || 'Không có'} — {categories.length} nhóm, {criteria.length} tiêu chí
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreviewMode(true)}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border text-foreground hover:bg-surface-muted rounded-md text-[14px] font-[510] transition-colors focus:ring-[3px] focus:ring-border outline-none"
          >
            <Eye className="w-4 h-4" strokeWidth={1.5} />
            Xem trước giao diện SV
          </button>
          <div className="w-px h-6 bg-border"></div>
          <button
            onClick={handleCreateNewCategory}
            disabled={isLocked && usedCriteriaIds.length > 0}
            title={isLocked && usedCriteriaIds.length > 0 ? 'Không thể thêm nhóm mới khi bộ tiêu chí đã có dữ liệu chấm' : ''}
            className="px-4 py-2 bg-surface border border-border text-foreground hover:bg-surface-muted rounded-md text-[14px] font-[510] transition-colors focus:ring-[3px] focus:ring-border outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Thêm nhóm (Category)
          </button>
          <button
            onClick={handleCreateNewCriterion}
            disabled={isLocked && usedCriteriaIds.length > 0}
            title={isLocked && usedCriteriaIds.length > 0 ? 'Không thể thêm tiêu chí mới khi bộ tiêu chí đã có dữ liệu chấm' : ''}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-md text-[14px] font-[510] transition-colors border border-transparent focus:ring-[3px] focus:ring-primary/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Thêm tiêu chí
          </button>
        </div>
      </div>

      {/* Lock Banner */}
      {isLocked && (
        <div className="flex items-center gap-2 px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 text-[13px] font-[510]">
          <Lock className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>{lockedReason || 'Bộ tiêu chí đang được sử dụng để chấm điểm — Thang điểm và cấu trúc đã được tự động khóa bảo vệ an toàn.'}</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Tree (60%) */}
        <div className="w-[60%] flex flex-col border-r border-border bg-surface-muted overflow-hidden">
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
        <div className="w-[40%] bg-surface flex flex-col overflow-auto relative">
          <CriteriaDetailPanel
            versionId={version.id}
            selectedItem={selectedItem}
            categories={categories}
            criteria={criteria}
            isVersionLocked={isLocked}
            usedCriteriaIds={usedCriteriaIds}
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
