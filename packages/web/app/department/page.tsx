'use client';

import { Suspense } from 'react';
import { DepartmentDashboard } from '../components/DepartmentDashboard';
import { DashboardLayout } from '../components/DashboardLayout';

function DepartmentContent() {
  return <DepartmentDashboard />;
}

export default function DepartmentPage() {
  return (
    <DashboardLayout
      pageTitle="Khoa"
      pageSubtitle="Quản lý và thống kê điểm rèn luyện cấp khoa"
    >
      <Suspense fallback={<p style={{ padding: 20 }}>Đang tải...</p>}>
        <DepartmentContent />
      </Suspense>
    </DashboardLayout>
  );
}
