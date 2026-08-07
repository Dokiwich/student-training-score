import { getServerSession } from 'next-auth';
import { authOptions } from '../../api/auth/[...nextauth]/route';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { ClipboardCheck, Clock, FileText, Activity } from 'lucide-react';
import Link from 'next/link';
import { ProgressMiniCard } from './ProgressMiniCard';

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string; name?: string; role?: string; studentId?: string } | undefined;

  let dashboardData = null;
  let dashboardLoadFailed = false;

  if (session) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${apiUrl}/scoring/student/dashboard`, {
        headers: { Authorization: `Bearer ${(session as any).customJwt}` },
        cache: 'no-store'
      });
      if (!res.ok) {
        dashboardLoadFailed = true;
      } else {
        dashboardData = await res.json();
      }
    } catch (e) {
      dashboardLoadFailed = true;
      console.error("Lỗi SSR fetch dashboard:", e);
    }
  }

  const greeting = new Date().getHours() < 12 ? 'Chào buổi sáng' : 'Chào buổi chiều';
  
  const currentPoints = dashboardData?.sheet?.studentScore || 0;
  const sheetStatus = dashboardData?.sheet?.status || 'NO_SHEET';
  const selectedCriteriaCount = dashboardData?.sheet?.selectedCriteriaCount || 0;
  
  const deadlineInfo = dashboardData?.deadline || {
    isOverdue: false,
    daysLeft: 0,
    remainingTimeText: 'Chưa thiết lập',
    studentSubmissionDeadline: null
  };

  const deadlineLabel = deadlineInfo.studentSubmissionDeadline 
    ? new Date(deadlineInfo.studentSubmissionDeadline).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) 
    : 'Chưa xác định';

  return (
    <DashboardLayout
      pageTitle="Tổng quan"
      pageSubtitle="Theo dõi tiến độ chấm điểm rèn luyện"
    >
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary to-primary-hover rounded-xl p-6 sm:p-8 text-primary-foreground shadow-md relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">{greeting}, {user?.name || 'Sinh viên'}!</h2>
            <p className="text-primary-foreground/90 max-w-xl">
              Chào mừng bạn đến với Cổng chấm điểm rèn luyện. Hãy kiểm tra các việc cần làm và hoàn thành phiếu tự đánh giá đúng hạn.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/student">
                <Button className="bg-background text-foreground hover:bg-surface-muted border-none shadow-sm font-semibold">
                  Chấm điểm ngay
                </Button>
              </Link>
            </div>
          </div>
          {/* Decorative background elements */}
          <div className="absolute right-0 top-0 -mt-12 -mr-12 w-64 h-64 bg-foreground opacity-10 rounded-full blur-2xl"></div>
          <div className="absolute right-32 bottom-0 -mb-12 w-48 h-48 bg-accent opacity-20 rounded-full blur-xl"></div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-x-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Điểm hiện tại</p>
                  <div className="text-2xl font-bold mt-1">
                    {dashboardLoadFailed ? '--' : currentPoints}
                  </div>
                </div>
                <div className="h-10 w-10 bg-info-bg rounded-full flex items-center justify-center text-info-foreground">
                  <Activity size={20} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">Dựa trên tự chấm điểm</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-x-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Trạng thái phiếu</p>
                  <div className="mt-1">
                    {dashboardLoadFailed ? (
                      <span className="text-sm text-muted-foreground">Không thể tải</span>
                    ) : (
                      <StatusBadge status={sheetStatus} />
                    )}
                  </div>
                </div>
                <div className="h-10 w-10 bg-warning-bg rounded-full flex items-center justify-center text-warning-foreground">
                  <FileText size={20} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                {dashboardLoadFailed ? '--' : (sheetStatus === 'NO_SHEET' ? 'Chưa nộp phiếu' : 'Đã khởi tạo')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-x-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Hạn nộp</p>
                  <div className="text-lg font-bold mt-1 text-foreground">
                    {dashboardLoadFailed ? '--' : deadlineLabel}
                  </div>
                </div>
                <div className="h-10 w-10 bg-danger-bg rounded-full flex items-center justify-center text-danger-foreground">
                  <Clock size={20} />
                </div>
              </div>
              <p className={`text-xs mt-4 ${(!dashboardLoadFailed && (deadlineInfo.isOverdue || deadlineInfo.daysLeft <= 3)) ? 'text-danger' : 'text-muted-foreground'}`}>
                {dashboardLoadFailed ? '--' : deadlineInfo.remainingTimeText}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-x-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Minh chứng</p>
                  <div className="text-2xl font-bold mt-1">
                    {dashboardLoadFailed ? '--' : `${selectedCriteriaCount} mục`}
                  </div>
                </div>
                <div className="h-10 w-10 bg-success-bg rounded-full flex items-center justify-center text-success-foreground">
                  <ClipboardCheck size={20} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">Số tiêu chí đã chọn</p>
            </CardContent>
          </Card>
        </div>

        {/* Tasks & Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Việc cần làm</CardTitle>
                <CardDescription>Các mục cần hoàn thành để nộp phiếu</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardLoadFailed ? (
                    <div className="p-4 text-center text-danger bg-danger-bg rounded-lg">
                      Không thể tải dữ liệu tổng quan lúc này.
                    </div>
                  ) : (sheetStatus === 'NO_SHEET' || sheetStatus === 'DRAFT') ? (
                    <div className="flex items-start gap-4 p-4 border border-border rounded-lg bg-surface-muted">
                      <div className="shrink-0 mt-0.5">
                        <Clock className="text-danger h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground">Nộp phiếu tự chấm</h4>
                        <p className="text-sm text-muted-foreground mt-1">Hoàn thành và nộp phiếu trước ngày {deadlineLabel}.</p>
                      </div>
                      <Link href="/student">
                        <Button variant="primary" size="sm">Xem phiếu</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      Không có việc cần làm lúc này.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        <div className="lg:col-span-1 space-y-6">
          {dashboardLoadFailed ? (
             <Card>
               <CardHeader><CardTitle>Tiến độ xét duyệt</CardTitle></CardHeader>
               <CardContent className="py-6 text-center text-muted-foreground">
                 Không thể tải tiến độ
               </CardContent>
             </Card>
          ) : (
            <ProgressMiniCard initialData={dashboardData?.progress} allowFallbackFetch={false} />
          )}
        </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
