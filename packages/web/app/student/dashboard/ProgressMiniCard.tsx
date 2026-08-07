'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export function ProgressMiniCard({ initialData, allowFallbackFetch = true }: { initialData?: Record<string, any> | null, allowFallbackFetch?: boolean }) {
  const [data, setData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(!initialData && allowFallbackFetch);

  useEffect(() => {
    if (initialData || !allowFallbackFetch) return;
    fetch('/api/scoring-progress')
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [initialData]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Tiến độ xét duyệt</CardTitle></CardHeader>
        <CardContent className="py-6 flex justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></CardContent>
      </Card>
    );
  }

  if (!data || data.statusInfo?.dbStatus === 'NO_SHEET') {
    return (
      <Card>
        <CardHeader><CardTitle>Tiến độ xét duyệt</CardTitle></CardHeader>
        <CardContent className="py-6 text-center">
          {!data && !allowFallbackFetch ? (
            <p className="text-sm text-muted-foreground mb-4">Không thể tải thông tin tiến độ lúc này.</p>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">Bạn chưa khởi tạo hoặc nộp phiếu rèn luyện.</p>
          )}
          <Link href="/student/scoring-progress">
            <Button variant="outline" className="w-full">Xem chi tiết</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { statusInfo, progress } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tiến độ xét duyệt</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{statusInfo.statusLabel}</span>
            <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">
              Bước {progress.currentStageIndex}/{progress.totalStages}
            </span>
          </div>

          <div className="relative w-full h-2 bg-surface-muted rounded-full overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-primary transition-all" 
              style={{ width: `${(progress.currentStageIndex / progress.totalStages) * 100}%` }}
            ></div>
          </div>

          <div className="text-xs text-muted-foreground">
            {progress.currentHandler?.roleLabel ? (
              <p>Đang chờ: <span className="font-semibold text-foreground">{progress.currentHandler.roleLabel}</span></p>
            ) : (
              <p>Đã hoàn thành</p>
            )}
          </div>

          <Link href="/student/scoring-progress" className="mt-2 block">
            <Button variant="outline" className="w-full text-xs">Xem chi tiết tiến trình</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
