'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';

const API_BASE = '/proxy-api';

const FIXED_CODES = ['1.1.1', '2.1', '4.1', '3.1.1', '2.2'];

const TAB_GROUPS = [
  { id: '1', short: 'Ý thức học tập', title: 'Đánh giá về ý thức tham gia học tập', max: 20 },
  { id: '2', short: 'Nội quy, Quy chế', title: 'Đánh giá về ý thức chấp hành Nội quy, Quy chế, Quy định trong Nhà trường', max: 20 },
  { id: '3', short: 'Hoạt động XH, VH, TT', title: 'Đánh giá về ý thức tham gia các hoạt động chính trị, xã hội, văn hóa, văn nghệ, thể thao, phòng chống tội phạm và các tệ nạn xã hội', max: 15 },
  { id: '4', short: 'Quan hệ cộng đồng', title: 'Đánh giá về ý thức công dân trong quan hệ cộng đồng', max: 20 },
  { id: '5', short: 'Cán bộ lớp, Thành tích', title: 'Đánh giá về ý thức và kết quả tham gia công tác cán bộ lớp, các đoàn thể, tổ chức khác trong Nhà trường hoặc sinh viên đạt được thành tích đặc biệt trong học tập, rèn luyện', max: 15 },
  { id: '6', short: 'Thành tích xuất sắc', title: 'Cộng thêm điểm rèn luyện cho thành tích xuất sắc', max: 10 },
];

const ROLE_CONFIG = {
  STUDENT: { label: 'Sinh viên', colHeader: 'Sinh viên tự Chấm' },
  CLASS_COMMITTEE: { label: 'Ban cán sự', colHeader: 'Ban cán sự Lớp' },
  ADVISOR: { label: 'Cố vấn', colHeader: 'Cố vấn Học tập' },
} as const;

type Role = keyof typeof ROLE_CONFIG;
const ALL_ROLES: Role[] = ['STUDENT', 'CLASS_COMMITTEE', 'ADVISOR'];

interface Criterion {
  id: number;
  code: string;
  content: string;
  max_points: number;
  score_type: string;
  parent_id: number | null;
  description?: string;
}

interface ScoreDetail {
  criteria_id: number;
  proof_url?: string | null;
  score_entries?: Array<{ scorer_role: string; score: number }>;
}

interface ToastMessage {
  id: number;
  type: 'success' | 'error';
  text: string;
}

/* ─── Toast ─── */
function Toast({
  message,
  onDismiss,
}: {
  message: ToastMessage;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(message.id), 3500);
    return () => clearTimeout(timer);
  }, [message.id, onDismiss]);

  return (
    <div className={`px-4 py-3 text-xs font-medium border rounded-xl shadow-lg ${message.type === 'success' ? 'bg-stone-50 border-stone-300 text-red-900' : 'bg-stone-50 border-stone-300 text-red-900'}`}>
      <span className="font-semibold">{message.type === 'success' ? 'Thành công:' : 'Lỗi:'}</span>{' '}
      {message.text}
    </div>
  );
}

/* ─── Main Component ─── */
interface ScoringFormProps {
  forcedRole?: Role;
  studentId?: string;
  studentName?: string;
  classNameStr?: string;
  formId?: string;
  viewMode?: 'edit' | 'history';
  stickyTop?: string;
  requiredStatuses?: string[];
  semesterId?: string;
  allowResetAnytime?: boolean;
}

