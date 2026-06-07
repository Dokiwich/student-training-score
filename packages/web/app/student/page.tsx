'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { ScoringForm } from '../components/ScoringForm';
import { DashboardLayout } from '../components/DashboardLayout';

export default function StudentScoringPage() {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id;
  const [topBarExtra, setTopBarExtra] = useState<React.ReactNode>(null);

  return (
    <DashboardLayout
      pageTitle="Phiếu tự chấm điểm"
      pageSubtitle="Đánh giá kết quả rèn luyện cá nhân"
      topBarExtra={topBarExtra}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {userId ? (
          <ScoringForm forcedRole="STUDENT" studentId={userId} setTopBarExtra={setTopBarExtra} />
        ) : (
          <p style={{ color: '#9ca3af', padding: 16 }}>Đang tải biểu mẫu...</p>
        )}
      </div>
    </DashboardLayout>
  );
}
