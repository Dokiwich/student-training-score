'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CheckCircle2, Clock, AlertCircle, RefreshCcw, User, MessageSquare } from 'lucide-react';

export default function StudentScoringProgressPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch('/api/scoring-progress')
      .then(res => {
        if (!res.ok) throw new Error('Không thể tải tiến trình chấm điểm');
        return res.json();
      })
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [session]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p>Đang tải dữ liệu tiến trình...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-danger-bg text-danger p-6 rounded-lg flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle size={48} className="mb-4" />
          <h3 className="text-lg font-bold mb-2">Đã xảy ra lỗi</h3>
          <p>{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="mt-4 bg-background">
            Thử lại
          </Button>
        </div>
      );
    }

    if (!data || data.statusInfo?.dbStatus === 'NO_SHEET') {
      return (
        <div className="bg-surface text-center p-12 rounded-xl border border-border">
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-lg font-bold mb-2">Chưa khởi tạo phiếu điểm</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Học kỳ hiện tại chưa được mở chấm điểm hoặc bạn chưa đăng ký lớp trong học kỳ này.
          </p>
        </div>
      );
    }

    const { statusInfo, progress, scores, stages, semesterInfo, history } = data;

    const actionIcons: Record<string, React.ReactNode> = {
      CREATED: <CheckCircle2 size={16} className="text-primary" />,
      SAVED: <CheckCircle2 size={16} className="text-muted-foreground" />,
      SUBMITTED: <CheckCircle2 size={16} className="text-primary" />,
      RESUBMITTED: <RefreshCcw size={16} className="text-warning" />,
      APPROVED: <CheckCircle2 size={16} className="text-success" />,
      RETURNED: <AlertCircle size={16} className="text-danger" />,
      COMMENTED: <MessageSquare size={16} className="text-info" />,
      SCORE_ADJUSTED: <RefreshCcw size={16} className="text-info" />,
      FINALIZED: <CheckCircle2 size={16} className="text-success" />
    };

    const actionLabels: Record<string, string> = {
      CREATED: 'Khởi tạo phiếu',
      SAVED: 'Lưu nháp',
      SUBMITTED: 'Đã nộp phiếu',
      RESUBMITTED: 'Đã nộp lại',
      APPROVED: 'Đã duyệt',
      RETURNED: 'Đã trả lại',
      COMMENTED: 'Thêm ghi chú',
      SCORE_ADJUSTED: 'Điều chỉnh điểm',
      FINALIZED: 'Đã chốt điểm'
    };

    return (
      <div className="space-y-6">
        {/* Tiêu đề & Trạng thái tổng quan */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Tiến trình xét duyệt</h2>
            <p className="text-muted-foreground mt-1">
              {semesterInfo.name} - Năm học {semesterInfo.academicYear}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Trạng thái:</span>
            <span className="px-3 py-1 bg-primary/10 text-primary font-semibold rounded-full text-sm">
              {statusInfo.statusLabel}
            </span>
          </div>
        </div>

        {/* Tổng hợp Điểm số */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">SV tự chấm</p>
              <p className="text-2xl font-bold">{scores.studentScore}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Ban cán sự</p>
              <p className="text-2xl font-bold">{scores.classCommitteeScore}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Cố vấn học tập</p>
              <p className="text-2xl font-bold">{scores.advisorScore}</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-primary mb-1 font-medium">Điểm cuối cùng</p>
              <p className="text-2xl font-bold text-primary">{scores.finalScore}</p>
            </CardContent>
          </Card>
        </div>

        {/* Alert Trả lại */}
        {progress.isReturned && (
          <div className="bg-danger-bg border border-danger/20 text-danger p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold">Phiếu đang bị trả lại</h4>
              <p className="text-sm mt-1">Vui lòng kiểm tra lại ghi chú ở các bước dưới đây và cập nhật lại điểm rèn luyện.</p>
            </div>
          </div>
        )}

        {/* Timeline Chi tiết */}
        <Card>
          <CardHeader>
            <CardTitle>Chi tiết các bước</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="relative border-l-2 border-border ml-3 md:ml-6 space-y-10">
              
              {stages.map((stage: Record<string, any>) => {
                const isPast = progress.currentStageIndex > stage.stageIndex || statusInfo.isCompleted;
                const isCurrent = progress.currentStageIndex === stage.stageIndex && !statusInfo.isCompleted;
                const isFuture = progress.currentStageIndex < stage.stageIndex;

                let markerColor = 'bg-muted border-border';
                if (isPast) markerColor = 'bg-primary border-primary';
                if (isCurrent) markerColor = progress.isReturned ? 'bg-danger border-danger' : 'bg-background border-primary border-[4px]';

                return (
                  <div key={stage.stageIndex} className="relative pl-8 md:pl-10">
                    {/* Marker */}
                    <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full ${markerColor} transition-colors`} />
                    
                    {/* Stage Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                      <div>
                        <h4 className={`text-base font-bold ${isFuture ? 'text-muted-foreground' : 'text-foreground'}`}>
                          Bước {stage.stageIndex}: {stage.roleLabel}
                        </h4>
                        {isCurrent && (
                          <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 bg-warning-bg text-warning-foreground rounded-full">
                            Đang xử lý
                          </span>
                        )}
                      </div>
                      {stage.deadline && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 sm:mt-0 bg-surface-muted px-2.5 py-1 rounded-md">
                          <Clock size={14} />
                          Hạn: {new Date(stage.deadline).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </div>

                    {/* Removed Stage Actions from here */}
                  </div>
                );
              })}
              
            </div>
          </CardContent>
        </Card>

        {/* Lịch sử hoạt động */}
        <Card>
          <CardHeader>
            <CardTitle>Lịch sử hoạt động</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {!history || history.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground italic">
                Phiếu hiện tại chưa có lịch sử xử lý.
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((event: Record<string, any>) => (
                  <div key={event.id} className="bg-surface-muted rounded-lg p-3 md:p-4 text-sm border border-border">
                    <div className="flex justify-between items-start mb-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          {actionIcons[event.eventType] || <User size={16} className="text-muted-foreground" />}
                          <span className="font-semibold text-foreground">{event.actorName}</span>
                          <span className="text-muted-foreground text-xs bg-background px-1.5 py-0.5 rounded border border-border">
                            {actionLabels[event.eventType] || event.eventType}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Vai trò: {event.actorRoleLabel}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(event.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    
                    {event.eventType === 'SCORE_ADJUSTED' && (
                      <div className="mt-3 bg-background border border-border p-3 rounded-md text-sm">
                        <div className="font-medium mb-1">
                          {event.criterionCode}: {event.criterionName}
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span className="line-through">{event.previousScore} điểm</span>
                          <span className="text-foreground">→</span>
                          <span className="font-semibold text-primary">{event.newScore} điểm</span>
                        </div>
                      </div>
                    )}

                    {(event.comment || event.reason) && (
                      <div className="mt-2 text-foreground/90 bg-background/50 p-2.5 rounded-md border-l-2 border-primary/50 whitespace-pre-wrap break-words text-xs md:text-sm">
                        {event.comment || event.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <DashboardLayout
      pageTitle="Tiến trình chấm điểm"
      pageSubtitle="Theo dõi quá trình nộp và xét duyệt điểm rèn luyện"
    >
      <div className="max-w-4xl mx-auto w-full pb-10">
        {renderContent()}
      </div>
    </DashboardLayout>
  );
}
