'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdvisorSummary } from '../components/AdvisorSummary';
import { ScoringDashboard } from '../components/ScoringDashboard';
import { DashboardLayout } from '../components/DashboardLayout';

function AdvisorContent() {
  const searchParams = useSearchParams();
  const filter = searchParams?.get('filter');

  // filter=summary → trang tổng hợp, mọi filter khác → danh sách chấm
  const isSummary = filter === 'summary';

  return (
    <div style={{ flex: 1 }}>
      {isSummary ? (
        <AdvisorSummary />
      ) : (
        <ScoringDashboard role="ADVISOR" showHeader={false} />
      )}
    </div>
  );
}

export default function AdvisorPage() {
  return (
    <DashboardLayout
      pageTitle="Cố vấn học tập"
      pageSubtitle="Quản lý và xét duyệt điểm rèn luyện HK1 — 2026"
    >
      <Suspense fallback={<p style={{ padding: 20 }}>Đang tải...</p>}>
        <AdvisorContent />
      </Suspense>
    </DashboardLayout>
  );
}