import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { prisma } from '@student-score/database';
import { randomUUID } from 'crypto';

@Injectable()
export class AppealService {

  // =============================================
  // 1. LẤY DANH SÁCH KHIẾU NẠI THEO ROLE
  //    STUDENT → chỉ thấy của mình
  //    ADVISOR → thấy SV lớp mình cố vấn
  //    SCHOOL_ADMIN / DEPARTMENT → thấy tất cả
  // =============================================
  async getAppealsByRole(userId: string, role: string, semesterId?: string) {
    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const activeSemester = await prisma.semesters.findFirst({
        where: { is_active: 1 },
        orderBy: { created_at: 'desc' },
        select: { id: true },
      });
      targetSemesterId = activeSemester?.id;
    }

    // Build where clause dựa trên Role
    let sheetFilter: any = {};

    if (role === 'STUDENT') {
      sheetFilter = {
        semester_enrollments: {
          user_id: userId,
          ...(targetSemesterId ? { semester_id: targetSemesterId } : {}),
        },
      };
    } else if (role === 'ADVISOR') {
      // Tìm lớp mà user này làm cố vấn
      const advisorClasses = await prisma.class_roles.findMany({
        where: { user_id: userId, role_type: 'ADVISOR', is_active: 1 },
        select: { class_id: true },
      });
      const classIds = advisorClasses.map(c => c.class_id);

      if (classIds.length === 0) {
        return { data: [] };
      }

      sheetFilter = {
        semester_enrollments: {
          class_id: { in: classIds },
          ...(targetSemesterId ? { semester_id: targetSemesterId } : {}),
        },
      };
    } else if (role === 'SCHOOL_ADMIN' || role === 'DEPARTMENT') {
      sheetFilter = targetSemesterId
        ? { semester_enrollments: { semester_id: targetSemesterId } }
        : {};
    } else {
      throw new ForbiddenException('Bạn không có quyền xem danh sách khiếu nại');
    }

    const appeals = await prisma.appeals.findMany({
      where: { scoring_sheets: sheetFilter },
      orderBy: { created_at: 'desc' },
      include: {
        scoring_sheets: {
          select: {
            id: true,
            status: true,
            student_total: true,
            class_total: true,
            advisor_total: true,
            final_total: true,
            classification: true,
            semester_enrollments: {
              select: {
                users: { select: { id: true, full_name: true, student_id: true } },
                semesters: { select: { id: true, code: true, name: true } },
                classes: { select: { code: true, name: true } },
              },
            },
          },
        },
        users_appeals_resolved_byTousers: {
          select: { full_name: true, role: true },
        },
      },
    });

    // Transform response
    const data = await Promise.all(appeals.map(async (a) => {
      const sheet = a.scoring_sheets;
      const enrollment = sheet.semester_enrollments;

      // Parse evidence_note: format "type:criteriaId"
      let appealType = 'class';
      let criteriaId: number | null = null;
      if (a.evidence_note) {
        const parts = a.evidence_note.split(':');
        appealType = parts[0] || 'class';
        if (parts[1]) criteriaId = parseInt(parts[1]) || null;
      }

      // Fetch criteria info
      let criteriaCode: string | null = null;
      let criteriaContent: string | null = null;
      if (criteriaId) {
        const crit = await prisma.criteria.findUnique({
          where: { id: criteriaId },
          select: { code: true, content: true },
        });
        if (crit) {
          criteriaCode = crit.code;
          criteriaContent = crit.content;
        }
      }

      // Get current scores cho tiêu chí đang khiếu nại
      let currentScores: Record<string, number> | null = null;
      if (criteriaId) {
        const scoreDetail = await prisma.score_details.findUnique({
          where: {
            scoring_sheet_id_criteria_id: {
              scoring_sheet_id: sheet.id,
              criteria_id: criteriaId,
            },
          },
          include: { score_entries: true },
        });
        if (scoreDetail) {
          currentScores = {};
          for (const entry of scoreDetail.score_entries) {
            currentScores[entry.scorer_role] = Number(entry.score);
          }
        }
      }

      return {
        id: a.id,
        reason: a.reason,
        appealType,
        criteriaId,
        criteriaCode,
        criteriaContent,
        currentScores,
        status: a.status,
        resolution: a.resolution,
        resolvedBy: a.users_appeals_resolved_byTousers?.full_name || null,
        resolvedAt: a.resolved_at?.toISOString() || null,
        createdAt: a.created_at.toISOString(),
        sheetId: sheet.id,
        sheetStatus: sheet.status,
        studentName: enrollment.users.full_name,
        studentCode: enrollment.users.student_id,
        semesterName: enrollment.semesters.name,
        semesterCode: enrollment.semesters.code,
        className: enrollment.classes.name,
        classCode: enrollment.classes.code,
        studentTotal: sheet.student_total != null ? Number(sheet.student_total) : null,
        classTotal: sheet.class_total != null ? Number(sheet.class_total) : null,
        advisorTotal: sheet.advisor_total != null ? Number(sheet.advisor_total) : null,
        finalTotal: sheet.final_total != null ? Number(sheet.final_total) : null,
        classification: sheet.classification,
      };
    }));

