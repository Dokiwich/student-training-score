import { DashboardLayout } from '../../components/DashboardLayout';
import { AdvisorSummary } from '../../components/AdvisorSummary';
import { Suspense } from 'react';

export default function AdvisorDashboardPage() {
  return (
    <DashboardLayout
      pageTitle="Tổng quan Cố vấn"
      pageSubtitle="Tổng hợp kết quả điểm rèn luyện của lớp"
      breadcrumbs={[{ label: 'Tổng quan' }]}
    >
      <Suspense fallback={<p style={{ padding: 20 }}>Đang tải...</p>}>
        <AdvisorSummary />
      </Suspense>
    </DashboardLayout>
  );
}
