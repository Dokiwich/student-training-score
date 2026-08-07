const { PrismaClient } = require('@prisma/client');
const { performance } = require('perf_hooks');

const FORBIDDEN_SQL = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE',
  'GRANT', 'REVOKE', 'MERGE', 'COPY'
];

function assertReadOnlySql(sql) {
  const normalized = sql.replace(/--.*$/gm, '').trim().toUpperCase();
  if (normalized.includes(';')) throw new Error('Multiple statements not allowed');
  if (!normalized.startsWith('SELECT') && !normalized.startsWith('SHOW') && !normalized.startsWith('EXPLAIN')) {
    throw new Error('Only SELECT, SHOW, or EXPLAIN allowed');
  }
  for (const word of FORBIDDEN_SQL) {
    if (new RegExp(`\\b${word}\\b`).test(normalized)) {
      throw new Error(`Forbidden SQL keyword: ${word}`);
    }
  }
  if (normalized.includes('FOR UPDATE') || normalized.includes('FOR SHARE')) {
    throw new Error('FOR UPDATE/SHARE not allowed');
  }
}



function calcStats(times) {
  if (times.length === 0) return { min: 0, avg: 0, p50: 0, p95: 0, max: 0 };
  times.sort((a, b) => a - b);
  const min = times[0];
  const max = times[times.length - 1];
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  return {
    min: min.toFixed(2),
    avg: avg.toFixed(2),
    p50: p50.toFixed(2),
    p95: p95.toFixed(2),
    max: max.toFixed(2)
  };
}

