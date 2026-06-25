import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

/**
 * GET /api/scoring-history
 * Lấy lịch sử phiếu điểm rèn luyện của sinh viên (qua tất cả các học kỳ).
 * Query: ?studentId=xxx (optional, dùng cho BCS/CVHT xem phiếu SV khác)
 * Nếu không truyền studentId → lấy phiếu của chính user đang đăng nhập.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
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
            student_total: true,
            class_total: true,
            advisor_total: true,
            final_total: true,
            classification: true,
            student_submitted_at: true,
            class_reviewed_at: true,
            advisor_approved_at: true,
            school_finalized_at: true,
            rejection_reason: true,
            created_at: true,
            updated_at: true,
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
        studentTotal: sheet?.student_total != null ? Number(sheet.student_total) : null,
        classTotal: sheet?.class_total != null ? Number(sheet.class_total) : null,
        advisorTotal: sheet?.advisor_total != null ? Number(sheet.advisor_total) : null,
        finalTotal: sheet?.final_total != null ? Number(sheet.final_total) : null,
        classification: sheet?.classification || null,
        classificationLabel: sheet?.classification ? CLASSIFICATION_LABELS[sheet.classification] || sheet.classification : null,
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

