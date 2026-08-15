import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { randomUUID } from 'crypto';
import { logAdminAction } from '../../../../lib/audit';
import { computeStatus } from '../../../../lib/semester';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkAdmin(session: any) {
  if (!session?.user || (session.user as { role?: string }).role !== 'SCHOOL_ADMIN') {
    return false;
  }
  return true;
}

const ACTIVE_SCORING_PHASES = ['STUDENT_SCORING', 'CLASS_REVIEWING', 'ADVISOR_REVIEWING', 'SCHOOL_REVIEWING', 'FINALIZED'];

// GET: list all criteria + categories
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!checkAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const versionId = searchParams.get('versionId');

  const versions = await prisma.criteria_versions.findMany({
    include: { semesters: { select: { id: true, name: true, code: true, start_date: true, end_date: true, student_deadline: true, class_committee_deadline: true, advisor_deadline: true, school_deadline: true, status: true } } },
    orderBy: { created_at: 'desc' },
  });

  const activeVersion = await prisma.criteria_versions.findFirst({
    where: { is_active: 1 },
    include: { semesters: { select: { id: true, name: true, code: true, start_date: true, end_date: true, student_deadline: true, class_committee_deadline: true, advisor_deadline: true, school_deadline: true, status: true } } },
    orderBy: { created_at: 'desc' },
  });

  const targetVersionId = versionId || activeVersion?.id;
  const targetVersion = versions.find(v => v.id === targetVersionId) || activeVersion;

  const [criteriaList, categoriesList] = await Promise.all([
    prisma.criteria.findMany({ 
      where: targetVersionId ? { criteria_categories: { criteria_version_id: targetVersionId } } : {},
      orderBy: [{ sort_order: 'asc' }, { code: 'asc' }, { id: 'asc' }] 
    }),
    prisma.criteria_categories.findMany({ 
      where: targetVersionId ? { criteria_version_id: targetVersionId } : {},
      orderBy: { sort_order: 'asc' } 
    }),
  ]);

  // Hybrid Lock info calculation
  let isLocked = false;
  let lockedReason: string | null = null;
  let usedCriteriaIds: number[] = [];

  if (targetVersion) {
    const critIds = criteriaList.map(c => c.id);
    if (critIds.length > 0) {
      const usedDetails = await prisma.score_details.groupBy({
        by: ['criteria_id'],
        where: { criteria_id: { in: critIds } },
        _count: { criteria_id: true },
      });
      usedCriteriaIds = usedDetails.map(d => d.criteria_id);
    }

    if (targetVersion.semesters) {
      const semStatus = computeStatus(targetVersion.semesters as any);
      if (ACTIVE_SCORING_PHASES.includes(semStatus)) {
        isLocked = true;
        lockedReason = `Học kỳ đang trong giai đoạn chấm điểm (${semStatus}).`;
      }
    }

    if (usedCriteriaIds.length > 0) {
      isLocked = true;
      lockedReason = lockedReason
        ? `${lockedReason} Đã có ${usedCriteriaIds.length} tiêu chí phát sinh dữ liệu chấm.`
        : `Đã có ${usedCriteriaIds.length} tiêu chí phát sinh dữ liệu chấm điểm thực tế.`;
    }
  }

  return NextResponse.json({
    data: criteriaList,
    categories: categoriesList,
    activeVersion,
    versions,
    isLocked,
    lockedReason,
    usedCriteriaIds,
  });
}

