import { prisma } from '@student-score/database';
import { randomUUID } from 'crypto';

/**
 * Thêm một bản ghi vào bảng audit_logs
 * @param actorId ID của người thực hiện hành động (Thường là Admin)
 * @param action Tên hành động (VD: CREATE_CRITERIA, UPDATE_SEMESTER)
 * @param entityType Tên bảng/thực thể (VD: criteria, semesters, users)
 * @param entityId ID của thực thể bị tác động
 * @param oldValue Dữ liệu trước khi thay đổi (truyền null nếu là CREATE)
 * @param newValue Dữ liệu sau khi thay đổi (truyền null nếu là DELETE)
 * @param ipAddress IP của người dùng (nếu có)
 * @param userAgent Trình duyệt của người dùng (nếu có)
 */
export async function logAdminAction(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  oldValue: any = null,
  newValue: any = null,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        actor_id: actorId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_value: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        new_value: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
      },
    });
  } catch (err) {
    console.error(`[Audit Log Error] Failed to log action ${action}:`, err);
    // Chúng ta log lỗi ra console nhưng không throw exception để không làm gián đoạn luồng chính
  }
}
