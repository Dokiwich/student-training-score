'use client';

import { useState } from 'react';
import { AdvisorSummary } from '../components/AdvisorSummary';
import { ScoringDashboard } from '../components/ScoringDashboard';
import { DashboardLayout } from '../components/DashboardLayout';

type Tab = 'summary' | 'list';

export default function AdvisorPage() {
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  return (
    <DashboardLayout
      pageTitle="Cố vấn học tập"
      pageSubtitle="Quản lý và xét duyệt điểm rèn luyện HK1 — 2026"
    >
      {/* Tabs */}
      <div className="dashboard-tabs" style={{ marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('summary')}
          className={`dashboard-tab ${activeTab === 'summary' ? 'active' : ''}`}
          id="tab-summary"
        >
          Bảng tổng hợp
        </button>
        <button
          onClick={() => setActiveTab('list')}
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
    </DashboardLayout>
  );
}