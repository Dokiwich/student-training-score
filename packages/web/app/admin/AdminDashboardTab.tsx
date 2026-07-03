'use client';
import React, { useState, useEffect } from 'react';
import { DataTable } from '../components/DataTable';

interface Stats {
  total: number;
  submitted: number;
  finalized: number;
  avgScore: number;
  byClassification: Record<string, number>;
  byDepartment: {
    departmentName: string;
    departmentCode: string;
    total: number;
    submitted: number;
    finalized: number;
    avgScore: number;
    byClassification: Record<string, number>;
  }[];
}

interface ComparisonData {
  semesterId: string;
  semesterName: string;
  semesterCode: string;
  byClassification: Record<string, number>;
  total: number;
  avgScore: number;
}

const CLASSIFICATION_LABELS: Record<string, string> = { EXCELLENT: 'Xuất sắc', VERY_GOOD: 'Giỏi', GOOD: 'Khá', AVERAGE: 'Trung bình', WEAK: 'Yếu', POOR: 'Kém' };
const CLS_COLORS: Record<string, { chart: string }> = { EXCELLENT: { chart: '#10b981' }, VERY_GOOD: { chart: '#3b82f6' }, GOOD: { chart: '#f59e0b' }, AVERAGE: { chart: '#9ca3af' }, WEAK: { chart: '#ef4444' }, POOR: { chart: '#dc2626' } };
const CLS_KEYS = ['EXCELLENT', 'VERY_GOOD', 'GOOD', 'AVERAGE', 'WEAK', 'POOR'];

