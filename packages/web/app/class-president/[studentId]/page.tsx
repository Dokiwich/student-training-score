import { ScoringForm } from '../../components/ScoringForm';

export default async function ClassPresidentScoringPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return (
    <main style={{ padding: 16, maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#eef2ff', color: '#1a365d', border: '1px solid #c7d2fe' }}>
          BCS
        </span>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', marginTop: 8 }}>Lớp trưởng đánh giá</h1>
        <p style={{ color: '#6b7280', fontSize: 13 }}>
          Đang đánh giá rèn luyện cho sinh viên: <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{studentId}</span>
        </p>
      </div>
      <ScoringForm forcedRole="CLASS_PRESIDENT" studentId={studentId} />
    </main>
  );
}