export function ScoringForm({
  forcedRole,
  studentId,
  studentName,
  classNameStr,
  formId = 'PHIẾU_01',
  viewMode = 'edit',
  stickyTop = 'top-0',
  requiredStatuses,
  semesterId,
  allowResetAnytime,
}: ScoringFormProps) {
  const { data: session } = useSession();

  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [savedStudentScores, setSavedStudentScores] = useState<Record<number, number>>({});
  const [savedClassScores, setSavedClassScores] = useState<Record<number, number>>({});
  const [savedAdvisorScores, setSavedAdvisorScores] = useState<Record<number, number>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [evidenceValues, setEvidenceValues] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Accordion State for Tabs (Default expand Tab 1)
  const [expandedTabs, setExpandedTabs] = useState<Set<string>>(new Set(['1']));

  const [currentRole] = useState<Role>(forcedRole || 'STUDENT');
  const [formStatus, setFormStatus] = useState<string>('DRAFT');
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rejectionInfo, setRejectionInfo] = useState<string | null>(null);

  const visibleRoles: Role[] =
    currentRole === 'STUDENT' && viewMode === 'edit' ? ['STUDENT'] : ALL_ROLES;
  const canEdit = viewMode !== 'history';

  const prevRoleRef = useRef<Role>(currentRole);
  const didInitRef = useRef(false);

  const addToast = useCallback((type: 'success' | 'error', text: string) => {
    setToasts((prev) => [...prev, { id: Date.now(), type, text }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getSavedMap = useCallback(
    (role: Role): Record<number, number> => {
      if (role === 'STUDENT') return savedStudentScores;
      if (role === 'CLASS_COMMITTEE') return savedClassScores;
      return savedAdvisorScores;
    },
    [savedStudentScores, savedClassScores, savedAdvisorScores],
  );

  const fetchData = useCallback(async () => {
    const customJwt = (session as any)?.customJwt;
    // Guard: chỉ fetch khi session đã sẵn sàng và có JWT, cùng với studentId
    if (!customJwt || !studentId || studentId === 'undefined') {
      return;
    }

    setIsLoading(true);
    setFetchError(null);
    try {
      const headersInit: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customJwt}`,
      };

      const [criteriaRes, scoresRes] = await Promise.all([
        fetch(`${API_BASE}/scoring/criteria`, {
          headers: headersInit,
          credentials: 'include',
        }),
        fetch(`${API_BASE}/scoring/${formId}/scores?studentId=${studentId}${semesterId ? `&semesterId=${semesterId}` : ''}`, {
          headers: headersInit,
          credentials: 'include',
        }),
      ]);

      if (criteriaRes.ok) {
        const data = await criteriaRes.json();
        const rootItems = (data.data || [])
          .filter((c: Criterion) => c.parent_id === null || c.parent_id === 0)
          .map((c: Criterion) => c.id);
        setCriteria(data.data || []);
        setExpandedIds(new Set(rootItems));
      } else {
        if (criteriaRes.status === 401) {
          addToast('error', 'Phiên đăng nhập hết hạn. Đang tải lại...');
          setTimeout(() => { signOut({ callbackUrl: '/login' }); }, 1500);
          return;
        }
        const text = await criteriaRes.text();
        setFetchError(`Không thể tải tiêu chí: ${criteriaRes.status} ${text}`);
      }

      if (scoresRes.ok) {
        const scoresData = await scoresRes.json();
        const sMap: Record<number, number> = {};
        const cMap: Record<number, number> = {};
        const aMap: Record<number, number> = {};
        const evidenceMap: Record<number, string> = {};

        scoresData.data.forEach((s: ScoreDetail) => {
          // Chỉ đọc từ score_entries
          const entries = s.score_entries || [];
          const sEntry = entries.find(e => e.scorer_role === 'STUDENT');
          const cEntry = entries.find(e => e.scorer_role === 'CLASS_COMMITTEE');
          const aEntry = entries.find(e => e.scorer_role === 'ADVISOR');

          const studentVal = sEntry ? sEntry.score : null;
          const classVal = cEntry ? cEntry.score : null;
          const advisorVal = aEntry ? aEntry.score : null;

          if (studentVal !== null && studentVal !== undefined) sMap[s.criteria_id] = Number(studentVal);

          if (classVal !== null && classVal !== undefined) cMap[s.criteria_id] = Number(classVal);
          else if (studentVal !== null && studentVal !== undefined) cMap[s.criteria_id] = Number(studentVal);

          if (advisorVal !== null && advisorVal !== undefined) aMap[s.criteria_id] = Number(advisorVal);
          else if (classVal !== null && classVal !== undefined) aMap[s.criteria_id] = Number(classVal);
          else if (studentVal !== null && studentVal !== undefined) aMap[s.criteria_id] = Number(studentVal);

          // ✅ Extract proof_url (minh chứng) từ API response
          if (s.proof_url) {
            evidenceMap[s.criteria_id] = s.proof_url;
          }
        });
        setSavedStudentScores(sMap);
        setSavedClassScores(cMap);
        setSavedAdvisorScores(aMap);
        setEvidenceValues(evidenceMap);

        // ✅ Cập nhật formStatus từ API response (dùng formStatusDetail — trạng thái chi tiết)
        if (scoresData.formStatusDetail) {
          setFormStatus(scoresData.formStatusDetail);
        } else if (scoresData.formStatus) {
          setFormStatus(scoresData.formStatus);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [formId, studentId, session]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isLoading) return;
    const shouldSync = !didInitRef.current || prevRoleRef.current !== currentRole;
    if (shouldSync) {
      const sourceMap = getSavedMap(currentRole);
      const newInputs: Record<number, string> = {};
      Object.entries(sourceMap).forEach(([k, v]) => {
        newInputs[parseInt(k)] = v.toString();
      });
      setInputValues(newInputs);
      didInitRef.current = true;
      prevRoleRef.current = currentRole;
    }
  }, [currentRole, isLoading, getSavedMap]);

  const sortedCriteria = useMemo(() => {
    if (!criteria.length) return [];
    const childrenMap = new Map<number | null, Criterion[]>();
    const criteriaIds = new Set(criteria.map((c) => c.id));
    criteria.forEach((c) => {
      const isRoot = c.parent_id === null || !criteriaIds.has(c.parent_id);
      const pid = isRoot ? null : c.parent_id;
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(c);
    });
    childrenMap.forEach((list) =>
      list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    );
    const result: Criterion[] = [];
    const traverse = (parentId: number | null) => {
      (childrenMap.get(parentId) || []).forEach((child) => {
        result.push(child);
        traverse(child.id);
      });
    };
    traverse(null);
    return result;
  }, [criteria]);

  const parentIds = useMemo(() => {
    const ids = new Set<number>();
    criteria.forEach((c) => {
      if (c.parent_id !== null) ids.add(c.parent_id);
    });
    return ids;
  }, [criteria]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTab = (tabId: string) => {
    setExpandedTabs((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) next.delete(tabId);
      else next.add(tabId);
      return next;
    });
  };

  const expandAll = () => {
    const allParents = new Set<number>();
    criteria.forEach((c) => {
      if (parentIds.has(c.id)) allParents.add(c.id);
    });
    setExpandedIds(allParents);
  };

  const collapseAll = () => setExpandedIds(new Set());

  const isVisible = useCallback(
    (itemId: number): boolean => {
      const item = criteria.find((c) => c.id === itemId);
      if (!item) return false;
      if (item.parent_id === null || item.parent_id === 0) return true;
      if (!expandedIds.has(item.parent_id)) return false;
      return isVisible(item.parent_id);
    },
    [criteria, expandedIds],
  );

  const depthMap = useMemo(() => {
    const map = new Map<number, number>();
    const getDepth = (item: Criterion): number => {
      if (map.has(item.id)) return map.get(item.id)!;
      if (item.parent_id === null || item.parent_id === 0) {
        map.set(item.id, 0);
        return 0;
      }
      const parent = criteria.find((c) => c.id === item.parent_id);
      const depth = parent ? getDepth(parent) + 1 : 0;
      map.set(item.id, depth);
      return depth;
    };
    criteria.forEach((c) => getDepth(c));
    return map;
  }, [criteria]);

  const getRoot = useCallback(
    (itemId: number): Criterion | null => {
      const item = criteria.find((c) => c.id === itemId);
      if (!item) return null;
      if (item.parent_id === null || item.parent_id === 0) return item;
      return getRoot(item.parent_id);
    },
    [criteria],
  );

  const calculateScoreFromMap = useCallback(
    (itemId: number, scoreMap: Record<number, number>, visited = new Set<number>()): number => {
      if (visited.has(itemId)) return 0;
      visited.add(itemId);
      const item = criteria.find((c) => c.id === itemId);
      if (!item) return 0;
      if (FIXED_CODES.includes(item.code)) return item.max_points;
      const children = criteria.filter((c) => c.parent_id === itemId);
      if (children.length > 0) {
        const sum = children.reduce(
          (acc, child) => acc + calculateScoreFromMap(child.id, scoreMap, visited),
          0,
        );
        if (item.max_points > 0) return Math.max(0, Math.min(sum, item.max_points));
        if (item.max_points < 0) return Math.min(0, Math.max(sum, item.max_points));
        return sum;
      }
      return scoreMap[itemId] ?? 0;
    },
    [criteria],
  );

  const calculateAutoScore = useCallback(
    (itemId: number, visited = new Set<number>()): number => {
      if (visited.has(itemId)) return 0;
      visited.add(itemId);
      const item = criteria.find((c) => c.id === itemId);
      if (!item) return 0;
      if (FIXED_CODES.includes(item.code)) return item.max_points;
      const children = criteria.filter((c) => c.parent_id === itemId);
      if (children.length > 0) {
        const sum = children.reduce(
          (acc, child) => acc + calculateAutoScore(child.id, visited),
          0,
        );
        if (item.max_points > 0) return Math.max(0, Math.min(sum, item.max_points));
        if (item.max_points < 0) return Math.min(0, Math.max(sum, item.max_points));
        return sum;
      }
      return parseFloat(inputValues[itemId]) || 0;
    },
    [criteria, inputValues],
  );

  const totalScore = useMemo(() => {
    return TAB_GROUPS.reduce((acc, tab) => {
      const tabRoots = criteria.filter(
        (c) =>
          (c.parent_id === null || c.parent_id === 0) &&
          (c.code === tab.id ||
            c.code.startsWith(tab.id + '.') ||
            c.code.startsWith('TC_0' + tab.id) ||
            c.code.startsWith('TC_' + tab.id)),
      );
      const tabSum = tabRoots.reduce((sum, root) => sum + calculateAutoScore(root.id), 0);
      const safeTabSum = Math.max(0, Math.min(tabSum, tab.max));
      return acc + safeTabSum;
    }, 0);
  }, [criteria, calculateAutoScore]);

  const handleInputChange = (criteriaId: number, value: string) => {
    let finalValue = value;
    const item = criteria.find(c => c.id === criteriaId);
    if (item && value !== '' && value !== '-') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        const isDeduction = item.score_type === 'DEDUCTION' || item.max_points < 0;
        if (isDeduction) {
          if (num > 0) finalValue = '0';
          else if (num < item.max_points) finalValue = item.max_points.toString();
        } else {
          if (num < 0) finalValue = '0';
          else if (item.max_points > 0 && num > item.max_points) finalValue = item.max_points.toString();
        }
      }
    }
    setInputValues((prev) => ({ ...prev, [criteriaId]: finalValue }));
    setIsDirty(true);
  };

  const handleSaveDraft = async () => {
    const leafItems = criteria.filter((c) => !criteria.some((x) => x.parent_id === c.id));
    if (leafItems.length === 0) return;
    setIsSavingDraft(true);
    try {
      const customJwt = (session as any)?.customJwt;
      if (!customJwt) { addToast('error', 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.'); return; }
      const headersInit: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customJwt}`,
      };

      const results: { id: number; score: number }[] = [];
      let failCount = 0;
      let lastError = '';

      const saveSingleItem = async (item: typeof leafItems[0]) => {
        let score = 0;
        if (FIXED_CODES.includes(item.code)) {
          score = item.max_points;
        } else {
          const raw = inputValues[item.id] ?? '';
          score = raw === '' ? 0 : parseFloat(raw);
        }
        if (isNaN(score)) return null;

        // Validate score against max_points before sending to API
        const isDeduction = item.score_type === 'DEDUCTION' || item.max_points < 0;
        if (isDeduction) {
          if (score < item.max_points || score > 0) return null;
        } else {
          if (score < 0) return null;
          if (item.max_points > 0 && score > item.max_points) return null;
        }

        try {
          const r = await fetch(`${API_BASE}/scoring/${formId}/submit-criteria`, {
            method: 'POST', credentials: 'include', headers: headersInit,
            body: JSON.stringify({ criteriaId: item.id, score, role: currentRole, studentId, proofUrl: evidenceValues[item.id] || undefined, isDraft: true, semesterId }),
          });
          if (r.ok) return { id: item.id, score };
          const errData = await r.json().catch(() => null);
          lastError = errData?.message || `HTTP ${r.status}`;
          failCount++;
        } catch (e) {
          console.error('Lỗi lưu điểm:', e);
          failCount++;
        }
        return null;
      };

      if (leafItems.length > 0) {
        const firstResult = await saveSingleItem(leafItems[0]);
        if (firstResult) results.push(firstResult);
      }

      const remaining = leafItems.slice(1);
      const BATCH_SIZE = 5;
      for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
        const batch = remaining.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(saveSingleItem));
        batchResults.forEach(res => { if (res) results.push(res); });
      }

      const newScores: Record<number, number> = { ...getSavedMap(currentRole) };
      results.forEach((r) => { newScores[r.id] = r.score; });
      if (currentRole === 'STUDENT') setSavedStudentScores(newScores);
      else if (currentRole === 'CLASS_COMMITTEE') setSavedClassScores(newScores);
      else setSavedAdvisorScores(newScores);
      setIsDirty(false);

      if (failCount > 0 && results.length === 0) {
        addToast('error', `Lỗi khi lưu: ${lastError}`);
      } else if (failCount > 0) {
        addToast('error', `Lưu được ${results.length} tiêu chí, ${failCount} bị lỗi: ${lastError}`);
      } else {
        addToast('success', 'Đã lưu nháp toàn bộ phiếu!');
      }
      await fetchData();
    } catch {
      addToast('error', 'Lỗi khi lưu nháp');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSaveRow = async (criteriaId: number, maxPoints: number) => {
    const raw = inputValues[criteriaId];
    const score = parseFloat(raw);
    if (isNaN(score)) return addToast('error', 'Vui lòng nhập số');
    
    const isDeduction = maxPoints < 0;
    if (isDeduction) {
      if (score < maxPoints) return addToast('error', `Điểm không được thấp hơn ${maxPoints}`);
      if (score > 0) return addToast('error', 'Điểm không được lớn hơn 0');
    } else {
      if (score < 0) return addToast('error', 'Không được âm');
      if (maxPoints > 0 && score > maxPoints) return addToast('error', `Điểm không được vượt quá ${maxPoints}`);
    }

    setSavingId(criteriaId);
    try {
      const customJwt = (session as any)?.customJwt;
      if (!customJwt) { addToast('error', 'Phiên đăng nhập không hợp lệ.'); return; }
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customJwt}`,
      };

      const response = await fetch(`${API_BASE}/scoring/${formId}/submit-criteria`, {
        method: 'POST',
        credentials: 'include',
        headers: headers,
        body: JSON.stringify({ criteriaId, score, role: currentRole, studentId, proofUrl: evidenceValues[criteriaId] || undefined, semesterId }),
      });

      if (response.ok) {
        if (currentRole === 'STUDENT') setSavedStudentScores((prev) => ({ ...prev, [criteriaId]: score }));
        if (currentRole === 'CLASS_COMMITTEE') setSavedClassScores((prev) => ({ ...prev, [criteriaId]: score }));
        if (currentRole === 'ADVISOR') setSavedAdvisorScores((prev) => ({ ...prev, [criteriaId]: score }));
        addToast('success', 'Đã lưu thành công!');
      } else {
        addToast('error', 'Lỗi khi lưu điểm');
      }
    } finally {
      setSavingId(null);
    }
  };

  const doSubmitForm = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    try {
      const currentSavedMap = getSavedMap(currentRole);
      const isCompletelyEmpty = Object.keys(currentSavedMap).length === 0;
      if (isDirty || isCompletelyEmpty) {
        await handleSaveDraft();
      }

      const customJwt = (session as any)?.customJwt;
      if (!customJwt) { addToast('error', 'Phiên đăng nhập không hợp lệ.'); setIsSubmitting(false); return; }
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customJwt}`,
      };

      const response = await fetch(`${API_BASE}/scoring/${formId}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: headers,
        body: JSON.stringify({ role: currentRole, studentId, semesterId }),
      });

      if (response.ok) {
        const data = await response.json();
        addToast('success', data.message || 'Nộp phiếu thành công!');
        // ✅ Refresh lại dữ liệu để cập nhật formStatus
        await fetchData();
      } else {
        const errorData = await response.json().catch(() => null);
        addToast('error', errorData?.message || 'Lỗi khi nộp phiếu');
      }
    } catch {
      addToast('error', 'Không thể kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForm = () => setShowConfirm(true);

  const doDeleteForm = async () => {
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    try {
      const customJwt = (session as any)?.customJwt;
      if (!customJwt) { addToast('error', 'Phiên đăng nhập không hợp lệ.'); setIsDeleting(false); return; }
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customJwt}`,
      };

      const response = await fetch(`${API_BASE}/scoring/${formId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: headers,
        body: JSON.stringify({ studentId, role: currentRole, semesterId }),
      });

      if (response.ok) {
        const data = await response.json();
        addToast('success', data.message || 'Đã xóa phiếu điểm thành công!');
        // ✅ Tải lại trang/dữ liệu để tạo phiếu DRAFT mới
        await fetchData();
      } else {
        const errorData = await response.json().catch(() => null);
        addToast('error', errorData?.message || 'Lỗi khi xóa phiếu');
      }
    } catch {
      addToast('error', 'Không thể kết nối máy chủ');
    } finally {
      setIsDeleting(false);
    }
  };

  const effectiveCanEdit = canEdit && (() => {
    if (currentRole === 'STUDENT') return formStatus === 'DRAFT';
    if (currentRole === 'CLASS_COMMITTEE') return ['STUDENT_SUBMITTED', 'CLASS_REVIEWING'].includes(formStatus);
    if (currentRole === 'ADVISOR') return ['CLASS_REVIEWED', 'ADVISOR_REVIEWING'].includes(formStatus);
    return false;
  })();

  const canDeleteForm = 
    (currentRole === 'CLASS_COMMITTEE' && !['NOT_CREATED', 'DRAFT'].includes(formStatus)) ||
    (currentRole === 'ADVISOR' && !['NOT_CREATED', 'DRAFT'].includes(formStatus)) ||
    (allowResetAnytime && !['NOT_CREATED'].includes(formStatus));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-stone-200 border-t-red-900 animate-spin"></div>
          <span className="text-red-900 text-sm">Đang tải dữ liệu...</span>
        </div>
      </div>
    );
  }

  // Stepper Logic
  const steps = [
    { id: 'DRAFT', label: 'Nháp', num: 1 },
    { id: 'STUDENT_SUBMITTED', label: 'Ban cán sự', num: 2 },
    { id: 'CLASS_REVIEWED', label: 'Cố vấn học tập', num: 3 },
    { id: 'APPROVED', label: 'Hoàn thành', num: 4 }
  ];

  const currentStepIndex = steps.findIndex(s => {
    if (formStatus === 'DRAFT' || formStatus === 'NOT_CREATED') return s.id === 'DRAFT';
    if (formStatus === 'STUDENT_SUBMITTED' || formStatus === 'CLASS_REVIEWING') return s.id === 'STUDENT_SUBMITTED';
    if (formStatus === 'CLASS_REVIEWED' || formStatus === 'ADVISOR_REVIEWING') return s.id === 'CLASS_REVIEWED';
    if (formStatus === 'APPROVED' || formStatus === 'ADVISOR_APPROVED' || formStatus === 'SCHOOL_APPROVED' || formStatus === 'FINALIZED') return s.id === 'APPROVED';
    return false;
  });

  return (
    <>
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((t) => (
            <Toast key={t.id} message={t} onDismiss={removeToast} />
          ))}
        </div>
      )}

      <div className="bg-stone-50/40 flex-1 flex flex-col h-full overflow-y-auto p-4 md:p-6">
        <div className="w-full mx-auto space-y-4">

          {/* Header: Stepper + Actions — fixed layout, no scroll */}
          <div className="bg-white rounded-2xl px-6 py-4 flex flex-col md:flex-row md:items-center justify-between border border-stone-200 shadow-sm gap-3">
            {/* Stepper — evenly spaced */}
            <div className="flex items-center flex-1 min-w-0">
              {steps.map((step, idx) => {
                const isActive = idx === Math.max(0, currentStepIndex);
                const isCompleted = idx < Math.max(0, currentStepIndex);
                return (
                  <div key={step.id} className="flex items-center flex-1 last:flex-none">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all ${isActive ? 'bg-stone-500 text-white' : isCompleted ? 'bg-red-100 text-red-900' : 'bg-gray-100 text-gray-400'}`}>
                        {isCompleted ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg> : step.num}
                      </div>
                      <span className={`text-xs ${isActive ? 'text-red-900 font-semibold' : isCompleted ? 'text-red-900' : 'text-gray-400'}`}>{step.label}</span>
                    </div>
                    {idx < steps.length - 1 && (
                      <div className={`flex-1 h-[1.5px] mx-2 rounded-full ${isCompleted ? 'bg-red-200' : 'bg-gray-100'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {effectiveCanEdit && (
                <>
                  <button onClick={handleSaveDraft} disabled={isSavingDraft || isSubmitting || isDeleting} className="px-4 py-2 rounded-xl text-xs font-semibold text-red-900 bg-white border border-stone-300 hover:bg-stone-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
                    {isSavingDraft ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-stone-300 border-t-red-900 animate-spin"></span> Đang lưu...</> : 'Lưu Nháp'}
                  </button>
                  <button onClick={handleSubmitForm} disabled={isSubmitting || isSavingDraft || isDeleting} className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-red-800 hover:bg-red-900 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
                    {isSubmitting ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-red-300 border-t-white animate-spin"></span> {(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') ? 'Đang xác nhận...' : 'Đang nộp...'}</> : <>{(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') ? 'Xác nhận' : 'Nộp Phiếu'} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></>}
                  </button>
                </>
              )}
              {canDeleteForm && (
                <button onClick={() => setShowDeleteConfirm(true)} disabled={isSubmitting || isSavingDraft || isDeleting} className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ml-2">
                  {isDeleting ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-red-300 border-t-white animate-spin"></span> Đang xóa...</> : <>Xóa Phiếu <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></>}
                </button>
              )}
            </div>
          </div>

          {/* Horizontal Score Card */}
          <div className="bg-white rounded-2xl px-6 py-5 shadow-sm border border-stone-200 flex flex-col md:flex-row items-center gap-6">
            {/* Circle */}
            <div className="flex flex-col items-center shrink-0">
              <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-2">Tổng điểm</span>
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#fef2f2" strokeWidth="7" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#991b1b" strokeWidth="7" strokeLinecap="round" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * totalScore) / 100} className="transition-all duration-1000 ease-out" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-red-900 leading-none">{totalScore}</span>
                  <span className="text-[10px] text-stone-500 font-medium">/ 100</span>
                </div>
              </div>
            </div>

            {/* Category chips */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 w-full">
              {TAB_GROUPS.map((tab, idx) => {
                const tabRoots = criteria.filter(c => (c.parent_id === null || c.parent_id === 0) && (c.code === tab.id || c.code.startsWith(tab.id + '.') || c.code.startsWith('TC_0' + tab.id) || c.code.startsWith('TC_' + tab.id)));
                const tabScore = Math.min(tabRoots.reduce((acc, root) => acc + calculateAutoScore(root.id), 0), tab.max);
                const isFull = tabScore === tab.max;
                const isEmpty = tabScore === 0;
                return (
                  <div key={tab.id} className={`flex flex-col items-center px-3 py-3 rounded-xl border transition-colors ${isFull ? 'bg-stone-50 border-stone-300' : isEmpty ? 'bg-gray-50 border-gray-100' : 'bg-white border-stone-200'}`}>
                    <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide text-center leading-tight mb-1.5 line-clamp-1" title={tab.short}>Mục {idx + 1}</span>
                    <span className={`text-lg font-bold leading-none ${isFull ? 'text-red-900' : isEmpty ? 'text-gray-300' : 'text-red-900'}`}>{tabScore}<span className="text-xs text-stone-400 font-medium">/{tab.max}</span></span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Accordion List for Criteria */}
          <div className="space-y-3 pb-8">
            {TAB_GROUPS.map((tab, idx) => {
              const isTabExpanded = expandedTabs.has(tab.id);
              const tabRoots = criteria.filter(c => (c.parent_id === null || c.parent_id === 0) && (c.code === tab.id || c.code.startsWith(tab.id + '.') || c.code.startsWith('TC_0' + tab.id) || c.code.startsWith('TC_' + tab.id)));
              const tabScore = Math.min(tabRoots.reduce((acc, root) => acc + calculateAutoScore(root.id), 0), tab.max);
              const isFull = tabScore === tab.max;
              const filtered = sortedCriteria.filter(item => {
                if (!isVisible(item.id)) return false;
                const root = getRoot(item.id);
                if (!root) return true;
                return root.code === tab.id || root.code.startsWith(tab.id + '.') || root.code.startsWith('TC_0' + tab.id) || root.code.startsWith('TC_' + tab.id);
              });

              return (
                <div key={tab.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-200 ${isTabExpanded ? 'border-stone-300' : 'border-stone-200 hover:border-stone-300'}`}>
                  {/* Accordion Header */}
                  <button onClick={() => toggleTab(tab.id)} className="w-full px-5 py-4 flex items-center justify-between gap-3 outline-none group">
                    <div className="flex items-center gap-3 text-left min-w-0">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm shrink-0 transition-colors ${isTabExpanded ? 'bg-red-800 text-white' : 'bg-stone-50 text-red-900 group-hover:bg-red-100'}`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-red-900 truncate">Mục {idx + 1}: {tab.short}</h4>
                        {isTabExpanded && <p className="text-[11px] text-stone-500 mt-0.5 leading-snug line-clamp-2">{tab.title}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-semibold px-2.5 py-1 rounded-lg ${isFull ? 'bg-red-100 text-red-900' : 'bg-gray-50 text-red-900'}`}>
                        {tabScore}<span className="text-xs text-stone-400 font-medium">/{tab.max}</span>
                      </span>
                      <div className={`w-6 h-6 rounded-md bg-stone-50 flex items-center justify-center transition-transform duration-200 ${isTabExpanded ? 'rotate-180' : ''}`}>
                        <svg className="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </button>

                  {/* Accordion Body */}
                  {isTabExpanded && (
                    <div className="border-t border-stone-200 overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead className="bg-stone-50/60">
                          <tr className="text-red-900 text-[11px] font-semibold uppercase tracking-wider border-b border-stone-200">
                            <th className="px-4 py-2.5 w-16">Mã</th>
                            <th className="px-4 py-2.5">Nội dung</th>
                            <th className="px-4 py-2.5 w-16 text-center">Điểm</th>
                            <th className="px-4 py-2.5 w-20 text-center">Sinh viên</th>
                            {(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') && (
                              <th className="px-4 py-2.5 w-20 text-center">BCS Lớp</th>
                            )}
                            {currentRole === 'ADVISOR' && (
                              <th className="px-4 py-2.5 w-20 text-center">Cố vấn</th>
                            )}
                            <th className="px-4 py-2.5 w-48">Minh chứng</th>
                            <th className="px-4 py-2.5 w-12 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-50">
                          {filtered.length === 0 ? (
                            <tr><td colSpan={currentRole === 'STUDENT' ? 6 : currentRole === 'CLASS_COMMITTEE' ? 7 : 8} className="p-8 text-center text-stone-400 text-sm">Không có tiêu chí nào.</td></tr>
                          ) : (
                            filtered.map((item) => {
                              const isParent = parentIds.has(item.id);
                              const depth = depthMap.get(item.id) || 0;
                              const isExpanded = expandedIds.has(item.id);
                              const isFixed = FIXED_CODES.includes(item.code);
                              const val = inputValues[item.id] || '';
                              const evidence = evidenceValues?.[item.id] || '';
                              const isRowSaving = savingId === item.id;

                              const isDeduction = item.score_type === 'DEDUCTION' || item.max_points < 0;
                              const minVal = isDeduction ? item.max_points : 0;
                              const maxVal = isDeduction ? 0 : (item.max_points > 0 ? item.max_points : 100);

                              if (isParent) {
                                return (
                                  <tr key={item.id} className="bg-stone-50/30 hover:bg-stone-50/60 cursor-pointer transition-colors" onClick={() => toggleExpand(item.id)}>
                                    <td className="px-4 py-2.5 text-[11px] font-medium text-stone-500">{item.code}</td>
                                    <td className="px-4 py-2.5">
                                      <div className="flex items-center" style={{ paddingLeft: `${depth * 1.2}rem` }}>
                                        <span className={`w-4 h-4 rounded flex items-center justify-center mr-2 text-[10px] font-semibold ${isExpanded ? 'bg-red-100 text-red-900' : 'bg-red-800 text-white'}`}>{isExpanded ? '−' : '+'}</span>
                                        <span className="text-xs font-semibold text-red-900">{item.content}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-center text-xs text-stone-500">{item.max_points}</td>
                                    <td className="px-4 py-2.5 text-center text-xs font-semibold text-red-900">
                                      {currentRole === 'STUDENT' ? calculateAutoScore(item.id) : calculateScoreFromMap(item.id, savedStudentScores)}
                                    </td>
                                    {(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') && (
                                      <td className="px-4 py-2.5 text-center text-xs font-semibold text-red-900">
                                        {currentRole === 'CLASS_COMMITTEE' ? calculateAutoScore(item.id) : calculateScoreFromMap(item.id, savedClassScores)}
                                      </td>
                                    )}
                                    {currentRole === 'ADVISOR' && (
                                      <td className="px-4 py-2.5 text-center text-xs font-semibold text-red-900">
                                        {calculateAutoScore(item.id)}
                                      </td>
                                    )}
                                    <td className="px-4 py-2.5"></td>
                                    <td className="px-4 py-2.5 text-center"><span className="text-[9px] uppercase font-semibold text-stone-400 bg-stone-50 px-1.5 py-0.5 rounded">Auto</span></td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={item.id} className={`hover:bg-stone-50/30 transition-colors group ${isRowSaving ? 'opacity-50' : ''}`}>
                                  <td className="px-4 py-2.5 text-[11px] text-stone-500">{item.code}</td>
                                  <td className="px-4 py-2.5">
                                    <div style={{ paddingLeft: `${depth * 1.2}rem` }}>
                                      <span className="text-xs text-red-900 leading-snug">{item.content}</span>
                                      {item.description && <span className="text-[10px] text-stone-400 mt-0.5 block leading-relaxed">{item.description}</span>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-center text-xs text-stone-500">{item.max_points}</td>
                                  
                                  {/* Student Score Column */}
                                  <td className="px-4 py-2.5 text-center">
                                    {isFixed ? (
                                      <span className="text-xs font-semibold text-red-900 bg-stone-50 px-2 py-1 rounded-lg">{item.max_points}</span>
                                    ) : currentRole === 'STUDENT' ? (
                                      <div className="relative inline-block">
                                        <input type="number" min={minVal} max={maxVal} value={val} disabled={!effectiveCanEdit || isRowSaving || isSavingDraft || isSubmitting} onChange={(e) => handleInputChange(item.id, e.target.value)} className="w-14 h-8 text-center text-xs font-medium text-red-900 border border-stone-300 rounded-lg focus:border-red-900 focus:ring-0 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-100 hover:border-red-300" />
                                        {isRowSaving && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-2 border-red-900 border-t-transparent rounded-full animate-spin bg-white"></div>}
                                      </div>
                                    ) : (
                                      <span className="text-xs font-medium text-red-900">{savedStudentScores[item.id] ?? '-'}</span>
                                    )}
                                  </td>

                                  {/* BCS Score Column */}
                                  {(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') && (
                                    <td className="px-4 py-2.5 text-center">
                                      {isFixed ? (
                                        <span className="text-xs font-semibold text-red-900 bg-stone-50 px-2 py-1 rounded-lg">{item.max_points}</span>
                                      ) : currentRole === 'CLASS_COMMITTEE' ? (
                                        <div className="relative inline-block">
                                          <input type="number" min={minVal} max={maxVal} value={val} disabled={!effectiveCanEdit || isRowSaving || isSavingDraft || isSubmitting} onChange={(e) => handleInputChange(item.id, e.target.value)} className="w-14 h-8 text-center text-xs font-medium text-red-900 border border-stone-300 rounded-lg focus:border-red-900 focus:ring-0 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-100 hover:border-red-300" />
                                          {isRowSaving && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-2 border-red-900 border-t-transparent rounded-full animate-spin bg-white"></div>}
                                        </div>
                                      ) : (
                                        <span className="text-xs font-medium text-red-900">{savedClassScores[item.id] ?? '-'}</span>
                                      )}
                                    </td>
                                  )}

                                  {/* Advisor Score Column */}
                                  {currentRole === 'ADVISOR' && (
                                    <td className="px-4 py-2.5 text-center">
                                      {isFixed ? (
                                        <span className="text-xs font-semibold text-red-900 bg-stone-50 px-2 py-1 rounded-lg">{item.max_points}</span>
                                      ) : (
                                        <div className="relative inline-block">
                                          <input type="number" min={minVal} max={maxVal} value={val} disabled={!effectiveCanEdit || isRowSaving || isSavingDraft || isSubmitting} onChange={(e) => handleInputChange(item.id, e.target.value)} className="w-14 h-8 text-center text-xs font-medium text-red-900 border border-stone-300 rounded-lg focus:border-red-900 focus:ring-0 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-100 hover:border-red-300" />
                                          {isRowSaving && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-2 border-red-900 border-t-transparent rounded-full animate-spin bg-white"></div>}
                                        </div>
                                      )}
                                    </td>
                                  )}
                                  <td className="px-4 py-2.5">
                                    {!isFixed && (
                                      <div className="relative flex items-center">
                                        <input type="text" placeholder="Link minh chứng..." value={evidence} disabled={!effectiveCanEdit || isRowSaving || isSavingDraft || isSubmitting} onChange={(e) => setEvidenceValues(prev => ({ ...prev, [item.id]: e.target.value }))} className="w-full h-8 px-3 text-[11px] text-red-900 border border-stone-300 rounded-lg focus:border-red-900 focus:ring-0 outline-none transition-all pr-8 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-100 hover:border-red-300 placeholder-red-200" />
                                        {evidence && (
                                          <a href={evidence.startsWith('http') ? evidence : `https://${evidence}`} target="_blank" rel="noopener noreferrer" className="absolute right-2 w-5 h-5 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center transition-colors shadow-sm cursor-pointer z-10" title="Mở liên kết minh chứng">
                                            <svg className="w-3 h-3 text-red-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    {!isFixed && effectiveCanEdit && (
                                      <button onClick={() => { handleInputChange(item.id, ''); setEvidenceValues(prev => ({ ...prev, [item.id]: '' })); }} disabled={isRowSaving || isSavingDraft || isSubmitting} className="w-6 h-6 rounded-md flex items-center justify-center text-stone-400 hover:text-stone-500 hover:bg-stone-50 transition-colors mx-auto opacity-0 group-hover:opacity-100 disabled:opacity-0" title="Xóa">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-900/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-7 max-w-sm w-full shadow-2xl">
            <div className="w-14 h-14 bg-red-100 text-red-900 rounded-xl flex items-center justify-center mb-5 mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <h3 className="text-lg font-semibold text-center text-red-900 mb-1.5">
              {(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') ? 'Bạn có chắc chắn xác nhận?' : 'Xác nhận nộp phiếu?'}
            </h3>
            <p className="text-center text-stone-500 text-xs mb-6 leading-relaxed">
              {(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') ? 'Phiếu điểm sẽ được xác nhận và chuyển sang trạng thái tiếp theo.' : 'Sau khi nộp, bạn sẽ không thể chỉnh sửa điểm. Bạn chắc chắn chứ?'}
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 px-4 bg-stone-50 hover:bg-red-100 text-red-900 font-semibold text-sm rounded-xl transition-colors">Hủy bỏ</button>
              <button onClick={doSubmitForm} className="flex-1 py-2.5 px-4 bg-red-800 hover:bg-red-900 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors">
                {(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') ? 'Đồng ý Xác nhận' : 'Đồng ý Nộp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-7 max-w-sm w-full shadow-2xl">
            <div className="w-14 h-14 bg-red-100 text-red-900 rounded-xl flex items-center justify-center mb-5 mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>
            <h3 className="text-lg font-semibold text-center text-slate-800 mb-2">Xóa Phiếu Rèn Luyện?</h3>
            <p className="text-center text-slate-500 text-sm mb-6 leading-relaxed">
              Bạn có chắc chắn muốn xóa toàn bộ phiếu này? Hệ thống sẽ tạo lại một phiếu mới (DRAFT) cho sinh viên tự chấm lại. Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-sm rounded-xl transition-colors">Hủy bỏ</button>
              <button onClick={doDeleteForm} className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm shadow-red-200">Xóa Phiếu</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
