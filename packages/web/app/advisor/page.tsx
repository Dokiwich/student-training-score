'use client';

import { useState } from 'react';
import { UserMenu } from '../components/UserMenu';
import { AdvisorSummary } from '../components/AdvisorSummary';
import { ScoringDashboard } from '../components/ScoringDashboard';

type Tab = 'summary' | 'list';

export default function AdvisorPage() {
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* HEADER */}
      <div className="px-8 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border-b border-gray-200 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            👨‍🏫 Cố Vấn Học Tập — Bảng Điều Khiển
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            Quản lý và xét duyệt điểm rèn luyện HK1 — 2026
          </p>
        </div>
        <UserMenu />
      </div>

      {/* TABS & CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {/* TABS */}
        <div className="flex gap-1 bg-gray-200/50 p-1 rounded-xl mb-4 w-fit shrink-0">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'summary'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            id="tab-summary"
          >
            📊 Bảng tổng hợp
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'list'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            id="tab-list"
          >
            📋 Danh sách chấm
          </button>
        </div>

        {/* TAB CONTENT */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'summary' ? (
            <div className="h-full overflow-y-auto pr-2">
              <AdvisorSummary />
            </div>
          ) : (
            <ScoringDashboard role="ADVISOR" showHeader={false} />
          )}
        </div>
      </div>
    </div>
  );
}