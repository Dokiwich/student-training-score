import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { randomUUID } from 'crypto';

/**
 * GET /api/appeals
 * Lấy danh sách khiếu nại của sinh viên đang đăng nhập.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    // Lấy tất cả scoring_sheet_id của sinh viên
    const enrollments = await prisma.semester_enrollments.findMany({
      where: { user_id: userId },
      select: {
        scoring_sheets: {
          select: { id: true },
        },
      },
    });

    const sheetIds = enrollments
      .map((e) => e.scoring_sheets?.id)
      .filter(Boolean) as string[];

    if (sheetIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const appeals = await prisma.appeals.findMany({
      where: { scoring_sheet_id: { in: sheetIds } },
      orderBy: { created_at: 'desc' },
      include: {
        scoring_sheets: {
          select: {
            id: true,
            status: true,
            student_total: true,
            class_total: true,
            advisor_total: true,
            final_total: true,
            classification: true,
            semester_enrollments: {
              select: {
                semesters: {
                  select: { id: true, code: true, name: true },
                },
                classes: {
                  select: { code: true, name: true },
                },
              },
            },
          },
        },
        users_appeals_resolved_byTousers: {
          select: { full_name: true },
        },
      },
    });

    // Pre-fetch all criteria for these appeals to avoid N+1 query
    const criteriaIds = appeals.map(a => {
      if (a.evidence_note) {
        const parts = a.evidence_note.split(':');
        if (parts[1]) return parseInt(parts[1]) || null;
      }
      return null;
    }).filter(id => id !== null) as number[];

    let criteriaMap = new Map();
    if (criteriaIds.length > 0) {
      const criteriaList = await prisma.criteria.findMany({
        where: { id: { in: Array.from(new Set(criteriaIds)) } },
        select: { id: true, code: true, content: true }
      });
      criteriaMap = new Map(criteriaList.map(c => [c.id, c]));
    }

    const data = appeals.map((a) => {
      const sheet = a.scoring_sheets;
      const enrollment = sheet.semester_enrollments;

      // Parse evidence_note: format "type:criteriaId" e.g. "class:42"
      let appealType = 'class';
      let criteriaId: number | null = null;
      if (a.evidence_note) {
        const parts = a.evidence_note.split(':');
        appealType = parts[0] || 'class';
        if (parts[1]) criteriaId = parseInt(parts[1]) || null;
      }

      // Fetch criteria info if we have an ID
      let criteriaCode: string | null = null;
      let criteriaContent: string | null = null;
      if (criteriaId) {
        const crit = criteriaMap.get(criteriaId);
        if (crit) {
          criteriaCode = crit.code;
          criteriaContent = crit.content;
        }
      }

      return {
        id: a.id,
        reason: a.reason,
        appealType,
        criteriaCode,
        criteriaContent,
        status: a.status,
        resolution: a.resolution,
        resolvedBy: a.users_appeals_resolved_byTousers?.full_name || null,
        resolvedAt: a.resolved_at?.toISOString() || null,
        createdAt: a.created_at.toISOString(),
        sheetId: sheet.id,
        semesterName: enrollment.semesters.name,
        semesterCode: enrollment.semesters.code,
        className: enrollment.classes.name,
        classCode: enrollment.classes.code,
        studentTotal: sheet.student_total != null ? Number(sheet.student_total) : null,
        classTotal: sheet.class_total != null ? Number(sheet.class_total) : null,
        advisorTotal: sheet.advisor_total != null ? Number(sheet.advisor_total) : null,
        finalTotal: sheet.final_total != null ? Number(sheet.final_total) : null,
        classification: sheet.classification,
      };
    });

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('appeals GET error:', err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

/**
 * POST /api/appeals
 * Tạo khiếu nại mới.
 * Body: { scoring_sheet_id, reason, appeal_type: "class" | "advisor", criteria_id: number }
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const body = await req.json();
    const { scoring_sheet_id, reason, appeal_type, criteria_ids } = body;

    if (!scoring_sheet_id || !reason?.trim()) {
      return NextResponse.json(
        { message: 'Vui lòng nhập đầy đủ thông tin (phiếu chấm điểm và lý do)' },
        { status: 400 }
      );
    }

    if (!['class', 'advisor'].includes(appeal_type)) {
      return NextResponse.json(
        { message: 'Loại khiếu nại không hợp lệ' },
        { status: 400 }
      );
    }

    if (!criteria_ids || !Array.isArray(criteria_ids) || criteria_ids.length === 0) {
      return NextResponse.json(
        { message: 'Vui lòng chọn ít nhất một tiêu chí khiếu nại' },
        { status: 400 }
      );
    }

    // Verify phiếu thuộc về sinh viên
    const sheet = await prisma.scoring_sheets.findFirst({
      where: {
        id: scoring_sheet_id,
        semester_enrollments: { user_id: userId },
      },
      select: { id: true, status: true },
    });

    if (!sheet) {
      return NextResponse.json(
        { message: 'Không tìm thấy phiếu chấm điểm hoặc phiếu không thuộc về bạn' },
        { status: 404 }
      );
    }

    // Check trùng cho tất cả tiêu chí
    for (const criteria_id of criteria_ids) {
      const evidenceNote = `${appeal_type}:${criteria_id}`;
      const existingPending = await prisma.appeals.findFirst({
        where: {
          scoring_sheet_id,
          status: 'PENDING',
          evidence_note: evidenceNote,
        },
      });

      if (existingPending) {
        return NextResponse.json(
          { message: `Tiêu chí có ID ${criteria_id} đã có khiếu nại đang chờ xử lý. Vui lòng bỏ chọn tiêu chí này.` },
          { status: 400 }
        );
      }
    }

    // Tạo các khiếu nại (1 khiếu nại cho mỗi tiêu chí)
    const appealsToCreate = criteria_ids.map((criteria_id: number) => ({
      id: randomUUID(),
      scoring_sheet_id,
      reason: reason.trim(),
      evidence_note: `${appeal_type}:${criteria_id}`,
      status: 'PENDING' as any,
    }));

    await prisma.appeals.createMany({
      data: appealsToCreate,
    });

    return NextResponse.json({
      message: 'Gửi khiếu nại thành công',
      data: { count: appealsToCreate.length },
    });
  } catch (err: any) {
    console.error('appeals POST error:', err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
