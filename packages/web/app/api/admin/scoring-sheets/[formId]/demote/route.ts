import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { logAdminAction } from '../../../../../../lib/audit';

function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const resolvedParams = await params;
    const formId = resolvedParams.formId;
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const adminId = (session?.user as any)?.id;
    const body = await req.json();
    const { newClassification, reason } = body;

    if (!newClassification || !reason) {
      return NextResponse.json({ message: 'Vui lòng cung cấp xếp loại mới và lý do.' }, { status: 400 });
    }

    // Check if the form exists
    const sheet = await prisma.scoring_sheets.findUnique({
      where: { id: formId },
      include: {
        semester_enrollments: {
          include: { users: true }
        }
      }
    });

    if (!sheet) {
      return NextResponse.json({ message: 'Không tìm thấy phiếu điểm.' }, { status: 404 });
    }

    // ✅ 3NF: classification is now computed at runtime; store override
    const oldClassification = (sheet as any).classification_override || 'Computed at runtime';

    // We will update the sheet classification_override and set its status to FINALIZED 
    // to prevent further automatic recalculation when others edit it.
    await prisma.$transaction(async (tx) => {
      await tx.scoring_sheets.update({
        where: { id: formId },
        data: {
          classification_override: newClassification as any,
          status: 'FINALIZED',
          school_finalized_at: new Date(),
          updated_at: new Date(),
        }
      });

      // Log the review action
      await tx.review_actions.create({
        data: {
          id: crypto.randomUUID(),
          scoring_sheet_id: formId,
          reviewer_id: adminId,
          action: 'APPROVE', // We can consider this an administrative approval with adjustment
          from_status: sheet.status,
          to_status: 'FINALIZED',
          comment: `[HẠ BẬC/KỶ LUẬT] Chuyển từ ${oldClassification || 'Chưa có'} sang ${newClassification}. Lý do: ${reason}`,
        }
      });
    });

    // Write audit log safely outside the tx or use logAdminAction which has its own try/catch
    await logAdminAction(adminId, 'DEMOTE_CLASSIFICATION', 'scoring_sheets', formId, 
      { classification_override: oldClassification, status: sheet.status },
      { classification_override: newClassification, status: 'FINALIZED', reason }
    );

    return NextResponse.json({ message: 'Đã hạ bậc xếp loại thành công.' });
  } catch (error: any) {
    console.error('Demotion Error:', error);
    return NextResponse.json(
      { message: 'Có lỗi xảy ra: ' + error.message },
      { status: 500 }
    );
  }
}
