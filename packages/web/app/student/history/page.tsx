'use client';

import { ScoringForm } from '../../components/ScoringForm';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useSession } from 'next-auth/react';

export default function StudentHistoryPage() {
  const { data: session } = useSession();
  const studentId = (session as { user?: { id?: string } })?.user?.id || '';

  return (
    <DashboardLayout
      pageTitle="Lịch sử đánh giá"
      pageSubtitle="Xem chi tiết điểm do Ban cán sự và Cố vấn học tập chấm"
    >
      <ScoringForm
        forcedRole="STUDENT"
        studentId={studentId}
        formId="PHIEU_THAT_01"
        viewMode="history"
      />
    </DashboardLayout>
  );
}
