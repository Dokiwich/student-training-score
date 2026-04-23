'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ScoringForm } from './ScoringForm';

const API_BASE = '/proxy-api';

interface StudentRow {
  id: string;
  studentCode: string | null;
  name: string;
  email: string;
  formId: string | null;
  status: string;
  studentTotal: number | null;
  classTotal: number | null;
  advisorTotal: number | null;
  finalTotal: number | null;
  classification: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  NO_SHEET: { label: 'Chưa tạo', color: '#9ca3af', bg: '#f3f4f6' },
  DRAFT: { label: 'Nháp', color: '#6b7280', bg: '#f3f4f6' },
  STUDENT_SUBMITTED: { label: 'SV đã nộp', color: '#2563eb', bg: '#eff6ff' },
  CLASS_REVIEWING: { label: 'Đang xét', color: '#d97706', bg: '#fffbeb' },
  CLASS_REVIEWED: { label: 'Đã duyệt', color: '#059669', bg: '#ecfdf5' },
  ADVISOR_REVIEWING: { label: 'CVHT xét', color: '#d97706', bg: '#fffbeb' },
  ADVISOR_APPROVED: { label: 'CVHT duyệt', color: '#059669', bg: '#ecfdf5' },
  SCHOOL_REVIEWING: { label: 'Trường xét', color: '#7c3aed', bg: '#f5f3ff' },
  SCHOOL_APPROVED: { label: 'Trường duyệt', color: '#059669', bg: '#ecfdf5' },
  APPEALING: { label: 'Phúc khảo', color: '#d97706', bg: '#fffbeb' },
  FINALIZED: { label: 'Đã chốt', color: '#059669', bg: '#ecfdf5' },
};

interface ScoringDashboardProps {
  role: 'CLASS_COMMITTEE' | 'ADVISOR';
  showHeader?: boolean;
}

const ROLE_META = {
  CLASS_COMMITTEE: { title: 'Ban Cán Sự Chấm Điểm', subtitle: 'Xét duyệt rèn luyện HK1 — 2026', scoreCol: 'classTotal' as const },
  ADVISOR: { title: 'Cố Vấn Duyệt Điểm', subtitle: 'Xét duyệt rèn luyện HK1 — 2026', scoreCol: 'advisorTotal' as const },
};

