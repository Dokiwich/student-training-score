'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ScoringForm } from './ScoringForm';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { StatusBadge } from './ui/StatusBadge';
import { Input } from './ui/Input';
import { EmptyState } from './ui/EmptyState';
import { BulkActionModal } from './BulkActionModal';
import { BulkResultDialog } from './BulkResultDialog';

import { Search, Users, CheckCircle, Clock, FileWarning, X, RefreshCw } from 'lucide-react';

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

export type TabType = 'all' | 'pending' | 'unscored' | 'scored';
export type RoleType = 'CLASS_COMMITTEE' | 'ADVISOR';

export function matchesTab(
  student: { status: string },
  activeTab: TabType,
  role: RoleType
): boolean {
  const { status } = student;

  switch (activeTab) {
    case 'all':
      return true;

    case 'pending':
      return status === 'NO_SHEET' || status === 'DRAFT';

    case 'unscored':
      if (role === 'CLASS_COMMITTEE') {
        return status === 'STUDENT_SUBMITTED' || status === 'CLASS_REVIEWING';
      }
      return status === 'CLASS_REVIEWED' || status === 'ADVISOR_REVIEWING';

    case 'scored':
      if (role === 'CLASS_COMMITTEE') {
        return (
          status === 'CLASS_REVIEWED' ||
          status === 'CLASS_REJECTED' ||
          status === 'ADVISOR_REVIEWING' ||
          status === 'ADVISOR_APPROVED' ||
          status === 'ADVISOR_REJECTED' ||
          status === 'SCHOOL_REVIEWING' ||
          status === 'SCHOOL_APPROVED' ||
          status === 'SCHOOL_REJECTED' ||
          status === 'FINALIZED'
        );
      }
      return (
        status === 'ADVISOR_APPROVED' ||
        status === 'ADVISOR_REJECTED' ||
        status === 'SCHOOL_REVIEWING' ||
        status === 'SCHOOL_APPROVED' ||
        status === 'SCHOOL_REJECTED' ||
        status === 'FINALIZED'
      );

    default:
      return false;
  }
}

export function getEmptyStateMessage({
  role,
  activeTab,
  searchTerm,
}: {
  role: RoleType;
  activeTab: TabType;
  searchTerm: string;
}) {
  if (searchTerm.trim() !== '') {
    return {
      title: 'Không tìm thấy sinh viên',
      description: 'Không có sinh viên nào khớp với từ khóa tìm kiếm.',
    };
  }

  const roleTitle = role === 'ADVISOR' ? 'Cố vấn học tập' : 'Ban cán sự';

  switch (activeTab) {
    case 'unscored':
      return {
        title: 'Không có phiếu cần chấm',
        description: `Hiện không có phiếu nào đang chờ ${roleTitle} đánh giá.`,
      };
    case 'scored':
      return {
        title: 'Chưa có phiếu đã chấm',
        description: `Chưa có phiếu nào được ${roleTitle} đánh giá.`,
      };
    case 'pending':
      return {
        title: 'Không có sinh viên chưa nộp',
        description: 'Tất cả sinh viên đã có phiếu rèn luyện.',
      };
    case 'all':
    default:
      return {
        title: 'Danh sách sinh viên trống',
        description: 'Chưa có sinh viên trong danh sách.',
      };
  }
}

interface ScoringDashboardProps {
  role: RoleType;
  showHeader?: boolean;
  defaultTab?: TabType;
}

// ── Bulk types ──────────────────────────────────────────────────
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

type BulkActionResponse = {
  summary: {
    requested: number;
    unique: number;
    succeeded: number;
    failed: number;
  };
  results: BulkActionResultItem[];
};

type BulkRecoveryState = 'idle' | 'checking' | 'failed';

// ── Eligibility helpers ─────────────────────────────────────────
const canBulkApprove = (student: StudentRow, role: 'CLASS_COMMITTEE' | 'ADVISOR') => {
  if (!student.formId) return false;
  if (role === 'CLASS_COMMITTEE' && student.status === 'STUDENT_SUBMITTED') return true;
  if (role === 'ADVISOR' && student.status === 'CLASS_REVIEWED') return true;
  return false;
};