function DonutChart({ data, total }: { data: Record<string, number>; total: number }) {
  const segments = CLS_KEYS.map(k => ({ key: k, value: data[k] || 0, color: CLS_COLORS[k]?.chart || '#ccc', label: CLASSIFICATION_LABELS[k] || k }));
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  const radius = 80;
  const cx = 100, cy = 100;
  const strokeWidth = 28;
  let startAngle = -90;
  const arcs = segments.filter(s => s.value > 0).map(s => {
    const pct = s.value / sum;
    const angle = pct * 360;
    const endAngle = startAngle + angle;
    const largeArc = angle > 180 ? 1 : 0;
    const x1 = cx + radius * Math.cos((startAngle * Math.PI) / 180);
    const y1 = cy + radius * Math.sin((startAngle * Math.PI) / 180);
    const x2 = cx + radius * Math.cos((endAngle * Math.PI) / 180);
    const y2 = cy + radius * Math.sin((endAngle * Math.PI) / 180);
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    startAngle = endAngle;
    return { ...s, path, pct };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        {arcs.length === 1 ? (
          /* Single segment = full circle (SVG arc can't draw 360°) */
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke={arcs[0].color} strokeWidth={strokeWidth} style={{ transition: 'all 0.5s ease' }}>
            <title>{arcs[0].label}: {arcs[0].value} ({(arcs[0].pct * 100).toFixed(1)}%)</title>
          </circle>
        ) : (
          arcs.map((arc, i) => (
            <path key={i} d={arc.path} fill="none" stroke={arc.color} strokeWidth={strokeWidth} strokeLinecap="round" style={{ transition: 'all 0.5s ease' }}>
              <title>{arc.label}: {arc.value} ({(arc.pct * 100).toFixed(1)}%)</title>
            </path>
          ))
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="28" fontWeight="800" fill="#0f172a">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" fill="#94a3b8" fontWeight="500">Sinh viên</text>
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {segments.filter(s => s.value > 0).map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#475569' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
            <span>{s.label}: <strong>{s.value}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ comparison }: { comparison: ComparisonData[] }) {
  if (!comparison.length) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Chưa có dữ liệu so sánh</div>;

  const categories = CLS_KEYS;
  const maxVal = Math.max(1, ...comparison.flatMap(c => categories.map(k => c.byClassification[k] || 0)));
  const barGroupWidth = 160;
  const chartW = categories.length * barGroupWidth + 60;
  const chartH = 240;
  const barW = 28;
  const semColors = ['#6366f1', '#0ea5e9', '#f59e0b'];

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={chartW} height={chartH + 70} viewBox={`0 0 ${chartW} ${chartH + 70}`} style={{ display: 'block', margin: '0 auto' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = chartH - pct * chartH;
          return (
            <g key={i}>
              <line x1="40" y1={y} x2={chartW - 10} y2={y} stroke="#e2e8f0" strokeDasharray={i === 0 ? '0' : '4,4'} />
              <text x="35" y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(maxVal * pct)}</text>
            </g>
          );
        })}
        {categories.map((cat, ci) => {
          const groupX = 50 + ci * barGroupWidth;
          return (
            <g key={cat}>
              {comparison.map((sem, si) => {
                const val = sem.byClassification[cat] || 0;
                const barH = (val / maxVal) * chartH;
                const x = groupX + si * (barW + 4) + (barGroupWidth - comparison.length * (barW + 4)) / 2;
                return (
                  <g key={si}>
                    <rect x={x} y={chartH - barH} width={barW} height={barH} rx={4} fill={semColors[si]} opacity={0.85} style={{ transition: 'all 0.5s ease' }}>
                      <title>{sem.semesterName}: {val}</title>
                    </rect>
                    {val > 0 && <text x={x + barW / 2} y={chartH - barH - 4} textAnchor="middle" fontSize="10" fontWeight="600" fill={semColors[si]}>{val}</text>}
                  </g>
                );
              })}
              <text x={groupX + barGroupWidth / 2} y={chartH + 16} textAnchor="middle" fontSize="10" fontWeight="500" fill="#475569">{CLASSIFICATION_LABELS[cat]}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
        {comparison.map((sem, i) => (
          <div key={sem.semesterId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#475569' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: semColors[i] }} />
            <span>{sem.semesterName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [comparison, setComparison] = useState<ComparisonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [semesters, setSemesters] = useState<{id: string, name: string, is_active: number}[]>([]);
  const [selectedSemId, setSelectedSemId] = useState('');

  useEffect(() => {
    fetch('/api/admin/semesters')
      .then(r => r.json())
      .then(d => {
        const sems = d.data || [];
        setSemesters(sems);
        if (sems.length > 0) setSelectedSemId(sems[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedSemId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/stats?semesterId=${selectedSemId}`).then(r => r.json()),
      fetch(`/api/admin/stats/compare`).then(r => r.json())
    ]).then(([st, comp]) => {
      setStats(st.stats);
      setComparison(comp.data || []);
      setLoading(false);
    });
  }, [selectedSemId]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải dữ liệu toàn trường...</div>;
  if (!stats) return null;

  const deptCols = [
    { header: 'Khoa', render: (d: any) => <span style={{ fontWeight: 600 }}>{d.departmentName}</span> },
    { header: 'Sĩ số', render: (d: any) => d.total },
    { header: 'Đã nộp', render: (d: any) => <span style={{ color: d.submitted < d.total ? 'var(--warning)' : 'var(--success)' }}>{d.submitted} / {d.total}</span> },
    { header: 'Đã duyệt', render: (d: any) => <span style={{ color: 'var(--primary)' }}>{d.finalized}</span> },
    { header: 'TB', render: (d: any) => <strong style={{ color: 'var(--accent)' }}>{d.avgScore}</strong> },
    { header: 'Xuất sắc/Giỏi', render: (d: any) => ((d.byClassification['EXCELLENT']||0) + (d.byClassification['VERY_GOOD']||0)) }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Control bar */}
      <div className="dashboard-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Tổng quan hệ thống</h2>
        <select value={selectedSemId} onChange={e => setSelectedSemId(e.target.value)} className="form-select" style={{ width: 250 }}>
          {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={{ background: 'linear-gradient(135deg, #6ee7b7 0%, #10b981 100%)', borderRadius: 12, padding: 20, color: '#064e3b', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Tổng Sinh viên (toàn trường)</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{stats.total}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%)', borderRadius: 12, padding: 20, color: '#1e3a8a', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Điểm trung bình (toàn trường)</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{stats.avgScore}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #d8b4fe 0%, #a855f7 100%)', borderRadius: 12, padding: 20, color: '#4c1d95', boxShadow: '0 4px 6px -1px rgba(168, 85, 247, 0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Sinh viên Xuất sắc / Giỏi</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{(stats.byClassification['EXCELLENT'] || 0) + (stats.byClassification['VERY_GOOD'] || 0)}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)', borderRadius: 12, padding: 20, color: '#78350f', boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Phiếu Đã nộp / Đã chốt</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{stats.submitted} / {stats.finalized}</div>
        </div>
      </div>

      {/* Donut + Khoa table */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        <div className="dashboard-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Phân loại rèn luyện toàn trường</h3>
          <DonutChart data={stats.byClassification} total={stats.total} />
        </div>
        <div>
          <DataTable
            title="Thống kê theo Khoa"
            columns={deptCols}
            data={stats.byDepartment}
          />
        </div>
      </div>

      {/* Bar Chart compare */}
      <div className="dashboard-card">
        <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          So sánh rèn luyện toàn trường (3 Học kỳ gần nhất)
        </h3>
        <BarChart comparison={comparison} />
      </div>
    </div>
  );
}
