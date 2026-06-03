'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardLayout } from '../../components/DashboardLayout';

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
  max_points: number;
  parent_id: number | null;
  studentScore: number | null;
  classScore: number | null;
  advisorScore: number | null;
}

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Đang chờ xử lý', bg: '#fef3c7', color: '#d97706' },
  ACCEPTED: { label: 'Đã chấp nhận', bg: '#ecfdf5', color: '#059669' },
  REJECTED: { label: 'Đã từ chối', bg: '#fef2f2', color: '#dc2626' },
};

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
          .filter((d: any) => d.hasSheet)
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
      console.log('[appeals] criteria fetch status:', r.status);
      if (r.ok) {
        const j = await r.json();
        console.log('[appeals] criteria data:', j.data?.length, 'items');
        setCriteriaList(j.data || []);
      } else {
        const errText = await r.text();
        console.error('[appeals] criteria fetch error:', r.status, errText);
      }
    } catch (err) { console.error('[appeals] criteria fetch exception:', err); }
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
  const getChildren = (parentId: number) => criteriaList.filter(c => c.parent_id === parentId);


  return (
    <DashboardLayout
      pageTitle="Khiếu nại điểm"
      pageSubtitle="Gửi khiếu nại về điểm Ban cán sự hoặc Cố vấn học tập"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn-primary"
            onClick={() => { setShowForm(!showForm); if (!showForm) fetchSheets(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {showForm ? 'Đóng' : 'Tạo khiếu nại mới'}
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="dashboard-card" style={{ padding: 24, animation: 'slideIn 0.3s ease-out' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
              Tạo khiếu nại mới
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 20 }}>
              {/* Chọn học kỳ */}
              <div>
                <label className="form-label">Học kỳ / Phiếu chấm điểm</label>
                <select
                  value={selectedSheetId}
                  onChange={(e) => setSelectedSheetId(e.target.value)}
                  className="form-select"
                >
                  {sheets.length === 0 && <option value="">-- Không có phiếu --</option>}
                  {sheets.map((s) => (
                    <option key={s.sheetId} value={s.sheetId}>{s.semesterName}</option>
                  ))}
                </select>
              </div>

              {/* Loại khiếu nại */}
              <div>
                <label className="form-label">Loại khiếu nại</label>
                <select
                  value={appealType}
                  onChange={(e) => setAppealType(e.target.value as 'class' | 'advisor')}
                  className="form-select"
                >
                  <option value="class">Điểm Ban cán sự (BCS) chấm</option>
                  <option value="advisor">Điểm Cố vấn học tập (CVHT) chấm</option>
                </select>
              </div>
            </div>

            {/* Hiển thị điểm hiện tại */}
            {selectedSheet && (
              <div style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 16, marginBottom: 20,
                display: 'flex', gap: 24, flexWrap: 'wrap',
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Điểm BCS chấm
                  </div>
                  <div style={{
                    fontSize: 24, fontWeight: 800,
                    color: appealType === 'class' ? '#dc2626' : 'var(--text-primary)',
                  }}>
                    {selectedSheet.classTotal ?? '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Điểm CVHT chấm
                  </div>
                  <div style={{
                    fontSize: 24, fontWeight: 800,
                    color: appealType === 'advisor' ? '#dc2626' : 'var(--text-primary)',
                  }}>
                    {selectedSheet.advisorTotal ?? '—'}
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    fontSize: 12, color: '#d97706', background: '#fef3c7',
                    padding: '6px 12px', borderRadius: 8, fontWeight: 500,
                  }}>
                    ⚠ Bạn đang khiếu nại về: <strong>{appealType === 'class' ? 'Điểm BCS' : 'Điểm CVHT'}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Chọn tiêu chí */}
            <div style={{ marginBottom: 20 }}>
              <label className="form-label">Tiêu chí khiếu nại *</label>
              {loadingCriteria ? (
                <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>Đang tải tiêu chí...</div>
              ) : criteriaList.length === 0 ? (
                <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>Không có tiêu chí nào (chưa chọn phiếu hoặc chưa có dữ liệu)</div>
              ) : (
                <>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                    {rootCriteria.map(parent => {
                      const isExpanded = expandedParents.has(parent.id);
                      const children = getChildren(parent.id);
                      if (children.length === 0) return null; // Only show parents that have children

                      return (
                        <div key={parent.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <div 
                            onClick={() => toggleParent(parent.id)}
                            style={{ 
                              padding: '12px 16px', background: isExpanded ? 'var(--bg-surface)' : '#fff', 
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              fontWeight: 600, fontSize: 14, color: 'var(--text-primary)'
                            }}
                          >
                            <div>[{parent.code}] {parent.content}</div>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </div>
                          
                          {isExpanded && (
                            <div style={{ padding: '0 16px 12px 16px', background: 'var(--bg-surface)' }}>
                              {children.map(child => {
                                const isSelected = selectedCriteriaIds.has(child.id);
                                return (
                                  <div 
                                    key={child.id}
                                    onClick={() => toggleSelectedCriteria(child.id)}
                                    style={{
                                      padding: '10px 12px', marginTop: 8, borderRadius: 6, cursor: 'pointer',
                                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                                      background: isSelected ? 'var(--accent-light)' : '#fff',
                                      display: 'flex', alignItems: 'center', gap: 12
                                    }}
                                  >
                                    <input 
                                      type="checkbox" 
                                      checked={isSelected} 
                                      readOnly
                                      style={{ margin: 0, cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--accent)' }}
                                    />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: 'var(--text-primary)' }}>
                                        [{child.code}] {child.content}
                                      </div>
                                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        Tối đa: {child.max_points} điểm
                                      </div>
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

                  {/* Hiện chi tiết điểm của tiêu chí đã chọn */}
                  {selectedCriteria.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        Chi tiết các tiêu chí đang chọn ({selectedCriteria.length}):
                      </div>
                      {selectedCriteria.map(sc => (
                        <div key={sc.id} style={{
                          background: '#f8fafc', border: '1px solid var(--border)',
                          borderRadius: 8, padding: 14, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center',
                        }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                              [{sc.code}] {sc.content}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              Điểm tối đa: {sc.max_points}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 16 }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>SV chấm</div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{sc.studentScore ?? '—'}</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: appealType === 'class' ? '#dc2626' : 'var(--text-muted)', textTransform: 'uppercase' }}>BCS chấm</div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: appealType === 'class' ? '#dc2626' : 'var(--text-primary)' }}>{sc.classScore ?? '—'}</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: appealType === 'advisor' ? '#dc2626' : 'var(--text-muted)', textTransform: 'uppercase' }}>CVHT chấm</div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: appealType === 'advisor' ? '#dc2626' : 'var(--text-primary)' }}>{sc.advisorScore ?? '—'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Lý do */}
            <div style={{ marginBottom: 20 }}>
              <label className="form-label">Lý do khiếu nại *</label>
              <textarea
                className="form-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Mô tả chi tiết lý do bạn muốn khiếu nại điểm này..."
                rows={4}
                style={{ resize: 'vertical', minHeight: 100 }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Hủy</button>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={submitting || !reason.trim() || !selectedSheetId || selectedCriteriaIds.size === 0}
                style={{ opacity: submitting || !reason.trim() || !selectedSheetId || selectedCriteriaIds.size === 0 ? 0.5 : 1 }}
              >
                {submitting ? 'Đang gửi...' : 'Gửi khiếu nại'}
              </button>
            </div>
          </div>
        )}

        {/* Appeals list */}
        <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Danh sách khiếu nại
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0 0' }}>
              {appeals.length} khiếu nại
            </p>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>
          ) : appeals.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 500 }}>Bạn chưa có khiếu nại nào</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nhấn &quot;Tạo khiếu nại mới&quot; để bắt đầu</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>STT</th>
                    <th>Học kỳ</th>
                    <th style={{ width: 130 }}>Loại</th>
                    <th>Tiêu chí</th>
                    <th>Lý do</th>
                    <th style={{ width: 140, textAlign: 'center' }}>Trạng thái</th>
                    <th>Phản hồi</th>
                    <th style={{ width: 130 }}>Ngày gửi</th>
                  </tr>
                </thead>
                <tbody>
                  {appeals.map((a, i) => {
                    const st = STATUS_MAP[a.status] || STATUS_MAP.PENDING;
                    return (
                      <tr key={a.id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{a.semesterName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.classCode} - {a.className}</div>
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
                            background: a.appealType === 'advisor' ? '#f3e8ff' : '#eff6ff',
                            color: a.appealType === 'advisor' ? '#7c3aed' : '#2563eb',
                          }}>
                            {a.appealType === 'advisor' ? 'Điểm CVHT' : 'Điểm BCS'}
                          </span>
                        </td>
                        <td>
                          {a.criteriaCode ? (
                            <div>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 6px', borderRadius: 4, marginRight: 6 }}>{a.criteriaCode}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.criteriaContent}</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.reason}>
                            {a.reason}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 999,
                            background: st.bg, color: st.color,
                          }}>
                            {st.label}
                          </span>
                        </td>
                        <td>
                          {a.resolution ? (
                            <div>
                              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{a.resolution}</div>
                              {a.resolvedBy && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                  — {a.resolvedBy}
                                  {a.resolvedAt && ` (${new Date(a.resolvedAt).toLocaleDateString('vi-VN')})`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {new Date(a.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
