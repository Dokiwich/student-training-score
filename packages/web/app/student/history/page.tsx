'use client';

import { ScoringForm } from '../../components/ScoringForm';
import { UserMenu } from '../../components/UserMenu';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function StudentHistoryPage() {
  const { data: session } = useSession();
  const studentId = (session as { user?: { id?: string } })?.user?.id || '';

  return (
    <main className="p-4 md:p-8 bg-white min-h-screen max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/student" className="text-black hover:underline text-sm font-bold mb-2 inline-block">
            &larr; Quay lai tu cham
          </Link>
          <div>
            <span className="text-xs font-bold px-2 py-0.5 border border-gray-300 text-gray-600">LICH SU</span>
          </div>
          <h1 className="text-xl font-bold text-black mt-2">Lich su danh gia</h1>
          <p className="text-gray-500 text-sm">Xem chi tiet diem do Ban can su va Co van hoc tap cham.</p>
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
