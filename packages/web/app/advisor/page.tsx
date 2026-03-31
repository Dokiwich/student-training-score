'use client';

import { useState } from 'react';
import { UserMenu } from '../components/UserMenu';
import { AdvisorSummary } from '../components/AdvisorSummary';
import { ScoringDashboard } from '../components/ScoringDashboard';

type Tab = 'summary' | 'list';

export default function AdvisorPage() {
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* HEADER */}
      <div className="px-8 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border-b border-gray-200 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-black">Co Van Hoc Tap - Bang Dieu Khien</h1>
          <p className="text-gray-500 text-xs mt-1">Quan ly va xet duyet diem ren luyen HK1 - 2026</p>
        </div>
        <UserMenu />
      </div>

      {/* TABS & CONTENT */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {/* TABS */}
        <div className="flex gap-0 border-b border-gray-200 mb-4 shrink-0">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-5 py-2.5 text-sm font-bold transition-colors border-b-2 ${
              activeTab === 'summary' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
            id="tab-summary"
          >
            Bang tong hop
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-5 py-2.5 text-sm font-bold transition-colors border-b-2 ${
              activeTab === 'list' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
            id="tab-list"
          >
            Danh sach cham
          </button>
        </div>

        {/* CONTENT */}
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