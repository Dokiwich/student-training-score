'use client';

import { ScoringDashboard } from '../components/ScoringDashboard';
import { DashboardLayout } from '../components/DashboardLayout';
<<<<<<< HEAD

import { Suspense } from 'react';
=======
>>>>>>> b667618330bd5ac598dc4a5e41537d57ede4ff57

export default function ClassPresidentPage() {
  return (
    <DashboardLayout
      pageTitle="Ban cán sự lớp"
      pageSubtitle="Xét duyệt điểm rèn luyện HK1 — 2026"
    >
<<<<<<< HEAD
      <Suspense fallback={<p style={{ padding: 20 }}>Đang tải...</p>}>
        <ScoringDashboard role="CLASS_COMMITTEE" showHeader={false} />
      </Suspense>
=======
      <ScoringDashboard role="CLASS_PRESIDENT" showHeader={false} />
>>>>>>> b667618330bd5ac598dc4a5e41537d57ede4ff57
    </DashboardLayout>
  );
}