const canBulkReject = (student: StudentRow, role: 'CLASS_COMMITTEE' | 'ADVISOR') => {
  if (!student.formId) return false;
  if (role === 'CLASS_COMMITTEE' && ['STUDENT_SUBMITTED', 'CLASS_REVIEWING'].includes(student.status)) return true;
  if (role === 'ADVISOR' && ['STUDENT_SUBMITTED', 'CLASS_REVIEWING', 'CLASS_REVIEWED', 'ADVISOR_REVIEWING', 'ADVISOR_APPROVED'].includes(student.status)) return true;
  return false;
};

const ROLE_META = {
  CLASS_COMMITTEE: {
    title: 'Ban cán sự chấm điểm',
    scoreCol: 'classTotal' as const,
  },
  ADVISOR: {
    title: 'Cố vấn học tập duyệt điểm',
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

const BULK_TIMEOUT_MS = 45_000;

export function ScoringDashboard({ role, showHeader = true, defaultTab = 'all' }: ScoringDashboardProps) {
  const { data: session } = useSession();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'unscored' | 'scored'>(defaultTab);

  // Modal state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [closingDrawer, setClosingDrawer] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const meta = ROLE_META[role];
  const searchParams = useSearchParams();
  const selectedStudentId = searchParams ? searchParams.get('studentId') : null;
  const urlClassId = searchParams ? searchParams.get('classId') : null;
  const router = useRouter();
  const pathname = usePathname();

  const [contextRequired, setContextRequired] = useState<{ message: string, classes: {id: string, name: string}[] } | null>(null);

  // Bulk state
  const bulkActionInProgressRef = useRef(false);
  const bulkTimeoutRef = useRef<number | null>(null);
  const [bulkRecoveryState, setBulkRecoveryState] = useState<BulkRecoveryState>('idle');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkActionResponse | null>(null);
  const [isResultDialogOpen, setIsResultDialogOpen] = useState(false);
  const [bulkRecoveryMessage, setBulkRecoveryMessage] = useState<string | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (bulkTimeoutRef.current !== null) {
        window.clearTimeout(bulkTimeoutRef.current);
      }
    };
  }, []);

  // Clear selection on tab or search change
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, search]);

  const fetchStudents = useCallback(async (): Promise<boolean> => {
    if (!session?.user) return false;
    const customJwt = (session as any)?.customJwt;
    if (!customJwt) return false;
    setIsLoading(true);
    setFetchError(null);
    setContextRequired(null);
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customJwt}`,
      };
      let endpoint = `${API_BASE}/scoring/students`;
      if (role === 'CLASS_COMMITTEE') endpoint = `${API_BASE}/scoring/class-committee/students`;
      if (role === 'ADVISOR') endpoint = `${API_BASE}/scoring/advisor/students`;
      if (urlClassId) {
        endpoint += `?classId=${urlClassId}`;
      }
      
      const res = await fetch(endpoint, { headers, credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setStudents(json.data || []);
        return true;
      } else {
        if (res.status === 401) {
          setFetchError('Phiên đăng nhập hết hạn. Đang tải lại...');
          const { signOut } = await import('next-auth/react');
          setTimeout(() => { signOut({ callbackUrl: '/login' }); }, 1500);
          return false;
        }
        
        let jsonError: any = null;
        try {
          jsonError = await res.json();
        } catch (e) {
          // not json
        }
        
        if (res.status === 400 && jsonError?.code === 'CLASS_CONTEXT_REQUIRED') {
          setContextRequired({
            message: jsonError.message || 'Vui lòng chọn lớp',
            classes: jsonError.classes || []
          });
          return false;
        }
        
        const errText = jsonError?.message || await res.text().catch(() => '');
        setFetchError(`Lỗi ${res.status}: ${errText}`);
        return false;
      }
    } catch {
      setFetchError('Không thể kết nối đến máy chủ.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [session, role, urlClassId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleCloseDrawer = useCallback(() => {
    setClosingDrawer(true);
    setTimeout(() => {
      setIsDrawerOpen(false);
      setClosingDrawer(false);
      const params = new URLSearchParams(searchParams?.toString());
      params.delete('studentId');
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, 200);
  }, [searchParams, pathname, router]);

  const handleStudentClick = (id: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('studentId', id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (selectedStudentId) {
      setIsDrawerOpen(true);
      setResetKey(prev => prev + 1);
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
    let result = students.filter((s) => matchesTab(s, activeTab, role));

    const trimmedSearch = search.trim().toLowerCase();
    if (trimmedSearch) {
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(trimmedSearch) ||
          (s.studentCode || '').toLowerCase().includes(trimmedSearch)
      );
    }

    return result;
  }, [students, activeTab, role, search]);

  const stats = useMemo(() => {
    const total = students.length;
    const submitted = students.filter((s) => !matchesTab(s, 'pending', role)).length;

    const unscoredCount = students.filter((s) => matchesTab(s, 'unscored', role)).length;
    const scoredCount = students.filter((s) => matchesTab(s, 'scored', role)).length;
    const pendingCount = students.filter((s) => matchesTab(s, 'pending', role)).length;

    return { total, submitted, scoredCount, unscoredCount, pendingCount };
  }, [students, role]);

  const animatedTotal = useCountUp(stats.total);
  const animatedSubmitted = useCountUp(stats.submitted);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const tabs = [
    { id: 'all', label: 'Tất cả sinh viên', count: stats.total, icon: Users },
    { id: 'unscored', label: 'Cần chấm', count: stats.unscoredCount, icon: Clock },
    { id: 'scored', label: 'Đã chấm', count: stats.scoredCount, icon: CheckCircle },
    { id: 'pending', label: 'Chưa nộp phiếu', count: stats.pendingCount, icon: FileWarning },
  ] as const;

  // ── Bulk action handler ───────────────────────────────────────
  const handleBulkAction = async (reason?: string) => {
    if (bulkActionInProgressRef.current) return;
    if (selectedIds.length === 0) return;

    const selectedStudents = students.filter(s => selectedIds.includes(s.id));
    const eligibleStudents = bulkActionType === 'APPROVE'
      ? selectedStudents.filter(s => canBulkApprove(s, role))
      : selectedStudents.filter(s => canBulkReject(s, role));

    const formIdsToProcess = eligibleStudents
      .map(s => s.formId)
      .filter((id): id is string => Boolean(id));

    if (formIdsToProcess.length === 0) return;

    const customJwt = (session as any)?.customJwt;
    if (!customJwt) return;

    setIsBulkSubmitting(true);
    bulkActionInProgressRef.current = true;
    setBulkRecoveryState('idle');
    setBulkRecoveryMessage(null);
    
    const rolePrefix = role === 'CLASS_COMMITTEE' ? 'class-committee' : 'advisor';
    const actionPath = bulkActionType === 'APPROVE' ? 'bulk-approve' : 'bulk-reject';
    const url = `${API_BASE}/scoring/${rolePrefix}/${actionPath}`;

    const controller = new AbortController();
    bulkTimeoutRef.current = window.setTimeout(() => controller.abort(), BULK_TIMEOUT_MS);

    try {
      const payload = bulkActionType === 'APPROVE'
        ? { formIds: formIdsToProcess }
        : { formIds: formIdsToProcess, reason };
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customJwt}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      window.clearTimeout(bulkTimeoutRef.current!);
      bulkTimeoutRef.current = null;

      if (!res.ok) {
        // HTTP error with clear response — NOT unknown outcome
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.message || `Lỗi xử lý yêu cầu (${res.status})`;
        setBulkRecoveryMessage(errMsg);
        setIsBulkModalOpen(false);
        // Still refresh to get latest state
        await fetchStudents();
        return;
      }

      const data: BulkActionResponse = await res.json();
      setBulkResult(data);
      setIsBulkModalOpen(false);
      setIsResultDialogOpen(true);

      // Deselect succeeded items
      if (data.results) {
        const successFormIds = new Set(data.results.filter(r => r.success).map(r => r.formId));
        const successStudentIds = new Set(
          students
            .filter(s => s.formId && successFormIds.has(s.formId))
            .map(s => s.id)
        );
        setSelectedIds(prev => prev.filter(id => !successStudentIds.has(id)));
      }

      // Refresh list (don't block result dialog on refresh failure)
      fetchStudents();
      
    } catch (err: any) {
      window.clearTimeout(bulkTimeoutRef.current!);
      bulkTimeoutRef.current = null;

      // Network error / AbortError → unknown outcome
      const isAbort = err.name === 'AbortError';
      const message = isAbort
        ? 'Yêu cầu đã quá thời gian chờ. Đang kiểm tra lại trạng thái...'
        : 'Mất kết nối mạng. Đang kiểm tra lại trạng thái...';

      setBulkRecoveryState('checking');
      setBulkRecoveryMessage(message);
      setIsBulkModalOpen(false);

      const refreshOk = await fetchStudents();
      if (refreshOk) {
        setBulkRecoveryState('idle');
        setSelectedIds([]);
        setBulkRecoveryMessage('Không nhận được kết quả từ máy chủ. Danh sách đã được tải lại để kiểm tra trạng thái.');
      } else {
        setBulkRecoveryState('failed');
        setBulkRecoveryMessage('Chưa thể xác nhận kết quả xử lý. Hãy tải lại dữ liệu trước khi thử lại.');
      }
    } finally {
      setIsBulkSubmitting(false);
      bulkActionInProgressRef.current = false;
    }
  };

  const handleRetryRefresh = async () => {
    setBulkRecoveryState('checking');
    setBulkRecoveryMessage('Đang tải lại dữ liệu...');
    const ok = await fetchStudents();
    if (ok) {
      setBulkRecoveryState('idle');
      setSelectedIds([]);
      setBulkRecoveryMessage(null);
    } else {
      setBulkRecoveryState('failed');
      setBulkRecoveryMessage('Chưa thể xác nhận kết quả xử lý. Hãy tải lại dữ liệu trước khi thử lại.');
    }
  };

  const getBulkValidationStats = () => {
    const selectedStudents = students.filter(s => selectedIds.includes(s.id));
    const eligibleStudents = bulkActionType === 'APPROVE'
      ? selectedStudents.filter(s => canBulkApprove(s, role))
      : selectedStudents.filter(s => canBulkReject(s, role));
    const ineligibleStudents = selectedStudents.filter(s => !eligibleStudents.includes(s));
    
    return {
      validCount: eligibleStudents.length,
      invalidCount: ineligibleStudents.length,
      ineligibleStudents: ineligibleStudents.map(s => ({
        id: s.id,
        name: s.name,
        studentCode: s.studentCode,
      })),
      invalidReason: bulkActionType === 'APPROVE' ? 'Trạng thái hiện tại của phiếu không cho phép duyệt tiếp.' : 'Trạng thái hiện tại của phiếu không thể trả lại.'
    };
  };

  const validationStats = getBulkValidationStats();
  const isBulkDisabled = bulkRecoveryState !== 'idle';

  if (contextRequired) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 text-center bg-surface border border-border rounded-2xl shadow-sm">
        <div className="w-16 h-16 bg-primary-light text-primary flex items-center justify-center rounded-full mx-auto mb-4">
          <Users size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2 text-foreground">{contextRequired.message}</h2>
        <p className="text-sm text-muted-foreground mb-6">Bạn được phân công nhiều lớp. Vui lòng chọn một lớp để xem danh sách sinh viên.</p>
        <div className="flex flex-col gap-3">
          {contextRequired.classes.map((cls: any) => (
            <button
              key={cls.id}
              className="p-4 border border-border rounded-xl hover:bg-primary-light hover:border-primary/30 transition-all text-left flex items-center justify-between group"
              onClick={() => {
                const params = new URLSearchParams(searchParams?.toString() || '');
                params.set('classId', cls.id);
                router.push(`${pathname}?${params.toString()}`);
              }}
            >
              <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{cls.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col overflow-hidden ${showHeader ? 'h-full min-h-[600px]' : ''}`}>
      <div className="flex-1 flex flex-col min-h-0 bg-background relative">
        
        {/* Header Section */}
        <div className="p-6 md:p-8 shrink-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Quản lý đánh giá lớp</h2>
              <p className="text-sm text-muted-foreground">Xét duyệt điểm rèn luyện của sinh viên trong lớp</p>
            </div>
            
            <div className="flex items-center gap-4 bg-surface border border-border p-3 rounded-2xl shadow-sm">
              <div className="text-center px-4 border-r border-border">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Sĩ số</div>
                <div className="text-xl font-black text-foreground">{animatedTotal}</div>
              </div>
              <div className="text-center px-4">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Đã nộp</div>
                <div className="text-xl font-black text-primary">{animatedSubmitted}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Tabs */}
            <div className="flex overflow-x-auto w-full lg:w-auto bg-surface-muted p-1.5 rounded-xl border border-border">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                      isActive 
                        ? 'bg-background text-primary shadow-sm ring-1 ring-border' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
                    {tab.label}
                    <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs ${
                      isActive ? 'bg-primary-light/20 text-primary' : 'bg-surface-muted text-muted-foreground'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="w-full lg:w-72 shrink-0">
              <Input
                placeholder="Tìm MSSV, họ tên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search size={18} />}
              />
            </div>
          </div>
        </div>

        {/* Recovery banner */}
        {bulkRecoveryMessage && (
          <div className={`mx-6 md:mx-8 mb-4 p-3 rounded-lg border text-sm flex items-center justify-between gap-3 ${
            bulkRecoveryState === 'failed'
              ? 'bg-warning-bg border-warning-border text-warning-foreground'
              : bulkRecoveryState === 'checking'
                ? 'bg-surface-muted border-border text-muted-foreground'
                : 'bg-surface border-border text-foreground'
          }`}>
            <span>{bulkRecoveryMessage}</span>
            <div className="flex gap-2 shrink-0">
              {bulkRecoveryState === 'failed' && (
                <button
                  onClick={handleRetryRefresh}
                  className="px-3 py-1 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  Tải lại dữ liệu
                </button>
              )}
              {bulkRecoveryState === 'idle' && (
                <button
                  onClick={() => setBulkRecoveryMessage(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Đóng thông báo"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-8">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-surface-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : fetchError ? (
            <EmptyState
              icon={FileWarning}
              title="Lỗi tải dữ liệu"
              description={fetchError}
            />
          ) : filtered.length === 0 ? (
            (() => {
              const emptyMsg = getEmptyStateMessage({
                role,
                activeTab,
                searchTerm: search,
              });
              return (
                <EmptyState
                  icon={search.trim() ? Search : Users}
                  title={emptyMsg.title}
                  description={emptyMsg.description}
                />
              );
            })()
          ) : (
            <Card className="overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-surface-muted border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-bold">
                      <th className="px-6 py-4 text-center w-12">
                            <input 
                              type="checkbox"
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                              title="Chọn tất cả kết quả đang hiển thị hợp lệ"
                              disabled={isBulkDisabled}
                              checked={filtered.length > 0 && selectedIds.length > 0 && selectedIds.length === filtered.filter(s => canBulkApprove(s, role) || canBulkReject(s, role)).length}
                              ref={input => {
                                if (input) {
                                  const validCount = filtered.filter(s => canBulkApprove(s, role) || canBulkReject(s, role)).length;
                                  input.indeterminate = selectedIds.length > 0 && selectedIds.length < validCount;
                                }
                              }}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const validIds = filtered.filter(s => canBulkApprove(s, role) || canBulkReject(s, role)).map(s => s.id);
                                  setSelectedIds(validIds);
                                } else {
                                  setSelectedIds([]);
                                }
                              }}
                            />
                          </th>
                          <th className="px-6 py-4 text-center w-16">STT</th>
                      <th className="px-6 py-4 w-32">MSSV</th>
                      <th className="px-6 py-4">Họ và tên</th>
                      <th className="px-6 py-4 w-40">Trạng thái</th>
                      <th className="px-6 py-4 text-center w-32">Điểm tổng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((student, index) => {
                      const score = student[meta.scoreCol];
                      return (
                        <tr
                          key={student.id}
                          onClick={() => handleStudentClick(student.id)}
                          className="hover:bg-surface-muted cursor-pointer transition-colors group"
                        >
                          <td className="px-6 py-4 text-center text-sm font-medium text-muted-foreground">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                              {student.studentCode}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-foreground">
                              {student.name}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={student.status} />
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-base font-black ${score !== null ? 'text-primary' : 'text-muted-foreground'}`}>
                              {score ?? '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Modal / Drawer for Scoring */}
      {(isDrawerOpen || closingDrawer) && selectedStudent && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
            closingDrawer ? 'opacity-0' : 'opacity-100'
          }`}
          onClick={handleCloseDrawer}
        >
          <div
            className={`bg-background w-full max-w-7xl h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-transform duration-200 ${
              closingDrawer ? 'scale-95 translate-y-4' : 'scale-100 translate-y-0'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface shrink-0">
              <h3 className="text-lg font-bold text-foreground">
                Chấm điểm sinh viên: <span className="text-primary">{selectedStudent.name}</span>
                <span className="ml-2 font-mono text-sm text-muted-foreground font-semibold bg-muted px-2 py-0.5 rounded">
                  {selectedStudent.studentCode}
                </span>
              </h3>
              <button
                onClick={handleCloseDrawer}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface-muted rounded-lg transition-colors"
                title="Đóng (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden relative flex flex-col bg-background">
              <ScoringForm 
                key={`${selectedStudent.id}-${resetKey}`} 
                forcedRole={role} 
                studentId={selectedStudent.id} 
                studentName={selectedStudent.name} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bulk Toolbar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.05)] p-4 flex items-center justify-between px-8 md:pl-[18rem] transition-all">
          <div className="font-semibold text-foreground flex items-center gap-4">
            <span>Đã chọn <strong className="text-primary">{selectedIds.length}</strong> sinh viên</span>
            <button onClick={() => setSelectedIds([])} className="text-sm text-muted-foreground hover:text-foreground">
              (Bỏ chọn)
            </button>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => { setBulkActionType('REJECT'); setIsBulkModalOpen(true); }}
              disabled={isBulkDisabled}
              className="px-4 py-2 bg-surface-muted text-warning-foreground font-bold border border-warning-border hover:bg-warning-bg hover:border-warning-border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Trả lại phiếu
            </button>
            <button 
              onClick={() => { setBulkActionType('APPROVE'); setIsBulkModalOpen(true); }}
              disabled={isBulkDisabled}
              className="px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Duyệt phiếu
            </button>
          </div>
        </div>
      )}

      <BulkActionModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onConfirm={handleBulkAction}
        actionType={bulkActionType}
        validCount={validationStats.validCount}
        ineligibleStudents={validationStats.ineligibleStudents}
        invalidCount={validationStats.invalidCount}
        invalidReason={validationStats.invalidReason}
        isSubmitting={isBulkSubmitting}
      />

      {bulkResult && (
        <BulkResultDialog
          isOpen={isResultDialogOpen}
          onClose={() => setIsResultDialogOpen(false)}
          summary={bulkResult.summary}
          results={bulkResult.results}
        />
      )}
    </div>
  );
}
