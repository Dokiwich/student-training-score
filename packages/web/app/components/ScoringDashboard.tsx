'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { UserMenu } from './UserMenu';
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

const STATUS_LABELS: Record<string, string> = {
  NO_SHEET: 'Chua tao',
  DRAFT: 'Nhap',
  STUDENT_SUBMITTED: 'SV nop',
  CLASS_REVIEWING: 'Dang xet',
  CLASS_REVIEWED: 'Da duyet',
  CLASS_REJECTED: 'Tra lai',
  ADVISOR_REVIEWING: 'CVHT xet',
  ADVISOR_APPROVED: 'CVHT duyet',
  ADVISOR_REJECTED: 'CVHT tra',
  FINALIZED: 'Chot so',
};

interface ScoringDashboardProps {
  role: 'CLASS_PRESIDENT' | 'ADVISOR';
  showHeader?: boolean;
}

const ROLE_META = {
  CLASS_PRESIDENT: {
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

export function ScoringDashboard({ role, showHeader = true }: ScoringDashboardProps) {
  const { data: session } = useSession();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const meta = ROLE_META[role];

  useEffect(() => {
    if (!session?.user) return;
    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/scoring/students`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          setStudents(json.data || []);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudents();
  }, [session]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      return !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.studentCode || '').includes(search);
    });
  }, [students, search]);

  const stats = useMemo(() => {
    const total = students.length;
    const submitted = students.filter((s) => s.status !== 'NO_SHEET' && s.status !== 'DRAFT').length;
    return { total, submitted };
  }, [students]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div className={`${showHeader ? 'h-screen' : 'h-[calc(100vh-200px)] min-h-[600px]'} flex flex-col bg-white overflow-hidden border border-gray-200`}>
      {showHeader && (
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold text-black">{meta.title}</h1>
            <p className="text-xs text-gray-500">{meta.subtitle}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <span className="border border-gray-300 px-2.5 py-1 font-bold text-gray-600">{stats.total} SV</span>
              <span className="border border-gray-300 px-2.5 py-1 font-bold text-gray-600">{stats.submitted} da nop</span>
            </div>
            <UserMenu />
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR */}
        <div className={`bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-14' : 'w-72'}`}>
          <div className="px-3 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
            {!sidebarCollapsed && (
              <input
                type="text"
                placeholder="Tim SV..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 text-xs focus:border-black outline-none bg-white"
              />
            )}
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="p-2 hover:bg-gray-100 text-gray-500 hover:text-black transition-colors shrink-0 text-xs font-bold"
              title={sidebarCollapsed ? 'Mo rong' : 'Thu gon'}
            >
              {sidebarCollapsed ? '>>' : '<<'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : sidebarCollapsed ? (
              <div className="py-2 space-y-1">
                {filtered.map((student) => {
                  const isActive = student.id === selectedStudentId;
                  const initial = student.name.split(' ').pop()?.[0] || '?';
                  return (
                    <button
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                      className={`w-full flex justify-center py-1.5 transition-colors ${isActive ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                      title={student.name}
                    >
                      <div className={`w-8 h-8 flex items-center justify-center text-xs font-bold border ${isActive ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300'}`}>
                        {initial}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-1">
                {filtered.map((student) => {
                  const isActive = student.id === selectedStudentId;
                  const statusLabel = STATUS_LABELS[student.status] || student.status;
                  const score = student[meta.scoreCol];

                  return (
                    <button
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                      className={`w-full text-left px-3 py-2.5 transition-colors border-l-2 ${isActive ? 'bg-gray-50 border-l-black' : 'border-l-transparent hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-bold truncate ${isActive ? 'text-black' : 'text-gray-800'}`}>{student.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-400 font-mono">{student.studentCode}</span>
                            <span className="text-[10px] font-bold text-gray-500">[{statusLabel}]</span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {score !== null && score !== undefined ? (
                            <span className="text-sm font-bold text-black">{score}</span>
                          ) : (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-6">Khong tim thay SV</p>}
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <div className="px-3 py-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 text-center">{filtered.length}/{students.length} sinh vien</p>
            </div>
          )}
        </div>

        {/* RIGHT FORM */}
        <div className="flex-1 overflow-y-auto pt-4 px-4 scroll-smooth">
          {selectedStudent ? (
            <div className="max-w-7xl mx-auto pb-20">
              <div className="sticky top-0 z-20 bg-white pb-4 mb-4">
                <div className="flex items-center gap-3 border border-gray-200 px-5 py-3">
                  <div>
                    <p className="font-bold text-black">{selectedStudent.name}</p>
                    <p className="text-xs text-gray-500">
                      MSSV: <span className="font-mono">{selectedStudent.studentCode}</span>
                      &nbsp;|&nbsp;Diem SV: <strong>{selectedStudent.studentTotal ?? '-'}</strong>
                    </p>
                  </div>
                </div>
              </div>
              <ScoringForm
                key={selectedStudentId}
                forcedRole={role}
                studentId={selectedStudent.id}
                studentName={selectedStudent.name}
                stickyTop="top-[80px]"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <h3 className="text-lg font-bold text-gray-700">Chon sinh vien de cham diem</h3>
                <p className="text-sm text-gray-400 mt-1">Nhan vao ten sinh vien o thanh ben trai de bat dau cham.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
