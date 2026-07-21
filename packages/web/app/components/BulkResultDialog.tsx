import React from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { Card } from './ui/Card';

// ── Types ──────────────────────────────────────────────────────
type BulkActionWarning = {
  code: 'NOTIFICATION_FAILED' | string;
  message: string;
};

type BulkActionResultItem = {
  formId: string;
  studentId: string | null;
  studentCode: string | null;
  studentName: string | null;
  previousStatus: string | null;
  newStatus?: string;
  success: boolean;
  code?: string;
  message?: string;
  warnings?: BulkActionWarning[];
};

type BulkActionSummary = {
  requested: number;
  unique: number;
  succeeded: number;
  failed: number;
};

interface BulkResultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  summary: BulkActionSummary;
  results: BulkActionResultItem[];
}

export function BulkResultDialog({ isOpen, onClose, summary, results }: BulkResultDialogProps) {
  if (!isOpen) return null;

  const successItems = results.filter(r => r.success);
  const successWithWarnings = successItems.filter(r => r.warnings && r.warnings.length > 0);
  const failedItems = results.filter(r => !r.success);
  const hasDuplicates = summary.requested !== summary.unique;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl bg-background shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
          <h3 className="text-lg font-bold text-foreground">Kết quả xử lý hàng loạt</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-surface p-3 rounded-xl border border-border text-center">
              <div className="text-xs font-bold text-muted-foreground uppercase mb-1">Đã gửi</div>
              <div className="text-xl font-black text-foreground">{summary.requested}</div>
            </div>
            <div className="bg-surface p-3 rounded-xl border border-border text-center">
              <div className="text-xs font-bold text-muted-foreground uppercase mb-1">Phiếu duy nhất</div>
              <div className="text-xl font-black text-foreground">{summary.unique}</div>
            </div>
            <div className="bg-surface p-3 rounded-xl border border-border text-center">
              <div className="text-xs font-bold text-muted-foreground uppercase mb-1">Thành công</div>
              <div className="text-xl font-black text-primary">{summary.succeeded}</div>
            </div>
            <div className="bg-surface p-3 rounded-xl border border-border text-center">
              <div className="text-xs font-bold text-muted-foreground uppercase mb-1">Thất bại</div>
              <div className={`text-xl font-black ${summary.failed > 0 ? 'text-warning-foreground' : 'text-muted-foreground'}`}>
                {summary.failed}
              </div>
            </div>
          </div>

          {/* Duplicate notice */}
          {hasDuplicates && (
            <div className="mb-4 p-3 bg-surface-muted text-muted-foreground rounded-lg border border-border text-sm flex items-center gap-2">
              <Info size={16} className="shrink-0" />
              <span>{summary.requested - summary.unique} ID trùng đã được bỏ qua.</span>
            </div>
          )}

          {/* Per-item warning summary */}
          {successWithWarnings.length > 0 && (
            <div className="mb-4 p-3 bg-warning-bg text-warning-foreground rounded-lg border border-warning-border text-sm flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{successWithWarnings.length} phiếu đã xử lý nhưng có cảnh báo (không ảnh hưởng kết quả điểm).</span>
            </div>
          )}

          {/* All-success celebration */}
          {summary.failed === 0 && summary.succeeded > 0 && successWithWarnings.length === 0 && (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} />
              </div>
              <h4 className="text-lg font-bold text-foreground">Hoàn tất thành công!</h4>
              <p className="text-muted-foreground mt-1">Toàn bộ {summary.succeeded} phiếu đã được xử lý xong.</p>
            </div>
          )}

          {/* Results table — shown when there are failures OR warnings */}
          {(failedItems.length > 0 || successWithWarnings.length > 0) && (
            <div>
              <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                Chi tiết kết quả
              </h4>
              <div className="bg-surface rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-surface-muted border-b border-border">
                      <th className="p-3 font-semibold text-muted-foreground">Sinh viên</th>
                      <th className="p-3 font-semibold text-muted-foreground">MSSV</th>
                      <th className="p-3 font-semibold text-muted-foreground">Kết quả</th>
                      <th className="p-3 font-semibold text-muted-foreground">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {/* Failed items first */}
                    {failedItems.map((item, idx) => (
                      <tr key={`fail-${idx}`} className="hover:bg-surface-muted transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-foreground">
                            {item.studentName || 'Không rõ'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            {item.studentCode || '—'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-warning-foreground font-semibold text-xs">
                            <XCircle size={14} />
                            Không thành công
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="text-foreground text-xs">{item.message || 'Lỗi không xác định'}</div>
                          <div className="text-muted-foreground text-xs mt-0.5">{item.code}</div>
                        </td>
                      </tr>
                    ))}
                    {/* Success with warnings */}
                    {successWithWarnings.map((item, idx) => (
                      <tr key={`warn-${idx}`} className="hover:bg-surface-muted transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-foreground">
                            {item.studentName || 'Không rõ'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            {item.studentCode || '—'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-primary font-semibold text-xs">
                            <CheckCircle size={14} />
                            Đã xử lý, có cảnh báo
                          </span>
                        </td>
                        <td className="p-3">
                          {item.warnings?.map((w, wi) => (
                            <div key={wi} className="text-warning-foreground text-xs flex items-center gap-1">
                              <AlertTriangle size={12} className="shrink-0" />
                              {w.message}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
