'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdvisorSummary } from '../components/AdvisorSummary';
import { ScoringDashboard } from '../components/ScoringDashboard';
import { DashboardLayout } from '../components/DashboardLayout';

function AdvisorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams?.get('filter');
  const tab = searchParams?.get('tab');
  
  // If there's a filter, we are in the list view automatically
  const activeTab = filter || tab === 'list' ? 'list' : 'summary';

  return (
    <>
      {/* Tabs */}
      <div className="dashboard-tabs" style={{ marginBottom: 20 }}>
        <button
          onClick={() => router.push('/advisor?tab=summary')}
          className={`dashboard-tab ${activeTab === 'summary' ? 'active' : ''}`}
          id="tab-summary"
        >
          Bảng tổng hợp
        </button>
        <button
          onClick={() => router.push('/advisor?tab=list')}
          className={`dashboard-tab ${activeTab === 'list' ? 'active' : ''}`}
          id="tab-list"
        >
          Danh sách chấm
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        {activeTab === 'summary' ? (
          <AdvisorSummary />
        ) : (
          <ScoringDashboard role="ADVISOR" showHeader={false} />
        )}
      </div>
    </>
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