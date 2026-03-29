import { ScoringForm } from '../../components/ScoringForm';

export default async function ClassPresidentScoringPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return (
    <main className="p-4 max-w-7xl mx-auto">
      <div className="mb-6">
        <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-purple-400">CLASS_PRESIDENT</span>
        <h1 className="text-2xl font-bold text-gray-800 mt-2">Lớp trưởng đánh giá</h1>
        <p className="text-gray-600">Đang đánh giá rèn luyện cho sinh viên: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{studentId}</span></p>
      </div>
      <ScoringForm forcedRole="CLASS_PRESIDENT" studentId={studentId} />
    </main>
  );
}
