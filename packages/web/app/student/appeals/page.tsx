'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AlertTriangle, Plus, ChevronDown, CheckSquare, MessageSquare, ShieldAlert, FileText, ChevronRight } from 'lucide-react';

interface AppealItem {
  id: string;
  reason: string;
  appealType: string;
  criteriaCode: string | null;
  criteriaContent: string | null;
  status: string;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  sheetId: string;
  semesterName: string;
  semesterCode: string;
  className: string;
  classCode: string;
  studentTotal: number | null;
  classTotal: number | null;
  advisorTotal: number | null;
  finalTotal: number | null;
  classification: string | null;
}

interface SheetOption {
  sheetId: string;
  semesterName: string;
  classTotal: number | null;
  advisorTotal: number | null;
}

interface CriteriaItem {
  id: number;
  code: string;
  content: string;
  point: number;
  parent_id: number | null;
  studentScore: number | null;
  classScore: number | null;
  advisorScore: number | null;
}

export default function StudentAppealsPage() {
  const { data: session } = useSession();
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [sheets, setSheets] = useState<SheetOption[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState('');
  const [appealType, setAppealType] = useState<'class' | 'advisor'>('class');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Accordion state for criteria
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set());
  const toggleParent = (id: number) => {
    const next = new Set(expandedParents);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedParents(next);
  };


  // Criteria state
  const [criteriaList, setCriteriaList] = useState<CriteriaItem[]>([]);
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<Set<number>>(new Set());
  const [loadingCriteria, setLoadingCriteria] = useState(false);

  const toggleSelectedCriteria = (id: number) => {
    const next = new Set(selectedCriteriaIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCriteriaIds(next);
  };

  const fetchAppeals = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/appeals');
      if (r.ok) {
        const j = await r.json();
        setAppeals(j.data || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  // Fetch sheets for the form dropdown
  const fetchSheets = useCallback(async () => {
    try {
      const r = await fetch('/api/scoring-history');
      if (r.ok) {
        const j = await r.json();
        const opts: SheetOption[] = (j.data || [])
          .filter((d: any) => d.hasSheet && (d.status === 'ADVISOR_APPROVED' || d.status === 'FINALIZED'))
          .map((d: any) => ({
            sheetId: d.sheetId,
            semesterName: d.semesterName,
            classTotal: d.classTotal,
            advisorTotal: d.advisorTotal,
          }));
        setSheets(opts);
        if (opts.length > 0 && !selectedSheetId) {
          setSelectedSheetId(opts[0].sheetId);
        }
      }
    } catch { /* ignore */ }
  }, [selectedSheetId]);

  // Fetch criteria for selected sheet
  const fetchCriteria = useCallback(async (sheetId: string) => {
    if (!sheetId) return;
    setLoadingCriteria(true);
    setCriteriaList([]);
    setSelectedCriteriaIds(new Set());
    try {
      const r = await fetch(`/api/appeals/criteria?sheetId=${sheetId}`);
      if (r.ok) {
        const j = await r.json();
        setCriteriaList(j.data || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingCriteria(false); }
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchAppeals();
      fetchSheets();
    }
  }, [session, fetchAppeals, fetchSheets]);

  // Reload criteria when sheet changes
  useEffect(() => {
    if (selectedSheetId && showForm) {
      fetchCriteria(selectedSheetId);
    }
  }, [selectedSheetId, showForm, fetchCriteria]);

  const handleSubmit = async () => {
    if (!selectedSheetId || !reason.trim()) {
      return alert('Vui lòng chọn học kỳ và nhập lý do khiếu nại');
    }
    if (selectedCriteriaIds.size === 0) {
      return alert('Vui lòng chọn ít nhất một tiêu chí muốn khiếu nại');
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scoring_sheet_id: selectedSheetId,
          reason: reason.trim(),
          appeal_type: appealType,
          criteria_ids: Array.from(selectedCriteriaIds),
        }),
      });
      const d = await r.json();
      if (r.ok) {
        alert('Gửi khiếu nại thành công!');
        setShowForm(false);
        setReason('');
        setSelectedCriteriaIds(new Set());
        fetchAppeals();
      } else {
        alert(d.message || 'Có lỗi xảy ra');
      }
    } catch {
      alert('Lỗi kết nối');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSheet = sheets.find((s) => s.sheetId === selectedSheetId);
  const selectedCriteria = criteriaList.filter((c) => selectedCriteriaIds.has(c.id));

  const rootCriteria = criteriaList.filter(c => c.parent_id === null || c.parent_id === 0);
  
  const getLeafDescendants = (parentId: number): CriteriaItem[] => {
    const children = criteriaList.filter(c => c.parent_id === parentId);
    if (children.length === 0) return [];
    
    let leaves: CriteriaItem[] = [];
    for (const child of children) {
      const childLeaves = getLeafDescendants(child.id);
      if (childLeaves.length > 0) {
        leaves = leaves.concat(childLeaves);
      } else {
        leaves.push(child);
      }
    }
    return leaves;
  };

  return (
    <DashboardLayout
      pageTitle="Khiếu nại điểm"
      pageSubtitle="Gửi khiếu nại về điểm Ban cán sự hoặc Cố vấn học tập"
      breadcrumbs={[{ label: 'Khiếu nại điểm' }]}
    >
      <div className="space-y-6">
        {/* Header actions */}
        <div className="flex justify-end">
          <Button
            variant={showForm ? 'outline' : 'primary'}
            onClick={() => { setShowForm(!showForm); if (!showForm) fetchSheets(); }}
            leftIcon={showForm ? undefined : <Plus size={16} />}
          >
            {showForm ? 'Đóng form khiếu nại' : 'Tạo khiếu nại mới'}
          </Button>
        </div>

        {/* Create form */}
        {showForm && (
          <Card className="animate-in slide-in-from-top-4 duration-300 border-primary/20 shadow-md">
            <CardHeader className="border-b border-border bg-surface-muted">
              <CardTitle className="text-primary flex items-center gap-2">
                <ShieldAlert size={20} />
                Tạo khiếu nại mới
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-foreground">Học kỳ / Phiếu chấm điểm</label>
                  <select
                    value={selectedSheetId}
                    onChange={(e) => setSelectedSheetId(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-border rounded-lg bg-surface focus:border-primary focus:ring-1 focus:ring-ring outline-none transition-all"
                  >
                    {sheets.length === 0 && <option value="">-- Không có phiếu --</option>}
                    {sheets.map((s) => (
                      <option key={s.sheetId} value={s.sheetId}>{s.semesterName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-foreground">Loại khiếu nại</label>
                  <select
                    value={appealType}
                    onChange={(e) => setAppealType(e.target.value as 'class' | 'advisor')}
                    className="w-full h-10 px-3 text-sm border border-border rounded-lg bg-surface focus:border-primary focus:ring-1 focus:ring-ring outline-none transition-all"
                  >
                    <option value="class">Điểm Ban cán sự (BCS) chấm</option>
                    <option value="advisor">Điểm Cố vấn học tập (CVHT) chấm</option>
                  </select>
                </div>
              </div>

              {selectedSheet && (
                <div className="bg-surface-muted border border-border rounded-xl p-5 flex flex-wrap gap-8">
                  <div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Điểm BCS chấm</div>
                    <div className={`text-3xl font-black ${appealType === 'class' ? 'text-danger' : 'text-foreground'}`}>
                      {selectedSheet.classTotal ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Điểm CVHT chấm</div>
                    <div className={`text-3xl font-black ${appealType === 'advisor' ? 'text-danger' : 'text-foreground'}`}>
                      {selectedSheet.advisorTotal ?? '—'}
                    </div>
                  </div>
                  <div className="flex-1 flex items-center">
                    <div className="bg-warning-bg text-warning-foreground px-4 py-2.5 rounded-lg text-sm font-medium border border-warning-border flex items-center gap-2">
                      <AlertTriangle size={16} />
                      Bạn đang khiếu nại về: <span className="font-bold">{appealType === 'class' ? 'Điểm BCS' : 'Điểm CVHT'}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground">Tiêu chí khiếu nại <span className="text-danger">*</span></label>
                
                {loadingCriteria ? (
                  <div className="p-4 text-center text-muted-foreground text-sm flex justify-center items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></div>
                    Đang tải tiêu chí...
                  </div>
                ) : criteriaList.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm border border-dashed border-border rounded-lg bg-surface-muted">
                    Không có tiêu chí nào (chưa chọn phiếu hoặc chưa có dữ liệu)
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                      {rootCriteria.map(parent => {
                        const isExpanded = expandedParents.has(parent.id);
                        const children = getLeafDescendants(parent.id);
                        
                        if (children.length === 0) {
                          const isSelected = selectedCriteriaIds.has(parent.id);
                          return (
                            <div key={parent.id} className="border-b border-border last:border-b-0 bg-card p-2">
                              <div 
                                onClick={() => toggleSelectedCriteria(parent.id)}
                                className={`p-3 rounded-lg cursor-pointer flex items-center gap-3 transition-all ${
                                  isSelected 
                                    ? 'border-2 border-primary bg-primary-light/10 shadow-sm' 
                                    : 'border border-transparent hover:bg-surface-muted'
                                }`}
                              >
                                <input 
                                  type="checkbox" 
                                  checked={isSelected} 
                                  readOnly
                                  className="w-4 h-4 rounded text-primary focus:ring-primary border-gray-300"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-foreground">
                                    <span className="text-primary font-mono bg-primary-light px-1.5 py-0.5 rounded mr-2 text-xs">{parent.code}</span>
                                    {parent.content}
                                  </div>
                                </div>
                                <div className="text-center px-2">
                                  <div className={`text-[10px] font-bold uppercase ${appealType === 'class' ? 'text-danger' : 'text-muted-foreground'}`}>BCS</div>
                                  <div className={`text-lg font-black ${appealType === 'class' ? 'text-danger' : 'text-foreground'}`}>{parent.classScore ?? '—'}</div>
                                </div>
                                <div className="text-center px-2">
                                  <div className={`text-[10px] font-bold uppercase ${appealType === 'advisor' ? 'text-danger' : 'text-muted-foreground'}`}>CVHT</div>
                                  <div className={`text-lg font-black ${appealType === 'advisor' ? 'text-danger' : 'text-foreground'}`}>{parent.advisorScore ?? '—'}</div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={parent.id} className="border-b border-border last:border-b-0">
                            <div 
                              onClick={() => toggleParent(parent.id)}
                              className={`p-3 sm:px-4 cursor-pointer flex items-center justify-between font-bold text-sm text-foreground transition-colors ${
                                isExpanded ? 'bg-surface-muted' : 'bg-card hover:bg-surface-muted'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-primary font-mono bg-primary-light px-1.5 py-0.5 rounded text-xs">{parent.code}</span>
                                {parent.content}
                              </div>
                              <ChevronDown size={18} className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                            
                            {isExpanded && (
                              <div className="p-2 sm:p-3 bg-surface border-t border-border space-y-1.5">
                                {children.map((child: CriteriaItem) => {
                                  const isSelected = selectedCriteriaIds.has(child.id);
                                  return (
                                    <div 
                                      key={child.id}
                                      onClick={() => toggleSelectedCriteria(child.id)}
                                      className={`p-3 rounded-lg cursor-pointer flex items-center gap-3 transition-all ${
                                        isSelected 
                                          ? 'border-2 border-primary bg-primary-light/10 shadow-sm' 
                                          : 'border border-border bg-card hover:border-primary/30'
                                      }`}
                                    >
                                      <input 
                                        type="checkbox" 
                                        checked={isSelected} 
                                        readOnly
                                        className="w-4 h-4 rounded text-primary focus:ring-primary border-gray-300"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className={`text-sm ${isSelected ? 'font-bold' : 'font-medium'} text-foreground leading-tight`}>
                                          <span className="text-muted-foreground font-mono text-xs mr-2">[{child.code}]</span>
                                          {child.content}
                                        </div>
                                      </div>
                                      <div className="text-center px-2">
                                        <div className={`text-[10px] font-bold uppercase ${appealType === 'class' ? 'text-danger' : 'text-muted-foreground'}`}>BCS</div>
                                        <div className={`text-base font-black ${appealType === 'class' ? 'text-danger' : 'text-foreground'}`}>{child.classScore ?? '—'}</div>
                                      </div>
                                      <div className="text-center px-2 border-l border-border pl-4">
                                        <div className={`text-[10px] font-bold uppercase ${appealType === 'advisor' ? 'text-danger' : 'text-muted-foreground'}`}>CVHT</div>
                                        <div className={`text-base font-black ${appealType === 'advisor' ? 'text-danger' : 'text-foreground'}`}>{child.advisorScore ?? '—'}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Selected Criteria Summary */}
                    {selectedCriteria.length > 0 && (
                      <div className="bg-primary-light border border-primary-light rounded-xl p-4">
                        <div className="text-sm font-bold text-primary flex items-center gap-2 mb-3">
                          <CheckSquare size={16} />
                          Các tiêu chí đã chọn ({selectedCriteria.length})
                        </div>
                        <div className="space-y-2">
                          {selectedCriteria.map(sc => (
                            <div key={sc.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-4 shadow-sm">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-foreground truncate">
                                  <span className="text-primary font-mono mr-1">[{sc.code}]</span>
                                  {sc.content}
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <div className="text-center">
                                  <div className="text-[10px] font-bold text-muted-foreground uppercase">SV</div>
                                  <div className="text-sm font-black text-foreground">{sc.studentScore ?? '—'}</div>
                                </div>
                                <div className="text-center">
                                  <div className={`text-[10px] font-bold uppercase ${appealType === 'class' ? 'text-danger' : 'text-muted-foreground'}`}>BCS</div>
                                  <div className={`text-sm font-black ${appealType === 'class' ? 'text-danger' : 'text-foreground'}`}>{sc.classScore ?? '—'}</div>
                                </div>
                                <div className="text-center">
                                  <div className={`text-[10px] font-bold uppercase ${appealType === 'advisor' ? 'text-danger' : 'text-muted-foreground'}`}>CVHT</div>
                                  <div className={`text-sm font-black ${appealType === 'advisor' ? 'text-danger' : 'text-foreground'}`}>{sc.advisorScore ?? '—'}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-foreground">Lý do khiếu nại <span className="text-danger">*</span></label>
                <textarea
                  className="w-full p-3 text-sm border border-border rounded-xl bg-surface focus:border-primary focus:ring-1 focus:ring-ring outline-none transition-all placeholder:text-muted-foreground resize-y min-h-[120px]"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Mô tả chi tiết lý do bạn muốn khiếu nại điểm này..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setShowForm(false)}>Hủy</Button>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={submitting || !reason.trim() || !selectedSheetId || selectedCriteriaIds.size === 0}
                  isLoading={submitting}
                >
                  Gửi khiếu nại
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Appeals list */}
        <Card>
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle>Danh sách khiếu nại</CardTitle>
              <div className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                {appeals.length} yêu cầu
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
                <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4"></div>
                <p className="text-sm font-medium">Đang tải dữ liệu...</p>
              </div>
            ) : appeals.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Chưa có khiếu nại nào"
                description="Nhấn 'Tạo khiếu nại mới' để gửi yêu cầu xem xét lại điểm số."
                action={
                  <Button variant="outline" onClick={() => setShowForm(true)}>
                    Tạo khiếu nại
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-muted border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-bold">
                      <th className="px-4 py-3 font-semibold w-12 text-center">STT</th>
                      <th className="px-4 py-3 font-semibold">Học kỳ / Lớp</th>
                      <th className="px-4 py-3 font-semibold w-32">Loại</th>
                      <th className="px-4 py-3 font-semibold">Tiêu chí & Lý do</th>
                      <th className="px-4 py-3 font-semibold w-40 text-center">Trạng thái</th>
                      <th className="px-4 py-3 font-semibold w-40">Ngày gửi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {appeals.map((a, i) => (
                      <tr key={a.id} className="hover:bg-surface-muted transition-colors group">
                        <td className="px-4 py-4 text-sm text-muted-foreground text-center">{i + 1}</td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-bold text-foreground">{a.semesterName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{a.classCode}</div>
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
                        <td className="px-4 py-4 max-w-xs">
                          {a.criteriaCode ? (
                            <div className="mb-2 line-clamp-1" title={a.criteriaContent || ''}>
                              <span className="font-mono text-xs font-bold text-primary bg-primary-light px-1.5 py-0.5 rounded mr-2">{a.criteriaCode}</span>
                              <span className="text-sm text-muted-foreground">{a.criteriaContent}</span>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground mb-2">—</div>
                          )}
                          <div className="text-sm text-foreground bg-surface-muted p-2.5 rounded-lg border border-border mt-2 shadow-sm line-clamp-2" title={a.reason}>
                            <span className="font-bold text-muted-foreground mr-1">Lý do:</span> {a.reason}
                          </div>
                          {a.resolution && (
                            <div className="mt-3 p-3 bg-success-bg border border-success-border rounded-lg text-sm text-success-foreground flex items-start gap-2">
                              <MessageSquare size={14} className="mt-0.5 shrink-0" />
                              <div>
                                <div className="font-medium">{a.resolution}</div>
                                {a.resolvedBy && (
                                  <div className="text-xs text-success-foreground mt-1 font-semibold">
                                    Phản hồi bởi: {a.resolvedBy}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <StatusBadge status={a.status} type="appeal" />
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground font-medium">
                          {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                          <div className="text-[10px] mt-0.5 text-muted-foreground opacity-80">
                            {new Date(a.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
