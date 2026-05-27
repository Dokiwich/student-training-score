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
  EXCELLENT: { bg: '#ecfdf5', color: '#059669' },
  VERY_GOOD: { bg: '#eff6ff', color: '#2563eb' },
  GOOD: { bg: '#fffbeb', color: '#d97706' },
  AVERAGE: { bg: '#f3f4f6', color: '#6b7280' },
  WEAK: { bg: '#fef2f2', color: '#dc2626' },
  POOR: { bg: '#fef2f2', color: '#dc2626' },
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
    const avgScore = total > 0 ? (students.reduce((sum, s) => sum + (s.finalTotal || s.advisorTotal || 0), 0) / total).toFixed(1) : '0';
    
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
        <div style={{ background: 'linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%)', borderRadius: 12, padding: 20, color: '#1e3a8a', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)' }}>
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
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="dashboard-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 50, textAlign: 'center' }}>STT</th>
                <th style={{ width: 100 }}>MSSV</th>
                <th>Họ và Tên</th>
                <th style={{ width: 90 }}>Lớp</th>
                <th style={{ width: 80, textAlign: 'center' }}>Điểm SV</th>
                <th style={{ width: 80, textAlign: 'center' }}>Điểm BCS</th>
                <th style={{ width: 80, textAlign: 'center' }}>Điểm CVHT</th>
                <th style={{ width: 100, textAlign: 'center' }}>Xếp loại</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Chưa có dữ liệu sinh viên</td></tr>
              ) : students.map((student, index) => {
                const clsLabel = student.classification ? CLASSIFICATION_LABELS[student.classification] || '' : '';
                const clsColor = CLS_COLORS[student.classification || ''] || { bg: '#f3f4f6', color: '#6b7280' };
                return (
                  <tr key={`${student.id}-${index}`}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{index + 1}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{student.studentCode || '-'}</td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{student.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{student.className || '-'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{student.studentTotal ?? '-'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{student.classTotal ?? '-'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>{student.advisorTotal ?? '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {clsLabel ? (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: clsColor.bg, color: clsColor.color }}>{clsLabel}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>
                      )}
                    </td>
                    <td>
                      <input type="text" placeholder="Nhập ghi chú..." value={notes[student.id] || ''}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [student.id]: e.target.value }))}
                        className="form-input" style={{ border: 'none', background: 'transparent', fontSize: 12, padding: '4px 6px' }} />
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
