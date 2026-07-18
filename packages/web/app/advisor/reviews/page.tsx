import { DashboardLayout } from '../../components/DashboardLayout';
import { ScoringDashboard } from '../../components/ScoringDashboard';
import { Suspense } from 'react';

export default function AdvisorReviewsPage() {
  return (
    <DashboardLayout
      pageTitle="Phiếu chờ duyệt"
      pageSubtitle="Duyệt điểm rèn luyện của sinh viên"
      breadcrumbs={[{ label: 'Phiếu chờ duyệt' }]}
    >
      <Suspense fallback={<p style={{ padding: 20 }}>Đang tải...</p>}>
        <ScoringDashboard role="ADVISOR" defaultTab="unscored" />
      </Suspense>
    </DashboardLayout>
  );
}
