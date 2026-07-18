'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { FileText, ShieldAlert, AlertTriangle, CheckSquare } from 'lucide-react';

interface AppealItem {
  id: string;
  reason: string;
  appealType: string;
  criteriaId: number | null;
  criteriaCode: string | null;
  criteriaContent: string | null;
  currentScores: Record<string, number> | null;
  status: string;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  sheetId: string;
  sheetStatus: string;
  studentName: string;
  studentCode: string;
  semesterName: string;
  semesterCode: string;
  className: string;
  classCode: string;
  studentTotal: number | null;
  classTotal: number | null;
  advisorTotal: number | null;
  finalTotal: number | null;
  classification: string | null;
  proofUrl?: string | null;
}


export default function DepartmentAppealsPage() {
  const { data: session } = useSession();
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppeal, setSelectedAppeal] = useState<AppealItem | null>(null);
  const [decision, setDecision] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [resolution, setResolution] = useState('');
  const [newScore, setNewScore] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAppeals = useCallback(async () => {
    if (!session?.user) return;
    const customJwt = (session as any).customJwt;
    if (!customJwt) return;

    setLoading(true);
    try {
      const r = await fetch('/proxy-api/appeal', {
        headers: {
          'Authorization': `Bearer ${customJwt}`
        }
      });
      if (r.ok) {
        const j = await r.json();
        setAppeals(j.data || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [session]);

  useEffect(() => {
    fetchAppeals();
  }, [fetchAppeals]);

  const handleOpenResolve = (appeal: AppealItem) => {
    setSelectedAppeal(appeal);
    setDecision('ACCEPTED');
    setResolution('');
    setNewScore(appeal.currentScores?.[appeal.appealType === 'class' ? 'CLASS_COMMITTEE' : 'ADVISOR'] ?? '');
  };

  const handleResolve = async () => {
    if (!selectedAppeal) return;
    if (!resolution.trim()) {
      return alert('Vui lòng nhập phản hồi');
    }
    if (decision === 'ACCEPTED' && newScore === '') {
      return alert('Vui lòng nhập điểm mới khi chấp nhận');
    }

    const customJwt = (session as any)?.customJwt;
    setSubmitting(true);
    try {
      const r = await fetch(`/proxy-api/appeal/${selectedAppeal.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customJwt}`
        },
        body: JSON.stringify({
          decision,
          resolution: resolution.trim(),
          newScore: decision === 'ACCEPTED' ? Number(newScore) : undefined,
        }),
      });
      
      if (r.ok) {
        alert('Đã xử lý khiếu nại thành công!');
        setSelectedAppeal(null);
        fetchAppeals();
      } else {
        const err = await r.json();
        alert(err.message || 'Có lỗi xảy ra');
      }
    } catch {
      alert('Lỗi kết nối');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = appeals.filter(a => a.status === 'PENDING').length;
  const deptReviewedCount = appeals.filter(a => a.status === 'DEPT_REVIEWED').length;

  return (
    <DashboardLayout
      pageTitle="Quản lý khiếu nại (Khoa)"
      pageSubtitle="Giám sát và xét duyệt các khiếu nại về điểm rèn luyện của sinh viên thuộc Khoa"
    >
      <div className="space-y-6">
        {/* Dashboard stats / Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card>
              <CardContent className="p-6 flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-warning-bg text-warning-foreground flex items-center justify-center">
                    <AlertTriangle size={24} />
                 </div>
                 <div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">CẦN XỬ LÝ</div>
                    <div className="text-3xl font-black text-foreground mt-1">{pendingCount}</div>
                 </div>
              </CardContent>
           </Card>
           <Card>
              <CardContent className="p-6 flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-success-bg text-success-foreground flex items-center justify-center">
                    <CheckSquare size={24} />
                 </div>
                 <div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">ĐÃ XỬ LÝ</div>
                    <div className="text-3xl font-black text-foreground mt-1">{appeals.length - pendingCount}</div>
                 </div>
              </CardContent>
           </Card>
           <Card>
              <CardContent className="p-6 flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-info-bg text-info-foreground flex items-center justify-center">
                    <FileText size={24} />
                 </div>
                 <div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">TỔNG CỘNG</div>
                    <div className="text-3xl font-black text-foreground mt-1">{appeals.length}</div>
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Appeals list */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle>Danh sách khiếu nại</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">Đang tải...</div>
          ) : appeals.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Chưa có khiếu nại nào"
              description="Hiện không có yêu cầu khiếu nại nào cần xử lý."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-muted border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-bold">
                    <th className="px-4 py-3 font-semibold w-12 text-center">STT</th>
                    <th className="px-4 py-3 font-semibold">Sinh viên</th>
                    <th className="px-4 py-3 font-semibold w-32">Đối tượng</th>
                    <th className="px-4 py-3 font-semibold w-64">Tiêu chí</th>
                    <th className="px-4 py-3 font-semibold">Lý do</th>
                    <th className="px-4 py-3 font-semibold w-40 text-center">Trạng thái</th>
                    <th className="px-4 py-3 font-semibold w-40">Ngày gửi</th>
                    <th className="px-4 py-3 font-semibold w-32 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {appeals.map((a, i) => {
                    return (
                      <tr key={a.id} className="hover:bg-surface-muted transition-colors">
                        <td className="px-4 py-4 text-sm text-muted-foreground text-center">{i + 1}</td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-bold text-foreground">{a.studentName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{a.studentCode} • Lớp {a.classCode}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            a.appealType === 'advisor' 
                              ? 'bg-info-bg text-info-foreground border border-info-border' 
                              : 'bg-primary-light text-primary-foreground border border-primary'
                          }`}>
                            {a.appealType === 'advisor' ? 'Điểm CVHT' : 'Điểm BCS'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {a.criteriaCode ? (
                            <div>
                              <span className="font-mono text-xs font-bold text-primary bg-primary-light px-1.5 py-0.5 rounded mr-2">{a.criteriaCode}</span>
                              <div className="text-sm text-muted-foreground mt-1 line-clamp-2" title={a.criteriaContent || ''}>{a.criteriaContent}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-foreground bg-surface-muted p-2.5 rounded-lg border border-border shadow-sm line-clamp-2" title={a.reason}>
                            {a.reason}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <StatusBadge status={a.status} type="appeal" />
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground font-medium">
                          {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                          <div className="text-[10px] mt-0.5 opacity-80">
                            {new Date(a.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Button
                             variant="secondary"
                             size="sm"
                             onClick={() => handleOpenResolve(a)}
                          >
                             {a.status === 'PENDING' ? 'Xử lý' : 'Chi tiết'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </CardContent>
        </Card>
      </div>

      {/* Resolve Modal */}
      {selectedAppeal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedAppeal(null)}>
            <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
               <div className="px-6 py-4 border-b border-border bg-surface-muted flex justify-between items-center">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                     <ShieldAlert size={20} className="text-primary" />
                     {selectedAppeal.status === 'PENDING' ? 'Xem xét & Đề xuất cho Admin' : 'Chi tiết khiếu nại'}
                  </h3>
                  <button onClick={() => setSelectedAppeal(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
               </div>
               
               <div className="p-6 max-h-[75vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                     <div className="bg-surface-muted p-3 rounded-lg border border-border">
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Sinh viên</div>
                        <div className="text-sm font-bold text-foreground">{selectedAppeal.studentName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{selectedAppeal.studentCode}</div>
                     </div>
                     <div className="bg-surface-muted p-3 rounded-lg border border-border">
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Đối tượng bị khiếu nại</div>
                        <div className="text-sm font-bold text-info-foreground mt-1">
                           {selectedAppeal.appealType === 'advisor' ? 'Điểm CVHT chấm' : 'Điểm BCS chấm'}
                        </div>
                     </div>
                  </div>

                  <div className="mb-6 space-y-3">
                     <div className="text-sm font-bold text-foreground flex items-center gap-2">
                        Tiêu chí: <span className="text-primary font-mono bg-primary-light px-1.5 py-0.5 rounded text-xs">[{selectedAppeal.criteriaCode}]</span>
                     </div>
                     <div className="text-sm text-foreground bg-surface-muted p-3 rounded-lg border border-border">
                        {selectedAppeal.criteriaContent}
                     </div>
                     
                     {selectedAppeal.proofUrl ? (
                        <a href={selectedAppeal.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-info-foreground bg-info-bg px-3 py-1.5 rounded-lg border border-info-border hover:bg-info-border transition-colors">
                           <FileText size={16} /> Xem minh chứng
                        </a>
                     ) : (
                        <span className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground bg-surface-muted px-3 py-1.5 rounded-lg border border-border">
                           <FileText size={16} className="opacity-50" /> Không có minh chứng đính kèm
                        </span>
                     )}
                  </div>

                  {selectedAppeal.currentScores && (
                     <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="text-center bg-card p-3 rounded-lg border border-border shadow-sm">
                           <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">SV tự chấm</div>
                           <div className="text-xl font-black text-foreground mt-1">{selectedAppeal.currentScores.STUDENT ?? '—'}</div>
                        </div>
                        <div className="text-center bg-card p-3 rounded-lg border border-border shadow-sm">
                           <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">BCS chấm</div>
                           <div className={`text-xl font-black mt-1 ${selectedAppeal.appealType === 'class' ? 'text-danger' : 'text-foreground'}`}>
                              {selectedAppeal.currentScores.CLASS_COMMITTEE ?? '—'}
                           </div>
                        </div>
                        <div className="text-center bg-card p-3 rounded-lg border border-border shadow-sm">
                           <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">CVHT chấm</div>
                           <div className={`text-xl font-black mt-1 ${selectedAppeal.appealType === 'advisor' ? 'text-danger' : 'text-foreground'}`}>
                              {selectedAppeal.currentScores.ADVISOR ?? '—'}
                           </div>
                        </div>
                     </div>
                  )}

                  <div className="mb-6">
                     <div className="text-sm font-bold text-foreground mb-2">Lý do của sinh viên:</div>
                     <div className="text-sm text-foreground bg-warning-bg p-4 rounded-lg border border-warning-border italic">
                        &quot;{selectedAppeal.reason}&quot;
                     </div>
                  </div>

                  {selectedAppeal.status === 'PENDING' ? (
                     <div className="space-y-6 pt-4 border-t border-border">
                        <div className="space-y-3">
                           <label className="text-sm font-bold text-foreground block">Quyết định <span className="text-danger">*</span></label>
                           <div className="flex gap-6">
                              <label className="flex items-center gap-2 cursor-pointer">
                                 <input type="radio" name="decision" checked={decision === 'ACCEPTED'} onChange={() => setDecision('ACCEPTED')} className="w-4 h-4 text-success focus:ring-success accent-success" />
                                 <span className="text-sm font-bold text-success">Đề xuất chấp nhận & Đổi điểm</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                 <input type="radio" name="decision" checked={decision === 'REJECTED'} onChange={() => setDecision('REJECTED')} className="w-4 h-4 text-danger focus:ring-danger accent-danger" />
                                 <span className="text-sm font-bold text-danger">Đề xuất từ chối (Giữ nguyên)</span>
                              </label>
                           </div>
                        </div>

                        {decision === 'ACCEPTED' && (
                           <div className="space-y-1.5">
                              <label className="text-sm font-bold text-foreground block">Nhập điểm mới (cho {selectedAppeal.appealType === 'advisor' ? 'CVHT' : 'BCS'}) <span className="text-danger">*</span></label>
                              <input 
                                 type="number" 
                                 className="w-full h-10 px-3 text-sm border border-border rounded-lg bg-surface focus:border-primary focus:ring-1 focus:ring-ring outline-none transition-all" 
                                 value={newScore} 
                                 onChange={e => setNewScore(e.target.value !== '' ? Number(e.target.value) : '')}
                                 placeholder="Nhập số điểm..."
                              />
                           </div>
                        )}

                        <div className="space-y-1.5">
                           <label className="text-sm font-bold text-foreground block">Phản hồi cho sinh viên <span className="text-danger">*</span></label>
                           <textarea
                              className="w-full p-3 text-sm border border-border rounded-xl bg-surface focus:border-primary focus:ring-1 focus:ring-ring outline-none transition-all placeholder:text-muted-foreground resize-y min-h-[100px]"
                              value={resolution}
                              onChange={e => setResolution(e.target.value)}
                              placeholder="Nhập nội dung phản hồi..."
                           />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                           <Button variant="outline" onClick={() => setSelectedAppeal(null)}>Hủy</Button>
                           <Button 
                              variant={decision === 'ACCEPTED' ? 'primary' : 'danger'}
                              onClick={handleResolve} 
                              isLoading={submitting}
                              disabled={submitting}
                           >
                              Đề xuất & Trình lên Admin
                           </Button>
                        </div>

                        <div className="mt-3 p-3 bg-warning-bg rounded-lg border border-warning-border text-sm text-warning-foreground">
                           ⚠️ <strong>Lưu ý:</strong> Đề xuất của Khoa sẽ được gửi lên Admin trường để phê duyệt cuối cùng. Khoa không trực tiếp thay đổi điểm.
                        </div>
                     </div>
                  ) : (
                     <div className="bg-surface-muted p-4 rounded-xl border border-border">
                        <div className="text-sm font-bold text-foreground mb-3">Kết quả xử lý:</div>
                        <div className="flex items-center gap-3 mb-3">
                           <StatusBadge status={selectedAppeal.status} type="appeal" />
                           <span className="text-xs text-muted-foreground">
                              bởi <strong>{selectedAppeal.resolvedBy}</strong> vào ngày {new Date(selectedAppeal.resolvedAt!).toLocaleDateString('vi-VN')}
                           </span>
                        </div>
                        <div className="text-sm text-foreground bg-card p-3 rounded-lg border border-border shadow-sm">
                           <span className="font-bold">Phản hồi:</span> {selectedAppeal.resolution}
                        </div>
                     </div>
                  )}
               </div>
            </div>
         </div>
      )}

    </DashboardLayout>
  );
}
