import React from 'react';
import { X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card } from './ui/Card';

interface BulkResultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  summary: {
    requested: number;
    unique: number;
    succeeded: number;
    failed: number;
  };
  results: Array<{
    formId: string;
    studentCode?: string;
    studentName?: string;
    success: boolean;
    code?: string;
    message?: string;
  }>;
  warnings?: Array<{ code: string; message: string }>;
}

export function BulkResultDialog({ isOpen, onClose, summary, results, warnings }: BulkResultDialogProps) {
  if (!isOpen) return null;

  const failedItems = results.filter(r => !r.success);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl bg-background shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
          <h3 className="text-lg font-bold text-foreground">Kết quả xử lý hàng loạt</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-surface p-3 rounded-xl border border-border text-center">
              <div className="text-xs font-bold text-muted-foreground uppercase mb-1">Yêu cầu</div>
              <div className="text-xl font-black text-foreground">{summary.unique}</div>
            </div>
            <div className="bg-surface p-3 rounded-xl border border-border text-center">
              <div className="text-xs font-bold text-muted-foreground uppercase mb-1">Thành công</div>
              <div className="text-xl font-black text-primary">{summary.succeeded}</div>
            </div>
            <div className="bg-surface p-3 rounded-xl border border-border text-center">
              <div className="text-xs font-bold text-muted-foreground uppercase mb-1">Thất bại</div>
              <div className="text-xl font-black text-warning-foreground">{summary.failed}</div>
            </div>
          </div>

          {warnings && warnings.length > 0 && (
            <div className="mb-6 p-4 bg-warning-bg text-warning-foreground rounded-xl border border-yellow-200">
              <div className="flex items-center gap-2 font-bold mb-2">
                <AlertTriangle size={18} /> Cảnh báo (Không ảnh hưởng kết quả điểm)
              </div>
              <ul className="list-disc pl-5 text-sm space-y-1 opacity-90">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}

          {failedItems.length > 0 && (
            <div>
              <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                <XCircle size={18} className="text-red-500" /> 
                Chi tiết phiếu thất bại ({failedItems.length})
              </h4>
              <div className="bg-surface rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-surface-muted border-b border-border">
                      <th className="p-3 font-semibold text-muted-foreground">Sinh viên</th>
                      <th className="p-3 font-semibold text-muted-foreground">Lỗi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {failedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-surface-muted transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-foreground">{item.studentName || 'Không rõ'}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">{item.studentCode || item.formId}</div>
                        </td>
                        <td className="p-3">
                          <div className="text-warning-foreground font-medium">{item.message}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{item.code}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {summary.failed === 0 && summary.succeeded > 0 && (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} />
              </div>
              <h4 className="text-lg font-bold text-foreground">Hoàn tất thành công!</h4>
              <p className="text-muted-foreground mt-1">Toàn bộ {summary.succeeded} phiếu đã được xử lý xong.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-surface flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </Card>
    </div>
  );
}