    return { data };
  }

  // =============================================
  // 2. SINH VIÊN GỬI KHIẾU NẠI
  //    → Tạo appeal + chuyển phiếu sang APPEALING
  //    → Gửi notification cho ADVISOR
  // =============================================
  async submitAppeal(
    studentId: string,
    sheetId: string,
    reason: string,
    appealType: 'class' | 'advisor',
    criteriaIds: number[],
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('Vui lòng nhập lý do khiếu nại');
    }
    if (!criteriaIds || criteriaIds.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một tiêu chí khiếu nại');
    }
    if (!['class', 'advisor'].includes(appealType)) {
      throw new BadRequestException('Loại khiếu nại không hợp lệ (class hoặc advisor)');
    }

    // Xác minh phiếu thuộc về sinh viên
    const sheet = await prisma.scoring_sheets.findFirst({
      where: {
        id: sheetId,
        semester_enrollments: { user_id: studentId },
      },
      select: { id: true, status: true },
    });

    if (!sheet) {
      throw new BadRequestException('Không tìm thấy phiếu hoặc phiếu không thuộc về bạn');
    }

    // Chỉ cho phép khiếu nại khi ADVISOR_APPROVED hoặc FINALIZED
    if (sheet.status !== 'ADVISOR_APPROVED' && sheet.status !== 'FINALIZED') {
      throw new BadRequestException(
        'Chỉ có thể khiếu nại khi phiếu đã được Cố vấn phê duyệt hoặc đã Chốt điểm',
      );
    }

    // Kiểm tra trùng: không tạo appeal mới nếu tiêu chí đã có PENDING
    for (const criteriaId of criteriaIds) {
      const evidenceNote = `${appealType}:${criteriaId}`;
      const existing = await prisma.appeals.findFirst({
        where: { scoring_sheet_id: sheetId, status: 'PENDING', evidence_note: evidenceNote },
      });
      if (existing) {
        throw new BadRequestException(
          `Tiêu chí ID ${criteriaId} đã có khiếu nại đang chờ xử lý`,
        );
      }
    }

    // Tạo bản ghi appeal (1 per criteria)
    const appealsData = criteriaIds.map((criteriaId) => ({
      id: randomUUID(),
      scoring_sheet_id: sheetId,
      reason: reason.trim(),
      evidence_note: `${appealType}:${criteriaId}`,
      status: 'PENDING' as any,
    }));

    await prisma.appeals.createMany({ data: appealsData });

    // Chuyển phiếu sang trạng thái APPEALING
    await prisma.scoring_sheets.update({
      where: { id: sheetId },
      data: { status: 'APPEALING', updated_at: new Date() },
    });

    // Gửi notification cho ADVISOR
    try {
      const sheetInfo = await prisma.scoring_sheets.findUnique({
        where: { id: sheetId },
        select: {
          semester_enrollments: {
            select: {
              class_id: true,
              users: { select: { full_name: true } },
            },
          },
        },
      });

      if (sheetInfo?.semester_enrollments) {
        const classId = sheetInfo.semester_enrollments.class_id;
        const studentName = sheetInfo.semester_enrollments.users.full_name;

        const advisorRoles = await prisma.class_roles.findMany({
          where: { class_id: classId, role_type: 'ADVISOR', is_active: 1 },
          select: { user_id: true },
        });

        for (const ar of advisorRoles) {
          await prisma.notifications.create({
            data: {
              id: randomUUID(),
              user_id: ar.user_id,
              type: 'APPEAL_SUBMITTED',
              title: 'Có khiếu nại mới cần xử lý',
              content: `Sinh viên ${studentName} đã gửi khiếu nại ${criteriaIds.length} tiêu chí. Vui lòng xem xét và phê duyệt.`,
              is_read: 0,
            },
          });
        }
      }
    } catch (err) {
      console.warn('Lỗi khi gửi thông báo khiếu nại:', err);
    }

    // Audit log
    try {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          actor_id: studentId,
          action: 'SUBMIT_APPEAL',
          entity_type: 'appeals',
          entity_id: sheetId,
          new_value: { appeal_type: appealType, criteria_ids: criteriaIds, count: criteriaIds.length },
        },
      });
    } catch (err) {
      console.warn('Lỗi khi ghi audit log:', err);
    }

    return {
      message: 'Gửi khiếu nại thành công',
      data: { count: appealsData.length },
    };
  }

  // =============================================
  // 3. RESOLVE MỘT KHIẾU NẠI (ADVISOR / SCHOOL_ADMIN)
  //    ACCEPTED → cập nhật điểm nếu có newScore
  //    REJECTED → giữ nguyên điểm
  //    Khi hết PENDING → chuyển phiếu về ADVISOR_APPROVED
  // =============================================
  async resolveAppeal(
    appealId: string,
    resolverId: string,
    decision: 'ACCEPTED' | 'REJECTED',
    resolution: string,
    newScore?: number,
  ) {
    // 3a. Tìm appeal
    const appeal = await prisma.appeals.findUnique({
      where: { id: appealId },
      include: {
        scoring_sheets: {
          select: {
            id: true,
            status: true,
            semester_enrollments: {
              select: { user_id: true, class_id: true },
            },
          },
        },
      },
    });

    if (!appeal) {
      throw new BadRequestException('Không tìm thấy khiếu nại');
    }

    if (appeal.status !== 'PENDING') {
      throw new BadRequestException('Khiếu nại này đã được xử lý rồi');
    }

    // 3b. Kiểm tra quyền resolver
    const resolver = await prisma.users.findUnique({
      where: { id: resolverId },
      select: { role: true },
    });

    if (!resolver || !['ADVISOR', 'SCHOOL_ADMIN'].includes(resolver.role)) {
      throw new ForbiddenException('Bạn không có quyền xử lý khiếu nại');
    }

    // Nếu là ADVISOR, kiểm tra đúng cố vấn của lớp
    if (resolver.role === 'ADVISOR') {
      const classId = appeal.scoring_sheets.semester_enrollments.class_id;
      const isAdvisor = await prisma.class_roles.findFirst({
        where: { user_id: resolverId, class_id: classId, role_type: 'ADVISOR', is_active: 1 },
      });
      if (!isAdvisor) {
        throw new ForbiddenException('Bạn không phải cố vấn của lớp này');
      }
    }

    if (!resolution?.trim()) {
      throw new BadRequestException('Vui lòng nhập nội dung phản hồi');
    }

    if (!['ACCEPTED', 'REJECTED'].includes(decision)) {
      throw new BadRequestException('Quyết định không hợp lệ (ACCEPTED hoặc REJECTED)');
    }

    // 3c. Cập nhật appeal
    await prisma.appeals.update({
      where: { id: appealId },
      data: {
        status: decision,
        resolved_by: resolverId,
        resolution: resolution.trim(),
        resolved_at: new Date(),
      },
    });

    // 3d. Nếu ACCEPTED + có newScore → cập nhật điểm
    if (decision === 'ACCEPTED' && newScore != null && appeal.evidence_note) {
      const [type, criteriaIdStr] = appeal.evidence_note.split(':');
      const criteriaId = parseInt(criteriaIdStr);
      const scorerRole = type === 'class' ? 'CLASS_COMMITTEE' : 'ADVISOR';

      if (!isNaN(criteriaId)) {
        const scoreDetail = await prisma.score_details.findUnique({
          where: {
            scoring_sheet_id_criteria_id: {
              scoring_sheet_id: appeal.scoring_sheet_id,
              criteria_id: criteriaId,
            },
          },
          include: { score_entries: { where: { scorer_role: scorerRole as any } } },
        });

        if (scoreDetail) {
          const oldScore = scoreDetail.score_entries[0]?.score != null
            ? Number(scoreDetail.score_entries[0].score)
            : null;

          // Upsert score entry
          await prisma.score_entries.upsert({
            where: {
              score_detail_id_scorer_role: {
                score_detail_id: scoreDetail.id,
                scorer_role: scorerRole as any,
              },
            },
            update: { score: newScore, scored_at: new Date() },
            create: {
              id: randomUUID(),
              score_detail_id: scoreDetail.id,
              scorer_role: scorerRole as any,
              score: newScore,
            },
          });

          // Ghi score_adjustment_logs
          if (oldScore != null && oldScore !== newScore) {
            try {
              await prisma.score_adjustment_logs.create({
                data: {
                  id: randomUUID(),
                  score_detail_id: scoreDetail.id,
                  adjusted_by_id: resolverId,
                  old_score: oldScore,
                  new_score: newScore,
                  reason: `Phúc khảo: ${resolution.trim()}`,
                },
              });
            } catch (err) {
              console.warn('Lỗi khi ghi score adjustment log:', err);
            }
          }
        }
      }
    }

    // 3e. Kiểm tra PENDING còn lại → nếu hết thì chuyển trạng thái
    const pendingCount = await prisma.appeals.count({
      where: { scoring_sheet_id: appeal.scoring_sheet_id, status: 'PENDING' },
    });

    let sheetTransitioned = false;
    if (pendingCount === 0) {
      const totals = await this.recalculateTotals(appeal.scoring_sheet_id);
      await prisma.scoring_sheets.update({
        where: { id: appeal.scoring_sheet_id },
        data: {
          status: 'ADVISOR_APPROVED',
          advisor_total: totals.advisorTotal,
          final_total: totals.advisorTotal,
          classification: this.getClassification(Number(totals.advisorTotal)) as any,
          updated_at: new Date(),
        },
      });
      sheetTransitioned = true;
    }

    // 3f. Audit log
    try {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          actor_id: resolverId,
          action: 'RESOLVE_APPEAL',
          entity_type: 'appeals',
          entity_id: appealId,
          old_value: { status: 'PENDING' },
          new_value: { status: decision, resolution: resolution.trim(), new_score: newScore ?? null },
        },
      });
    } catch (err) {
      console.warn('Lỗi khi ghi audit log:', err);
    }

    // 3g. Notification cho sinh viên
    try {
      const studentId = appeal.scoring_sheets.semester_enrollments.user_id;
      const decisionText = decision === 'ACCEPTED' ? 'chấp nhận' : 'từ chối';
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          user_id: studentId,
          type: 'APPEAL_RESOLVED',
          title: `Khiếu nại đã được ${decisionText}`,
          content: `Khiếu nại của bạn đã được ${decisionText}. Phản hồi: ${resolution.trim()}`,
          is_read: 0,
        },
      });
    } catch (err) {
      console.warn('Lỗi khi gửi thông báo:', err);
    }

    return {
      message: `Đã ${decision === 'ACCEPTED' ? 'chấp nhận' : 'từ chối'} khiếu nại`,
      data: {
        appealId,
        decision,
        pendingRemaining: pendingCount,
        sheetTransitioned,
      },
    };
  }

  // =============================================
  // 4. RESOLVE TẤT CẢ PENDING APPEALS TRÊN 1 PHIẾU
  //    Dùng khi ADVISOR muốn kết thúc nhanh
  //    Các appeal chưa xử lý sẽ bị REJECTED với lý do mặc định
  // =============================================
  async resolveAllAppeals(sheetId: string, resolverId: string, defaultResolution?: string) {
    // 4a. Kiểm tra quyền
    const resolver = await prisma.users.findUnique({
      where: { id: resolverId },
      select: { role: true },
    });

    if (!resolver || !['ADVISOR', 'SCHOOL_ADMIN'].includes(resolver.role)) {
      throw new ForbiddenException('Bạn không có quyền xử lý khiếu nại');
    }

    // 4b. Tìm phiếu
    const sheet = await prisma.scoring_sheets.findUnique({
      where: { id: sheetId },
      select: {
        id: true,
        status: true,
        semester_enrollments: { select: { user_id: true } },
      },
    });

    if (!sheet) {
      throw new BadRequestException('Không tìm thấy phiếu điểm');
    }

    if (sheet.status !== 'APPEALING') {
      throw new BadRequestException('Phiếu không ở trạng thái khiếu nại (APPEALING)');
    }

    // 4c. Tìm và reject tất cả PENDING appeals
    const pendingAppeals = await prisma.appeals.findMany({
      where: { scoring_sheet_id: sheetId, status: 'PENDING' },
      select: { id: true },
    });

    const resolveMessage = defaultResolution?.trim() || 'Đã xem xét, không điều chỉnh điểm';

    if (pendingAppeals.length > 0) {
      await prisma.appeals.updateMany({
        where: { scoring_sheet_id: sheetId, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          resolved_by: resolverId,
          resolution: resolveMessage,
          resolved_at: new Date(),
        },
      });
    }

    // 4d. Tính lại tổng điểm
    const totals = await this.recalculateTotals(sheetId);

    // 4e. Chuyển trạng thái phiếu → ADVISOR_APPROVED
    await prisma.scoring_sheets.update({
      where: { id: sheetId },
      data: {
        status: 'ADVISOR_APPROVED',
        advisor_total: totals.advisorTotal,
        final_total: totals.advisorTotal,
        classification: this.getClassification(Number(totals.advisorTotal)) as any,
        updated_at: new Date(),
      },
    });

    // 4f. Audit log
    try {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          actor_id: resolverId,
          action: 'RESOLVE_ALL_APPEALS',
          entity_type: 'scoring_sheets',
          entity_id: sheetId,
          old_value: { status: 'APPEALING', pending_count: pendingAppeals.length },
          new_value: { status: 'ADVISOR_APPROVED', resolution: resolveMessage },
        },
      });
    } catch (err) {
      console.warn('Lỗi khi ghi audit log:', err);
    }

    // 4g. Notification cho sinh viên
    try {
      const studentId = sheet.semester_enrollments.user_id;
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          user_id: studentId,
          type: 'APPEAL_RESOLVED',
          title: 'Tất cả khiếu nại đã được xử lý',
          content: `Tất cả khiếu nại trên phiếu đã được xem xét và xử lý hoàn tất. Phiếu đã chuyển về trạng thái chờ duyệt.`,
          is_read: 0,
        },
      });
    } catch (err) {
      console.warn('Lỗi khi gửi thông báo:', err);
    }

    return {
      message: 'Đã xử lý tất cả khiếu nại',
      data: {
        rejectedCount: pendingAppeals.length,
        newStatus: 'ADVISOR_APPROVED',
        totals,
      },
    };
  }

  // =============================================
  // HELPER: Tính lại tổng điểm (clone logic từ ScoringService)
  //   Áp trần max_score theo danh mục + sàn 0
  //   Làm tròn 1 chữ số thập phân (khớp Decimal(5,1) trong DB)
  // =============================================
  private async recalculateTotals(sheetId: string) {
    const details = await prisma.score_details.findMany({
      where: { scoring_sheet_id: sheetId },
      select: {
        criteria: { select: { category_id: true } },
        score_entries: { select: { scorer_role: true, score: true } },
      },
    });

    const categories = await prisma.criteria_categories.findMany({
      select: { id: true, max_score: true },
    });
    const categoryMaxMap = new Map<string, number>();
    for (const cat of categories) {
      categoryMaxMap.set(cat.id, cat.max_score);
    }

    // Gom điểm theo danh mục
    const byCategoryStudent = new Map<string, number>();
    const byCategoryClass = new Map<string, number>();
    const byCategoryAdvisor = new Map<string, number>();

    for (const d of details) {
      const catId = d.criteria?.category_id;
      if (!catId) continue;

      const entries = d.score_entries || [];
      const sEntry = entries.find((e: any) => e.scorer_role === 'STUDENT');
      const cEntry = entries.find((e: any) => e.scorer_role === 'CLASS_COMMITTEE');
      const aEntry = entries.find((e: any) => e.scorer_role === 'ADVISOR');

      byCategoryStudent.set(catId, (byCategoryStudent.get(catId) || 0) + Number(sEntry?.score ?? 0));
      byCategoryClass.set(catId, (byCategoryClass.get(catId) || 0) + Number(cEntry?.score ?? 0));
      byCategoryAdvisor.set(catId, (byCategoryAdvisor.get(catId) || 0) + Number(aEntry?.score ?? 0));
    }

    // Tính tổng sau khi áp trần + sàn
    let studentTotal = 0;
    let classTotal = 0;
    let advisorTotal = 0;

    for (const [catId, maxScore] of categoryMaxMap) {
      const rawStudent = byCategoryStudent.get(catId) || 0;
      const rawClass = byCategoryClass.get(catId) || 0;
      const rawAdvisor = byCategoryAdvisor.get(catId) || 0;

      studentTotal += Math.max(0, Math.min(rawStudent, maxScore));
      classTotal += Math.max(0, Math.min(rawClass, maxScore));
      advisorTotal += Math.max(0, Math.min(rawAdvisor, maxScore));
    }

    // Làm tròn 1 chữ số thập phân
    studentTotal = Math.round(studentTotal * 10) / 10;
    classTotal = Math.round(classTotal * 10) / 10;
    advisorTotal = Math.round(advisorTotal * 10) / 10;

    return { studentTotal, classTotal, advisorTotal };
  }

  // =============================================
  // HELPER: Xếp loại theo tổng điểm
  // =============================================
  private getClassification(totalScore: number): string {
    if (totalScore >= 90) return 'EXCELLENT';
    if (totalScore >= 80) return 'VERY_GOOD';
    if (totalScore >= 65) return 'GOOD';
    if (totalScore >= 50) return 'AVERAGE';
    if (totalScore >= 35) return 'WEAK';
    return 'POOR';
  }
}
