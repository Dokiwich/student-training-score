import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const versions = await prisma.criteria_versions.findMany({
      include: { semesters: { select: { name: true, code: true } } },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({
      message: 'Thành công',
      data: versions,
    });
  } catch (err) {
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, description, cloneFromId } = body;

    if (!name) {
      return NextResponse.json({ message: 'Thiếu tên bộ tiêu chí' }, { status: 400 });
    }

    const { randomUUID } = require('crypto');
    const newVersionId = `tpl_${randomUUID().slice(0, 8)}`;

    const newVersion = await prisma.$transaction(async (tx) => {
      const v = await tx.criteria_versions.create({
        data: {
          id: newVersionId,
          semester_id: null,
          name,
          description,
          version: 1,
          is_active: 1,
          applied_at: null,
        },
      });

      if (cloneFromId) {
        const oldCategories = await tx.criteria_categories.findMany({
          where: { criteria_version_id: cloneFromId }
        });

        if (oldCategories.length > 0) {
          const oldCatIds = oldCategories.map(c => c.id);
          const oldCriteriaList = await tx.criteria.findMany({
            where: { category_id: { in: oldCatIds } }
          });

          const catIdMap = new Map<string, string>();
          for (const oldCat of oldCategories) {
            const newCatId = randomUUID();
            catIdMap.set(oldCat.id, newCatId);
            await tx.criteria_categories.create({
              data: {
                id: newCatId,
                criteria_version_id: newVersionId,
                code: oldCat.code,
                name: oldCat.name,
                description: oldCat.description,
                max_score: oldCat.max_score,
                sort_order: oldCat.sort_order,
              }
            });
          }

          const insertCriteriaRecursive = async (oldParentId: number | null, newParentId: number | null) => {
            const children = oldCriteriaList.filter(c => c.parent_id === oldParentId);
            for (const oldC of children) {
              const newCatId = catIdMap.get(oldC.category_id);
              if (!newCatId) continue;

              const newC = await tx.criteria.create({
                data: {
                  category_id: newCatId,
                  parent_id: newParentId,
                  code: oldC.code,
                  content: oldC.content,
                  point: oldC.point,
                  score: oldC.score,
                  score_type: oldC.score_type,
                  score_options: oldC.score_options ? JSON.parse(JSON.stringify(oldC.score_options)) : null,
                  require_evidence: oldC.require_evidence,
                  evidence_guide: oldC.evidence_guide,
                  sort_order: oldC.sort_order,
                  is_active: oldC.is_active,
                }
              });
              await insertCriteriaRecursive(oldC.id, newC.id);
            }
          };

          await insertCriteriaRecursive(null, null);
        }
      }

      return v;
    });

    return NextResponse.json({
      message: 'Tạo bộ tiêu chí thành công',
      data: newVersion,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
