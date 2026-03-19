'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitScoreSchema, SubmitScoreType } from '@student-score/shared';

const API_BASE = 'http://localhost:3000/api';

interface ScoreDetail {
  criteria_id: number;
  student_score: number | string | null;
  criteria?: {
    id: number;
    code: string;
    content: string;
    max_points: number;
  };
}

export function ScoringForm() {
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scores, setScores] = useState<ScoreDetail[]>([]);
  const [isLoadingScores, setIsLoadingScores] = useState(true);

  const formId = 'PHIEU_THAT_01';

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<SubmitScoreType>({
    resolver: zodResolver(SubmitScoreSchema),
  });

  const fetchScores = useCallback(async () => {
    try {
      setIsLoadingScores(true);
      const response = await fetch(`${API_BASE}/scoring/${formId}/scores`);
      const result = await response.json();
      if (response.ok) {
        setScores(result.data);
      }
    } catch (error) {
      console.error('Lỗi tải danh sách điểm:', error);
    } finally {
      setIsLoadingScores(false);
    }
  }, [formId]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  // Auto-dismiss success message
  useEffect(() => {
    if (submitMessage?.type === 'success') {
      const timer = setTimeout(() => setSubmitMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [submitMessage]);

  const onSubmit = async (data: SubmitScoreType) => {
    setSubmitMessage(null);
    try {
      const response = await fetch(`${API_BASE}/scoring/${formId}/submit-criteria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Lỗi máy chủ');

      setSubmitMessage({ type: 'success', text: '✓ Lưu điểm thành công!' });
      reset();
      fetchScores();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi';
      setSubmitMessage({ type: 'error', text: message });
    }
  };

  const totalScore = scores.reduce((sum, s) => sum + (Number(s.student_score) || 0), 0);
  const totalMax = scores.reduce((sum, s) => sum + (s.criteria?.max_points || 0), 0);

  return (
    <div className="space-y-6">
      {/* Submit Message Toast */}
      {submitMessage && (
        <div
          className={`animate-slide-in rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 shadow-md
            ${submitMessage.type === 'success'
              ? 'bg-success-light text-green-800 border border-green-200'
              : 'bg-danger-light text-red-800 border border-red-200'
            }`}
        >
          {submitMessage.type === 'success' ? (
            <svg className="w-5 h-5 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-danger flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {submitMessage.text}
        </div>
      )}

      {/* Form Card */}
      <div className="bg-surface rounded-2xl shadow-md border border-border p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-text-primary">Nhập điểm tiêu chí</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex gap-3 items-start">
          <div className="flex-1">
            <label className="block text-xs font-medium text-text-muted mb-1.5">Mã tiêu chí</label>
            <input
              type="number"
              {...register('criteriaId', { valueAsNumber: true })}
              disabled={isSubmitting}
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-white
                focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all
                disabled:bg-gray-50 disabled:text-text-muted placeholder:text-text-muted/60"
              placeholder="VD: 1"
            />
            {errors.criteriaId && (
              <p className="text-danger text-xs mt-1.5 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.criteriaId.message}
              </p>
            )}
          </div>

          <div className="w-36">
            <label className="block text-xs font-medium text-text-muted mb-1.5">Điểm số</label>
            <input
              type="number"
              step="0.1"
              {...register('studentScore', { valueAsNumber: true })}
              disabled={isSubmitting}
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-white
                focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all
                disabled:bg-gray-50 disabled:text-text-muted placeholder:text-text-muted/60"
              placeholder="0 - 100"
            />
            {errors.studentScore && (
              <p className="text-danger text-xs mt-1.5 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.studentScore.message}
              </p>
            )}
          </div>

          <div className="pt-[22px]">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary-dark disabled:bg-primary/50 text-white font-semibold
                py-2.5 px-5 rounded-lg transition-all duration-200 text-sm flex items-center gap-2
                shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang lưu...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Lưu điểm
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Scores Table Card */}
      <div className="bg-surface rounded-2xl shadow-md border border-border overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-text-primary">Bảng điểm chi tiết</h2>
          </div>
          {scores.length > 0 && (
            <div className="text-sm">
              <span className="text-text-muted">Tổng điểm: </span>
              <span className="font-bold text-primary text-lg">{totalScore}</span>
              {totalMax > 0 && <span className="text-text-muted">/{totalMax}</span>}
            </div>
          )}
        </div>

        {isLoadingScores ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="skeleton w-16 h-5" />
                <div className="skeleton flex-1 h-5" />
                <div className="skeleton w-20 h-5" />
              </div>
            ))}
          </div>
        ) : scores.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-text-secondary font-medium">Chưa có tiêu chí nào được chấm</p>
            <p className="text-text-muted text-sm mt-1">Nhập mã tiêu chí và điểm số ở form phía trên để bắt đầu.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 text-text-secondary text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3 text-left">Mã TC</th>
                  <th className="px-6 py-3 text-left">Nội dung tiêu chí</th>
                  <th className="px-6 py-3 text-center">Điểm tối đa</th>
                  <th className="px-6 py-3 text-center">Điểm tự chấm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scores.map((score, index) => {
                  const studentScore = Number(score.student_score) || 0;
                  const maxPoints = score.criteria?.max_points || 0;
                  const percentage = maxPoints > 0 ? (studentScore / maxPoints) * 100 : 0;

                  return (
                    <tr
                      key={score.criteria_id}
                      className="hover:bg-surface-hover transition-colors duration-150"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center justify-center w-10 h-7 rounded-md bg-primary-50 text-primary text-xs font-bold">
                          {score.criteria?.code || score.criteria_id}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-text-primary">
                        {score.criteria?.content || '—'}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-text-muted font-medium">
                        {maxPoints}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`text-base font-bold ${percentage >= 70 ? 'text-success' : percentage >= 40 ? 'text-warning' : 'text-danger'}`}>
                            {studentScore}
                          </span>
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${percentage >= 70 ? 'bg-success' : percentage >= 40 ? 'bg-warning' : 'bg-danger'}`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer total */}
              <tfoot>
                <tr className="bg-gray-50/80 font-semibold">
                  <td className="px-6 py-4 text-sm text-text-primary" colSpan={2}>Tổng cộng</td>
                  <td className="px-6 py-4 text-center text-sm text-text-secondary">{totalMax}</td>
                  <td className="px-6 py-4 text-center text-lg font-bold text-primary">{totalScore}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}