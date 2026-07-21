import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Card } from './ui/Card';

interface BulkActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  actionType: 'APPROVE' | 'REJECT';
  validCount: number;
  invalidCount: number;
  invalidReason: string;
  isSubmitting: boolean;
  ineligibleStudents?: any[];
}

export function BulkActionModal({
  isOpen,
  onClose,
  onConfirm,
  actionType,
  validCount,
  invalidCount,
  invalidReason,
  isSubmitting,
  ineligibleStudents = []
}: BulkActionModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (actionType === 'REJECT') {
      const trimmed = reason.trim();
      if (trimmed.length < 5 || trimmed.length > 500) {
        setError('Lý do phải từ 5 đến 500 ký tự');
        return;
      }
    }
    setError('');
    onConfirm(actionType === 'REJECT' ? reason.trim() : undefined);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg bg-background shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
          <h3 className="text-lg font-bold text-foreground">
            {actionType === 'APPROVE' ? 'Xác nhận duyệt hàng loạt' : 'Xác nhận trả lại hàng loạt'}
          </h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <p className="text-foreground">
              Bạn đang chọn thao tác cho <strong>{validCount}</strong> phiếu hợp lệ.
            </p>
            {invalidCount > 0 && (
              <div className="mt-3 p-3 bg-warning-bg text-warning-foreground text-sm rounded-lg flex flex-col gap-2 border border-warning-border">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <strong>Cảnh báo:</strong> Có <strong>{invalidCount}</strong> phiếu trong danh sách đang chọn không thể thực hiện thao tác này.
                    <div className="mt-1 opacity-90">{invalidReason}</div>
                    <div className="mt-1 opacity-90 italic">Các phiếu không hợp lệ sẽ tự động bị bỏ qua.</div>
                  </div>
                </div>
                {ineligibleStudents.length > 0 && (
                  <div className="mt-2 pl-6">
                    <p className="font-semibold text-xs mb-1">Danh sách chi tiết:</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1 text-xs opacity-90 max-h-24 overflow-y-auto">
                      {ineligibleStudents.slice(0, 5).map((s: any) => (
                        <li key={s.id}>{s.name} ({s.code})</li>
                      ))}
                      {ineligibleStudents.length > 5 && (
                        <li>... và {ineligibleStudents.length - 5} phiếu khác.</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {actionType === 'REJECT' && (
            <div className="mt-4">
              <label className="block text-sm font-semibold mb-2 text-foreground">
                Lý do trả lại (áp dụng chung) <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => { setReason(e.target.value); setError(''); }}
                placeholder="Nhập lý do trả lại phiếu..."
                className="w-full p-3 border border-border rounded-lg bg-background resize-none focus:ring-2 focus:ring-primary/20 outline-none"
                rows={4}
                disabled={isSubmitting}
              />
              {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-surface flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg font-semibold text-muted-foreground hover:bg-surface-muted transition-colors disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || validCount === 0}
            className={`px-4 py-2 rounded-lg font-bold text-white transition-colors disabled:opacity-50 flex items-center gap-2 ${
              actionType === 'APPROVE' ? 'bg-primary hover:bg-primary/90' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Đang xử lý...
              </>
            ) : (
              actionType === 'APPROVE' ? 'Duyệt phiếu' : 'Trả lại phiếu'
            )}
          </button>
        </div>
      </Card>
    </div>
  );
}
