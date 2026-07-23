import { DashboardLayout } from '../../components/DashboardLayout';
import { ScoringDashboard } from '../../components/ScoringDashboard';
import { Suspense } from 'react';

export default function AdvisorClassesPage() {
  return (
    <DashboardLayout
      pageTitle="Danh sách lớp quản lý"
      pageSubtitle="Quản lý điểm rèn luyện của lớp"
      breadcrumbs={[{ label: 'Danh sách lớp' }]}
    >
      <Suspense fallback={<p style={{ padding: 20 }}>Đang tải...</p>}>
        <ScoringDashboard
          scopeContext="ADVISOR"
          scopeMode="SINGLE_CLASS"
          classSelectorOwner="self"
          defaultTab="all"
        />
      </Suspense>
    </DashboardLayout>
  );
}
