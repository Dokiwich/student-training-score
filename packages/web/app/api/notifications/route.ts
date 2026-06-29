import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

/**
 * GET /api/notifications
 * Lấy danh sách thông báo của user đang đăng nhập.
 * Query: ?unread_only=true  — chỉ lấy chưa đọc
 *        ?limit=20          — số lượng tối đa (mặc định 20)
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session?.user as any)?.id;
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get('unread_only') === 'true';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50);

  try {
    const where: any = { user_id: userId };
    if (unreadOnly) {
      where.is_read = 0;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notifications.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          data: true,
          is_read: true,
          read_at: true,
          created_at: true,
        },
      }),
      prisma.notifications.count({
        where: { user_id: userId, is_read: 0 },
      }),
    ]);

    const data = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      data: n.data,
      isRead: n.is_read === 1,
      readAt: n.read_at?.toISOString() || null,
      createdAt: n.created_at.toISOString(),
    }));

    return NextResponse.json({ data, unreadCount });
  } catch (err: any) {
    console.error('notifications GET error:', err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * Đánh dấu thông báo đã đọc.
 * Body: { ids: string[] }         — đánh dấu theo danh sách ID
 *    OR { markAllRead: true }     — đánh dấu tất cả đã đọc
 */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session?.user as any)?.id;

  try {
    const body = await req.json();
    const now = new Date();

    if (body.markAllRead) {
      await prisma.notifications.updateMany({
        where: { user_id: userId, is_read: 0 },
        data: { is_read: 1, read_at: now },
      });
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      await prisma.notifications.updateMany({
        where: {
          id: { in: body.ids },
          user_id: userId, // đảm bảo chỉ update thông báo của user
        },
        data: { is_read: 1, read_at: now },
      });
    } else {
      return NextResponse.json({ message: 'Thiếu ids hoặc markAllRead' }, { status: 400 });
    }

    // Trả lại count mới
    const unreadCount = await prisma.notifications.count({
      where: { user_id: userId, is_read: 0 },
    });

    return NextResponse.json({ success: true, unreadCount });
  } catch (err: any) {
    console.error('notifications PATCH error:', err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
