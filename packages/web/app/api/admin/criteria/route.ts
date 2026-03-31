import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkAdmin(session: any) {
  if (!session?.user || !['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes((session.user as { role?: string }).role || '')) {
    return false;
  }
  return true;
}

// GET: list all criteria + categories
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!checkAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const [criteriaList, categoriesList] = await Promise.all([
    prisma.criteria.findMany({ orderBy: { id: 'asc' } }),
    prisma.criteria_categories.findMany({ orderBy: { sort_order: 'asc' } }),
  ]);

  return NextResponse.json({
    data: criteriaList,
    categories: categoriesList,
  });
}

// PUT: update criterion
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!checkAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, max_points, content, code } = body;
    if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (max_points !== undefined) updateData.max_points = parseFloat(max_points);
    if (content !== undefined) updateData.content = content;
    if (code !== undefined) updateData.code = code;

    const updated = await prisma.criteria.update({
      where: { id: typeof id === 'string' ? parseInt(id) : id },
      data: updateData,
    });

    return NextResponse.json({ message: 'Cap nhat thanh cong', data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Loi server' }, { status: 500 });
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
      if (!code || !name) return NextResponse.json({ message: 'Thieu ma hoac ten muc' }, { status: 400 });

      // Get active criteria version
      const activeVersion = await prisma.criteria_versions.findFirst({
        where: { is_active: 1 },
        orderBy: { created_at: 'desc' },
      });

      if (!activeVersion) {
        return NextResponse.json({ message: 'Khong tim thay phien ban tieu chi dang hoat dong' }, { status: 400 });
      }

      const maxOrder = await prisma.criteria_categories.aggregate({
        _max: { sort_order: true },
        where: { criteria_version_id: activeVersion.id },
      });

      const newCat = await prisma.criteria_categories.create({
        data: {
          id: randomUUID(),
          criteria_version_id: activeVersion.id,
          code,
          name,
          max_score: parseFloat(max_score) || 0,
          sort_order: (maxOrder._max.sort_order || 0) + 1,
        },
      });

      return NextResponse.json({ message: 'Them muc thanh cong', data: newCat });
    }

    // Create criterion
    const { code, content, max_points, parent_id, category_id } = body;
    if (!code || !content) return NextResponse.json({ message: 'Thieu ma hoac noi dung' }, { status: 400 });

    const newCriteria = await prisma.criteria.create({
      data: {
        category_id,
        code,
        content,
        max_points: parseFloat(max_points) || 0,
        parent_id: parent_id ? parseInt(parent_id) : null,
        sort_order: 0,
        is_active: 1,
      },
    });

    return NextResponse.json({ message: 'Them tieu chi thanh cong', data: newCriteria });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Loi server' }, { status: 500 });
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
      await prisma.criteria.deleteMany({ where: { category_id: body.id } });
      await prisma.criteria_categories.delete({ where: { id: body.id } });
      return NextResponse.json({ message: 'Da xoa muc va tat ca tieu chi lien quan' });
    }

    // Delete criterion
    const { id } = body;
    if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

    // Delete child criteria first
    await prisma.criteria.deleteMany({ where: { parent_id: typeof id === 'string' ? parseInt(id) : id } });
    await prisma.criteria.delete({ where: { id: typeof id === 'string' ? parseInt(id) : id } });

    return NextResponse.json({ message: 'Da xoa tieu chi thanh cong' });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Loi khi xoa. Co the tieu chi dang duoc su dung.' }, { status: 500 });
  }
}
