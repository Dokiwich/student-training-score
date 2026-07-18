'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';

const API_BASE = '/proxy-api';

interface StudentSummary {
  id: string;
  studentCode: string | null;
  name: string;
  className?: string;
  status: string;
  studentTotal: number | null;
  classTotal: number | null;
  advisorTotal: number | null;
  finalTotal: number | null;
  classification: string | null;
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  EXCELLENT: 'Xuất sắc',
  VERY_GOOD: 'Giỏi',
  GOOD: 'Khá',
  AVERAGE: 'Trung bình',
  WEAK: 'Yếu',
  POOR: 'Kém',
};

const CLS_COLORS: Record<string, { bg: string; color: string }> = {
  EXCELLENT: { bg: 'var(--success-bg)', color: 'var(--success-foreground)' },
  VERY_GOOD: { bg: 'var(--info-bg)', color: 'var(--info)' },
  GOOD: { bg: 'var(--warning-bg)', color: 'var(--warning-foreground)' },
  AVERAGE: { bg: 'var(--surface-muted)', color: 'var(--muted-foreground)' },
  WEAK: { bg: 'var(--danger-bg)', color: 'var(--danger-foreground)' },
  POOR: { bg: 'var(--danger-bg)', color: 'var(--danger-foreground)' },
};

export function AdvisorSummary() {
  const { data: session } = useSession();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!session?.user) return;
    const customJwt = (session as any)?.customJwt;
    if (!customJwt) return; // Chờ cho đến khi có JWT

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customJwt}`,
        };
        const res = await fetch(`${API_BASE}/scoring/students`, { headers, credentials: 'include' });
        if (res.ok) { const json = await res.json(); setStudents(json.data || []); }
      } finally { setIsLoading(false); }
    };
    fetchData();
  }, [session]);

  const stats = useMemo(() => {
    const total = students.length;
    const submitted = students.filter(s => s.status !== 'NO_SHEET' && s.status !== 'DRAFT').length;
    const unsubmitted = total - submitted;
    const submittedPct = total > 0 ? Math.round((submitted / total) * 100) : 0;
    
    const byClass: Record<string, number> = {};
    students.forEach((s) => { const cls = s.classification || 'NONE'; byClass[cls] = (byClass[cls] || 0) + 1; });

    const scoredStudents = students.filter(s => s.finalTotal != null || s.advisorTotal != null || s.classTotal != null || s.studentTotal != null);
    const avgScore = scoredStudents.length > 0
      ? (scoredStudents.reduce((sum, s) => sum + (s.finalTotal || s.advisorTotal || s.classTotal || s.studentTotal || 0), 0) / scoredStudents.length).toFixed(1)
      : '0';
    
    return { total, submitted, unsubmitted, submittedPct, byClass, avgScore };
  }, [students]);
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div className="skeleton" style={{ height: 140, borderRadius: 12 }} />
          <div className="skeleton" style={{ height: 140, borderRadius: 12 }} />
        </div>
        <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 400, borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={{ background: 'linear-gradient(135deg, #6ee7b7 0%, #10b981 100%)', borderRadius: 12, padding: 20, color: '#064e3b', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Sĩ số</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{stats.total}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #93c5fd 0%, #b91c1c 100%)', borderRadius: 12, padding: 20, color: '#1e3a8a', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Điểm trung bình lớp</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{stats.avgScore}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #d8b4fe 0%, #a855f7 100%)', borderRadius: 12, padding: 20, color: '#4c1d95', boxShadow: '0 4px 6px -1px rgba(168, 85, 247, 0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Xếp loại Xuất sắc/Giỏi</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{(stats.byClass['EXCELLENT'] || 0) + (stats.byClass['VERY_GOOD'] || 0)}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fca5a5 0%, #ef4444 100%)', borderRadius: 12, padding: 20, color: '#7f1d1d', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Yếu/Kém</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{(stats.byClass['WEAK'] || 0) + (stats.byClass['POOR'] || 0)}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-surface-muted border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-bold">
                <th className="px-4 py-3 text-center w-12">STT</th>
                <th className="px-4 py-3 w-28">MSSV</th>
                <th className="px-4 py-3">Họ và Tên</th>
                <th className="px-4 py-3 w-24">Lớp</th>
                <th className="px-4 py-3 text-center w-20">Điểm SV</th>
                <th className="px-4 py-3 text-center w-24">Điểm BCS</th>
                <th className="px-4 py-3 text-center w-24">Điểm CVHT</th>
                <th className="px-4 py-3 text-center w-28">Xếp loại</th>
                <th className="px-4 py-3">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-muted-foreground p-8">Chưa có dữ liệu sinh viên</td></tr>
              ) : students.map((student, index) => {
                const clsLabel = student.classification ? CLASSIFICATION_LABELS[student.classification] || '' : '';
                const clsColor = CLS_COLORS[student.classification || ''] || { bg: '#f3f4f6', color: '#6b7280' };
                return (
                  <tr key={`${student.id}-${index}`} className="hover:bg-surface-muted transition-colors">
                    <td className="px-4 py-3 text-center text-muted-foreground text-xs">{index + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{student.studentCode || '-'}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{student.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{student.className || '-'}</td>
                    <td className="px-4 py-3 text-center font-bold text-foreground">{student.studentTotal ?? '-'}</td>
                    <td className="px-4 py-3 text-center font-bold text-foreground">{student.classTotal ?? '-'}</td>
                    <td className="px-4 py-3 text-center font-bold text-primary">{student.advisorTotal ?? '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {clsLabel ? (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: clsColor.bg, color: clsColor.color }}>{clsLabel}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input type="text" placeholder="Nhập ghi chú..." value={notes[student.id] || ''}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [student.id]: e.target.value }))}
                        className="w-full bg-transparent border-none text-xs px-2 py-1 focus:ring-1 focus:ring-primary rounded" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
