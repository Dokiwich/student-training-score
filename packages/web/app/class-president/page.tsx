'use client';

import { ScoringDashboard } from '../components/ScoringDashboard';
import { DashboardLayout } from '../components/DashboardLayout';

export default function ClassPresidentPage() {
  return (
    <DashboardLayout
      pageTitle="Ban cán sự lớp"
      pageSubtitle="Xét duyệt điểm rèn luyện HK1 — 2026"
    >
      <ScoringDashboard role="CLASS_PRESIDENT" showHeader={false} />
    </DashboardLayout>
  );
}
