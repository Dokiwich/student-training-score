'use client';
import React, { useState, useEffect } from 'react';
import { DataTable } from '../components/DataTable';
import { Users, TrendingUp, Award, FileCheck } from 'lucide-react';

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

import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

const CLASSIFICATION_LABELS: Record<string, string> = { EXCELLENT: 'Xuất sắc', VERY_GOOD: 'Giỏi', GOOD: 'Khá', AVERAGE: 'Trung bình', WEAK: 'Yếu', POOR: 'Kém' };
const CLS_COLORS: Record<string, { chart: string }> = { EXCELLENT: { chart: 'var(--success)' }, VERY_GOOD: { chart: 'var(--danger-foreground)' }, GOOD: { chart: '#f59e0b' }, AVERAGE: { chart: 'var(--muted-foreground)' }, WEAK: { chart: 'var(--danger)' }, POOR: { chart: 'var(--danger)' } };
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
    <div className="flex flex-col items-center gap-4">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx={cx} cy={cy} r={radius} fill="none" className="stroke-muted" strokeWidth={strokeWidth} />
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
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="28" fontWeight="800" className="fill-foreground">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" className="fill-muted-foreground" fontWeight="500">Sinh viên</text>
      </svg>
      <div className="flex flex-wrap gap-2 justify-center">
        {segments.filter(s => s.value > 0).map(s => (
          <div key={s.key} className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
            <span>{s.label}: <strong className="text-foreground">{s.value}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ comparison }: { comparison: ComparisonData[] }) {
  const [hover, setHover] = useState<{ x: number, y: number, text: string } | null>(null);

  if (!comparison.length) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>Chưa có dữ liệu so sánh giữa các học kỳ.</div>;

  const categories = CLS_KEYS;
  const maxVal = Math.max(1, ...comparison.flatMap(c => categories.map(k => c.byClassification[k] || 0)));
  const barGroupWidth = 160;
  const chartW = categories.length * barGroupWidth + 60;
  const chartH = 240;
  const barW = 28;
  const semColors = ['#6366f1', '#0ea5e9', '#f59e0b'];

  return (
    <div style={{ overflowX: 'auto', position: 'relative' }}>
      <svg width={chartW} height={chartH + 70} viewBox={`0 0 ${chartW} ${chartH + 70}`} style={{ display: 'block', margin: '0 auto' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = chartH - pct * chartH;
          return (
            <g key={i}>
              <line x1="40" y1={y} x2={chartW - 10} y2={y} stroke="var(--border)" strokeOpacity={0.5} strokeDasharray={i === 0 ? '0' : '4,4'} />
              <text x="35" y={y + 4} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">{Math.round(maxVal * pct)}</text>
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
                    <rect 
                      x={x} y={chartH - barH} width={barW} height={barH} rx={4} fill={semColors[si]} opacity={0.85} 
                      style={{ transition: 'all 0.5s ease', cursor: 'pointer' }}
                      onMouseEnter={() => setHover({ x: x + barW / 2, y: chartH - barH - 5, text: `${sem.semesterName}: ${val}` })}
                      onMouseLeave={() => setHover(null)}
                    />
                    {val > 0 && <text x={x + barW / 2} y={chartH - barH - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--foreground)">{val}</text>}
                  </g>
                );
              })}
              <text x={groupX + barGroupWidth / 2} y={chartH + 16} textAnchor="middle" fontSize="10" fontWeight="500" fill="var(--muted-foreground)">{CLASSIFICATION_LABELS[cat]}</text>
            </g>
          );
        })}
        {hover && (
          <foreignObject x={hover.x - 75} y={hover.y - 30} width={150} height={30} style={{ pointerEvents: 'none', overflow: 'visible' }}>
            <div className="flex justify-center">
              <div className="bg-popover text-popover-foreground text-[11px] px-2 py-1 rounded shadow-md border border-border whitespace-nowrap">
                {hover.text}
              </div>
            </div>
          </foreignObject>
        )}
      </svg>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
        {comparison.map((sem, i) => (
          <div key={sem.semesterId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--foreground)' }}>
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

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)' }}>Đang tải dữ liệu toàn trường...</div>;
  if (!stats) return null;

  const deptCols = [
    { header: 'Khoa', render: (d: any) => <span className="font-semibold text-foreground">{d.departmentName}</span> },
    { header: 'Sĩ số', render: (d: any) => d.total },
    { header: 'Đã nộp', render: (d: any) => <span className={d.submitted < d.total ? 'text-warning-foreground' : 'text-success'}>{d.submitted} / {d.total}</span> },
    { header: 'Đã duyệt', render: (d: any) => <span className="text-primary font-medium">{d.finalized}</span> },
    { header: 'TB', render: (d: any) => <strong className="text-accent">{d.avgScore}</strong> },
    { header: 'Xuất sắc/Giỏi', render: (d: any) => ((d.byClassification['EXCELLENT']||0) + (d.byClassification['VERY_GOOD']||0)) }
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Control bar */}
      <Card>
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Tổng quan hệ thống</h2>
            <p className="text-sm text-muted-foreground mt-1">Thống kê điểm rèn luyện toàn trường</p>
          </div>
          <select 
            value={selectedSemId} 
            onChange={e => setSelectedSemId(e.target.value)} 
            className="w-full sm:w-64 bg-surface border border-border text-foreground text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors"
          >
            {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tổng Sinh viên</div>
              <div className="text-3xl font-black text-foreground mt-1">{stats.total}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success-bg text-success-foreground flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Điểm trung bình</div>
              <div className="text-3xl font-black text-foreground mt-1">{stats.avgScore}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-info-bg text-info-foreground flex items-center justify-center">
              <Award size={24} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Xuất sắc / Giỏi</div>
              <div className="text-3xl font-black text-foreground mt-1">{(stats.byClassification['EXCELLENT'] || 0) + (stats.byClassification['VERY_GOOD'] || 0)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-warning-bg text-warning-foreground flex items-center justify-center">
              <FileCheck size={24} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Đã nộp / Đã chốt</div>
              <div className="text-2xl font-black text-foreground mt-1">{stats.submitted} / {stats.finalized}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Donut + Khoa table */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Phân loại toàn trường</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <DonutChart data={stats.byClassification} total={stats.total} />
          </CardContent>
        </Card>
        <div className="min-w-0">
          <DataTable
            title="Thống kê theo Khoa"
            columns={deptCols}
            data={stats.byDepartment}
          />
        </div>
      </div>

      {/* Bar Chart compare */}
      <Card>
        <CardHeader>
          <CardTitle>So sánh rèn luyện toàn trường (3 Học kỳ gần nhất)</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <BarChart comparison={comparison} />
        </CardContent>
      </Card>
    </div>
  );
}
