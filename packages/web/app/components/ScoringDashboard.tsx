'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  STUDENT_SUBMITTED: { label: 'SV đã nộp', color: '#991b1b', bg: '#fef2f2' },
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
  CLASS_COMMITTEE: {
    title: 'Ban Can Su Cham Diem',
    subtitle: 'Xet duyet ren luyen HK1 - 2026',
    scoreCol: 'classTotal' as const,
  },
  ADVISOR: {
    title: 'Co Van Duyet Diem',
    subtitle: 'Xet duyet ren luyen HK1 - 2026',
    scoreCol: 'advisorTotal' as const,
  },
};


function useCountUp(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrame: number;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };
    animationFrame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return count;
}

export function ScoringDashboard({ role, showHeader = true }: ScoringDashboardProps) {
  const { data: session } = useSession();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [closingDrawer, setClosingDrawer] = useState(false);

  const meta = ROLE_META[role];
  const searchParams = useSearchParams();
  const filterParam = searchParams ? searchParams.get('filter') : null;
  const selectedStudentId = searchParams ? searchParams.get('studentId') : null;
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!session?.user) return;
    const customJwt = (session as any)?.customJwt;
    if (!customJwt) return;

    const fetchStudents = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customJwt}`,
        };

        const res = await fetch(`${API_BASE}/scoring/students`, { headers, credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          setStudents(json.data || []);
        } else {
          if (res.status === 401) {
            setFetchError('Phiên đăng nhập hết hạn. Đang tải lại...');
            const { signOut } = await import('next-auth/react');
            setTimeout(() => { signOut({ callbackUrl: '/login' }); }, 1500);
            return;
          }
          const errText = await res.text().catch(() => '');
          setFetchError(`Lỗi ${res.status}: ${errText}`);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudents();
  }, [session]);

  const refetchStudents = useCallback(async () => {
    try {
      const customJwt = (session as any)?.customJwt;
      if (!customJwt) return;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customJwt}`,
      };
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
      if (!customJwt) { alert('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.'); return; }
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customJwt}`,
      };
      const res = await fetch(`${API_BASE}/scoring/reset/reject`, {
        method: 'POST', credentials: 'include', headers,
        body: JSON.stringify({ studentId }),
      });
      if (res.ok) {
        alert('Đã xóa phiếu thành công! Phiếu mới sẽ được tự động tạo.');
        await refetchStudents();
        setResetKey(prev => prev + 1);
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

  const handleCloseDrawer = useCallback(() => {
    setClosingDrawer(true);
    setTimeout(() => {
      setIsDrawerOpen(false);
      setClosingDrawer(false);
      const params = new URLSearchParams(searchParams?.toString());
      params.delete('studentId');
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);
  }, [searchParams, pathname, router]);

  const handleStudentClick = (id: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('studentId', id);
    // Use View Transitions API if supported
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    } else {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  useEffect(() => {
    if (selectedStudentId) {
      setIsDrawerOpen(true);
    } else {
      setIsDrawerOpen(false);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        handleCloseDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, handleCloseDrawer]);

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
    } else if (filterParam === 'pending') {
      result = result.filter(s => s.status === 'NO_SHEET' || s.status === 'DRAFT');
    }

    return result;
  }, [students, search, filterParam, role]);

  const stats = useMemo(() => {
    const total = students.length;
    const submitted = students.filter((s) => s.status !== 'NO_SHEET' && s.status !== 'DRAFT').length;
    return { total, submitted, pct: total > 0 ? Math.round((submitted / total) * 100) : 0 };
  }, [students]);

  const animatedTotal = useCountUp(stats.total);
  const animatedSubmitted = useCountUp(stats.submitted);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: showHeader ? '100vh' : 'calc(100vh - 160px)',
      minHeight: 600, background: 'var(--bg-surface)', overflow: 'hidden',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* MAIN CONTENT AREA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-page)' }}>
          {/* Header & Stats */}
          <div style={{ padding: '24px 32px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Danh sách sinh viên
            </h2>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input type="text" placeholder="Tìm tên, MSSV..." value={search} onChange={(e) => setSearch(e.target.value)}
                  style={{ width: 220, fontSize: 13, padding: '8px 10px 8px 32px', border: '1px solid var(--border)', borderRadius: 8, outline: 'none' }} />
              </div>
              <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '6px 16px', borderRadius: 'var(--radius-full)', display: 'flex', gap: 16, fontSize: 13, boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ color: 'var(--text-secondary)' }}>Sĩ số: <strong style={{ color: 'var(--text-primary)' }}>{animatedTotal}</strong></div>
                <div style={{ width: 1, background: 'var(--border)' }}></div>
                <div style={{ color: 'var(--text-secondary)' }}>Đã nộp: <strong style={{ color: 'var(--success)' }}>{animatedSubmitted}</strong></div>
              </div>
            </div>
          </div>
          

          <div style={{ flex: 1, padding: '0 32px 24px', overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />)}
              </div>
            ) : fetchError ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--danger)' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>Lỗi tải dữ liệu</div>
                <div style={{ marginTop: 8 }}>{fetchError}</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Không tìm thấy sinh viên nào.</div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-inset)', textAlign: 'left' }}>
                      <th style={{ width: 60, padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>STT</th>
                      <th style={{ width: 140, padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>MSSV</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Họ và Tên</th>
                      <th style={{ width: 140, padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Trạng thái</th>
                      <th style={{ width: 120, padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>Điểm tổng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((student, index) => {
                      const st = STATUS_MAP[student.status] || { label: student.status, color: '#6b7280', bg: '#f3f4f6' };
                      const score = student[meta.scoreCol];
                      const isWarning = student.status === 'NO_SHEET' || student.status === 'DRAFT';
                      
                      return (
                        <tr 
                          key={`${student.id}-${index}`} 
                          onClick={() => handleStudentClick(student.id)}
                          className="staggered-item"
                          style={{ 
                            '--index': index > 20 ? 0 : index, 
                            borderBottom: '1px solid var(--border-light)', cursor: 'pointer', transition: 'background 0.2s'
                          } as React.CSSProperties}
                          onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                        >
                          <td style={{ padding: '16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{index + 1}</td>
                          <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>{student.studentCode}</td>
                          <td style={{ padding: '16px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{student.name}</td>
                          <td style={{ padding: '16px' }}>
                            <span style={{ 
                              display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 9999, 
                              background: st.bg, color: st.color,
                              animation: isWarning ? 'pulseWarning 2s infinite' : 'none'
                            }}>
                              {st.label}
                            </span>
                          </td>
                          <td style={{ padding: '16px', textAlign: 'center', fontSize: 15, fontWeight: 800, color: score !== null ? 'var(--accent)' : 'var(--text-muted)' }}>
                            {score ?? '—'}
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
      </div>

      {/* MODAL OVERLAY & CONTENT */}
      {(isDrawerOpen || closingDrawer) && selectedStudent && (
        <div 
          className="modal-overlay"
          style={{ animation: closingDrawer ? 'fadeIn 0.3s reverse forwards' : 'fadeIn 0.3s forwards' }}
          onClick={handleCloseDrawer}
        >
          {/* Modal Content */}
          <div 
            className="modal-content"
            style={{ 
              maxWidth: '1200px', width: '96vw', height: '90vh', display: 'flex', flexDirection: 'column',
              animation: closingDrawer ? 'modalSlideUp 0.3s reverse forwards' : 'modalSlideUp 0.3s forwards' 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-header-title">
                Chấm điểm: <span style={{ color: 'var(--accent)' }}>{selectedStudent.name}</span>
              </h3>
              <button 
                onClick={handleCloseDrawer} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', transition: 'background 0.2s' }} 
                onMouseOver={e => e.currentTarget.style.background = 'var(--bg-inset)'} 
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                title="Đóng"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'var(--bg-page)' }}>
               {role === 'ADVISOR' && (
                 <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                   <button
                      onClick={() => handleResetSheet(selectedStudent.id, selectedStudent.name)}
                      disabled={isResetting}
                      style={{
                        padding: '6px 14px', fontSize: 12, fontWeight: 600,
                        borderRadius: 8, border: '1px solid #ef4444', color: '#ef4444', background: '#fff',
                        cursor: isResetting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                        display: 'flex', gap: 6, alignItems: 'center'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                      onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      {isResetting ? 'Đang xóa...' : 'Xóa & Reset phiếu'}
                    </button>
                 </div>
               )}
               <ScoringForm key={`${selectedStudent.id}-${resetKey}`} forcedRole={role} studentId={selectedStudent.id} studentName={selectedStudent.name} stickyTop="top-0" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
