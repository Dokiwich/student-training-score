import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MoreVertical, MoreHorizontal, Eye, Lock, CheckCircle2, Trash2 } from 'lucide-react';
import { ConfirmActionDialog } from './ConfirmActionDialog';
import type { CriteriaVersion, ToggleVersionPayload } from './types';

interface CriteriaSetCardProps {
  version: CriteriaVersion;
  onOpen: () => void;
  onUpdate: () => void;
}

export function CriteriaSetCard({ version, onOpen, onUpdate }: CriteriaSetCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = version.is_active === 1;
  const targetStatus = isActive ? 0 : 1;
  const actionName = isActive ? 'Ngừng áp dụng' : 'Công bố';

  // Click-outside listener for dropdown menu
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setShowMenu(false);
    }
  }, []);

  useEffect(() => {
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu, handleClickOutside]);

  const handleToggleStatus = async () => {
    setIsProcessing(true);
    try {
      const payload: ToggleVersionPayload = {
        _type: 'version',
        id: version.id,
        is_active: targetStatus,
      };
      const res = await fetch('/api/admin/criteria', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.message || `Lỗi khi ${actionName.toLowerCase()} phiên bản`);
      } else {
        onUpdate();
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối khi cập nhật trạng thái phiên bản');
    } finally {
      setIsProcessing(false);
      setShowStatusDialog(false);
    }
  };

  const handleDeleteVersion = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin/criteria', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _type: 'version', id: version.id }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.message || 'Lỗi khi xóa phiên bản');
        setIsDeleting(false);
      } else {
        alert('Đã xóa phiên bản tiêu chí thành công');
        setShowDeleteDialog(false);
        onUpdate();
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối khi xóa phiên bản');
      setIsDeleting(false);
    }
  };
  
  return (
    <>
      <div 
        onClick={onOpen}
        className={`relative h-full flex flex-col p-5 bg-surface border ${isActive ? 'border-success' : 'border-border'} rounded-[12px] hover:shadow-sm hover:-translate-y-0.5 transition-all group`}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            {isActive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-success/10 text-success border border-success/30 text-[11px] font-[590]">
                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />
                ĐANG ÁP DỤNG
              </span>
            ) : (
              <span className="inline-flex px-2.5 py-1 rounded-[4px] bg-surface-muted text-muted-foreground border border-border text-[11px] font-[590]">
                <Lock className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} /> BẢN NHÁP
              </span>
            )}
          </div>
          
          <div className="relative" ref={menuRef}>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-1 rounded-[4px] hover:bg-surface-hover text-muted-foreground transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" strokeWidth={1.5} />
            </button>
            
            {showMenu && (
              <div 
                className="absolute right-0 top-[28px] w-48 bg-surface border border-border rounded-[8px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-10 overflow-hidden"
              >
                <div className="flex flex-col py-1">
                  <button onClick={() => { setShowMenu(false); onOpen(); }} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-hover text-[13px] font-[510] text-foreground text-left">
                    <Eye className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /> Xem chi tiết
                  </button>
                  <button onClick={() => { setShowMenu(false); setShowStatusDialog(true); }} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-hover text-[13px] font-[510] text-foreground text-left">
                    {isActive ? <Lock className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /> : <CheckCircle2 className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />}
                    {isActive ? 'Ngừng áp dụng' : 'Áp dụng bộ tiêu chí'}
                  </button>
                  {isActive ? (
                    <button 
                      disabled
                      title="Không thể xóa bộ tiêu chí đang áp dụng"
                      className="flex items-center gap-2 px-3 py-2 text-[13px] font-[510] text-muted-foreground cursor-not-allowed text-left border-t border-border mt-1 pt-2"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /> Xóa bộ tiêu chí
                    </button>
                  ) : (
                    <button 
                      onClick={() => { setShowMenu(false); setShowDeleteDialog(true); }} 
                      className="flex items-center gap-2 px-3 py-2 hover:bg-danger/10 text-[13px] font-[510] text-danger text-left border-t border-border mt-1 pt-2"
                    >
                      <Trash2 className="w-4 h-4 text-danger" strokeWidth={1.5} /> Xóa bộ tiêu chí
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col mt-3 min-w-0" onClick={onOpen}>
          <h4 className="text-[18px] font-[590] text-foreground leading-[1.3] mb-1 pr-4 truncate">
            {version.name || 'Chưa đặt tên'}
          </h4>
          
          <p className="text-[14px] text-muted-foreground font-[400] mb-4">
            Học kỳ: {version.semesters?.name || 'Không xác định'}
          </p>

          <div className="mt-auto pt-4 border-t border-border flex justify-between items-center text-[13px] text-muted-foreground">
            <span className="font-[510]">{version.totalCategories || 0} Nhóm</span>
            <span className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30"></span>
              {new Date(version.created_at).toLocaleDateString('vi-VN')}
            </span>
          </div>
        </div>
      </div>

      {/* Confirm Status Change Dialog */}
      {showStatusDialog && (
        <ConfirmActionDialog
          title={actionName}
          description={`Bạn có chắc chắn muốn ${actionName.toLowerCase()} phiên bản "${version.name || version.semesters?.code}"?`}
          confirmText="Xác nhận"
          cancelText="Hủy"
          isDestructive={isActive}
          onConfirm={handleToggleStatus}
          onCancel={() => setShowStatusDialog(false)}
          isLoading={isProcessing}
        />
      )}

      {/* Confirm Delete Dialog */}
      {showDeleteDialog && (
        <ConfirmActionDialog
          title="Xóa bộ tiêu chí"
          description={`Bạn có chắc chắn muốn xóa phiên bản "${version.name || version.semesters?.code}"?\nCảnh báo: Thao tác này sẽ xóa toàn bộ Nhóm và Tiêu chí con thuộc phiên bản này và không thể hoàn tác.`}
          confirmText="Xác nhận xóa"
          cancelText="Hủy"
          isDestructive={true}
          onConfirm={handleDeleteVersion}
          onCancel={() => setShowDeleteDialog(false)}
          isLoading={isDeleting}
        />
      )}
    </>
  );
}
