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

    // Lấy tất cả criteria đang active để sinh viên có thể khiếu nại mọi mục, kể cả mục chưa có điểm (bị thiếu)
    const FIXED_CODES = ['1.1.1', '2.1', '4.1', '3.1.1', '2.2'];
    const allCriteria = await prisma.criteria.findMany({
      where: { 
        is_active: 1,
        code: { notIn: FIXED_CODES }
      },
      select: {
        id: true,
        code: true,
        content: true,
        max_points: true,
        parent_id: true,
      },
    });

    const scoreDetails = await prisma.score_details.findMany({
      where: { scoring_sheet_id: sheetId },
      select: {
        criteria_id: true,
        score_entries: {
          select: { scorer_role: true, score: true },
        },
      },
    });

    console.log('[appeals/criteria] scoreDetails count:', scoreDetails.length);

    const scoreMap = new Map();
    for (const sd of scoreDetails) {
      scoreMap.set(sd.criteria_id, sd.score_entries || []);
    }

    const data = allCriteria.map(c => {
      const entries = scoreMap.get(c.id) || [];
      const student = entries.find((e: any) => e.scorer_role === 'STUDENT');
      const classC = entries.find((e: any) => e.scorer_role === 'CLASS_COMMITTEE');
      const advisor = entries.find((e: any) => e.scorer_role === 'ADVISOR');
      return {
        id: c.id,
        code: c.code,
        content: c.content,
        max_points: c.max_points,
        parent_id: c.parent_id,
        studentScore: student ? Number(student.score) : null,
        classScore: classC ? Number(classC.score) : null,
        advisorScore: advisor ? Number(advisor.score) : null,
      };
    });

    console.log('[appeals/criteria] total criteria returned:', data.length);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('appeals/criteria GET error:', err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
