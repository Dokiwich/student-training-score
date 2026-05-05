'use client';

<<<<<<< HEAD
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
=======
import { useState } from 'react';
>>>>>>> b667618330bd5ac598dc4a5e41537d57ede4ff57
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
<<<<<<< HEAD
    <>
      {/* Tabs */}
      <div className="dashboard-tabs" style={{ marginBottom: 20 }}>
        <button
          onClick={() => router.push('/advisor?tab=summary')}
=======
    <DashboardLayout
      pageTitle="Cố vấn học tập"
      pageSubtitle="Quản lý và xét duyệt điểm rèn luyện HK1 — 2026"
    >
      {/* Tabs */}
      <div className="dashboard-tabs" style={{ marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('summary')}
>>>>>>> b667618330bd5ac598dc4a5e41537d57ede4ff57
          className={`dashboard-tab ${activeTab === 'summary' ? 'active' : ''}`}
          id="tab-summary"
        >
          Bảng tổng hợp
        </button>
        <button
<<<<<<< HEAD
          onClick={() => router.push('/advisor?tab=list')}
=======
          onClick={() => setActiveTab('list')}
>>>>>>> b667618330bd5ac598dc4a5e41537d57ede4ff57
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
<<<<<<< HEAD
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
=======
>>>>>>> b667618330bd5ac598dc4a5e41537d57ede4ff57
    </DashboardLayout>
  );
}