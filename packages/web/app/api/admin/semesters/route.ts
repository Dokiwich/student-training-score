import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { randomUUID } from 'crypto';

function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const semesters = await prisma.semesters.findMany({
    orderBy: { start_date: 'desc' },
  });

  return NextResponse.json({ data: semesters });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      code, name, academic_year, semester_number,
      start_date, end_date,
      student_deadline, class_committee_deadline,
      advisor_deadline, school_deadline,
    } = body;

    if (!code || !name || !academic_year || !start_date || !end_date) {
      return NextResponse.json({ message: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    const semester = await prisma.semesters.create({
      data: {
        id: randomUUID(),
        code,
        name,
        academic_year,
        semester_number: semester_number || 1,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        student_deadline: new Date(student_deadline || end_date),
        class_committee_deadline: new Date(class_committee_deadline || end_date),
        advisor_deadline: new Date(advisor_deadline || end_date),
        school_deadline: new Date(school_deadline || end_date),
        status: 'UPCOMING',
        is_active: 1,
      },
    });

    return NextResponse.json({ message: 'Tạo học kỳ thành công', data: semester });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002')
      return NextResponse.json({ message: 'Mã học kỳ đã tồn tại' }, { status: 400 });
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ message: 'ID học kỳ là bắt buộc' }, { status: 400 });

    // Convert date strings to Date objects
    const dateFields = ['start_date', 'end_date', 'student_deadline', 'class_committee_deadline', 'advisor_deadline', 'school_deadline'];
    const updateData: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined) continue;
      if (dateFields.includes(key) && typeof val === 'string') {
        updateData[key] = new Date(val);
      } else {
        updateData[key] = val;
      }
    }

    const semester = await prisma.semesters.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ message: 'Cập nhật học kỳ thành công', data: semester });
  } catch {
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