// PUT: update criterion or category
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!checkAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }
  const actorId = (session as any)?.user?.id || 'SYSTEM';

  try {
    const body = await req.json();

    if (body._type === 'version') {
      const { id, version, is_active, name, description } = body;
      if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

      const targetVersion = await prisma.criteria_versions.findUnique({ 
        where: { id },
        include: { semesters: true }
      });
      if (!targetVersion) return NextResponse.json({ message: 'Không tìm thấy phiên bản' }, { status: 404 });

      // Time-based & Data check: prevent changing is_active if semester is in active scoring phase or has scores
      if (is_active !== undefined && is_active !== targetVersion.is_active && targetVersion.semester_id && targetVersion.semesters) {
        const semStatus = computeStatus(targetVersion.semesters as any);
        const isInScoring = ACTIVE_SCORING_PHASES.includes(semStatus);

        const categoryIds = (await prisma.criteria_categories.findMany({
          where: { criteria_version_id: id },
          select: { id: true }
        })).map(c => c.id);
        
        const critCount = categoryIds.length > 0 ? await prisma.score_details.count({
          where: { criteria: { category_id: { in: categoryIds } } }
        }) : 0;

        if (isInScoring || critCount > 0) {
          return NextResponse.json({ 
            message: `Không thể thay đổi trạng thái phiên bản: Học kỳ "${targetVersion.semesters.name}" đang trong giai đoạn chấm điểm (${semStatus}) hoặc đã có ${critCount} phiếu chấm điểm ghi nhận.` 
          }, { status: 400 });
        }
      }

      // Check for conflicts when activating
      if (is_active === 1) {
        const activeInSameSemester = await prisma.criteria_versions.findFirst({
          where: { 
            semester_id: targetVersion.semester_id, 
            is_active: 1,
            id: { not: id }
          }
        });
        if (activeInSameSemester) {
          return NextResponse.json({ 
            message: targetVersion.semester_id ? 'Học kỳ này đã có một phiên bản đang được áp dụng.' : 'Đã có một Bộ tiêu chí mẫu đang được kích hoạt.' 
          }, { status: 400 });
        }
      }

      const updateData: Record<string, any> = {};
      if (version !== undefined) updateData.version = parseInt(version);
      if (is_active !== undefined) updateData.is_active = is_active;
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      const oldData = targetVersion;
      const updated = await prisma.criteria_versions.update({
        where: { id },
        data: updateData,
      });
      await logAdminAction(actorId, 'UPDATE_VERSION', 'criteria_versions', id, oldData, updated);

      return NextResponse.json({ message: 'Cập nhật phiên bản thành công', data: updated });
    }

    if (body._type === 'category') {
      const { id, name, max_score, code } = body;
      if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

      const oldData = await prisma.criteria_categories.findUnique({ where: { id } });
      if (!oldData) return NextResponse.json({ message: 'Không tìm thấy mục' }, { status: 404 });

      // Granular Field Lock: Check if Category has scores recorded
      const crits = await prisma.criteria.findMany({ where: { category_id: id }, select: { id: true } });
      const critIds = crits.map(c => c.id);
      let usageCount = 0;
      if (critIds.length > 0) {
        usageCount = await prisma.score_details.count({ where: { criteria_id: { in: critIds } } });
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;

      // If scores already exist, block structural changes (code, max_score)
      if (usageCount > 0) {
        if (code !== undefined && code !== oldData.code) {
          return NextResponse.json({
            message: `Không thể sửa Mã danh mục: Mục này đang được ${usageCount} phiếu chấm điểm sử dụng.`
          }, { status: 400 });
        }
        if (max_score !== undefined && parseFloat(max_score) !== oldData.max_score) {
          return NextResponse.json({
            message: `Không thể sửa Điểm tối đa: Mục này đang được ${usageCount} phiếu chấm điểm sử dụng. Vui lòng tạo phiên bản mới.`
          }, { status: 400 });
        }
      } else {
        if (max_score !== undefined) updateData.max_score = parseFloat(max_score);
        if (code !== undefined) updateData.code = code;
      }

      const updated = await prisma.criteria_categories.update({
        where: { id },
        data: updateData,
      });
      await logAdminAction(actorId, 'UPDATE_CATEGORY', 'criteria_categories', id, oldData, updated);

      return NextResponse.json({ message: 'Cập nhật mục thành công', data: updated });
    }

    // Update criterion
    const { id, point, content, code, category_id, parent_id, evidence_guide, score_type } = body;
    if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

    const critId = typeof id === 'string' ? parseInt(id) : id;
    const oldData = await prisma.criteria.findUnique({ where: { id: critId } });
    if (!oldData) return NextResponse.json({ message: 'Không tìm thấy tiêu chí' }, { status: 404 });

    const usageCount = await prisma.score_details.count({ where: { criteria_id: critId } });
    const updateData: Record<string, unknown> = { updated_at: new Date() };

    if (usageCount > 0) {
      // Granular Field Lock: Allow content, evidence_guide, but block structural/scoring modifications
      if (point !== undefined && parseFloat(point) !== oldData.point) {
        return NextResponse.json({
          message: `Không thể thay đổi Thang điểm: Tiêu chí này đang được ${usageCount} phiếu chấm điểm sử dụng.`
        }, { status: 400 });
      }
      if (code !== undefined && code !== oldData.code) {
        return NextResponse.json({
          message: `Không thể thay đổi Mã tiêu chí: Tiêu chí này đang được ${usageCount} phiếu chấm điểm sử dụng.`
        }, { status: 400 });
      }
      if (category_id !== undefined && category_id !== oldData.category_id) {
        return NextResponse.json({
          message: `Không thể chuyển Danh mục của tiêu chí: Tiêu chí này đang được ${usageCount} phiếu chấm điểm sử dụng.`
        }, { status: 400 });
      }
      if (parent_id !== undefined && (parent_id ? parseInt(parent_id) : null) !== oldData.parent_id) {
        return NextResponse.json({
          message: `Không thể thay đổi Tiêu chí cha: Tiêu chí này đang được ${usageCount} phiếu chấm điểm sử dụng.`
        }, { status: 400 });
      }
      if (score_type !== undefined && score_type !== oldData.score_type) {
        return NextResponse.json({
          message: `Không thể thay đổi Loại điểm của tiêu chí đã có dữ liệu chấm điểm.`
        }, { status: 400 });
      }

      if (content !== undefined) updateData.content = content;
      if (evidence_guide !== undefined) updateData.evidence_guide = evidence_guide;
    } else {
      if (point !== undefined) updateData.point = parseFloat(point);
      if (content !== undefined) updateData.content = content;
      if (code !== undefined) updateData.code = code;
      if (category_id !== undefined) updateData.category_id = category_id;
      if (evidence_guide !== undefined) updateData.evidence_guide = evidence_guide;
      if (score_type !== undefined) updateData.score_type = score_type;
      if (parent_id !== undefined) {
        const parsedParentId = parent_id ? parseInt(parent_id) : null;
        if (parsedParentId === critId) {
          return NextResponse.json({ message: 'Lỗi Dữ Liệu: Tiêu chí không thể tự nhận chính nó làm cha (Gây lặp vô hạn).' }, { status: 400 });
        }
        updateData.parent_id = parsedParentId;
      }
    }

    const updated = await prisma.criteria.update({
      where: { id: critId },
      data: updateData,
    });
    await logAdminAction(actorId, 'UPDATE_CRITERIA', 'criteria', critId.toString(), oldData, updated);

    return NextResponse.json({ message: 'Cập nhật tiêu chí thành công', data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

// POST: create criterion or category
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!checkAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }
  const actorId = (session as any)?.user?.id || 'SYSTEM';

  try {
    const body = await req.json();

    // Create category
    if (body._type === 'category') {
      const { code, name, max_score } = body;
      if (!code || !name) return NextResponse.json({ message: 'Thiếu mã hoặc tên mục' }, { status: 400 });

      // Get target criteria version
      const targetVersion = body.criteria_version_id
        ? await prisma.criteria_versions.findUnique({ where: { id: body.criteria_version_id }, include: { semesters: true } })
        : await prisma.criteria_versions.findFirst({ where: { is_active: 1 }, include: { semesters: true }, orderBy: { created_at: 'desc' } });

      if (!targetVersion) {
        return NextResponse.json({ message: 'Không tìm thấy phiên bản tiêu chí' }, { status: 400 });
      }

      // Check if target version already has scores
      const catIds = (await prisma.criteria_categories.findMany({ where: { criteria_version_id: targetVersion.id }, select: { id: true } })).map(c => c.id);
      if (catIds.length > 0) {
        const usageCount = await prisma.score_details.count({ where: { criteria: { category_id: { in: catIds } } } });
        if (usageCount > 0) {
          return NextResponse.json({
            message: `Không thể thêm danh mục mới: Bộ tiêu chí này đã có ${usageCount} phiếu chấm điểm ghi nhận. Vui lòng tạo phiên bản mới.`
          }, { status: 400 });
        }
      }

      const maxOrder = await prisma.criteria_categories.aggregate({
        _max: { sort_order: true },
        where: { criteria_version_id: targetVersion.id },
      });

      const newCat = await prisma.criteria_categories.create({
        data: {
          id: randomUUID(),
          criteria_version_id: targetVersion.id,
          code,
          name,
          max_score: parseFloat(max_score) || 0,
          sort_order: (maxOrder._max.sort_order || 0) + 1,
        },
      });
      await logAdminAction(actorId, 'CREATE_CATEGORY', 'criteria_categories', newCat.id, null, newCat);

      return NextResponse.json({ message: 'Thêm mục thành công', data: newCat });
    }

    // Create criterion
    const { code, content, point, parent_id, category_id, evidence_guide, score_type } = body;
    if (!code || !content) return NextResponse.json({ message: 'Thiếu mã hoặc nội dung tiêu chí' }, { status: 400 });

    const parentCategory = await prisma.criteria_categories.findUnique({
      where: { id: category_id },
      include: { criteria_versions: { include: { semesters: true } } }
    });

    if (!parentCategory) {
      return NextResponse.json({ message: 'Không tìm thấy danh mục cha' }, { status: 404 });
    }

    // Check if target version already has scores
    const catIds = (await prisma.criteria_categories.findMany({
      where: { criteria_version_id: parentCategory.criteria_version_id },
      select: { id: true }
    })).map(c => c.id);

    if (catIds.length > 0) {
      const usageCount = await prisma.score_details.count({ where: { criteria: { category_id: { in: catIds } } } });
      if (usageCount > 0) {
        return NextResponse.json({
          message: `Không thể thêm tiêu chí mới: Bộ tiêu chí này đã có ${usageCount} phiếu chấm điểm ghi nhận. Vui lòng tạo phiên bản mới.`
        }, { status: 400 });
      }
    }

    // Calculate next sort_order
    const maxCritOrder = await prisma.criteria.aggregate({
      _max: { sort_order: true },
      where: { category_id },
    });

    const newCriteria = await prisma.criteria.create({
      data: {
        category_id,
        code,
        content,
        point: parseFloat(point) || 0,
        parent_id: parent_id ? parseInt(parent_id) : null,
        evidence_guide: evidence_guide || null,
        score_type: score_type || 'RANGE',
        sort_order: (maxCritOrder._max.sort_order || 0) + 1,
        is_active: 1,
      },
    });
    await logAdminAction(actorId, 'CREATE_CRITERIA', 'criteria', newCriteria.id.toString(), null, newCriteria);

    return NextResponse.json({ message: 'Thêm tiêu chí thành công', data: newCriteria });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

// DELETE: delete criterion or category
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!checkAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }
  const actorId = (session as any)?.user?.id || 'SYSTEM';

  try {
    const body = await req.json();

    if (body._type === 'version') {
      const { id } = body;
      if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

      const targetVersion = await prisma.criteria_versions.findUnique({ 
        where: { id },
        include: { semesters: true }
      });
      if (!targetVersion) return NextResponse.json({ message: 'Không tìm thấy phiên bản' }, { status: 404 });
      
      if (targetVersion.is_active === 1) {
        return NextResponse.json({ message: 'Không thể xóa: Phiên bản này đang được áp dụng.' }, { status: 400 });
      }

      // Check if semester is in active scoring phase
      if (targetVersion.semesters) {
        const semStatus = computeStatus(targetVersion.semesters as any);
        if (ACTIVE_SCORING_PHASES.includes(semStatus)) {
          return NextResponse.json({ 
            message: `Không thể xóa: Học kỳ "${targetVersion.semesters.name}" đang trong giai đoạn chấm điểm (${semStatus}).` 
          }, { status: 400 });
        }
      }

      // Check if any criteria in this version is being used
      const categories = await prisma.criteria_categories.findMany({ where: { criteria_version_id: id }, select: { id: true } });
      const catIds = categories.map(c => c.id);
      if (catIds.length > 0) {
        const crits = await prisma.criteria.findMany({ where: { category_id: { in: catIds } }, select: { id: true } });
        const critIds = crits.map(c => c.id);
        if (critIds.length > 0) {
          const usageCount = await prisma.score_details.count({ where: { criteria_id: { in: critIds } } });
          if (usageCount > 0) {
            return NextResponse.json({
              message: `Không thể xóa: Có ${usageCount} phiếu chấm điểm đang sử dụng tiêu chí thuộc phiên bản này.`
            }, { status: 400 });
          }
        }
      }

      const oldData = targetVersion;
      const transactions = [];
      if (catIds.length > 0) {
        transactions.push(prisma.criteria.deleteMany({ where: { category_id: { in: catIds } } }));
        transactions.push(prisma.criteria_categories.deleteMany({ where: { criteria_version_id: id } }));
      }
      transactions.push(prisma.criteria_versions.delete({ where: { id } }));
      
      await prisma.$transaction(transactions);
      await logAdminAction(actorId, 'DELETE_VERSION', 'criteria_versions', id, oldData, null);

      return NextResponse.json({ message: 'Đã xóa phiên bản tiêu chí và tất cả dữ liệu liên quan' });
    }

    if (body._type === 'category') {
      // Check if any criteria in this category is being used
      const crits = await prisma.criteria.findMany({ where: { category_id: body.id }, select: { id: true } });
      const critIds = crits.map(c => c.id);
      
      if (critIds.length > 0) {
        const usageCount = await prisma.score_details.count({ where: { criteria_id: { in: critIds } } });
        if (usageCount > 0) {
          return NextResponse.json({
            message: `Không thể xóa: Có ${usageCount} phiếu chấm điểm đang sử dụng tiêu chí thuộc mục này.`
          }, { status: 400 });
        }
      }
      
      const oldData = await prisma.criteria_categories.findUnique({ where: { id: body.id } });
      await prisma.criteria_categories.delete({ where: { id: body.id } });
      await logAdminAction(actorId, 'DELETE_CATEGORY', 'criteria_categories', body.id, oldData, null);
      return NextResponse.json({ message: 'Đã xóa mục và tất cả tiêu chí liên quan' });
    }

    // Delete criterion
    const { id } = body;
    if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

    const critId = typeof id === 'string' ? parseInt(id) : id;

    // Check if criterion is being used in score_details
    const usageCount = await prisma.score_details.count({ where: { criteria_id: critId } });
    if (usageCount > 0) {
      return NextResponse.json({
        message: `Không thể xóa: Tiêu chí đang được ${usageCount} phiếu chấm điểm sử dụng.`
      }, { status: 400 });
    }

    // Also check children usage
    const childIds = (await prisma.criteria.findMany({ where: { parent_id: critId }, select: { id: true } })).map(c => c.id);
    if (childIds.length > 0) {
      const childUsage = await prisma.score_details.count({ where: { criteria_id: { in: childIds } } });
      if (childUsage > 0) {
        return NextResponse.json({
          message: `Không thể xóa: Có ${childUsage} phiếu đang sử dụng tiêu chí con.`
        }, { status: 400 });
      }
    }

    const oldData = await prisma.criteria.findUnique({ where: { id: critId } });
    await prisma.criteria.delete({ where: { id: critId } });
    await logAdminAction(actorId, 'DELETE_CRITERIA', 'criteria', critId.toString(), oldData, null);

    return NextResponse.json({ message: 'Đã xóa tiêu chí thành công' });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Lỗi khi xóa. Có thể tiêu chí đang được sử dụng.' }, { status: 500 });
  }
}

