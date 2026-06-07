'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardLayout } from '../../components/DashboardLayout';

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

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Đang chờ xử lý', bg: '#fef3c7', color: '#d97706' },
  ACCEPTED: { label: 'Đã chấp nhận', bg: '#ecfdf5', color: '#059669' },
  REJECTED: { label: 'Đã từ chối', bg: '#fef2f2', color: '#dc2626' },
};

export default function AdminAppealsPage() {
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

  return (
    <DashboardLayout
      pageTitle="Quản lý khiếu nại (Admin)"
      pageSubtitle="Giám sát và xét duyệt các khiếu nại về điểm rèn luyện của sinh viên toàn trường"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Dashboard stats / Header */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div className="dashboard-card" style={{ flex: 1, padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>CẦN XỬ LÝ</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{pendingCount}</div>
            </div>
          </div>
          <div className="dashboard-card" style={{ flex: 1, padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>ĐÃ XỬ LÝ</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{appeals.length - pendingCount}</div>
            </div>
          </div>
          <div className="dashboard-card" style={{ flex: 1, padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>TỔNG CỘNG</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{appeals.length}</div>
            </div>
          </div>
        </div>

        {/* Appeals list */}
        <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Danh sách khiếu nại
            </h3>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>
          ) : appeals.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 500 }}>Chưa có khiếu nại nào</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>STT</th>
                    <th>Sinh viên</th>
                    <th style={{ width: 120 }}>Đối tượng bị khiếu nại</th>
                    <th style={{ width: 250 }}>Tiêu chí</th>
                    <th>Lý do</th>
                    <th style={{ width: 140, textAlign: 'center' }}>Trạng thái</th>
                    <th style={{ width: 130 }}>Ngày gửi</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {appeals.map((a, i) => {
                    const st = STATUS_MAP[a.status] || STATUS_MAP.PENDING;
                    return (
                      <tr key={a.id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{a.studentName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.studentCode} • Lớp {a.classCode}</div>
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
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={a.criteriaContent || ''}>{a.criteriaContent}</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.reason}>
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
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {new Date(a.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '4px 12px', fontSize: 12 }}
                            onClick={() => handleOpenResolve(a)}
                          >
                            {a.status === 'PENDING' ? 'Xử lý' : 'Chi tiết'}
                          </button>
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

      {/* Resolve Modal */}
      {selectedAppeal && (
        <div className="modal-overlay" onClick={() => setSelectedAppeal(null)}>
          <div className="modal-content" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-header-title">
                {selectedAppeal.status === 'PENDING' ? 'Xử lý khiếu nại' : 'Chi tiết khiếu nại'}
              </h3>
              <button onClick={() => setSelectedAppeal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <div style={{ flex: 1, background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Sinh viên</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedAppeal.studentName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedAppeal.studentCode}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Đối tượng bị khiếu nại</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: selectedAppeal.appealType === 'advisor' ? '#7c3aed' : '#2563eb' }}>
                    {selectedAppeal.appealType === 'advisor' ? 'Điểm CVHT chấm' : 'Điểm BCS chấm'}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Tiêu chí: <span style={{ color: 'var(--accent)' }}>[{selectedAppeal.criteriaCode}]</span></div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                  {selectedAppeal.criteriaContent}
                </div>
                <div style={{ marginTop: 12 }}>
                  {selectedAppeal.proofUrl ? (
                    <a href={selectedAppeal.proofUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#2563eb', textDecoration: 'none', background: '#eff6ff', padding: '6px 12px', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                      Xem minh chứng
                    </a>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path><line x1="4" y1="4" x2="20" y2="20"></line></svg>
                      Không có minh chứng đính kèm
                    </span>
                  )}
                </div>
              </div>

              {selectedAppeal.currentScores && (
                <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                  <div style={{ flex: 1, textAlign: 'center', background: '#f8fafc', padding: '12px 8px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>SV tự chấm</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedAppeal.currentScores.STUDENT ?? '—'}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', background: '#f8fafc', padding: '12px 8px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>BCS chấm</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: selectedAppeal.appealType === 'class' ? '#dc2626' : 'var(--text-primary)' }}>{selectedAppeal.currentScores.CLASS_COMMITTEE ?? '—'}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', background: '#f8fafc', padding: '12px 8px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>CVHT chấm</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: selectedAppeal.appealType === 'advisor' ? '#dc2626' : 'var(--text-primary)' }}>{selectedAppeal.currentScores.ADVISOR ?? '—'}</div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Lý do của sinh viên:</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', background: '#fffbeb', padding: 12, borderRadius: 8, border: '1px solid #fde68a', fontStyle: 'italic' }}>
                  &quot;{selectedAppeal.reason}&quot;
                </div>
              </div>

              {selectedAppeal.status === 'PENDING' ? (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <label className="form-label">Quyết định *</label>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="radio" name="decision" checked={decision === 'ACCEPTED'} onChange={() => setDecision('ACCEPTED')} style={{ accentColor: '#059669', width: 16, height: 16 }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#059669' }}>Chấp nhận & Đổi điểm</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="radio" name="decision" checked={decision === 'REJECTED'} onChange={() => setDecision('REJECTED')} style={{ accentColor: '#dc2626', width: 16, height: 16 }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>Từ chối (Giữ nguyên)</span>
                      </label>
                    </div>
                  </div>

                  {decision === 'ACCEPTED' && (
                    <div style={{ marginBottom: 20 }}>
                      <label className="form-label">Nhập điểm mới (cho {selectedAppeal.appealType === 'advisor' ? 'Cố vấn học tập' : 'Ban cán sự'}) *</label>
                      <input
                        type="number"
                        className="form-input"
                        value={newScore}
                        onChange={e => setNewScore(e.target.value !== '' ? Number(e.target.value) : '')}
                        placeholder="Nhập số điểm..."
                      />
                    </div>
                  )}

                  <div style={{ marginBottom: 20 }}>
                    <label className="form-label">Phản hồi cho sinh viên *</label>
                    <textarea
                      className="form-input"
                      value={resolution}
                      onChange={e => setResolution(e.target.value)}
                      placeholder="Nhập nội dung phản hồi..."
                      rows={3}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                    <button className="btn-secondary" onClick={() => setSelectedAppeal(null)}>Hủy</button>
                    <button
                      className="btn-primary"
                      onClick={handleResolve}
                      disabled={submitting}
                      style={{ background: decision === 'ACCEPTED' ? '#059669' : '#dc2626', borderColor: decision === 'ACCEPTED' ? '#059669' : '#dc2626' }}
                    >
                      {submitting ? 'Đang xử lý...' : 'Xác nhận xử lý'}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Kết quả xử lý:</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 999,
                      background: STATUS_MAP[selectedAppeal.status]?.bg, color: STATUS_MAP[selectedAppeal.status]?.color,
                    }}>
                      {STATUS_MAP[selectedAppeal.status]?.label}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      bởi <strong>{selectedAppeal.resolvedBy}</strong> vào ngày {new Date(selectedAppeal.resolvedAt!).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                    <strong>Phản hồi:</strong> {selectedAppeal.resolution}
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
