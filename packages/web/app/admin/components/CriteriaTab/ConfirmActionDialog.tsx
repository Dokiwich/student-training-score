import React from 'react';
import { Loader2, AlertTriangle, Info } from 'lucide-react';

interface ConfirmActionDialogProps {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmActionDialog({
  title,
  description,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  isDestructive = false,
  onConfirm,
  onCancel,
  isLoading = false
}: ConfirmActionDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-surface rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-full ${isDestructive ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'}`}>
              {isDestructive ? (
                <AlertTriangle className="w-6 h-6" strokeWidth={2} />
              ) : (
                <Info className="w-6 h-6" strokeWidth={2} />
              )}
            </div>
            <div className="flex flex-col gap-2 mt-1">
              <h3 className="text-[18px] font-[590] text-foreground leading-tight">
                {title}
              </h3>
              <p className="text-[14px] text-muted-foreground font-[400] leading-[1.5]">
                {description}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-surface-muted px-6 py-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 bg-surface border border-border text-foreground hover:bg-surface-muted rounded-[6px] text-[14px] font-[510] transition-colors focus:ring-2 focus:ring-ring outline-none disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 border border-transparent rounded-[6px] text-[14px] font-[510] text-primary-foreground transition-colors focus:ring-2 outline-none disabled:opacity-50 ${
              isDestructive 
                ? 'bg-danger hover:bg-danger-foreground focus:ring-danger/50' 
                : 'bg-success hover:bg-success-foreground focus:ring-success/50'
            }`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
