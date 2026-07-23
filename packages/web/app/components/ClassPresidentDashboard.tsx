'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Users, FileText, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchClassScopedStudents } from '../lib/fetch-helpers';
import { ClassDataState } from '../lib/scoring-types';

const API_BASE = '/proxy-api';

export function ClassPresidentDashboard() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const urlClassId = searchParams ? searchParams.get('classId') : null;
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<ClassDataState<import('../lib/scoring-types').ScoringStudentRow>>({ status: 'loading' });

  const fetchStudents = async () => {
    if (!session?.user) return;
    const customJwt = (session as { customJwt?: string })?.customJwt;
    if (!customJwt) return;

    setState({ status: 'loading' });
    let endpoint = `${API_BASE}/scoring/class-committee/students`;
    if (urlClassId) {
      endpoint += `?classId=${urlClassId}`;
    }

    const res = await fetchClassScopedStudents<import('../lib/scoring-types').ScoringStudentRow>(endpoint, customJwt);
    
    if (res.type === 'success') {
      if (res.context.reason === 'NO_ENROLLMENTS_FOR_CURRENT_SEMESTER') {
        setState({
          status: 'empty-enrollment',
          title: 'Danh sách sinh viên trống',
          message: 'Lớp chưa có danh sách sinh viên trong học kỳ hiện tại.',
          context: res.context
        });
      } else {
        setState({
          status: 'ready',
          data: res.data,
          context: res.context
        });
      }
    } else if (res.type === 'class-context-required') {
      setState({
        status: 'class-context-required',
        message: res.message,
        classes: res.classes
      });
    } else if (res.type === 'forbidden') {
      setState({
        status: 'forbidden',
        message: res.message
      });
    } else {
      setState({
        status: 'error',
        message: res.message
      });
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [session, urlClassId]);

  const stats = useMemo(() => {
    let students: any[] = [];
    if (state.status === 'ready') {
      students = state.data;
    } else if (state.status === 'empty-enrollment') {
      students = [];
    } else {
      return null;
    }

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
  }, [state]);

  if (state.status === 'loading') {
    return <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2"><RefreshCw className="animate-spin" /> Đang tải dữ liệu...</div>;
  }

  if (state.status === 'class-context-required') {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 text-center bg-surface border border-border rounded-2xl shadow-sm">
        <div className="w-16 h-16 bg-primary-light text-primary flex items-center justify-center rounded-full mx-auto mb-4">
          <Users size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2 text-foreground">{state.message}</h2>
        <p className="text-sm text-muted-foreground mb-6">Bạn được phân công nhiều lớp. Vui lòng chọn một lớp để xem tổng quan.</p>
        <div className="flex flex-col gap-3">
          {state.classes.map((cls) => (
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

  if (state.status === 'forbidden') {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 text-center bg-destructive/10 border border-destructive/20 rounded-2xl shadow-sm">
        <div className="w-16 h-16 bg-destructive text-destructive-foreground flex items-center justify-center rounded-full mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2 text-destructive">Không có quyền truy cập</h2>
        <p className="text-sm text-muted-foreground mb-6">{state.message}</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 text-center bg-surface border border-border rounded-2xl shadow-sm">
        <div className="w-16 h-16 bg-destructive/10 text-destructive flex items-center justify-center rounded-full mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2 text-foreground">Đã có lỗi xảy ra</h2>
        <p className="text-sm text-muted-foreground mb-6">{state.message}</p>
        <button onClick={fetchStudents} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 mx-auto">
          <RefreshCw size={16} /> Thử lại
        </button>
      </div>
    );
  }

  if (state.status === 'empty-enrollment') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-surface rounded-xl shadow-sm border border-border text-center">
        <div className="w-16 h-16 bg-muted flex items-center justify-center rounded-full mb-4">
          <Users size={32} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{state.title || 'Danh sách sinh viên trống'}</h3>
        <p className="text-muted-foreground max-w-md">{state.message}</p>
      </div>
    );
  }

  if (!stats) return null;

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
