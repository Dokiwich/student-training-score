import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../[...nextauth]/route';
import bcrypt from 'bcrypt';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ message: 'Thiếu thông tin mật khẩu' }, { status: 400 });
    }

    const userId = (session.user as any).id;
    const user = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ message: 'Không tìm thấy tài khoản' }, { status: 404 });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json({ message: 'Mật khẩu hiện tại không chính xác' }, { status: 400 });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const newSessionVersion = (user.session_version || 1) + 1; // Invalidate other sessions optionally

    await prisma.users.update({
      where: { id: userId },
      data: { 
        password_hash: newPasswordHash,
        session_version: newSessionVersion
      },
    });

    return NextResponse.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ message: 'Lỗi máy chủ nội bộ' }, { status: 500 });
  }
}
