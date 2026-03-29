'use client';

import { ScoringForm } from '../../components/ScoringForm';
import { UserMenu } from '../../components/UserMenu';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function StudentHistoryPage() {
  const { data: session } = useSession();
  const studentId = (session as any)?.user?.id || '';

  return (
    <main className="p-4 md:p-8 bg-gray-50 min-h-screen max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/student" className="text-indigo-600 hover:text-indigo-800 text-sm font-bold flex items-center gap-1 mb-2 group transition-colors">
            <span className="group-hover:-translate-x-1 transition-transform inline-block">←</span> Quay lại tự chấm
          </Link>
          <div className="flex items-center gap-2">
            <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-purple-400">LỊCH SỬ</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mt-2">Lịch sử đánh giá</h1>
          <p className="text-gray-600">Xem chi tiết điểm do Ban cán sự và Cố vấn học tập chấm.</p>
        </div>
        <UserMenu />
      </div>

      <ScoringForm
        forcedRole="STUDENT"
        studentId={studentId}
        formId="PHIEU_THAT_01"
        viewMode="history"
      />
    </main>
  );
}
