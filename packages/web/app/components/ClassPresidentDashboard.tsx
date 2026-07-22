'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Users, FileText, CheckCircle, Clock } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';

const API_BASE = '/proxy-api';

export function ClassPresidentDashboard() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const urlClassId = searchParams ? searchParams.get('classId') : null;
  const router = useRouter();
  const pathname = usePathname();

  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextRequired, setContextRequired] = useState<{ message: string, classes: {id: string, name: string}[] } | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    const customJwt = (session as any)?.customJwt;
    if (!customJwt) return;

    const fetchStudents = async () => {
      setLoading(true);
      setContextRequired(null);
      try {
        let endpoint = `${API_BASE}/scoring/class-committee/students`;
        if (urlClassId) {
          endpoint += `?classId=${urlClassId}`;
        }
        const res = await fetch(endpoint, {
          headers: { 'Authorization': `Bearer ${customJwt}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStudents(data.data || []);
        } else if (res.status === 400) {
          let jsonError: any = null;
          try {
            jsonError = await res.json();
          } catch (e) {}
          if (jsonError?.code === 'CLASS_CONTEXT_REQUIRED') {
            setContextRequired({
              message: jsonError.message || 'Vui lòng chọn lớp',
              classes: jsonError.classes || []
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch class students', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [session, urlClassId]);

  const stats = useMemo(() => {
    const total = students.length;
    let submitted = 0;
    let pendingReview = 0;
    let reviewed = 0;
    let finalized = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    students.forEach((s) => {
      if (s.status !== 'NO_SHEET' && s.status !== 'DRAFT') {
        submitted++;
      }
      if (s.status === 'STUDENT_SUBMITTED' || s.status === 'CLASS_REVIEWING') {
        pendingReview++;
      }
      if (['CLASS_REVIEWED', 'CLASS_REJECTED', 'ADVISOR_REVIEWING', 'ADVISOR_APPROVED', 'ADVISOR_REJECTED', 'SCHOOL_REVIEWING', 'SCHOOL_APPROVED', 'SCHOOL_REJECTED', 'FINALIZED'].includes(s.status)) {
        reviewed++;
      }
      if (s.status === 'FINALIZED') finalized++;
      
      if (s.classTotal != null) {
        scoreSum += s.classTotal;
        scoreCount++;
      }
    });

    const avgScore = scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : 0;

    return { total, submitted, pendingReview, reviewed, finalized, avgScore };
  }, [students]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Đang tải dữ liệu...</div>;
  }

  if (contextRequired) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 text-center bg-surface border border-border rounded-2xl shadow-sm">
        <div className="w-16 h-16 bg-primary-light text-primary flex items-center justify-center rounded-full mx-auto mb-4">
          <Users size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2 text-foreground">{contextRequired.message}</h2>
        <p className="text-sm text-muted-foreground mb-6">Bạn được phân công nhiều lớp. Vui lòng chọn một lớp để xem tổng quan.</p>
        <div className="flex flex-col gap-3">
          {contextRequired.classes.map((cls: any) => (
            <button
              key={cls.id}
              className="p-4 border border-border rounded-xl hover:bg-primary-light hover:border-primary/30 transition-all text-left flex items-center justify-between group"
              onClick={() => {
                const params = new URLSearchParams(searchParams?.toString() || '');
                params.set('classId', cls.id);
                router.push(`${pathname}?${params.toString()}`);
              }}
            >
              <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{cls.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-sm border-border">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-info-bg text-info flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Sĩ số lớp</p>
              <h3 className="text-2xl font-bold text-foreground">{stats.total}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-border">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-warning-bg text-warning-foreground flex items-center justify-center">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Chờ BCS duyệt</p>
              <h3 className="text-2xl font-bold text-foreground">{stats.pendingReview} <span className="text-sm font-normal text-muted-foreground">/ {stats.submitted} đã nộp</span></h3>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success-bg text-success-foreground flex items-center justify-center">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Đã duyệt (BCS)</p>
              <h3 className="text-2xl font-bold text-foreground">{stats.reviewed}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Điểm TB (BCS chấm)</p>
              <h3 className="text-2xl font-bold text-foreground">{stats.avgScore}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader>
          <CardTitle>Tiến độ chấm điểm của lớp</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Đã nộp phiếu ({stats.submitted}/{stats.total})</span>
              <span className="font-semibold">{stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
              <div className="bg-info h-2.5 rounded-full" style={{ width: `${stats.total > 0 ? (stats.submitted / stats.total) * 100 : 0}%` }}></div>
            </div>

            <div className="flex justify-between text-sm mt-4">
              <span className="text-muted-foreground">BCS đã duyệt ({stats.reviewed}/{stats.submitted})</span>
              <span className="font-semibold">{stats.submitted > 0 ? Math.round((stats.reviewed / stats.submitted) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
              <div className="bg-success h-2.5 rounded-full" style={{ width: `${stats.submitted > 0 ? (stats.reviewed / stats.submitted) * 100 : 0}%` }}></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
