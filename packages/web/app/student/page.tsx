'use client';

import { ScoringForm } from '../components/ScoringForm';
import { UserMenu } from '../components/UserMenu';

export default function StudentScoringPage() {
  return (
    <main className="p-4 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-blue-400">STUDENT</span>
          <h1 className="text-2xl font-bold text-gray-800 mt-2">Sinh viên tự đánh giá rèn luyện</h1>
          <p className="text-gray-600">Vui lòng điền điểm tự đánh giá của bạn cho học kỳ này.</p>
        </div>
        <UserMenu />
      </div>
      <ScoringForm forcedRole="STUDENT" />
    </main>
  );
}
