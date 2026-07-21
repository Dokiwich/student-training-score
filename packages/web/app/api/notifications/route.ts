import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session?.user as any)?.id;
  const url = new URL(req.url);
  
  const filter = url.searchParams.get('filter'); // 'all' or 'unread'
  // Support old unread_only for compatibility
  const unreadOnly = filter === 'unread' || url.searchParams.get('unread_only') === 'true';
  const limitStr = url.searchParams.get('limit');
  const limit = Math.min(Number(limitStr) || 20, 50);
  const cursorParam = url.searchParams.get('cursor');

  let cursorCreatedAt: Date | null = null;
  let cursorId: string | null = null;

  if (cursorParam) {
    try {
      const decoded = Buffer.from(cursorParam, 'base64url').toString('utf-8');
      const parsed = JSON.parse(decoded);
      if (!parsed.createdAt || !parsed.id || !UUID_REGEX.test(parsed.id)) {
        throw new Error('Invalid cursor format');
      }
      cursorCreatedAt = new Date(parsed.createdAt);
      if (isNaN(cursorCreatedAt.getTime())) {
        throw new Error('Invalid date in cursor');
      }
      cursorId = parsed.id;
    } catch (err) {
      return NextResponse.json({ message: 'Lỗi cursor không hợp lệ' }, { status: 400 });
    }
  }

  try {
    const where: any = { user_id: userId };
    if (unreadOnly) {
      where.is_read = 0;
    }

    if (cursorCreatedAt && cursorId) {
      where.OR = [
        { created_at: { lt: cursorCreatedAt } },
        { 
          created_at: { equals: cursorCreatedAt },
          id: { lt: cursorId }
        }
      ];
    }

    const [rawNotifications, unreadCount] = await Promise.all([
      prisma.notifications.findMany({
        where,
        orderBy: [
          { created_at: 'desc' },
          { id: 'desc' }
        ],
        take: limit + 1, // Fetch one extra to determine hasMore
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

    let hasMore = false;
    let nextCursor: string | null = null;
    let itemsToReturn = rawNotifications;

    if (rawNotifications.length > limit) {
      hasMore = true;
      itemsToReturn = rawNotifications.slice(0, limit);
      const lastItem = itemsToReturn[itemsToReturn.length - 1];
      nextCursor = Buffer.from(JSON.stringify({
        createdAt: lastItem.created_at.toISOString(),
        id: lastItem.id
      })).toString('base64url');
    }

    const data = itemsToReturn.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      data: n.data,
      isRead: n.is_read === 1,
      readAt: n.read_at?.toISOString() || null,
      createdAt: n.created_at.toISOString(),
    }));

    return NextResponse.json({ data, nextCursor, hasMore, unreadCount });
  } catch (err: any) {
    console.error('notifications GET error:', err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session?.user as any)?.id;

  try {
    const body = await req.json();
    const now = new Date();

    const hasIds = Array.isArray(body.ids);
    const hasMarkAll = typeof body.markAllRead === 'boolean' && body.markAllRead === true;

    if (!hasIds && !hasMarkAll) {
      return NextResponse.json({ message: 'Thiếu ids hoặc markAllRead' }, { status: 400 });
    }

    if (hasIds && hasMarkAll) {
      return NextResponse.json({ message: 'Không thể truyền cả ids và markAllRead đồng thời' }, { status: 400 });
    }

    let updatedCount = 0;

    if (hasMarkAll) {
      const result = await prisma.notifications.updateMany({
        where: { user_id: userId, is_read: 0 },
        data: { is_read: 1, read_at: now },
      });
      updatedCount = result.count;
    } else {
      const uniqueIds = Array.from(new Set(body.ids)) as string[];
      if (uniqueIds.length > 50) {
        return NextResponse.json({ message: 'Chỉ được đánh dấu tối đa 50 thông báo cùng lúc' }, { status: 400 });
      }

      // Validate UUIDs
      if (uniqueIds.some(id => !UUID_REGEX.test(id))) {
        return NextResponse.json({ message: 'Định dạng ID không hợp lệ' }, { status: 400 });
      }

      if (uniqueIds.length > 0) {
        const result = await prisma.notifications.updateMany({
          where: {
            id: { in: uniqueIds },
            user_id: userId,
            is_read: 0
          },
          data: { is_read: 1, read_at: now },
        });
        updatedCount = result.count;
      }
    }

    // Trả lại count mới
    const unreadCount = await prisma.notifications.count({
      where: { user_id: userId, is_read: 0 },
    });

    return NextResponse.json({ success: true, updatedCount, unreadCount });
  } catch (err: any) {
    console.error('notifications PATCH error:', err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
