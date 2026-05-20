/**
 * migrate_normalize.js
 * =====================
 * Script chuẩn hóa database sang 3NF:
 * 1. Tạo semester_enrollments từ users.class_id + semesters
 * 2. Tạo score_entries từ 3 cột score cũ trong score_details
 * 3. Verify kết quả
 *
 * Chạy: node migrate_normalize.js
 * Yêu cầu: prisma generate đã chạy trước (schema mới)
 */

const { PrismaClient } = require('./src/generated/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

// =============================================
// BƯỚC 1: Tạo semester_enrollments
// =============================================
async function migrateEnrollments() {
  console.log('\n══════════════════════════════════════════');
  console.log('  BƯỚC 1: Tạo semester_enrollments');
  console.log('══════════════════════════════════════════\n');

  // Lấy tất cả users có class_id
  const usersWithClass = await prisma.users.findMany({
    where: { class_id: { not: null } },
    select: { id: true, class_id: true, full_name: true },
  });

  console.log(`Tìm thấy ${usersWithClass.length} users có class_id`);

  // Lấy tất cả semesters
  const semesters = await prisma.semesters.findMany({
    select: { id: true, code: true },
    orderBy: { created_at: 'asc' },
  });

  console.log(`Tìm thấy ${semesters.length} semesters`);

  let created = 0;
  let skipped = 0;

  for (const user of usersWithClass) {
    for (const semester of semesters) {
      try {
        // Kiểm tra enrollment đã tồn tại chưa
        const existing = await prisma.semester_enrollments.findUnique({
          where: {
            user_id_semester_id: {
              user_id: user.id,
              semester_id: semester.id,
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await prisma.semester_enrollments.create({
          data: {
            id: randomUUID(),
            user_id: user.id,
            semester_id: semester.id,
            class_id: user.class_id,
            is_active: 1,
          },
        });
        created++;
      } catch (err) {
        if (err.code === 'P2002') {
          // Unique constraint violation — already exists
          skipped++;
        } else {
          console.error(`  ✗ Lỗi khi tạo enrollment cho user ${user.full_name}:`, err.message);
        }
      }
    }
  }

  console.log(`\n✅ Tạo xong: ${created} enrollment mới, ${skipped} đã tồn tại`);
  return { created, skipped };
}

// =============================================
// BƯỚC 2: Tạo score_entries từ 3 cột cũ
// =============================================
async function migrateScoreEntries() {
  console.log('\n══════════════════════════════════════════');
  console.log('  BƯỚC 2: Tạo score_entries từ score_details');
  console.log('══════════════════════════════════════════\n');

  // Lấy tất cả score_details có ít nhất 1 điểm
  const details = await prisma.score_details.findMany({
    where: {
      OR: [
        { student_score: { not: null } },
        { class_score: { not: null } },
        { advisor_score: { not: null } },
      ],
    },
    select: {
      id: true,
      student_score: true,
      class_score: true,
      advisor_score: true,
    },
  });

  console.log(`Tìm thấy ${details.length} score_details có điểm`);

  let created = 0;
  let skipped = 0;

  // Chuẩn bị batch data
  const entriesToCreate = [];

  for (const detail of details) {
    const roles = [
      { role: 'STUDENT', score: detail.student_score },
      { role: 'CLASS_COMMITTEE', score: detail.class_score },
      { role: 'ADVISOR', score: detail.advisor_score },
    ];

    for (const { role, score } of roles) {
      if (score === null || score === undefined) continue;

      entriesToCreate.push({
        id: randomUUID(),
        score_detail_id: detail.id,
        scorer_role: role,
        score: Number(score),
      });
    }
  }

  console.log(`Cần tạo ${entriesToCreate.length} score_entries`);

  // Batch insert (50 records per batch)
  const BATCH_SIZE = 50;
  for (let i = 0; i < entriesToCreate.length; i += BATCH_SIZE) {
    const batch = entriesToCreate.slice(i, i + BATCH_SIZE);
    try {
      const result = await prisma.score_entries.createMany({
        data: batch,
        skipDuplicates: true,
      });
      created += result.count;
      skipped += batch.length - result.count;
    } catch (err) {
      console.error(`  ✗ Lỗi batch ${Math.floor(i / BATCH_SIZE) + 1}:`, err.message);
      // Fallback: insert từng record
      for (const entry of batch) {
        try {
          await prisma.score_entries.create({ data: entry });
          created++;
        } catch (innerErr) {
          if (innerErr.code === 'P2002') {
            skipped++;
          } else {
            console.error(`    ✗ Lỗi insert entry:`, innerErr.message);
          }
        }
      }
    }
  }

  console.log(`\n✅ Tạo xong: ${created} score_entries mới, ${skipped} đã tồn tại`);
  return { created, skipped };
}

// =============================================
// BƯỚC 3: Verify kết quả
// =============================================
async function verifyMigration() {
  console.log('\n══════════════════════════════════════════');
  console.log('  BƯỚC 3: Kiểm tra kết quả migration');
  console.log('══════════════════════════════════════════\n');

  // 3a. Kiểm tra semester_enrollments
  const enrollmentCount = await prisma.semester_enrollments.count();
  const usersWithClass = await prisma.users.count({ where: { class_id: { not: null } } });
  const semesterCount = await prisma.semesters.count();
  const expectedEnrollments = usersWithClass * semesterCount;

  console.log(`semester_enrollments:`);
  console.log(`  Tổng records: ${enrollmentCount}`);
  console.log(`  Kỳ vọng tối đa: ${expectedEnrollments} (${usersWithClass} users × ${semesterCount} semesters)`);
  console.log(`  ${enrollmentCount >= usersWithClass ? '✅ OK' : '⚠️ Thiếu enrollment'}`);

  // 3b. Kiểm tra score_entries
  const entryCount = await prisma.score_entries.count();
  const detailsWithScore = await prisma.score_details.count({
    where: {
      OR: [
        { student_score: { not: null } },
        { class_score: { not: null } },
        { advisor_score: { not: null } },
      ],
    },
  });

  console.log(`\nscore_entries:`);
  console.log(`  Tổng records: ${entryCount}`);
  console.log(`  score_details có điểm: ${detailsWithScore}`);
  console.log(`  Tỷ lệ: ${detailsWithScore > 0 ? (entryCount / detailsWithScore).toFixed(1) : 'N/A'} entries/detail (kỳ vọng 1.0-3.0)`);

  // 3c. So sánh tổng điểm mẫu (lấy 5 phiếu đầu)
  console.log(`\nSo sánh tổng điểm (5 phiếu đầu tiên):`);
  const sheets = await prisma.scoring_sheets.findMany({
    take: 5,
    select: {
      id: true,
      student_total: true,
      class_total: true,
      advisor_total: true,
    },
  });

  for (const sheet of sheets) {
    // Tính từ cột cũ
    const oldDetails = await prisma.score_details.findMany({
      where: { scoring_sheet_id: sheet.id },
      select: { student_score: true, class_score: true, advisor_score: true },
    });

    const oldStudentTotal = oldDetails.reduce((s, d) => s + Number(d.student_score ?? 0), 0);
    const oldClassTotal = oldDetails.reduce((s, d) => s + Number(d.class_score ?? 0), 0);
    const oldAdvisorTotal = oldDetails.reduce((s, d) => s + Number(d.advisor_score ?? 0), 0);

    // Tính từ score_entries mới
    const allDetailIds = await prisma.score_details.findMany({
      where: { scoring_sheet_id: sheet.id },
      select: { id: true },
    });
    const detailIds = allDetailIds.map(d => d.id);

    const entries = await prisma.score_entries.findMany({
      where: { score_detail_id: { in: detailIds } },
      select: { scorer_role: true, score: true },
    });

    const newStudentTotal = entries
      .filter(e => e.scorer_role === 'STUDENT')
      .reduce((s, e) => s + Number(e.score), 0);
    const newClassTotal = entries
      .filter(e => e.scorer_role === 'CLASS_COMMITTEE')
      .reduce((s, e) => s + Number(e.score), 0);
    const newAdvisorTotal = entries
      .filter(e => e.scorer_role === 'ADVISOR')
      .reduce((s, e) => s + Number(e.score), 0);

    const match =
      oldStudentTotal === newStudentTotal &&
      oldClassTotal === newClassTotal &&
      oldAdvisorTotal === newAdvisorTotal;

    console.log(`  Phiếu ${sheet.id.substring(0, 12)}...:`);
    console.log(`    Cũ: SV=${oldStudentTotal} BCS=${oldClassTotal} CVHT=${oldAdvisorTotal}`);
    console.log(`    Mới: SV=${newStudentTotal} BCS=${newClassTotal} CVHT=${newAdvisorTotal}`);
    console.log(`    ${match ? '✅ Khớp' : '❌ KHÔNG KHỚP!'}`);
  }

  return { enrollmentCount, entryCount };
}

// =============================================
// MAIN
// =============================================
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  MIGRATION: Chuẩn hóa Database 3NF      ║');
  console.log('║  semester_enrollments + score_entries     ║');
  console.log('╚══════════════════════════════════════════╝');

  try {
    const enrollResult = await migrateEnrollments();
    const entryResult = await migrateScoreEntries();
    const verifyResult = await verifyMigration();

    console.log('\n══════════════════════════════════════════');
    console.log('  KẾT QUẢ TỔNG HỢP');
    console.log('══════════════════════════════════════════');
    console.log(`  semester_enrollments: ${enrollResult.created} mới`);
    console.log(`  score_entries:        ${entryResult.created} mới`);
    console.log(`  Tổng records:         ${verifyResult.enrollmentCount} enrollments, ${verifyResult.entryCount} entries`);
    console.log('\n🎉 Migration hoàn tất!');
  } catch (err) {
    console.error('\n❌ Migration thất bại:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
