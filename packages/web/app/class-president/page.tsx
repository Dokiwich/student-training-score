'use client';

import { ScoringDashboard } from '../components/ScoringDashboard';
import { DashboardLayout } from '../components/DashboardLayout';

import { Suspense } from 'react';

export default function ClassPresidentPage() {
  return (
    <DashboardLayout
      pageTitle="Ban cán sự lớp"
      pageSubtitle="Quản lý và xét duyệt điểm rèn luyện"
    >
      <Suspense fallback={<p style={{ padding: 20 }}>Đang tải...</p>}>
        <ScoringDashboard role="CLASS_COMMITTEE" showHeader={false} />
      </Suspense>
    </DashboardLayout>
  );
}
