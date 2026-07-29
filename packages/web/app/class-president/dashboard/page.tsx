'use client';

import { Suspense } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { ClassPresidentDashboard } from '../../components/ClassPresidentDashboard';

export default function ClassPresidentDashboardPage() {
  return (
    <DashboardLayout
      pageTitle="Ban cán sự lớp"
      pageSubtitle="Tổng quan thống kê điểm rèn luyện của lớp"
    >
      <Suspense fallback={<p className="p-4 text-muted-foreground">Đang tải...</p>}>
        <ClassPresidentDashboard />
      </Suspense>
    </DashboardLayout>
  );
}
