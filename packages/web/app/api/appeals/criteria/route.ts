import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

/**
 * GET /api/appeals/criteria?sheetId=xxx
 * Lấy danh sách tiêu chí kèm điểm từng role cho 1 scoring_sheet.
 * Chỉ trả về cho chủ phiếu (sinh viên đang đăng nhập).
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const sheetId = searchParams.get('sheetId');

  if (!sheetId) {
    return NextResponse.json({ message: 'sheetId is required' }, { status: 400 });
  }

  try {
    console.log('[appeals/criteria] sheetId:', sheetId, 'userId:', userId);

    // Verify phiếu thuộc về sinh viên
    const sheet = await prisma.scoring_sheets.findFirst({
      where: {
        id: sheetId,
        semester_enrollments: { user_id: userId },
      },
      select: { id: true, enrollment_id: true },
    });

    console.log('[appeals/criteria] sheet found:', !!sheet);
    if (!sheet) {
      return NextResponse.json({ message: 'Không tìm thấy phiếu' }, { status: 404 });
    }

    // Lấy tất cả score_details kèm criteria và score_entries cho phiếu này
    // Đây là cách đơn giản nhất — chỉ lấy criteria mà phiếu đã có score_detail
    const scoreDetails = await prisma.score_details.findMany({
      where: { scoring_sheet_id: sheetId },
      select: {
        criteria_id: true,
        criteria: {
          select: {
            id: true,
            code: true,
            content: true,
            max_points: true,
            parent_id: true,
          },
        },
        score_entries: {
          select: { scorer_role: true, score: true },
        },
      },
    });

    console.log('[appeals/criteria] scoreDetails count:', scoreDetails.length);

    // Cũng lấy thêm các criteria cha (parent) để hiển thị cây
    const allCriteriaIds = new Set<number>();
    const parentIds = new Set<number>();
    
    for (const sd of scoreDetails) {
      allCriteriaIds.add(sd.criteria.id);
      if (sd.criteria.parent_id != null) {
        parentIds.add(sd.criteria.parent_id);
      }
    }

    // Lấy thêm thông tin các parent criteria
    const missingParentIds = [...parentIds].filter(pid => !allCriteriaIds.has(pid));
    let parentCriteria: any[] = [];
    if (missingParentIds.length > 0) {
      parentCriteria = await prisma.criteria.findMany({
        where: { id: { in: missingParentIds } },
        select: { id: true, code: true, content: true, max_points: true, parent_id: true },
      });
      // Check if these parents also have parents
      const grandparentIds = parentCriteria
        .filter((p: any) => p.parent_id != null && !allCriteriaIds.has(p.parent_id) && !missingParentIds.includes(p.parent_id))
        .map((p: any) => p.parent_id);
      if (grandparentIds.length > 0) {
        const gpCriteria = await prisma.criteria.findMany({
          where: { id: { in: grandparentIds } },
          select: { id: true, code: true, content: true, max_points: true, parent_id: true },
        });
        parentCriteria = [...parentCriteria, ...gpCriteria];
      }
    }

    // Build combined list
    const data: any[] = [];

    // Add parent criteria (no scores)
    for (const pc of parentCriteria) {
      data.push({
        id: pc.id,
        code: pc.code,
        content: pc.content,
        max_points: pc.max_points,
        parent_id: pc.parent_id,
        studentScore: null,
        classScore: null,
        advisorScore: null,
      });
    }

    // Add score_details criteria with scores
    for (const sd of scoreDetails) {
      const entries = sd.score_entries || [];
      const student = entries.find(e => e.scorer_role === 'STUDENT');
      const classC = entries.find(e => e.scorer_role === 'CLASS_COMMITTEE');
      const advisor = entries.find(e => e.scorer_role === 'ADVISOR');
      data.push({
        id: sd.criteria.id,
        code: sd.criteria.code,
        content: sd.criteria.content,
        max_points: sd.criteria.max_points,
        parent_id: sd.criteria.parent_id,
        studentScore: student ? Number(student.score) : null,
        classScore: classC ? Number(classC.score) : null,
        advisorScore: advisor ? Number(advisor.score) : null,
      });
    }

    console.log('[appeals/criteria] total criteria returned:', data.length);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('appeals/criteria GET error:', err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
