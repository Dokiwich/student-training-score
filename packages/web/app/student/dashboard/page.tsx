import { getServerSession } from 'next-auth';
import { authOptions } from '../../api/auth/[...nextauth]/route';
import { prisma } from '@student-score/database';
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

  let activeSemester = null;
  let scoringSheet = null;
  
  if (user?.studentId) {
    activeSemester = await prisma.semesters.findFirst({
      where: { status: { in: ['UPCOMING', 'STUDENT_SCORING', 'CLASS_REVIEWING', 'ADVISOR_REVIEWING', 'SCHOOL_REVIEWING', 'FINALIZED'] } },
      orderBy: { end_date: 'desc' }
    });

    if (activeSemester) {
      scoringSheet = await prisma.scoring_sheets.findFirst({
        where: {
          semester_enrollments: {
            user_id: user.id,
            semester_id: activeSemester.id,
          }
        },
        include: {
          score_details: {
            include: { score_entries: true }
          }
        }
      });
    }
  }

  let progressData = null;
  if (scoringSheet && session) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${apiUrl}/scoring/progress?sheetId=${scoringSheet.id}`, {
        headers: { Authorization: `Bearer ${(session as any).customJwt}` },
        cache: 'no-store'
      });
      if (res.ok) progressData = await res.json();
    } catch (e) {
      console.error("Lỗi SSR fetch progress:", e);
    }
  }

  const greeting = new Date().getHours() < 12 ? 'Chào buổi sáng' : 'Chào buổi chiều';
  
  const currentPoints = scoringSheet?.score_details?.reduce((acc: number, d: any) => {
    const studentEntry = d.score_entries?.find((e: any) => e.scorer_role === 'STUDENT');
    return acc + (studentEntry ? Number(studentEntry.score) : 0);
  }, 0) || 0;
  
  const sheetStatus = scoringSheet?.status || 'NO_SHEET';
  const missingProofs = 0; // simplified for now

  let deadlineLabel = 'Chưa xác định';
  let daysLeft = 0;
  if (activeSemester?.student_deadline) {
    const d = new Date(activeSemester.student_deadline);
    deadlineLabel = d.toLocaleDateString('vi-VN');
    const diffTime = Math.max(0, d.getTime() - new Date().getTime());
    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

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
                  <div className="text-2xl font-bold mt-1">{currentPoints}</div>
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
                    <StatusBadge status={sheetStatus} />
                  </div>
                </div>
                <div className="h-10 w-10 bg-warning-bg rounded-full flex items-center justify-center text-warning-foreground">
                  <FileText size={20} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">{sheetStatus === 'NO_SHEET' ? 'Chưa nộp phiếu' : 'Đã khởi tạo'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-x-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Hạn nộp</p>
                  <div className="text-lg font-bold mt-1 text-foreground">{deadlineLabel}</div>
                </div>
                <div className="h-10 w-10 bg-danger-bg rounded-full flex items-center justify-center text-danger-foreground">
                  <Clock size={20} />
                </div>
              </div>
              <p className={`text-xs mt-4 ${daysLeft <= 3 ? 'text-danger' : 'text-muted-foreground'}`}>
                {daysLeft > 0 ? `Còn ${daysLeft} ngày` : 'Đã hết hạn'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-x-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Minh chứng</p>
                  <div className="text-2xl font-bold mt-1">{scoringSheet?.score_details?.length || 0} mục</div>
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
                  {(sheetStatus === 'NO_SHEET' || sheetStatus === 'DRAFT') ? (
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
          <ProgressMiniCard initialData={progressData} />
        </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