async function runBenchmark() {
  const args = process.argv.slice(2);
  let runs = 10;
  let warmup = 2;
  let explain = false;

  for (const arg of args) {
    if (arg.startsWith('--runs=')) runs = parseInt(arg.split('=')[1]);
    if (arg.startsWith('--warmup=')) warmup = parseInt(arg.split('=')[1]);
  }

  runs = Math.max(3, Math.min(30, runs));
  warmup = Math.max(0, Math.min(5, warmup));

  console.log(`Starting benchmark with ${runs} runs, ${warmup} warmup...`);

  const connectStart = performance.now();
  const prisma = new PrismaClient();
  await prisma.$connect();
  const connectMs = performance.now() - connectStart;
  console.log(`connectMs: ${connectMs.toFixed(2)}ms`);

  const firstQueryStart = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  const firstQueryMs = performance.now() - firstQueryStart;
  console.log(`firstQueryMs: ${firstQueryMs.toFixed(2)}ms`);

  const warmSelects = [];
  for (let i = 0; i < runs + warmup; i++) {
    const s = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    const e = performance.now();
    if (i >= warmup) warmSelects.push(e - s);
  }
  const warmStats = calcStats(warmSelects);
  console.log(`warmSelect P50: ${warmStats.p50}ms, P95: ${warmStats.p95}ms`);

  const results = {};

  try {
    await prisma.$transaction(async (tx) => {
      // 1. MUST BE FIRST
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;

      // 2. VERIFY READ ONLY
      const txMode = await tx.$queryRaw`SHOW transaction_read_only`;
      if (txMode[0].transaction_read_only !== 'on') {
        throw new Error('Transaction is not read-only!');
      }
      console.log('Verified: transaction_read_only = on');

      // 3. Find Samples (READ ONLY)
      const semester = await tx.semesters.findFirst({
        where: { is_active: 1 },
        orderBy: { created_at: 'desc' },
      });
      const sheet = await tx.scoring_sheets.findFirst({
        where: {
          score_details: { some: {} }
        },
        include: {
          semester_enrollments: true
        }
      });

      if (!semester || !sheet) {
        console.log('Missing valid sample data (semester or sheet with details). Skipping remaining tests.');
        return;
      }
      console.log('sampleFound: true');

      const studentId = sheet.semester_enrollments.user_id;
      const sheetId = sheet.id;
      const semesterId = semester.id;

      const user = await tx.users.findUnique({ where: { id: studentId } });
      const loginIdentifier = (user && user.student_id) ? user.student_id : (user ? user.email : 'unknown');

      // --- Benchmarks ---

      const runBench = async (name, fn) => {
        for (let i = 0; i < warmup; i++) await fn();
        const times = [];
        for (let i = 0; i < runs; i++) {
          const s = performance.now();
          await fn();
          times.push(performance.now() - s);
        }
        results[name] = calcStats(times);
      };

      // 1. authLookup
      await runBench('authLookup', async () => {
        await tx.users.findFirst({
          where: {
            OR: [
              { student_id: loginIdentifier },
              { email: loginIdentifier }
            ]
          }
        });
      });

      // 2. activeSemester
      await runBench('activeSemester', async () => {
        await tx.semesters.findFirst({
          where: { is_active: 1 },
          orderBy: { created_at: 'desc' }
        });
      });

      // 3. scoringSheetLookup
      await runBench('scoringSheetLookup', async () => {
        await tx.scoring_sheets.findFirst({
          where: {
            semester_enrollments: {
              user_id: studentId,
              semester_id: semesterId
            }
          },
          include: {
            semester_enrollments: { include: { classes: true, semesters: true, users: true } },
          }
        });
      });

      // 4. scoreDetailsWithRelations
      await runBench('scoreDetailsWithRelations', async () => {
        await tx.score_details.findMany({
          where: { scoring_sheet_id: sheetId },
          include: {
            criteria: true,
            score_entries: true
          }
        });
      });

      // 5. scoreEntriesSeparate
      const details = await tx.score_details.findMany({ where: { scoring_sheet_id: sheetId } });
      const detailIds = details.map(d => d.id);
      
      const entries = await tx.score_entries.findMany({ where: { score_detail_id: { in: detailIds } } });
      const entryIds = entries.map(e => e.id);

      await runBench('scoreEntriesSeparate', async () => {
        await tx.score_entries.findMany({
          where: { score_detail_id: { in: detailIds } }
        });
      });

      // 6. logsGroupedWallTime
      await runBench('logsGroupedWallTime', async () => {
        await Promise.all([
          tx.audit_logs.findMany({
            where: {
              OR: [
                { entity_type: 'scoring_sheets', entity_id: sheetId },
                { entity_type: 'score_details', entity_id: { in: detailIds } },
                { entity_type: 'score_entries', entity_id: { in: entryIds } },
              ]
            },
            include: { users: { select: { full_name: true } } },
            orderBy: { created_at: 'asc' },
          }),
          tx.score_adjustment_logs.findMany({
            where: { score_detail_id: { in: detailIds } },
            include: { users: { select: { full_name: true } }, score_details: { include: { criteria: true } } },
            orderBy: { created_at: 'asc' },
          })
        ]);
      });

      // 7. criteriaParallelWallTime
      await runBench('criteriaParallelWallTime', async () => {
        await Promise.all([
          tx.criteria_categories.findMany({ select: { id: true, max_score: true } }),
          tx.criteria.findMany({ where: { is_active: 1 } })
        ]);
      });

      // 8. currentProgressReadPath
      await runBench('currentProgressReadPath', async () => {
        // Mock getScoringProgress read path without service logic
        
        // progress -> form
        const form = await tx.scoring_sheets.findFirst({
          where: {
            semester_enrollments: {
              user_id: studentId,
              semester_id: semesterId
            }
          },
          include: {
            semester_enrollments: { include: { classes: true, semesters: true, users: true } },
          }
        });

        // history -> sheet again
        const form2 = await tx.scoring_sheets.findUnique({
          where: { id: sheetId },
          include: { semester_enrollments: true },
        });

        // history -> details
        const scoreDetails1 = await tx.score_details.findMany({
          where: { scoring_sheet_id: sheetId },
          include: { criteria: true },
        });

        // history -> entries
        await tx.score_entries.findMany({
          where: { score_detail_id: { in: detailIds } },
        });

        // history -> logs
        await Promise.all([
          tx.audit_logs.findMany({
            where: {
              OR: [
                { entity_type: 'scoring_sheets', entity_id: sheetId },
                { entity_type: 'score_details', entity_id: { in: detailIds } },
                { entity_type: 'score_entries', entity_id: { in: entryIds } },
              ]
            }
          }),
          tx.score_adjustment_logs.findMany({
            where: { score_detail_id: { in: detailIds } }
          })
        ]);

        // progress -> details with entries
        await tx.score_details.findMany({
          where: { scoring_sheet_id: sheetId },
          include: { score_entries: true }
        });

        // progress -> criteria
        await Promise.all([
          tx.criteria_categories.findMany({ select: { id: true, max_score: true } }),
          tx.criteria.findMany({ where: { is_active: 1 } })
        ]);
      });

      // 9. optimizedProgressReadPath (to be filled during P2)
      if (process.env.RUN_OPTIMIZED === '1') {
        await runBench('optimizedProgressReadPath', async () => {
          const form = await tx.scoring_sheets.findFirst({
            where: {
              semester_enrollments: {
                user_id: studentId,
                semester_id: semesterId
              }
            },
            include: {
              semester_enrollments: { include: { classes: true, semesters: true, users: true } },
            }
          });

          const scoreDetails = await tx.score_details.findMany({
            where: { scoring_sheet_id: sheetId },
            include: { criteria: true, score_entries: true },
          });

          await Promise.all([
            tx.criteria_categories.findMany({ select: { id: true, max_score: true } }),
            tx.criteria.findMany({ where: { is_active: 1 } })
          ]);

          await Promise.all([
            tx.audit_logs.findMany({
              where: {
                OR: [
                  { entity_type: 'scoring_sheets', entity_id: sheetId },
                  { entity_type: 'score_details', entity_id: { in: detailIds } },
                  { entity_type: 'score_entries', entity_id: { in: entryIds } },
                ]
              }
            }),
            tx.score_adjustment_logs.findMany({
              where: { score_detail_id: { in: detailIds } }
            })
          ]);
        });
      }



    }, { maxWait: 15000, timeout: 300000 });
    
  } catch (e) {
    console.error('Benchmark error:', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }

  if (Object.keys(results).length > 0) {
    console.log('\nBenchmark                      Runs   Avg   P50   P95   Max');
    console.log('------------------------------------------------------------');
    for (const [key, stats] of Object.entries(results)) {
      console.log(`${key.padEnd(30)} ${String(runs).padEnd(6)} ${stats.avg.padEnd(5)} ${stats.p50.padEnd(5)} ${stats.p95.padEnd(5)} ${stats.max}`);
    }
  }
}

runBenchmark();
