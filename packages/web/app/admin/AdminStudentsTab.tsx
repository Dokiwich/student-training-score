'use client';
import React, { useState, useEffect } from 'react';
import { DataTable } from '../components/DataTable';
import { ScoringForm } from '../components/ScoringForm';

interface AdminStudentsTabProps {
  classId?: string;
  classNameStr?: string;
  onBack?: () => void;
}

export function AdminStudentsTab({ classId, classNameStr, onBack }: AdminStudentsTabProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [semesters, setSemesters] = useState<{id: string, name: string, is_active: number}[]>([]);
  const [selectedSemId, setSelectedSemId] = useState('');
  
  const [search, setSearch] = useState('');
  
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/admin/semesters')
      .then(r => r.json())
      .then(d => {
        const sems = d.data || [];
        setSemesters(sems);
        if (sems.length > 0) setSelectedSemId(sems[0].id);
      });
  }, []);

  const fetchStudents = () => {
    if (!selectedSemId) return;
    setLoading(true);
    let url = `/api/admin/students?semesterId=${selectedSemId}`;
    if (classId) {
      url += `&classId=${classId}`;
    }
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setStudents(d.data || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedSemId, classId]);

  const filtered = students.filter(s => {
    const term = search.toLowerCase();
    const matchSearch = s.name.toLowerCase().includes(term) || s.studentCode.toLowerCase().includes(term) || s.className.toLowerCase().includes(term);
    return matchSearch;
  });

  const columns = [
    { header: 'MSSV', width: 100, render: (s: any) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.studentCode}</span> },
    { header: 'Họ tên', render: (s: any) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span> },
    { header: 'Trạng thái', width: 140, render: (s: any) => {
        const st = s.status;
        let bg = '#f3f4f6', color = '#6b7280', label = st;
        if (st === 'UPCOMING') { bg = '#eff6ff'; color = '#3b82f6'; label = 'Chưa nộp'; }
        if (st === 'STUDENT_SCORING') { bg = '#fef3c7'; color = '#d97706'; label = 'SV đang chấm'; }
        if (st === 'CLASS_REVIEWING') { bg = '#fef3c7'; color = '#d97706'; label = 'Lớp đang xét'; }
        if (st === 'ADVISOR_REVIEWING') { bg = '#fce7f3'; color = '#db2777'; label = 'CVHT duyệt'; }
        if (st === 'SCHOOL_REVIEWING') { bg = '#e0e7ff'; color = '#4f46e5'; label = 'Trường xét'; }
        if (st === 'FINALIZED') { bg = '#ecfdf5'; color = '#10b981'; label = 'Đã chốt'; }
        return <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: bg, color }}>{label}</span>;
      }
    },
    { header: 'SV tự chấm', width: 100, align: 'center' as const, render: (s: any) => s.studentTotal || '-' },
    { header: 'BCS chấm', width: 100, align: 'center' as const, render: (s: any) => s.classTotal || '-' },
    { header: 'CVHT chấm', width: 100, align: 'center' as const, render: (s: any) => s.advisorTotal || '-' },
    { header: 'Điểm chốt', width: 100, align: 'center' as const, render: (s: any) => <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{s.finalTotal ?? s.score ?? '-'}</span> },
    { header: 'Xếp loại', width: 120, align: 'center' as const, render: (s: any) => {
        const c = s.classification;
        if (!c) return '-';
        const m: any = { EXCELLENT: 'Xuất sắc', VERY_GOOD: 'Giỏi', GOOD: 'Khá', AVERAGE: 'Trung bình', WEAK: 'Yếu', POOR: 'Kém' };
        const col: any = { EXCELLENT: '#10b981', VERY_GOOD: '#3b82f6', GOOD: '#f59e0b', AVERAGE: '#6b7280', WEAK: '#ef4444', POOR: '#dc2626' };
        return <span style={{ color: col[c] || '#000', fontWeight: 600 }}>{m[c] || c}</span>;
      }
    },
    { header: 'Thao tác', width: 120, align: 'center' as const, render: (s: any) => (
        <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setSelectedStudentForEdit(s)}>
          Chi tiết phiếu
        </button>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {onBack && (
        <div style={{ marginBottom: '-10px' }}>
          <button onClick={onBack} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Quay lại danh sách lớp
          </button>
        </div>
      )}
      <div className="dashboard-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)', flex: 1 }}>
          {classNameStr ? `Danh sách sinh viên - Lớp ${classNameStr}` : 'Danh sách sinh viên (Toàn trường)'}
        </h2>
        
        <select value={selectedSemId} onChange={e => setSelectedSemId(e.target.value)} className="form-select" style={{ width: 200 }}>
          {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        
        <input 
          type="text" 
          placeholder="Tìm tên, MSSV..." 
          className="form-input" 
          style={{ width: 200 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        title="Sinh viên"
        subtitle={`Hiển thị ${filtered.length} sinh viên`}
        columns={columns}
        data={filtered}
        loading={loading}
      />

      {selectedStudentForEdit && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 16, width: '90vw', maxWidth: 1000, height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', animation: 'slideIn 0.3s ease-out' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: '16px 16px 0 0' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Phiếu Đánh Giá Rèn Luyện</h2>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Sinh viên: <strong>{selectedStudentForEdit.name}</strong> ({selectedStudentForEdit.studentCode}) — Lớp: <strong>{selectedStudentForEdit.className}</strong>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStudentForEdit(null)}
                style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#e2e8f0', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = '#cbd5e1'}
                onMouseOut={e => e.currentTarget.style.background = '#e2e8f0'}
              >
                ✕
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <ScoringForm 
                forcedRole="ADVISOR"
                studentId={selectedStudentForEdit.id}
                studentName={selectedStudentForEdit.name}
                viewMode="history"
                stickyTop="top-0"
                semesterId={selectedSemId}
                allowResetAnytime={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
