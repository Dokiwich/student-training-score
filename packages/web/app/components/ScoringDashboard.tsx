'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ScoringForm } from './ScoringForm';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { StatusBadge } from './ui/StatusBadge';
import { Input } from './ui/Input';
import { EmptyState } from './ui/EmptyState';
import { Search, Users, CheckCircle, Clock, FileWarning, X } from 'lucide-react';

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

interface ScoringDashboardProps {
  role: 'CLASS_COMMITTEE' | 'ADVISOR';
  showHeader?: boolean;
  defaultTab?: 'all' | 'pending' | 'unscored' | 'scored';
}

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
    let result = students;
    if (search) {
      result = result.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || (s.studentCode || '').includes(search));
    }

    if (activeTab === 'scored') {
      if (role === 'CLASS_COMMITTEE') {
        result = result.filter(s => s.status === 'CLASS_REVIEWED' || s.status === 'FINALIZED' || s.status === 'ADVISOR_REVIEWING' || s.status === 'ADVISOR_APPROVED');
      } else {
        result = result.filter(s => s.status === 'ADVISOR_APPROVED' || s.status === 'FINALIZED');
      }
    } else if (activeTab === 'unscored') {
      if (role === 'CLASS_COMMITTEE') {
        result = result.filter(s => s.status === 'STUDENT_SUBMITTED' || s.status === 'CLASS_REVIEWING');
      } else {
        result = result.filter(s => s.status === 'CLASS_REVIEWED' || s.status === 'ADVISOR_REVIEWING');
      }
    } else if (activeTab === 'pending') {
      result = result.filter(s => s.status === 'NO_SHEET' || s.status === 'DRAFT');
    }

    return result;
  }, [students, search, activeTab, role]);

  const stats = useMemo(() => {
    const total = students.length;
    const submitted = students.filter((s) => s.status !== 'NO_SHEET' && s.status !== 'DRAFT').length;
    
    // Calculate counts for tabs
    let scoredCount = 0;
    let unscoredCount = 0;
    let pendingCount = 0;
    
    students.forEach(s => {
      if (s.status === 'NO_SHEET' || s.status === 'DRAFT') {
        pendingCount++;
      } else {
        if (role === 'CLASS_COMMITTEE') {
          if (['CLASS_REVIEWED', 'FINALIZED', 'ADVISOR_REVIEWING', 'ADVISOR_APPROVED'].includes(s.status)) scoredCount++;
          else unscoredCount++;
        } else {
          if (['ADVISOR_APPROVED', 'FINALIZED'].includes(s.status)) scoredCount++;
          else unscoredCount++;
        }
      }
    });
    
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
            <EmptyState
              icon={Users}
              title="Không tìm thấy sinh viên"
              description="Không có sinh viên nào khớp với điều kiện tìm kiếm hiện tại."
            />
          ) : (
            <Card className="overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-surface-muted border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-bold">
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
    </div>
  );
}
