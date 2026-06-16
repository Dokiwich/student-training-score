import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { randomUUID } from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkAdmin(session: any) {
  if (!session?.user || (session.user as { role?: string }).role !== 'SCHOOL_ADMIN') {
    return false;
  }
  return true;
}

// GET: list all criteria + categories
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
      orderBy: { id: 'asc' } 
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

  try {
    const body = await req.json();

    if (body._type === 'version') {
      const { id, version } = body;
      if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

      const updated = await prisma.criteria_versions.update({
        where: { id },
        data: { version: parseInt(version) },
      });

      return NextResponse.json({ message: 'Cập nhật phiên bản thành công', data: updated });
    }

    if (body._type === 'category') {
      const { id, name, max_score, code } = body;
      if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (max_score !== undefined) updateData.max_score = parseFloat(max_score);
      if (code !== undefined) updateData.code = code;

      const updated = await prisma.criteria_categories.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({ message: 'Cập nhật mục thành công', data: updated });
    }

    // Update criterion
    const { id, point, content, code, category_id } = body;
    if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (point !== undefined) updateData.point = parseFloat(point);
    if (content !== undefined) updateData.content = content;
    if (code !== undefined) updateData.code = code;
    if (category_id !== undefined) updateData.category_id = category_id;

    const updated = await prisma.criteria.update({
      where: { id: typeof id === 'string' ? parseInt(id) : id },
      data: updateData,
    });

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

  try {
    const body = await req.json();

    if (body._type === 'category') {
      // Delete all criteria in this category first
      const crits = await prisma.criteria.findMany({ where: { category_id: body.id } });
      const critIds = crits.map(c => c.id);
      
      // Delete children first to avoid FK constraint
      if (critIds.length > 0) {
        await prisma.criteria.deleteMany({ where: { parent_id: { in: critIds } } });
        await prisma.criteria.deleteMany({ where: { category_id: body.id } });
      }
      
      await prisma.criteria_categories.delete({ where: { id: body.id } });
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

    // Delete child criteria first
    await prisma.criteria.deleteMany({ where: { parent_id: critId } });
    await prisma.criteria.delete({ where: { id: critId } });

    return NextResponse.json({ message: 'Đã xóa tiêu chí thành công' });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Lỗi khi xóa. Có thể tiêu chí đang được sử dụng.' }, { status: 500 });
  }
}
