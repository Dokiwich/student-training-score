'use client';

import { Role } from '../ScoringForm';

interface StickyActionBarProps {
  currentRole: string;
  formStatus: string;
  effectiveCanEdit: boolean;
  canDeleteForm: boolean;
  isSavingDraft: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
  onReject: () => void;
}

export function StickyActionBar({
  currentRole,
  formStatus,
  effectiveCanEdit,
  canDeleteForm,
  isSavingDraft,
  isSubmitting,
  isDeleting,
  onSaveDraft,
  onSubmit,
  onReject,
}: StickyActionBarProps) {
  // Determine text based on role
  const submitText = (currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') ? 'Xác nhận' : 'Nộp Phiếu';
  const submitLoadingText = (currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') ? 'Đang xác nhận...' : 'Đang nộp...';

  // Stepper Logic
  const steps = [
    { id: 'DRAFT', label: 'Chưa nộp', num: 1 },
    { id: 'STUDENT_SUBMITTED', label: 'Ban cán sự', num: 2 },
    { id: 'CLASS_REVIEWED', label: 'Cố vấn học tập', num: 3 },
    { id: 'APPROVED', label: 'Hoàn thành', num: 4 }
  ];

  const currentStepIndex = steps.findIndex(s => {
    if (formStatus === 'DRAFT' || formStatus === 'NOT_CREATED' || formStatus === 'CLASS_REJECTED' || formStatus === 'ADVISOR_REJECTED' || formStatus === 'REJECTED') return s.id === 'DRAFT';
    if (formStatus === 'STUDENT_SUBMITTED' || formStatus === 'CLASS_REVIEWING') return s.id === 'STUDENT_SUBMITTED';
    if (formStatus === 'CLASS_REVIEWED' || formStatus === 'ADVISOR_REVIEWING') return s.id === 'CLASS_REVIEWED';
    if (formStatus === 'APPROVED' || formStatus === 'ADVISOR_APPROVED' || formStatus === 'SCHOOL_REVIEWING' || formStatus === 'SCHOOL_APPROVED' || formStatus === 'FINALIZED') return s.id === 'APPROVED';
    return false;
  });

  return (
    <div className="sticky bottom-0 left-0 right-0 z-40 bg-surface border-t border-border shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] p-4 md:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Stepper (Desktop only or responsive) */}
        <div className="hidden md:flex flex-1 items-center max-w-xl">
          {steps.map((step, idx) => {
            const isActive = idx === Math.max(0, currentStepIndex);
            const isCompleted = idx < Math.max(0, currentStepIndex);
            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${isActive ? 'bg-primary text-primary-foreground shadow-sm ring-4 ring-primary-light/30' : isCompleted ? 'bg-primary-light text-primary' : 'bg-surface-muted text-muted-foreground'}`}>
                    {isCompleted ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg> : step.num}
                  </div>
                  <span className={`text-sm ${isActive ? 'text-primary font-bold' : isCompleted ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{step.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-[2px] mx-3 rounded-full ${isCompleted ? 'bg-primary-light' : 'bg-surface-muted'}`} />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Mobile step text */}
        <div className="md:hidden w-full text-center text-sm font-medium text-muted-foreground">
          Bước {Math.max(1, currentStepIndex + 1)}/4: <span className="text-primary font-bold">{steps[Math.max(0, currentStepIndex)]?.label}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end">
          {effectiveCanEdit && (
            <>
              <button 
                onClick={onSaveDraft} 
                disabled={isSavingDraft || isSubmitting || isDeleting} 
                className="flex-1 md:flex-none px-5 py-2.5 rounded-lg text-sm font-semibold text-primary bg-surface border border-border hover:bg-surface-muted hover:border-primary-light transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSavingDraft ? (
                  <><span className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></span> Lưu...</>
                ) : 'Lưu Nháp'}
              </button>
              <button 
                onClick={onSubmit} 
                disabled={isSubmitting || isSavingDraft || isDeleting} 
                className="flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary-hover shadow-md shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span> {submitLoadingText}</>
                ) : (
                  <>{submitText} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></>
                )}
              </button>
            </>
          )}
          {canDeleteForm && (
            <button 
              onClick={onReject} 
              disabled={isSubmitting || isSavingDraft || isDeleting} 
              className="flex-1 md:flex-none px-5 py-2.5 rounded-lg text-sm font-semibold text-danger bg-danger/10 hover:bg-danger/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <><span className="w-4 h-4 rounded-full border-2 border-danger/30 border-t-danger animate-spin"></span> Đang xử lý...</>
              ) : (
                <>Trả Lại <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