export function ScoringDashboard({ role, showHeader = true }: ScoringDashboardProps) {
  const { data: session } = useSession();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetKey, setResetKey] = useState(0); // force ScoringForm remount after reset

  const meta = ROLE_META[role];

  useEffect(() => {
    if (!session?.user) return;
    const fetchStudents = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const customJwt = (session as any)?.customJwt;
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (customJwt) headers['Authorization'] = `Bearer ${customJwt}`;
        const res = await fetch(`${API_BASE}/scoring/students`, { headers, credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          setStudents(json.data || []);
        } else {
          const errText = await res.text();
          setFetchError(`Lỗi ${res.status}: ${errText}`);
        }
      } catch (err) {
        setFetchError('Không thể kết nối máy chủ');
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudents();
  }, [session]);

  const refetchStudents = useCallback(async () => {
    try {
      const customJwt = (session as any)?.customJwt;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (customJwt) headers['Authorization'] = `Bearer ${customJwt}`;
      const res = await fetch(`${API_BASE}/scoring/students`, { headers, credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setStudents(json.data || []);
      }
    } catch { /* silent */ }
  }, [session]);

  const handleResetSheet = async (studentId: string, studentName: string) => {
    if (!window.confirm(`CẢNH BÁO: Hành động này sẽ XÓA HOÀN TOÀN phiếu điểm của "${studentName}" và tạo phiếu mới trắng. Tiếp tục?`)) return;
    setIsResetting(true);
    try {
      const customJwt = (session as any)?.customJwt;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (customJwt) headers['Authorization'] = `Bearer ${customJwt}`;
      const res = await fetch(`${API_BASE}/scoring/reset/reject`, {
        method: 'POST', credentials: 'include', headers,
        body: JSON.stringify({ studentId }),
      });
      if (res.ok) {
        alert('Đã xóa phiếu thành công! Phiếu mới sẽ được tự động tạo.');
        await refetchStudents();
        setResetKey(prev => prev + 1); // force ScoringForm remount
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.message || 'Lỗi khi xóa phiếu');
      }
    } catch {
      alert('Không thể kết nối máy chủ');
    } finally {
      setIsResetting(false);
    }
  };

  const searchParams = useSearchParams();
  const filterParam = searchParams ? searchParams.get('filter') : null;
  const selectedStudentId = searchParams ? searchParams.get('studentId') : null;

  const router = useRouter();
  const pathname = usePathname();

  const handleStudentClick = (id: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('studentId', id);
    router.push(`${pathname}?${params.toString()}`);
  };

  const filtered = useMemo(() => {
    let result = students;
    if (search) {
      result = result.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || (s.studentCode || '').includes(search));
    }

    if (filterParam === 'scored') {
      if (role === 'CLASS_COMMITTEE') {
        result = result.filter(s => s.status === 'CLASS_REVIEWED' || s.status === 'FINALIZED' || s.status === 'ADVISOR_REVIEWING' || s.status === 'ADVISOR_APPROVED');
      } else {
        result = result.filter(s => s.status === 'ADVISOR_APPROVED' || s.status === 'FINALIZED');
      }
    } else if (filterParam === 'unscored') {
      if (role === 'CLASS_COMMITTEE') {
        result = result.filter(s => s.status === 'STUDENT_SUBMITTED' || s.status === 'CLASS_REVIEWING');
      } else {
        result = result.filter(s => s.status === 'CLASS_REVIEWED' || s.status === 'ADVISOR_REVIEWING');
      }
    } else if (filterParam === 'unsubmitted') {
      result = result.filter(s => s.status === 'NO_SHEET' || s.status === 'DRAFT');
    }

    return result;
  }, [students, search, filterParam, role]);

  const stats = useMemo(() => {
    const total = students.length;
    const submitted = students.filter((s) => s.status !== 'NO_SHEET' && s.status !== 'DRAFT').length;
    return { total, submitted, pct: total > 0 ? Math.round((submitted / total) * 100) : 0 };
  }, [students]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: showHeader ? '100vh' : 'calc(100vh - 160px)',
      minHeight: 600, background: 'var(--bg-surface)', overflow: 'hidden',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    }}>
      {/* Stats bar */}
      {!showHeader && (
        <div style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-inset)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            <span style={{ background: 'var(--accent-light)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 9999, fontWeight: 700 }}>{stats.total}</span> sinh viên
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            <span style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '2px 8px', borderRadius: 9999, fontWeight: 700 }}>{stats.submitted}</span> đã nộp ({stats.pct}%)
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* LEFT SIDEBAR */}
        <div style={{
          background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          transition: 'width 0.3s cubic-bezier(0.16,1,0.3,1)',
          width: sidebarCollapsed ? 56 : 280,
        }}>
          {/* Search */}
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {!sidebarCollapsed && (
              <div style={{ position: 'relative', flex: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input type="text" placeholder="Tìm sinh viên..." value={search} onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '100%', fontSize: 13, padding: '8px 10px 8px 32px', border: '1px solid var(--border)', borderRadius: 8, outline: 'none' }} />
              </div>
            )}
            <button onClick={() => setSidebarCollapsed((v) => !v)}
              style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', flexShrink: 0 }}
              title={sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {sidebarCollapsed ? (
                  <polyline points="9 18 15 12 9 6" />
                ) : (
                  <polyline points="15 18 9 12 15 6" />
                )}
              </svg>
            </button>
          </div>

          {/* Student list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {fetchError ? (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600, marginBottom: 4 }}>Lỗi tải danh sách</p>
                <p style={{ fontSize: 11, color: '#ef4444', wordBreak: 'break-all' }}>{fetchError}</p>
              </div>
            ) : isLoading ? (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 48 }} />
                ))}
              </div>
            ) : sidebarCollapsed ? (
              <div style={{ padding: '8px 0' }}>
                {filtered.map((student) => {
                  const isActive = student.id === selectedStudentId;
                  const initial = student.name.split(' ').pop()?.[0] || '?';
                  return (
                    <button key={student.id} onClick={() => handleStudentClick(student.id)}
                      style={{
                        width: '100%', display: 'flex', justifyContent: 'center', padding: '6px 0', background: isActive ? 'var(--accent-light)' : 'transparent',
                        border: 'none', cursor: 'pointer', transition: 'background 0.15s'
                      }}
                      title={student.name}>
                      <div style={{
                        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                        borderRadius: 'var(--radius)', background: isActive ? 'var(--accent)' : 'var(--bg-inset)',
                        color: isActive ? '#fff' : 'var(--text-secondary)', border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`
                      }}>
                        {initial}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '4px 0' }}>
                {filtered.map((student) => {
                  const isActive = student.id === selectedStudentId;
                  const st = STATUS_MAP[student.status] || { label: student.status, color: '#6b7280', bg: '#f3f4f6' };
                  const score = student[meta.scoreCol];
                  return (
                    <button key={student.id} onClick={() => handleStudentClick(student.id)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '12px 14px', background: isActive ? '#f8fafc' : 'transparent',
                        border: 'none', cursor: 'pointer', transition: 'all 0.15s', borderLeft: `3px solid ${isActive ? '#818cf8' : 'transparent'}`,
                        fontFamily: 'inherit'
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 14, fontWeight: isActive ? 700 : 500, color: '#0f172a',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0
                          }}>{student.name}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{student.studentCode}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.label}</span>
                          </div>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          {score !== null && score !== undefined ? (
                            <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{score}</span>
                          ) : (
                            <span style={{ fontSize: 13, color: '#94a3b8' }}>—</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: 24 }}>Không tìm thấy SV</p>}
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-light)', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length}/{students.length} sinh viên</p>
            </div>
          )}
        </div>

        {/* RIGHT FORM */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {selectedStudent ? (
            <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 80 }}>
              {/* Student info header */}
              <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-surface)', paddingBottom: 12, marginBottom: 12 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)'
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0
                  }}>
                    {selectedStudent.name.split(' ').pop()?.[0] || '?'}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontSize: 14 }}>{selectedStudent.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                      MSSV: <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedStudent.studentCode}</span>
                      &nbsp;·&nbsp;Điểm SV: <strong style={{ color: 'var(--text-primary)' }}>{selectedStudent.studentTotal ?? '—'}</strong>
                    </p>
                  </div>
                  {role === 'ADVISOR' && (
                    <button
                      onClick={() => handleResetSheet(selectedStudent.id, selectedStudent.name)}
                      disabled={isResetting}
                      style={{
                        marginLeft: 'auto', padding: '6px 14px', fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 6,
                        borderRadius: 8, border: '1px solid #ef4444', color: '#ef4444', background: '#fff',
                        cursor: isResetting ? 'not-allowed' : 'pointer', transition: 'all 0.2s', flexShrink: 0,
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                      onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      {isResetting ? 'Đang xóa...' : 'Xóa & Reset phiếu'}
                    </button>
                  )}
                </div>
              </div>
              <ScoringForm key={`${selectedStudentId}-${resetKey}`} forcedRole={role} studentId={selectedStudent.id} studentName={selectedStudent.name} stickyTop="top-[80px]" />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ margin: '0 auto 24px', display: 'flex', justifyContent: 'center' }}>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Chọn sinh viên để bắt đầu chấm điểm</h3>
                <p style={{ fontSize: 14, color: '#64748b' }}>Nhấn vào tên sinh viên ở thanh bên trái để bắt đầu chấm.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
