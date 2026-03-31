'use client';

import { useSession } from 'next-auth/react';
import { ScoringForm } from '../components/ScoringForm';
import { UserMenu } from '../components/UserMenu';

export default function StudentScoringPage() {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id;

  return (
    <main className="w-full min-h-screen flex flex-col bg-gray-50">
      <div className="px-4 py-2 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 shadow-sm">
        <div>
          <span className="text-[10px] font-bold px-1.5 py-0.5 border border-gray-300 text-gray-600 tracking-wide">SINH VIÊN</span>
          <h1 className="text-base font-bold text-black mt-1.5">Sinh viên tự đánh giá rèn luyện</h1>
          <p className="text-gray-500 text-xs mt-0.5">Vui lòng điền điểm tự đánh giá của bạn cho học kỳ này.</p>
        </div>
        <UserMenu />
      </div>
      <div className="flex-1 w-full flex flex-col bg-white">
        {userId ? (
          <ScoringForm forcedRole="STUDENT" studentId={userId} />
        ) : (
          <p className="text-gray-500 mt-4 px-4">Đang tải biểu mẫu...</p>
        )}
      </div>
    </main>
  );
}
