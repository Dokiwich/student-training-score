'use client';

import { ScoringDashboard } from '../components/ScoringDashboard';
import { DashboardLayout } from '../components/DashboardLayout';

import { Suspense } from 'react';

export default function ClassPresidentPage() {
  return (
    <DashboardLayout
      pageTitle="Ban cán sự lớp"
      pageSubtitle="Xét duyệt điểm rèn luyện HK1 — 2026"
    >
      <Suspense fallback={<p style={{ padding: 20 }}>Đang tải...</p>}>
        <ScoringDashboard role="CLASS_COMMITTEE" showHeader={false} />
      </Suspense>
    </DashboardLayout>
  );
}
