import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
/**
 * GET /api/scoring-history
 * Lấy lịch sử phiếu điểm rèn luyện của sinh viên (qua tất cả các học kỳ).
 * Query: ?studentId=xxx (optional, dùng cho BCS/CVHT xem phiếu SV khác)
 * Nếu không truyền studentId → lấy phiếu của chính user đang đăng nhập.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session?.user as any)?.id;
  const url = new URL(req.url);
  const targetStudentId = url.searchParams.get('studentId') || userId;

  if (targetStudentId !== userId) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: { user_roles: { include: { roles: true } } }
    });
    
    let isAllowed = false;
    
    // Check if SCHOOL_ADMIN
    if (user?.user_roles.some(r => r.roles.code === 'SCHOOL_ADMIN' && r.is_active === 1)) {
      isAllowed = true;
    }
    
    // Check if DEPARTMENT
    if (!isAllowed && user?.user_roles.some(r => r.roles.code === 'DEPARTMENT' && r.is_active === 1)) {
      const targetUser = await prisma.users.findUnique({ where: { id: targetStudentId } });
      if (targetUser?.department_id === user.department_id) {
        isAllowed = true;
      }
    }
    
    // Check if CLASS_COMMITTEE or ADVISOR
    if (!isAllowed) {
      const classRoles = user?.user_roles.filter(r => 
        ['MONITOR', 'VICE_MONITOR', 'SECRETARY', 'ADVISOR'].includes(r.roles.code) && r.is_active === 1
      ) || [];
      const allowedClassIds = classRoles.map(r => r.entity_id).filter(Boolean);
      
      const enrollmentsCount = await prisma.semester_enrollments.count({
        where: { user_id: targetStudentId, class_id: { in: allowedClassIds as string[] } }
      });
      
      if (enrollmentsCount > 0) {
        isAllowed = true;
      }
    }
    
    if (!isAllowed) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    // Lấy tất cả enrollment + scoring_sheet của sinh viên
    const enrollments = await prisma.semester_enrollments.findMany({
      where: { user_id: targetStudentId },
      select: {
        id: true,
        semester_id: true,
        class_id: true,
        semesters: {
          select: {
            id: true,
            code: true,
            name: true,
            academic_year: true,
            semester_number: true,
            status: true,
          },
        },
        classes: {
          select: {
            code: true,
            name: true,
          },
        },
        scoring_sheets: {
          select: {
            id: true,
            status: true,
            classification_override: true,
            student_submitted_at: true,
            class_reviewed_at: true,
            advisor_approved_at: true,
            school_finalized_at: true,
            rejection_reason: true,
            created_at: true,
            updated_at: true,
            score_details: {
              select: {
                criteria: { select: { category_id: true } },
                score_entries: { select: { scorer_role: true, score: true } },
              },
            },
            comments: {
              select: {
                id: true,
                content: true,
                created_at: true,
                user_id: true,
              },
              orderBy: { created_at: 'desc' },
            },
            review_actions: {
              select: {
                id: true,
                action: true,
                from_status: true,
                to_status: true,
                comment: true,
                created_at: true,
                reviewer_id: true,
                users: {
                  select: {
                    full_name: true,
                  },
                },
              },
              orderBy: { created_at: 'desc' },
            },
          },
        },
      },
      orderBy: { semesters: { start_date: 'desc' } },
    });

    const CLASSIFICATION_LABELS: Record<string, string> = {
      EXCELLENT: 'Xuất sắc',
      VERY_GOOD: 'Tốt',
      GOOD: 'Khá',
      AVERAGE: 'Trung bình',
      WEAK: 'Yếu',
      POOR: 'Kém',
    };

    const data = enrollments.map((e) => {
      const sheet = e.scoring_sheets;
      const sem = e.semesters;
      const cls = e.classes;

      // Combine comments + review_actions into a unified "notes" list
      const notes: Array<{
        id: string;
        type: 'comment' | 'review';
        content: string;
        author: string;
        authorRole: string;
        createdAt: string;
        action?: string;
      }> = [];

      if (sheet) {
        // Add review actions as notes
        for (const ra of sheet.review_actions || []) {
          if (ra.comment) {
            notes.push({
              id: ra.id,
              type: 'review',
              content: ra.comment,
              author: ra.users?.full_name || 'Hệ thống',
              authorRole: '',
              createdAt: ra.created_at.toISOString(),
              action: ra.action,
            });
          }
        }
      }

      // ✅ 3NF: Compute totals at runtime
      let studentTotal: number | null = null;
      let classTotal: number | null = null;
      let advisorTotal: number | null = null;
      let finalTotal: number | null = null;
      let classification: string | null = null;
      if (sheet && (sheet as any).score_details) {
        let sSum = 0, cSum = 0, aSum = 0;
        for (const d of (sheet as any).score_details) {
          const entries = d.score_entries || [];
          const sEntry = entries.find((x: any) => x.scorer_role === 'STUDENT');
          const cEntry = entries.find((x: any) => x.scorer_role === 'CLASS_COMMITTEE');
          const aEntry = entries.find((x: any) => x.scorer_role === 'ADVISOR');
          sSum += sEntry ? Number(sEntry.score) : 0;
          cSum += cEntry ? Number(cEntry.score) : (sEntry ? Number(sEntry.score) : 0);
          aSum += aEntry ? Number(aEntry.score) : (cEntry ? Number(cEntry.score) : (sEntry ? Number(sEntry.score) : 0));
        }
        studentTotal = Math.round(Math.min(100, Math.max(0, sSum)) * 10) / 10;
        classTotal = Math.round(Math.min(100, Math.max(0, cSum)) * 10) / 10;
        advisorTotal = Math.round(Math.min(100, Math.max(0, aSum)) * 10) / 10;
        finalTotal = advisorTotal;
        const getClassification = (score: number): string => {
          if (score >= 90) return 'EXCELLENT';
          if (score >= 80) return 'VERY_GOOD';
          if (score >= 65) return 'GOOD';
          if (score >= 50) return 'AVERAGE';
          if (score >= 35) return 'WEAK';
          return 'POOR';
        };
        classification = (sheet as any).classification_override || getClassification(finalTotal);
      }

      return {
        semesterId: sem.id,
        semesterCode: sem.code,
        semesterName: sem.name,
        academicYear: sem.academic_year,
        semesterNumber: sem.semester_number,
        semesterStatus: sem.status,
        classCode: cls.code,
        className: cls.name,
        hasSheet: !!sheet,
        sheetId: sheet?.id || null,
        status: sheet?.status || 'NO_SHEET',
        studentTotal,
        classTotal,
        advisorTotal,
        finalTotal,
        classification,
        classificationLabel: classification ? CLASSIFICATION_LABELS[classification] || classification : null,
        rejectionReason: sheet?.rejection_reason || null,
        studentSubmittedAt: sheet?.student_submitted_at?.toISOString() || null,
        classReviewedAt: sheet?.class_reviewed_at?.toISOString() || null,
        advisorApprovedAt: sheet?.advisor_approved_at?.toISOString() || null,
        schoolFinalizedAt: sheet?.school_finalized_at?.toISOString() || null,
        createdAt: sheet?.created_at?.toISOString() || null,
        updatedAt: sheet?.updated_at?.toISOString() || null,
        notes,
      };
    });

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('scoring-history GET error:', err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

