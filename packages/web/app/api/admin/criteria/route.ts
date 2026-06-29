import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { randomUUID } from 'crypto';
import { logAdminAction } from '../../../../lib/audit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkAdmin(session: any) {
  if (!session?.user || (session.user as { role?: string }).role !== 'SCHOOL_ADMIN') {
    return false;
  }
  return true;
}

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
    include: { semesters: { select: { name: true, code: true } } },
    orderBy: { created_at: 'desc' },
  });

  const activeVersion = await prisma.criteria_versions.findFirst({
    where: { is_active: 1 },
    orderBy: { created_at: 'desc' },
  });

  const targetVersionId = versionId || activeVersion?.id;

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

  return NextResponse.json({
    data: criteriaList,
    categories: categoriesList,
    activeVersion,
    versions,
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
      const { id, version, is_active } = body;
      if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

      // Check for conflicts when activating
      if (is_active === 1) {
        const targetVersion = await prisma.criteria_versions.findUnique({ where: { id } });
        if (targetVersion) {
          const activeInSameSemester = await prisma.criteria_versions.findFirst({
            where: { 
              semester_id: targetVersion.semester_id, 
              is_active: 1,
              id: { not: id }
            }
          });
          if (activeInSameSemester) {
            return NextResponse.json({ 
              message: 'Học kỳ này đã có một phiên bản đang được áp dụng. Vui lòng hủy kích hoạt phiên bản hiện tại trước khi kích hoạt bản mới.' 
            }, { status: 400 });
          }
        }
      }

      const updateData: Record<string, any> = {};
      if (version !== undefined) updateData.version = parseInt(version);
      if (is_active !== undefined) updateData.is_active = is_active;

      const oldData = await prisma.criteria_versions.findUnique({ where: { id } });
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

      // Double Check: Không cho sửa Category nếu đã có điểm
      const crits = await prisma.criteria.findMany({ where: { category_id: id }, select: { id: true } });
      const critIds = crits.map(c => c.id);
      if (critIds.length > 0) {
        const usageCount = await prisma.score_details.count({ where: { criteria_id: { in: critIds } } });
        if (usageCount > 0) {
          return NextResponse.json({
            message: `Không thể chỉnh sửa: Mục này đang được ${usageCount} phiếu chấm điểm sử dụng. Vui lòng tạo phiên bản mới.`
          }, { status: 400 });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (max_score !== undefined) updateData.max_score = parseFloat(max_score);
      if (code !== undefined) updateData.code = code;

      const oldData = await prisma.criteria_categories.findUnique({ where: { id } });
      const updated = await prisma.criteria_categories.update({
        where: { id },
        data: updateData,
      });
      await logAdminAction(actorId, 'UPDATE_CATEGORY', 'criteria_categories', id, oldData, updated);

      return NextResponse.json({ message: 'Cập nhật mục thành công', data: updated });
    }

    // Update criterion
    const { id, point, content, code, category_id, parent_id } = body;
    if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

    const critId = typeof id === 'string' ? parseInt(id) : id;

    // Double Check: Không cho sửa Criteria nếu đã có điểm
    const usageCount = await prisma.score_details.count({ where: { criteria_id: critId } });
    if (usageCount > 0) {
      return NextResponse.json({
        message: `Không thể chỉnh sửa: Tiêu chí này đang được ${usageCount} phiếu chấm điểm sử dụng. Vui lòng tạo phiên bản mới.`
      }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (point !== undefined) updateData.point = parseFloat(point);
    if (content !== undefined) updateData.content = content;
    if (code !== undefined) updateData.code = code;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (parent_id !== undefined) {
      const parsedParentId = parent_id ? parseInt(parent_id) : null;
      if (parsedParentId === critId) {
        return NextResponse.json({ message: 'Lỗi Dữ Liệu: Tiêu chí không thể tự nhận chính nó làm cha (Gây lặp vô hạn).' }, { status: 400 });
      }
      updateData.parent_id = parsedParentId;
    }

    const oldData = await prisma.criteria.findUnique({ where: { id: critId } });
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
        ? await prisma.criteria_versions.findUnique({ where: { id: body.criteria_version_id } })
        : await prisma.criteria_versions.findFirst({ where: { is_active: 1 }, orderBy: { created_at: 'desc' } });

      if (!targetVersion) {
        return NextResponse.json({ message: 'Không tìm thấy phiên bản tiêu chí' }, { status: 400 });
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
    const { code, content, point, parent_id, category_id } = body;
    if (!code || !content) return NextResponse.json({ message: 'Thiếu mã hoặc nội dung tiêu chí' }, { status: 400 });

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
