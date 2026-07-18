import test from 'node:test';
import assert from 'node:assert';
import { computeStatus } from './semester';

test('computeStatus should return STUDENT_SCORING when now is between start and student_deadline', () => {
  const now = new Date();
  const start = new Date(now.getTime() - 1000 * 60 * 60 * 24); // 1 day ago
  const student = new Date(now.getTime() + 1000 * 60 * 60 * 24); // 1 day from now
  const committee = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 2);
  const advisor = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3);
  const school = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 4);
  const end = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 5);

  const status = computeStatus({
    start_date: start,
    student_deadline: student,
    class_committee_deadline: committee,
    advisor_deadline: advisor,
    school_deadline: school,
    end_date: end,
  });

  assert.strictEqual(status, 'STUDENT_SCORING');
});

test('computeStatus should return UPCOMING before start_date', () => {
  const now = new Date();
  const start = new Date(now.getTime() + 1000 * 60 * 60 * 24);
  
  const status = computeStatus({
    start_date: start,
    student_deadline: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 2),
    class_committee_deadline: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3),
    advisor_deadline: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 4),
    school_deadline: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 5),
    end_date: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 6),
  });

  assert.strictEqual(status, 'UPCOMING');
});

test('computeStatus should return LOCKED after end_date', () => {
  const now = new Date();
  const start = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 6);
  const student = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5);
  const committee = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 4);
  const advisor = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3);
  const school = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2);
  const end = new Date(now.getTime() - 1000 * 60 * 60 * 24);

  const status = computeStatus({
    start_date: start,
    student_deadline: student,
    class_committee_deadline: committee,
    advisor_deadline: advisor,
    school_deadline: school,
    end_date: end,
  });

  assert.strictEqual(status, 'LOCKED');
});
import { formatDashboardDeadlineInfo } from './semester';

test('formatDashboardDeadlineInfo should return the correct deadline from the active semester', () => {
  const info = formatDashboardDeadlineInfo({
    id: 'sem_2',
    name: 'Học kỳ 2',
    academic_year: '2025-2026',
    status: 'CLASS_REVIEWING',
    student_deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
  });

  assert.strictEqual(info.semester?.id, 'sem_2');
  assert.strictEqual(info.isOverdue, false);
});

test('formatDashboardDeadlineInfo should show Đã hết hạn if deadline passed', () => {
  const info = formatDashboardDeadlineInfo({
    id: 'sem_2',
    name: 'Học kỳ 2',
    academic_year: '2025-2026',
    status: 'CLASS_REVIEWING',
    student_deadline: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
  });

  assert.strictEqual(info.isOverdue, true);
  assert.strictEqual(info.remainingTimeText, 'Đã hết hạn');
});

test('formatDashboardDeadlineInfo should show Chưa thiết lập if deadline is null', () => {
  const info = formatDashboardDeadlineInfo({
    id: 'sem_2',
    name: 'Học kỳ 2',
    academic_year: '2025-2026',
    status: 'UPCOMING',
    student_deadline: null,
  });

  assert.strictEqual(info.studentSubmissionDeadline, null);
  assert.strictEqual(info.remainingTimeText, 'Chưa thiết lập');
});
