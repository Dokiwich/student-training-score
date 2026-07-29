import test from 'node:test';
import assert from 'node:assert';
import { matchesTab, getEmptyStateMessage } from '../ScoringDashboard';

test('matchesTab - CVHT role: STUDENT_SUBMITTED should NOT be in unscored (Cần chấm)', () => {
  const student = { status: 'STUDENT_SUBMITTED' };
  assert.strictEqual(matchesTab(student, 'unscored', 'ADVISOR'), false);
  assert.strictEqual(matchesTab(student, 'scored', 'ADVISOR'), false);
  assert.strictEqual(matchesTab(student, 'pending', 'ADVISOR'), false);
  assert.strictEqual(matchesTab(student, 'all', 'ADVISOR'), true);
});

test('matchesTab - CVHT role: CLASS_REVIEWED & ADVISOR_REVIEWING belong to unscored (Cần chấm)', () => {
  assert.strictEqual(matchesTab({ status: 'CLASS_REVIEWED' }, 'unscored', 'ADVISOR'), true);
  assert.strictEqual(matchesTab({ status: 'ADVISOR_REVIEWING' }, 'unscored', 'ADVISOR'), true);
  assert.strictEqual(matchesTab({ status: 'ADVISOR_APPROVED' }, 'unscored', 'ADVISOR'), false);
});

test('matchesTab - CVHT role: ADVISOR_APPROVED, ADVISOR_REJECTED, SCHOOL_REJECTED & FINALIZED belong to scored (Đã chấm)', () => {
  assert.strictEqual(matchesTab({ status: 'ADVISOR_APPROVED' }, 'scored', 'ADVISOR'), true);
  assert.strictEqual(matchesTab({ status: 'ADVISOR_REJECTED' }, 'scored', 'ADVISOR'), true);
  assert.strictEqual(matchesTab({ status: 'SCHOOL_REVIEWING' }, 'scored', 'ADVISOR'), true);
  assert.strictEqual(matchesTab({ status: 'SCHOOL_APPROVED' }, 'scored', 'ADVISOR'), true);
  assert.strictEqual(matchesTab({ status: 'SCHOOL_REJECTED' }, 'scored', 'ADVISOR'), true);
  assert.strictEqual(matchesTab({ status: 'FINALIZED' }, 'scored', 'ADVISOR'), true);
});

test('matchesTab - BCS role: CLASS_REJECTED, ADVISOR_REJECTED, SCHOOL_REJECTED belong to scored (Đã chấm)', () => {
  assert.strictEqual(matchesTab({ status: 'CLASS_REJECTED' }, 'scored', 'CLASS_COMMITTEE'), true);
  assert.strictEqual(matchesTab({ status: 'ADVISOR_REJECTED' }, 'scored', 'CLASS_COMMITTEE'), true);
  assert.strictEqual(matchesTab({ status: 'SCHOOL_REJECTED' }, 'scored', 'CLASS_COMMITTEE'), true);
});

test('matchesTab - BCS role: STUDENT_SUBMITTED & CLASS_REVIEWING belong to unscored (Cần chấm)', () => {
  assert.strictEqual(matchesTab({ status: 'STUDENT_SUBMITTED' }, 'unscored', 'CLASS_COMMITTEE'), true);
  assert.strictEqual(matchesTab({ status: 'CLASS_REVIEWING' }, 'unscored', 'CLASS_COMMITTEE'), true);
});

test('matchesTab - UNSUBMITTED / Pending tab (NO_SHEET & DRAFT)', () => {
  assert.strictEqual(matchesTab({ status: 'NO_SHEET' }, 'pending', 'ADVISOR'), true);
  assert.strictEqual(matchesTab({ status: 'DRAFT' }, 'pending', 'ADVISOR'), true);
  assert.strictEqual(matchesTab({ status: 'STUDENT_SUBMITTED' }, 'pending', 'ADVISOR'), false);
});

test('Count matching list length when search is empty', () => {
  const students = [
    { status: 'STUDENT_SUBMITTED' },
    { status: 'STUDENT_SUBMITTED' },
    { status: 'CLASS_REVIEWED' },
    { status: 'ADVISOR_APPROVED' },
    { status: 'DRAFT' },
  ];

  // ADVISOR "Cần chấm" count & list
  const advisorUnscoredList = students.filter(s => matchesTab(s, 'unscored', 'ADVISOR'));
  assert.strictEqual(advisorUnscoredList.length, 1);
  assert.strictEqual(advisorUnscoredList[0].status, 'CLASS_REVIEWED');

  // ADVISOR "Đã chấm" count & list
  const advisorScoredList = students.filter(s => matchesTab(s, 'scored', 'ADVISOR'));
  assert.strictEqual(advisorScoredList.length, 1);
  assert.strictEqual(advisorScoredList[0].status, 'ADVISOR_APPROVED');
});

test('getEmptyStateMessage - returns search message if search term has non-whitespace characters', () => {
  const msg = getEmptyStateMessage({ role: 'ADVISOR', activeTab: 'unscored', searchTerm: '  test  ' });
  assert.strictEqual(msg.title, 'Không tìm thấy sinh viên');
  assert.strictEqual(msg.description, 'Không có sinh viên nào khớp với từ khóa tìm kiếm.');
});

test('getEmptyStateMessage - returns context-specific tab messages when search is empty or whitespace', () => {
  const advisorUnscored = getEmptyStateMessage({ role: 'ADVISOR', activeTab: 'unscored', searchTerm: '   ' });
  assert.strictEqual(advisorUnscored.description, 'Hiện không có phiếu nào đang chờ Cố vấn học tập đánh giá.');

  const advisorScored = getEmptyStateMessage({ role: 'ADVISOR', activeTab: 'scored', searchTerm: '' });
  assert.strictEqual(advisorScored.description, 'Chưa có phiếu nào được Cố vấn học tập đánh giá.');

  const bcsUnscored = getEmptyStateMessage({ role: 'CLASS_COMMITTEE', activeTab: 'unscored', searchTerm: '' });
  assert.strictEqual(bcsUnscored.description, 'Hiện không có phiếu nào đang chờ Ban cán sự đánh giá.');

  const pendingMsg = getEmptyStateMessage({ role: 'ADVISOR', activeTab: 'pending', searchTerm: '' });
  assert.strictEqual(pendingMsg.description, 'Tất cả sinh viên đã có phiếu rèn luyện.');

  const allMsg = getEmptyStateMessage({ role: 'ADVISOR', activeTab: 'all', searchTerm: '' });
  assert.strictEqual(allMsg.description, 'Chưa có sinh viên trong danh sách.');
});
