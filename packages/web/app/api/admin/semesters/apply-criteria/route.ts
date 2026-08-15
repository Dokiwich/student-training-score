import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { randomUUID } from 'crypto';
import { logAdminAction } from '../../../../../lib/audit';
import { computeStatus } from '../../../../../lib/semester';

function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

const ACTIVE_SCORING_PHASES = ['STUDENT_SCORING', 'CLASS_REVIEWING', 'ADVISOR_REVIEWING', 'SCHOOL_REVIEWING', 'FINALIZED'];

/**
 * POST: Áp dụng (clone) bộ tiêu chí từ học kỳ nguồn sang học kỳ đích.
 * Body: { targetSemesterId: string, sourceSemesterId?: string }
 * - Nếu không truyền sourceSemesterId → tự chọn version active mới nhất có dữ liệu.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { targetSemesterId, sourceSemesterId, sourceVersionId } = body;

    if (!targetSemesterId) {
      return NextResponse.json({ message: 'Thiếu ID học kỳ đích' }, { status: 400 });
    }

    // 1. Kiểm tra học kỳ đích có tồn tại không
    const targetSemester = await prisma.semesters.findUnique({ where: { id: targetSemesterId } });
    if (!targetSemester) {
      return NextResponse.json({ message: 'Không tìm thấy học kỳ đích' }, { status: 404 });
    }

    // 2. Kiểm tra xem đã có version cho học kỳ đích chưa
    const existingVersion = await prisma.criteria_versions.findFirst({
      where: { semester_id: targetSemesterId },
      include: { criteria_categories: { include: { _count: { select: { criteria: true } } } } },
    });

    const semStatus = computeStatus(targetSemester as any);
    const isInScoring = ACTIVE_SCORING_PHASES.includes(semStatus);

    if (existingVersion) {
      const catIds = existingVersion.criteria_categories.map(c => c.id);
      const scoresCount = catIds.length > 0 ? await prisma.score_details.count({
        where: { criteria: { category_id: { in: catIds } } }
      }) : 0;

      if (scoresCount > 0 || isInScoring) {
        return NextResponse.json({
          message: `Không thể ghi đè bộ tiêu chí: Học kỳ "${targetSemester.name}" đang trong giai đoạn chấm điểm (${semStatus}) hoặc đã có ${scoresCount} phiếu chấm điểm ghi nhận.`
        }, { status: 400 });
      }

      const totalCriteria = existingVersion.criteria_categories.reduce((a, c) => a + c._count.criteria, 0);
      if (totalCriteria > 0) {
        return NextResponse.json({
          message: `Học kỳ "${targetSemester.name}" đã có ${totalCriteria} tiêu chí. Vui lòng xóa trước khi áp dụng lại.`,
        }, { status: 400 });
      }
    }

    // 3. Tìm version nguồn
    let sourceVersion = null;
    if (sourceVersionId && sourceVersionId !== 'BLANK') {
      sourceVersion = await prisma.criteria_versions.findUnique({
        where: { id: sourceVersionId },
        include: {
          criteria_categories: {
            include: { criteria: { orderBy: { id: 'asc' } } },
            orderBy: { sort_order: 'asc' },
          },
        },
      });
    } else if (sourceSemesterId) {
      sourceVersion = await prisma.criteria_versions.findFirst({
        where: { semester_id: sourceSemesterId, is_active: 1 },
        include: {
          criteria_categories: {
            include: { criteria: { orderBy: { id: 'asc' } } },
            orderBy: { sort_order: 'asc' },
          },
        },
      });
    }

    if (!sourceVersion && sourceVersionId !== 'BLANK') {
      // Fallback: tìm version active có nhiều criteria nhất
      const allVersions = await prisma.criteria_versions.findMany({
        where: { is_active: 1 },
        include: {
          criteria_categories: {
            include: { criteria: { orderBy: { id: 'asc' } } },
            orderBy: { sort_order: 'asc' },
          },
          semesters: true,
        },
      });

      sourceVersion = allVersions
        .map(v => ({
          ...v,
          totalCriteria: v.criteria_categories.reduce((a, c) => a + c.criteria.length, 0),
        }))
        .sort((a, b) => b.totalCriteria - a.totalCriteria)[0];
    }

    if (!sourceVersion && sourceVersionId !== 'BLANK') {
      return NextResponse.json({ message: 'Không tìm thấy bộ tiêu chí nguồn nào' }, { status: 400 });
    }

    const sourceCatCount = sourceVersion ? sourceVersion.criteria_categories.length : 0;
    const sourceCriteriaCount = sourceVersion ? sourceVersion.criteria_categories.reduce((a, c) => a + c.criteria.length, 0) : 0;

    if (sourceCriteriaCount === 0 && sourceVersionId !== 'BLANK') {
      return NextResponse.json({ message: 'Bộ tiêu chí nguồn không có tiêu chí nào' }, { status: 400 });
    }

    // Thực hiện trong transaction
    const result = await prisma.$transaction(async (tx) => {
      if (existingVersion) {
        // Xóa criteria_versions (cascade sẽ tự xóa categories và criteria con)
        await tx.criteria_versions.delete({ where: { id: existingVersion.id } });
      }

      // 4. Đảm bảo auto-increment sequence đúng (PostgreSQL only)
      try {
        const maxCriteria = await tx.criteria.aggregate({ _max: { id: true } });
        const maxId = maxCriteria._max.id || 0;
        await tx.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('criteria', 'id'), ${maxId}, true)`
        );
      } catch (e) {
        // Bỏ qua nếu DB không phải PostgreSQL (SQLite, MySQL...)
      }

      // 5. Tính version number mới và tạo version cho học kỳ đích
      const maxVersionInSemester = await tx.criteria_versions.findFirst({
        where: { semester_id: targetSemesterId },
        orderBy: { version: 'desc' }
      });
      const nextVersionNum = maxVersionInSemester ? maxVersionInSemester.version + 1 : 1;
      const newVersionId = `ver_${targetSemester.code}_v${nextVersionNum}`;

      await tx.criteria_versions.create({
        data: {
          id: newVersionId,
          semester_id: targetSemesterId,
          version: nextVersionNum,
          is_active: 1,
          applied_at: new Date(),
        },
      });

      if (sourceVersionId === 'BLANK') {
        return { newVersionId, clonedTotal: 0 };
      }

      // 6. Clone categories
      const catIdMap = new Map<string, string>();
      for (const cat of sourceVersion!.criteria_categories) {
        const newCatId = `cat_${targetSemester.code}_${cat.code}`;
        catIdMap.set(cat.id, newCatId);
        await tx.criteria_categories.create({
          data: {
            id: newCatId,
            criteria_version_id: newVersionId,
            code: cat.code,
            name: cat.name,
            description: cat.description,
            max_score: cat.max_score,
            sort_order: cat.sort_order,
          },
        });
      }

      // 7. Clone criteria (roots first, then children in topological order)
      const allCriteria = sourceVersion!.criteria_categories.flatMap(cat =>
        cat.criteria.map(c => ({ ...c, newCategoryId: catIdMap.get(cat.id)! }))
      );

      const roots = allCriteria.filter(c => !c.parent_id);
      const children = allCriteria.filter(c => c.parent_id);
      const criteriaIdMap = new Map<number, number>();

      for (const c of roots) {
        const newCrit = await tx.criteria.create({
          data: {
            category_id: c.newCategoryId,
            parent_id: null,
            code: c.code,
            content: c.content,
            point: c.point,
            
            score_type: c.score_type,
            score_options: c.score_options || undefined,
            require_evidence: c.require_evidence,
            evidence_guide: c.evidence_guide,
            sort_order: c.sort_order,
            is_active: c.is_active,
          },
        });
        criteriaIdMap.set(c.id, newCrit.id);
      }

      // Sort children topologically (handle multi-level nesting)
      const sorted: typeof children = [];
      const remaining = [...children];
      let passes = 0;
      while (remaining.length > 0 && passes < 10) {
        passes++;
        for (let i = remaining.length - 1; i >= 0; i--) {
          if (criteriaIdMap.has(remaining[i].parent_id!)) {
            sorted.push(remaining.splice(i, 1)[0]);
          }
        }
      }

      for (const c of sorted) {
        const newParentId = criteriaIdMap.get(c.parent_id!);
        const newCrit = await tx.criteria.create({
          data: {
            category_id: c.newCategoryId,
            parent_id: newParentId || null,
            code: c.code,
            content: c.content,
            point: c.point,
            
            score_type: c.score_type,
            score_options: c.score_options || undefined,
            require_evidence: c.require_evidence,
            evidence_guide: c.evidence_guide,
            sort_order: c.sort_order,
            is_active: c.is_active,
          },
        });
        criteriaIdMap.set(c.id, newCrit.id);
      }

      return { newVersionId, clonedTotal: sourceVersionId === 'BLANK' ? 0 : criteriaIdMap.size };
    }); // End transaction

    const actorId = (session?.user as any)?.id;
    await logAdminAction(actorId, 'APPLY_CRITERIA', 'semesters', targetSemesterId, null, {
      sourceVersionId: sourceVersion?.id || 'BLANK',
      newVersionId: result.newVersionId,
      clonedCriteriaCount: result.clonedTotal
    });

    if (sourceVersionId === 'BLANK') {
      return NextResponse.json({
        message: `Đã tạo phiên bản bộ tiêu chí (trống) thành công cho học kỳ "${targetSemester.name}"!`,
        data: { versionId: result.newVersionId }
      });
    }

    return NextResponse.json({
      message: `Đã áp dụng ${result.clonedTotal} tiêu chí (${sourceCatCount} mục) vào học kỳ "${targetSemester.name}" thành công!`,
      data: {
        versionId: result.newVersionId,
        categories: sourceCatCount,
        criteria: result.clonedTotal,
        sourceSemester: (sourceVersion as any).semesters?.code || 'unknown',
      },
    });
  } catch (err) {
    console.error('Error applying criteria:', err);
    return NextResponse.json({ message: 'Lỗi server khi áp dụng tiêu chí' }, { status: 500 });
  }
}
