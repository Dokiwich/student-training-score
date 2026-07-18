'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '../components/DashboardLayout';
import { useSession } from 'next-auth/react';

import { UsersTab } from './UsersTab';
import { SemestersTab } from './SemestersTab';
import { DepartmentsTab } from './DepartmentsTab';
import { ClassesTab } from './ClassesTab';
import { AdminDashboardTab } from './AdminDashboardTab';
import { CriteriaTab } from './components/CriteriaTab/CriteriaTab';
import { Loader2 } from 'lucide-react';

type AdminTab = 'criteria' | 'departments' | 'classes' | 'users' | 'semesters' | 'dashboard';

export default function AdminPage() {
  return (
    <Suspense fallback={
      <DashboardLayout pageTitle="Quản trị hệ thống" pageSubtitle="Đang tải dữ liệu...">
        <div className="flex items-center justify-center h-[200px]">
          <Loader2 className="w-8 h-8 text-[#d0d6e0] animate-spin" />
        </div>
      </DashboardLayout>
    }>
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as AdminTab | null;

  const activeTab: AdminTab = tabParam || 'criteria';
  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === 'SCHOOL_ADMIN';

  if (!session) return (
    <div className="flex items-center justify-center h-screen bg-[#F8FAFC]">
      <Loader2 className="w-8 h-8 text-[#d0d6e0] animate-spin" />
    </div>
  );
  
  if (!isAdmin) return (
    <div className="flex items-center justify-center h-screen bg-[#F8FAFC] p-4">
      <div className="p-8 text-center text-[#DC2626] font-[700] bg-surface rounded-[16px] border border-[#FECACA] shadow-sm">
        Bạn không có quyền truy cập trang này!
      </div>
    </div>
  );

  return (
    <DashboardLayout pageTitle="Quản trị Hệ thống" pageSubtitle="Quản lý cấu hình hệ thống đánh giá rèn luyện">
      <div className="flex flex-col gap-5 w-full max-w-[1440px] mx-auto">
        {activeTab === 'dashboard' && <AdminDashboardTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'departments' && <DepartmentsTab />}
        {activeTab === 'classes' && <ClassesTab />}
        {activeTab === 'semesters' && <SemestersTab />}
        {activeTab === 'criteria' && <CriteriaTab />}
      </div>
    </DashboardLayout>
  );
}
