import { ScoringForm } from './ScoringForm';

export default function ScoringPage() {
  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Chấm Điểm Rèn Luyện</h1>
            <p className="text-text-muted text-sm">Học kỳ 1 — Năm học 2023-2024</p>
          </div>
        </div>
      </div>

      {/* ScoringForm */}
      <ScoringForm />
    </div>
  );
}