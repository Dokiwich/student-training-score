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
      const advisorClasses = await prisma.user_roles.findMany({
        where: { user_id: userId, roles: { code: 'ADVISOR' }, is_active: 1 },
        select: { entity_id: true },
      });
      const classIds = advisorClasses.map(c => c.entity_id as string).filter(Boolean);

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
          select: { full_name: true },
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
      let proofUrl: string | null = null;
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
          proofUrl = scoreDetail.proof_url;
          currentScores = {};
          for (const entry of scoreDetail.score_entries) {
            currentScores[entry.scorer_role] = Number(entry.score);
          }
        }
      }

      // Lấy tên người duyệt Khoa
      let deptResolverName: string | null = null;
      if (a.dept_resolved_by) {
        const deptResolver = await prisma.users.findUnique({
          where: { id: a.dept_resolved_by },
          select: { full_name: true },
        });
        deptResolverName = deptResolver?.full_name || null;
      }

      return {
        id: a.id,
        reason: a.reason,
        appealType,
        criteriaId,
        criteriaCode,
        criteriaContent,
        currentScores,
        proofUrl,
        status: a.status,
        resolution: a.resolution,
        resolvedBy: a.users_appeals_resolved_byTousers?.full_name || null,
        resolvedAt: a.resolved_at?.toISOString() || null,
        createdAt: a.created_at.toISOString(),
        // Thông tin duyệt cấp Khoa
        deptDecision: a.dept_decision || null,
        deptResolution: a.dept_resolution || null,
        deptResolvedBy: deptResolverName,
        deptResolvedAt: a.dept_resolved_at?.toISOString() || null,
        deptNewScore: a.dept_new_score != null ? Number(a.dept_new_score) : null,
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

    // Kiểm tra trùng: không tạo appeal mới nếu tiêu chí đã có PENDING hoặc DEPT_REVIEWED
    for (const criteriaId of criteriaIds) {
      const evidenceNote = `${appealType}:${criteriaId}`;
      const existing = await prisma.appeals.findFirst({
        where: { scoring_sheet_id: sheetId, status: { in: ['PENDING', 'DEPT_REVIEWED'] }, evidence_note: evidenceNote },
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

    // Gửi notification cho DEPARTMENT
    try {
      const sheetInfo = await prisma.scoring_sheets.findUnique({
        where: { id: sheetId },
        select: {
          semester_enrollments: {
            select: {
              classes: { select: { department_id: true } },
              users: { select: { full_name: true } },
            },
          },
        },
      });

      if (sheetInfo?.semester_enrollments) {
        const departmentId = sheetInfo.semester_enrollments.classes.department_id;
        const studentName = sheetInfo.semester_enrollments.users.full_name;

        const deptUsers = await prisma.users.findMany({
          where: { user_roles: { some: { roles: { code: 'DEPARTMENT' }, is_active: 1 } }, department_id: departmentId },
          select: { id: true },
        });

        for (const deptUser of deptUsers) {
          await prisma.notifications.create({
            data: {
              id: randomUUID(),
              user_id: deptUser.id,
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
  // 3. RESOLVE MỘT KHIẾU NẠI — QUY TRÌNH 2 CẤP
  //    Bước 1: DEPARTMENT xem xét → DEPT_REVIEWED (lưu đề xuất)
  //    Bước 2: SCHOOL_ADMIN phê duyệt cuối → ACCEPTED/REJECTED
  //    Chỉ Admin mới được cập nhật điểm chính thức
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
              select: { user_id: true, class_id: true, classes: { select: { department_id: true } } },
            },
          },
        },
      },
    });

    if (!appeal) {
      throw new BadRequestException('Không tìm thấy khiếu nại');
    }

    // 3b. Kiểm tra quyền resolver
    const resolver = await prisma.users.findUnique({
      where: { id: resolverId },
      include: { user_roles: { include: { roles: true } } },
    });

    const isDept = resolver?.user_roles.some(ur => ur.roles.code === 'DEPARTMENT' && ur.is_active === 1);
    const isAdmin = resolver?.user_roles.some(ur => ur.roles.code === 'SCHOOL_ADMIN' && ur.is_active === 1);

    if (!resolver || (!isDept && !isAdmin)) {
      throw new ForbiddenException('Bạn không có quyền xử lý khiếu nại (Chỉ Khoa hoặc Admin trường)');
    }

    if (!resolution?.trim()) {
      throw new BadRequestException('Vui lòng nhập nội dung phản hồi');
    }

    if (!['ACCEPTED', 'REJECTED'].includes(decision)) {
      throw new BadRequestException('Quyết định không hợp lệ (ACCEPTED hoặc REJECTED)');
    }

    // ========== NHÁNH 1: KHOA (DEPARTMENT) XEM XÉT ==========
    if (isDept) {
      if (appeal.status !== 'PENDING') {
        throw new BadRequestException('Khiếu nại này đã được xem xét rồi');
      }

      // Kiểm tra đúng khoa
      const deptId = appeal.scoring_sheets.semester_enrollments.classes.department_id;
      if (resolver.department_id !== deptId) {
        throw new ForbiddenException('Sinh viên này không thuộc khoa của bạn');
      }

      // Cập nhật appeal → DEPT_REVIEWED (chưa chốt, chỉ ghi đề xuất)
      await prisma.appeals.update({
        where: { id: appealId },
        data: {
          status: 'DEPT_REVIEWED',
          dept_decision: decision,
          dept_resolution: resolution.trim(),
          dept_resolved_by: resolverId,
          dept_resolved_at: new Date(),
          dept_new_score: newScore != null ? newScore : null,
        },
      });

      // Audit log
      try {
        await prisma.audit_logs.create({
          data: {
            id: randomUUID(),
            actor_id: resolverId,
            action: 'DEPT_REVIEW_APPEAL',
            entity_type: 'appeals',
            entity_id: appealId,
            old_value: { status: 'PENDING' },
            new_value: { status: 'DEPT_REVIEWED', dept_decision: decision, dept_new_score: newScore ?? null },
          },
        });
      } catch (err) {
        console.warn('Lỗi khi ghi audit log:', err);
      }

      // Notification cho Admin trường
      try {
        const admins = await prisma.users.findMany({
          where: { user_roles: { some: { roles: { code: 'SCHOOL_ADMIN' }, is_active: 1 } } },
          select: { id: true },
        });
        const studentId = appeal.scoring_sheets.semester_enrollments.user_id;
        const student = await prisma.users.findUnique({ where: { id: studentId }, select: { full_name: true } });
        const decisionText = decision === 'ACCEPTED' ? 'đề xuất chấp nhận' : 'đề xuất từ chối';

        for (const admin of admins) {
          await prisma.notifications.create({
            data: {
              id: randomUUID(),
              user_id: admin.id,
              type: 'APPEAL_SUBMITTED',
              title: 'Khoa đã xem xét khiếu nại — Cần Admin phê duyệt',
              content: `Khoa đã ${decisionText} khiếu nại của SV ${student?.full_name || ''}. Vui lòng phê duyệt cuối cùng.`,
              is_read: 0,
            },
          });
        }
      } catch (err) {
        console.warn('Lỗi khi gửi thông báo cho Admin:', err);
      }

      // Notification cho sinh viên
      try {
        const studentId = appeal.scoring_sheets.semester_enrollments.user_id;
        const decisionText = decision === 'ACCEPTED' ? 'đề xuất chấp nhận' : 'đề xuất từ chối';
        await prisma.notifications.create({
          data: {
            id: randomUUID(),
            user_id: studentId,
            type: 'APPEAL_RESOLVED',
            title: `Khoa đã xem xét khiếu nại (${decisionText})`,
            content: `Khoa đã ${decisionText} khiếu nại của bạn. Đang chờ Admin trường phê duyệt cuối cùng. Phản hồi Khoa: ${resolution.trim()}`,
            is_read: 0,
          },
        });
      } catch (err) {
        console.warn('Lỗi khi gửi thông báo:', err);
      }

      return {
        message: `Đã ${decision === 'ACCEPTED' ? 'đề xuất chấp nhận' : 'đề xuất từ chối'} khiếu nại. Đang chờ Admin trường phê duyệt.`,
        data: { appealId, decision: 'DEPT_REVIEWED', deptDecision: decision },
      };
    }

    // ========== NHÁNH 2: ADMIN TRƯỜNG PHÊ DUYỆT CUỐI ==========
    if (isAdmin) {
      // Admin có thể duyệt cả PENDING (bỏ qua Khoa) lẫn DEPT_REVIEWED
      if (appeal.status !== 'PENDING' && appeal.status !== 'DEPT_REVIEWED') {
        throw new BadRequestException('Khiếu nại này đã được xử lý rồi');
      }

      // Cập nhật appeal → ACCEPTED / REJECTED (chốt sổ)
      await prisma.appeals.update({
        where: { id: appealId },
        data: {
          status: decision,
          resolved_by: resolverId,
          resolution: resolution.trim(),
          resolved_at: new Date(),
        },
      });

      // Nếu ACCEPTED + có newScore → cập nhật điểm chính thức
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
                    reason: `Phúc khảo (Admin): ${resolution.trim()}`,
                  },
                });
              } catch (err) {
                console.warn('Lỗi khi ghi score adjustment log:', err);
              }
            }
          }
        }
      }

      // Kiểm tra còn PENDING/DEPT_REVIEWED không → nếu hết thì chuyển trạng thái phiếu
      const remainingCount = await prisma.appeals.count({
        where: {
          scoring_sheet_id: appeal.scoring_sheet_id,
          status: { in: ['PENDING', 'DEPT_REVIEWED'] },
        },
      });

      let sheetTransitioned = false;
      if (remainingCount === 0) {
        const totals = await this.recalculateTotals(appeal.scoring_sheet_id);
        await prisma.scoring_sheets.update({
          where: { id: appeal.scoring_sheet_id },
          data: {
            status: 'SCHOOL_REVIEWING',
            advisor_total: totals.advisorTotal,
            final_total: totals.advisorTotal,
            classification: this.getClassification(Number(totals.advisorTotal)) as any,
            updated_at: new Date(),
          },
        });
        sheetTransitioned = true;
      }

      // Audit log
      try {
        await prisma.audit_logs.create({
          data: {
            id: randomUUID(),
            actor_id: resolverId,
            action: 'ADMIN_RESOLVE_APPEAL',
            entity_type: 'appeals',
            entity_id: appealId,
            old_value: { status: appeal.status },
            new_value: { status: decision, resolution: resolution.trim(), new_score: newScore ?? null },
          },
        });
      } catch (err) {
        console.warn('Lỗi khi ghi audit log:', err);
      }

      // Notification cho sinh viên
      try {
        const studentId = appeal.scoring_sheets.semester_enrollments.user_id;
        const decisionText = decision === 'ACCEPTED' ? 'chấp nhận' : 'từ chối';
        await prisma.notifications.create({
          data: {
            id: randomUUID(),
            user_id: studentId,
            type: 'APPEAL_RESOLVED',
            title: `Khiếu nại đã được Admin trường ${decisionText}`,
            content: `Khiếu nại của bạn đã được Admin trường ${decisionText} (quyết định cuối cùng). Phản hồi: ${resolution.trim()}`,
            is_read: 0,
          },
        });
      } catch (err) {
        console.warn('Lỗi khi gửi thông báo:', err);
      }

      return {
        message: `Đã ${decision === 'ACCEPTED' ? 'chấp nhận' : 'từ chối'} khiếu nại (Quyết định cuối cùng)`,
        data: {
          appealId,
          decision,
          pendingRemaining: remainingCount,
          sheetTransitioned,
        },
      };
    }

    throw new ForbiddenException('Không xác định được quyền xử lý');
  }

  // =============================================
  // 4. RESOLVE TẤT CẢ APPEALS TRÊN 1 PHIẾU — QUY TRÌNH 2 CẤP
  //    DEPARTMENT → chuyển tất cả PENDING → DEPT_REVIEWED (đề xuất từ chối)
  //    SCHOOL_ADMIN → chốt tất cả PENDING/DEPT_REVIEWED → REJECTED
  // =============================================
  async resolveAllAppeals(sheetId: string, resolverId: string, defaultResolution?: string) {
    // 4a. Kiểm tra quyền
    const resolver = await prisma.users.findUnique({
      where: { id: resolverId },
      include: { user_roles: { include: { roles: true } } },
    });

    const isDept = resolver?.user_roles.some(ur => ur.roles.code === 'DEPARTMENT' && ur.is_active === 1);
    const isAdmin = resolver?.user_roles.some(ur => ur.roles.code === 'SCHOOL_ADMIN' && ur.is_active === 1);

    if (!resolver || (!isDept && !isAdmin)) {
      throw new ForbiddenException('Bạn không có quyền xử lý khiếu nại');
    }

    // 4b. Tìm phiếu
    const sheet = await prisma.scoring_sheets.findUnique({
      where: { id: sheetId },
      select: {
        id: true,
        status: true,
        semester_enrollments: { select: { user_id: true, classes: { select: { department_id: true } } } },
      },
    });

    if (!sheet) {
      throw new BadRequestException('Không tìm thấy phiếu điểm');
    }

    if (sheet.status !== 'APPEALING') {
      throw new BadRequestException('Phiếu không ở trạng thái khiếu nại (APPEALING)');
    }

    const resolveMessage = defaultResolution?.trim() || 'Đã xem xét, không điều chỉnh điểm';

    // ========== NHÁNH DEPARTMENT ==========
    if (isDept) {
      if (resolver.department_id !== sheet.semester_enrollments.classes.department_id) {
        throw new ForbiddenException('Sinh viên này không thuộc khoa của bạn');
      }

      const pendingAppeals = await prisma.appeals.findMany({
        where: { scoring_sheet_id: sheetId, status: 'PENDING' },
        select: { id: true },
      });

      if (pendingAppeals.length > 0) {
        await prisma.appeals.updateMany({
          where: { scoring_sheet_id: sheetId, status: 'PENDING' },
          data: {
            status: 'DEPT_REVIEWED',
            dept_decision: 'REJECTED',
            dept_resolution: resolveMessage,
            dept_resolved_by: resolverId,
            dept_resolved_at: new Date(),
          },
        });
      }

      // Thông báo cho Admin
      try {
        const admins = await prisma.users.findMany({ where: { user_roles: { some: { roles: { code: 'SCHOOL_ADMIN' }, is_active: 1 } } }, select: { id: true } });
        for (const admin of admins) {
          await prisma.notifications.create({
            data: {
              id: randomUUID(),
              user_id: admin.id,
              type: 'APPEAL_SUBMITTED',
              title: 'Khoa đã xem xét tất cả khiếu nại — Cần Admin phê duyệt',
              content: `Khoa đã đề xuất từ chối ${pendingAppeals.length} khiếu nại trên phiếu. Vui lòng phê duyệt cuối cùng.`,
              is_read: 0,
            },
          });
        }
      } catch (err) {
        console.warn('Lỗi khi gửi thông báo cho Admin:', err);
      }

      return {
        message: `Đã đề xuất từ chối ${pendingAppeals.length} khiếu nại. Đang chờ Admin trường phê duyệt.`,
        data: { reviewedCount: pendingAppeals.length, newStatus: 'DEPT_REVIEWED' },
      };
    }

    // ========== NHÁNH SCHOOL_ADMIN ==========
    // Admin chốt tất cả PENDING + DEPT_REVIEWED còn lại
    const unresolved = await prisma.appeals.findMany({
      where: { scoring_sheet_id: sheetId, status: { in: ['PENDING', 'DEPT_REVIEWED'] } },
      select: { id: true },
    });

    if (unresolved.length > 0) {
      await prisma.appeals.updateMany({
        where: { scoring_sheet_id: sheetId, status: { in: ['PENDING', 'DEPT_REVIEWED'] } },
        data: {
          status: 'REJECTED',
          resolved_by: resolverId,
          resolution: resolveMessage,
          resolved_at: new Date(),
        },
      });
    }

    // Tính lại tổng điểm
    const totals = await this.recalculateTotals(sheetId);

    // Chuyển trạng thái phiếu → SCHOOL_REVIEWING
    await prisma.scoring_sheets.update({
      where: { id: sheetId },
      data: {
        status: 'SCHOOL_REVIEWING',
        advisor_total: totals.advisorTotal,
        final_total: totals.advisorTotal,
        classification: this.getClassification(Number(totals.advisorTotal)) as any,
        updated_at: new Date(),
      },
    });

    // Audit log
    try {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          actor_id: resolverId,
          action: 'ADMIN_RESOLVE_ALL_APPEALS',
          entity_type: 'scoring_sheets',
          entity_id: sheetId,
          old_value: { status: 'APPEALING', unresolved_count: unresolved.length },
          new_value: { status: 'SCHOOL_REVIEWING', resolution: resolveMessage },
        },
      });
    } catch (err) {
      console.warn('Lỗi khi ghi audit log:', err);
    }

    // Notification cho sinh viên
    try {
      const studentId = sheet.semester_enrollments.user_id;
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          user_id: studentId,
          type: 'APPEAL_RESOLVED',
          title: 'Tất cả khiếu nại đã được xử lý (Admin)',
          content: `Admin trường đã xử lý tất cả khiếu nại trên phiếu (quyết định cuối cùng). Phiếu đã chuyển về trạng thái chờ duyệt.`,
          is_read: 0,
        },
      });
    } catch (err) {
      console.warn('Lỗi khi gửi thông báo:', err);
    }

    return {
      message: 'Đã xử lý tất cả khiếu nại (quyết định cuối cùng)',
      data: {
        rejectedCount: unresolved.length,
        newStatus: 'SCHOOL_REVIEWING',
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

      // ✅ FIX BUG-05: Chỉ áp trần (max_score), KHÔNG áp sàn 0 per-category
      // → Đồng bộ logic với ScoringService.calculateTotals
      studentTotal += Math.min(rawStudent, maxScore);
      classTotal += Math.min(rawClass, maxScore);
      advisorTotal += Math.min(rawAdvisor, maxScore);
    }

    // Đảm bảo tổng điểm cuối cùng không bị âm
    studentTotal = Math.max(0, studentTotal);
    classTotal = Math.max(0, classTotal);
    advisorTotal = Math.max(0, advisorTotal);

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
