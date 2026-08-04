'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { AlertTriangle, FileText } from 'lucide-react';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';
import { scoringSheetStatusConfig } from '../../lib/statusConfig';

const API_BASE = '/proxy-api';



const QUANTITY_MULTIPLIERS: Record<string, number> = {
  '1.2.1': 1, '3.2.1': 1,
  '1.2.2': 1, '3.2.2': 1, '4.2.1': 1,
  '1.2.3': 2, '3.2.3': 2, '4.2.2': 2, '5.3.1': 2,
  '1.2.4': 3, '3.2.4': 3, '5.2.2': 3,
  '1.2.5': 4,
  '5.3.4': 5,
  '1.1.3': -2, '1.2.7': -2, '2.3': -2, '3.1.2': -2, '3.3': -2, '4.3': -2
};

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

export type Role = keyof typeof ROLE_CONFIG;
const ALL_ROLES: Role[] = ['STUDENT', 'CLASS_COMMITTEE', 'ADVISOR'];

interface Criterion {
  id: number;
  code: string;
  content: string;
  point: number;
  score_type: string;
  score_options?: number[] | null;
  parent_id: number | null;
  sort_order: number;
  description?: string;
  require_evidence?: number;
}

interface ScoreDetail {
  criteria_id: number;
  proof_url?: string | null;
  score_entries?: Array<{ scorer_role: string; score: number }>;
}

export type SubmissionValidationError = {
  criterionId: number | null;
  code: string;
  message: string;
};

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
    const timer = setTimeout(() => onDismiss(message.id), 60000);
    return () => clearTimeout(timer);
  }, [message.id, onDismiss]);

  return (
    <div className={`px-4 py-3 text-xs font-medium border rounded-xl shadow-sm ${message.type === 'success' ? 'bg-success-bg border-success-border text-success-foreground' : 'bg-danger-bg border-danger-border text-danger-foreground'}`}>
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
  setTopBarExtra?: (node: React.ReactNode) => void;
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
  setTopBarExtra,
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

  const criteriaIds = useMemo(() => new Set(criteria.map((c) => c.id)), [criteria]);
  const isRootItem = useCallback((c: Criterion) => {
    return !c.parent_id || !criteriaIds.has(c.parent_id);
  }, [criteriaIds]);

  const [formStatus, setFormStatus] = useState<string>('DRAFT');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [actualFormId, setActualFormId] = useState<string>(formId);
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<SubmissionValidationError[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rejectionInfo, setRejectionInfo] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

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
        const fetchedCriteria = data.data || [];
        const fetchedIds = new Set(fetchedCriteria.map((c: Criterion) => c.id));
        const rootItems = fetchedCriteria
          .filter((c: Criterion) => !c.parent_id || !fetchedIds.has(c.parent_id))
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

        let hasClassEntry = false;
        let hasAdvisorEntry = false;

        scoresData.data.forEach((s: ScoreDetail) => {
          const entries = s.score_entries || [];
          if (entries.some(e => e.scorer_role === 'CLASS_COMMITTEE')) hasClassEntry = true;
          if (entries.some(e => e.scorer_role === 'ADVISOR')) hasAdvisorEntry = true;
        });

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
          else if (!hasClassEntry && studentVal !== null && studentVal !== undefined) cMap[s.criteria_id] = Number(studentVal);

          if (advisorVal !== null && advisorVal !== undefined) aMap[s.criteria_id] = Number(advisorVal);
          else if (!hasAdvisorEntry && classVal !== null && classVal !== undefined) aMap[s.criteria_id] = Number(classVal);
          else if (!hasAdvisorEntry && studentVal !== null && studentVal !== undefined) aMap[s.criteria_id] = Number(studentVal);

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

        // ✅ Cập nhật currentStep từ API response
        if (scoresData.currentStep) {
          setCurrentStep(scoresData.currentStep);
        }

        // ✅ Cập nhật actualFormId
        if (scoresData.formId) {
          setActualFormId(scoresData.formId);
        }
        if (scoresData.rejectionReason) {
          setRejectionInfo(scoresData.rejectionReason);
        } else {
          setRejectionInfo(null);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [formId, studentId, session, semesterId]);

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
    criteria.forEach((c) => {
      const isRoot = isRootItem(c);
      const pid = isRoot ? null : c.parent_id;
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(c);
    });
    childrenMap.forEach((list) =>
      list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.code.localeCompare(b.code, undefined, { numeric: true })),
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
      if (isRootItem(item)) return true;
      if (!expandedIds.has(item.parent_id!)) return false;
      return isVisible(item.parent_id!);
    },
    [criteria, expandedIds, isRootItem],
  );

  const depthMap = useMemo(() => {
    const map = new Map<number, number>();
    const getDepth = (item: Criterion): number => {
      if (map.has(item.id)) return map.get(item.id)!;
      if (isRootItem(item)) {
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
  }, [criteria, isRootItem]);

  const getRoot = useCallback(
    (itemId: number): Criterion | null => {
      const item = criteria.find((c) => c.id === itemId);
      if (!item) return null;
      if (isRootItem(item)) return item;
      return getRoot(item.parent_id!);
    },
    [criteria, isRootItem],
  );

  const calculateScoreFromMap = useCallback(
    (itemId: number, scoreMap: Record<number, number>, visited = new Set<number>()): number => {
      if (visited.has(itemId)) return 0;
      visited.add(itemId);
      const item = criteria.find((c) => c.id === itemId);
      if (!item) return 0;
      if (item.score_type === 'FIXED') return item.point;
      const children = criteria.filter((c) => c.parent_id === itemId);
      if (children.length > 0) {
        const sum = children.reduce(
          (acc, child) => acc + calculateScoreFromMap(child.id, scoreMap, visited),
          0,
        );
        if (item.point > 0) return Math.min(sum, item.point);
        if (item.point < 0) return Math.min(0, Math.max(sum, item.point));
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
      if (item.score_type === 'FIXED') return item.point;
      const children = criteria.filter((c) => c.parent_id === itemId);
      if (children.length > 0) {
        const sum = children.reduce(
          (acc, child) => acc + calculateAutoScore(child.id, visited),
          0,
        );
        if (item.point > 0) return Math.min(sum, item.point);
        if (item.point < 0) return Math.min(0, Math.max(sum, item.point));
        return sum;
      }
      return parseFloat(inputValues[itemId]) || 0;
    },
    [criteria, inputValues],
  );

  const totalScore = useMemo(() => {
    const rawTotal = TAB_GROUPS.reduce((acc, tab) => {
      const tabRoots = criteria.filter(
        (c) =>
          isRootItem(c) &&
          (c.code === tab.id ||
            c.code.startsWith(tab.id + '.') ||
            c.code.startsWith('TC_0' + tab.id) ||
            c.code.startsWith('TC_' + tab.id)),
      );
      const tabSum = tabRoots.reduce((sum, root) => sum + calculateAutoScore(root.id), 0);
      const safeTabSum = Math.min(Math.max(0, tabSum), tab.max);
      return acc + safeTabSum;
    }, 0);
    return Math.min(100, Math.max(0, rawTotal));
  }, [criteria, calculateAutoScore, isRootItem]);

  const handleInputChange = (criteriaId: number, value: string) => {
    let finalValue = value;
    const item = criteria.find(c => c.id === criteriaId);
    if (item && value !== '' && value !== '-') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        const isQuantityBased = !!QUANTITY_MULTIPLIERS[item.code];
        const isDeduction = item.score_type === 'DEDUCTION' || item.point < 0;
        if (isQuantityBased) {
          const multiplier = QUANTITY_MULTIPLIERS[item.code];
          const absMultiplier = Math.abs(multiplier);
          const inputQuantity = Math.abs(num) / absMultiplier;
          const maxQuantity = isDeduction ? 40 : 30;

          if (inputQuantity > maxQuantity) {
            const clampedScore = maxQuantity * absMultiplier;
            finalValue = (multiplier < 0 ? -clampedScore : clampedScore).toString();
          }
        } else {
          // Non-quantity: clamp theo point bình thường
          if (isDeduction) {
            if (num > 0) finalValue = '0';
            else if (num < item.point) finalValue = item.point.toString();
          } else {
            if (num < 0) finalValue = '0';
            else if (item.point > 0 && num > item.point) finalValue = item.point.toString();
          }
        }
      } else {
        // NaN guard: reset to empty
        finalValue = '';
      }
    } else {
      finalValue = value;
    }

    setInputValues((prev) => {
      const next = { ...prev };

      // Mutual Exclusivity Logic for OPTIONS/RADIO criteria
      if (item && item.parent_id) {
        const parent = criteria.find(c => c.id === item.parent_id);
        if (parent && (parent.score_type === 'OPTIONS' || parent.score_type === 'RADIO')) {
          if (finalValue && parseFloat(finalValue) > 0) {
            const siblings = criteria.filter(c => c.parent_id === parent.id && c.id !== item.id);
            siblings.forEach(sib => {
              if (next[sib.id] !== undefined || prev[sib.id]) {
                next[sib.id] = '';
              }
            });
          }
        }
      }

      next[criteriaId] = finalValue;
      setIsDirty(true);
      return next;
    });
  };

  const handleSaveDraft = async (): Promise<boolean> => {
    const leafItems = criteria.filter((c) => !criteria.some((x) => x.parent_id === c.id));
    if (leafItems.length === 0) return true;
    setIsSavingDraft(true);
    try {
      const customJwt = (session as any)?.customJwt;
      if (!customJwt) { addToast('error', 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.'); return false; }
      const headersInit: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customJwt}`,
      };

      const results: { id: number; score: number | null }[] = [];
      let failCount = 0;
      let lastError = '';

      const saveSingleItem = async (item: typeof leafItems[0]) => {
        let score = 0;
        if (item.score_type === 'FIXED') {
          score = item.point;
        } else {
          const raw = inputValues[item.id] ?? '';
          if (raw === '') {
            const oldSavedMap = getSavedMap(currentRole);
            if (oldSavedMap[item.id] !== undefined) {
              try {
                const r = await fetch(`${API_BASE}/scoring/${actualFormId}/delete-criteria`, {
                  method: 'POST', credentials: 'include', headers: headersInit,
                  body: JSON.stringify({ criteriaId: item.id, role: currentRole, studentId, semesterId }),
                });
                if (r.ok) return { id: item.id, score: null };
                const errData = await r.json().catch(() => null);
                lastError = errData?.message || `HTTP ${r.status}`;
                failCount++;
              } catch (e) {
                console.error('Lỗi xóa điểm:', e);
                failCount++;
              }
            }
            return null;
          }
          score = parseFloat(raw);
        }
        if (isNaN(score)) return null;

        // Validate score against point before sending to API
        const isDeduction = item.score_type === 'DEDUCTION' || item.point < 0;
        const isQuantityBased = !!QUANTITY_MULTIPLIERS[item.code];
        if (isQuantityBased) {
          const multiplier = QUANTITY_MULTIPLIERS[item.code];
          const absMultiplier = Math.abs(multiplier);
          const inputQuantity = Math.abs(score) / absMultiplier;
          const maxQuantity = isDeduction ? 40 : 30;
          if (inputQuantity > maxQuantity) return null;
        } else {
          if (isDeduction) {
            if (score < item.point || score > 0) return null;
          } else {
            if (score < 0) return null;
            if (item.point > 0 && score > item.point) return null;
          }
        }

        try {
          const r = await fetch(`${API_BASE}/scoring/${actualFormId}/submit-criteria`, {
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
      results.forEach((r) => {
        if (r.score === null) {
          delete newScores[r.id];
        } else {
          newScores[r.id] = r.score;
        }
      });
      if (currentRole === 'STUDENT') setSavedStudentScores(newScores);
      else if (currentRole === 'CLASS_COMMITTEE') setSavedClassScores(newScores);
      else setSavedAdvisorScores(newScores);

      let success = true;
      if (failCount > 0 && results.length === 0) {
        addToast('error', `Lỗi khi lưu: ${lastError}`);
        success = false;
      } else if (failCount > 0) {
        addToast('error', `Lưu được ${results.length} tiêu chí, ${failCount} bị lỗi: ${lastError}`);
        success = false;
      } else {
        addToast('success', 'Đã lưu nháp toàn bộ phiếu!');
        success = true;
      }

      if (success) {
        setIsDirty(false);
      } else {
        setIsDirty(true);
      }

      await fetchData();
      return success;
    } catch {
      addToast('error', 'Lỗi khi lưu nháp');
      setIsDirty(true);
      return false;
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

      const response = await fetch(`${API_BASE}/scoring/${actualFormId}/submit-criteria`, {
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
        const saveSuccess = await handleSaveDraft();
        if (!saveSuccess) {
          setIsSubmitting(false);
          return;
        }
      }

      const customJwt = (session as any)?.customJwt;
      if (!customJwt) { addToast('error', 'Phiên đăng nhập không hợp lệ.'); setIsSubmitting(false); return; }
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customJwt}`,
      };

      const response = await fetch(`${API_BASE}/scoring/${actualFormId}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: headers,
        body: JSON.stringify({ role: currentRole, studentId, semesterId }),
      });

      if (response.ok) {
        const data = await response.json();
        addToast('success', data.message || 'Nộp phiếu thành công!');
        setValidationErrors([]);
        // ✅ Refresh lại dữ liệu để cập nhật formStatus
        await fetchData();
      } else {
        const errorData = await response.json().catch(() => null);
        if (response.status === 400 && errorData?.errors) {
          const errors: SubmissionValidationError[] = errorData.errors;
          setValidationErrors(errors);
          addToast('error', `Phiếu chưa hợp lệ! Có ${errors.length} lỗi cần sửa.`);

          // Scroll to the first error
          if (errors.length > 0) {
            setTimeout(() => {
              const firstErrorElement = document.getElementById(`criterion-${errors[0].criterionId}`);
              if (firstErrorElement) {
                firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100);
          }
        } else {
          addToast('error', errorData?.message || 'Lỗi khi nộp phiếu');
        }
      }
    } catch {
      addToast('error', 'Không thể kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForm = () => setShowConfirm(true);

  const doDeleteForm = async () => {
    if (!rejectReasonInput.trim()) {
      addToast('error', 'Vui lòng nhập lý do trả lại phiếu!');
      return;
    }
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    try {
      const customJwt = (session as any)?.customJwt;
      if (!customJwt) { addToast('error', 'Phiên đăng nhập không hợp lệ.'); setIsDeleting(false); return; }
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customJwt}`,
      };

      const response = await fetch(`${API_BASE}/scoring/${actualFormId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: headers,
        body: JSON.stringify({ studentId, role: currentRole, semesterId, reason: rejectReasonInput }),
      });

      if (response.ok) {
        const data = await response.json();
        addToast('success', data.message || 'Đã trả lại phiếu điểm thành công!');
        setRejectReasonInput('');
        await fetchData();
      } else {
        const errorData = await response.json().catch(() => null);
        addToast('error', errorData?.message || 'Lỗi khi trả lại phiếu');
      }
    } catch {
      addToast('error', 'Không thể kết nối máy chủ');
    } finally {
      setIsDeleting(false);
    }
  };

  const effectiveCanEdit = canEdit && (() => {
    if (currentRole === 'STUDENT') return ['NOT_CREATED', 'DRAFT', 'CLASS_REJECTED', 'ADVISOR_REJECTED'].includes(formStatus);
    if (currentRole === 'CLASS_COMMITTEE') return ['STUDENT_SUBMITTED', 'CLASS_REVIEWING'].includes(formStatus);
    if (currentRole === 'ADVISOR') return ['CLASS_REVIEWED', 'ADVISOR_REVIEWING'].includes(formStatus);
    return false;
  })();

  const canDeleteForm =
    (currentRole === 'CLASS_COMMITTEE' && ['STUDENT_SUBMITTED', 'CLASS_REVIEWING'].includes(formStatus)) ||
    (currentRole === 'ADVISOR' && ['STUDENT_SUBMITTED', 'CLASS_REVIEWING', 'CLASS_REVIEWED', 'ADVISOR_REVIEWING', 'ADVISOR_APPROVED'].includes(formStatus)) ||
    (allowResetAnytime && !['NOT_CREATED'].includes(formStatus));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-400px">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-stone-200 border-t-red-900 animate-spin"></div>
          <span className="text-red-900 text-sm">Đang tải dữ liệu...</span>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex items-center justify-center h-full min-h-400px">
        <div className="bg-danger-bg text-danger p-6 rounded-xl flex flex-col items-center gap-4 max-w-md text-center shadow-sm border border-danger-border">
          <AlertTriangle size={36} strokeWidth={2} />
          <span className="font-medium">{fetchError}</span>
        </div>
      </div>
    );
  }

  // Stepper Logic
  const steps = [
    { id: 'DRAFT', label: 'Chưa nộp', num: 1 },
    { id: 'STUDENT_SUBMITTED', label: 'Ban cán sự', num: 2 },
    { id: 'CLASS_REVIEWED', label: 'Cố vấn học tập', num: 3 },
    { id: 'APPROVED', label: 'Hoàn thành', num: 4 }
  ];

  const currentStatusConfig = scoringSheetStatusConfig[formStatus] || { label: formStatus, tone: 'neutral' };

  const currentStepIndex = Math.max(0, currentStep - 1);

  return (
    <>
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((t) => (
            <Toast key={t.id} message={t} onDismiss={removeToast} />
          ))}
        </div>
      )}

      <div className="bg-stone-50/40 flex-1 flex flex-col h-full overflow-y-auto p-2 md:p-3">
        <div className="w-full mx-auto space-y-2">

          {/* Header: Stepper + Actions — fixed layout, no scroll */}
          {viewMode !== 'history' && (
            <div className="bg-surface rounded-2xl px-6 py-4 flex flex-col md:flex-row md:items-center justify-between border border-border shadow-sm gap-3">
              {/* Stepper — evenly spaced */}
              <div className="flex items-center flex-1 min-w-0">
                {steps.map((step, idx) => {
                  const isActive = idx === Math.max(0, currentStepIndex);
                  const isCompleted = idx < Math.max(0, currentStepIndex);
                  return (
                    <div key={step.id} className="flex items-center flex-1 last:flex-none">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all ${isActive ? 'bg-primary text-primary-foreground' : isCompleted ? 'bg-primary/20 text-primary' : 'bg-surface-muted text-muted-foreground'}`}>
                          {isCompleted ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg> : step.num}
                        </div>
                        <span className={`text-xs ${isActive ? 'text-primary font-semibold' : isCompleted ? 'text-primary' : 'text-muted-foreground'}`}>{step.label}</span>
                      </div>
                      {idx < steps.length - 1 && (
                        <div className={`flex-1 h-[1.5px] mx-2 rounded-full ${isCompleted ? 'bg-primary/20' : 'bg-border'}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {effectiveCanEdit && (
                  <>
                    <button onClick={handleSaveDraft} disabled={isSavingDraft || isSubmitting || isDeleting} className="px-4 py-2 rounded-xl text-xs font-semibold text-primary bg-surface border border-border hover:bg-surface-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
                      {isSavingDraft ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-border border-t-primary animate-spin"></span> Đang lưu...</> : 'Lưu Nháp'}
                    </button>
                    <button onClick={handleSubmitForm} disabled={isSubmitting || isSavingDraft || isDeleting} className="px-5 py-2 rounded-xl text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary-hover shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
                      {isSubmitting ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-primary-light border-t-white animate-spin"></span> {(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') ? 'Đang xác nhận...' : 'Đang nộp...'}</> : <>{(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') ? 'Xác nhận' : (currentRole === 'STUDENT' && (formStatus === 'CLASS_REJECTED' || formStatus === 'ADVISOR_REJECTED' || formStatus === 'REJECTED') ? 'Chỉnh sửa và nộp lại' : 'Nộp Phiếu')} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></>}
                    </button>
                  </>
                )}
                {canDeleteForm && (
                  <button onClick={() => setShowDeleteConfirm(true)} disabled={isSubmitting || isSavingDraft || isDeleting} className="px-5 py-2 rounded-xl text-xs font-semibold text-primary-foreground bg-danger hover:bg-danger-hover shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ml-2">
                    {isDeleting ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-danger-hover border-t-white animate-spin"></span> Đang xử lý...</> : <>Trả Lại <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg></>}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Rejection Banner */}
          {rejectionInfo && ['CLASS_REJECTED', 'ADVISOR_REJECTED', 'REJECTED'].includes(formStatus) && (
            <div className="bg-danger-bg border-l-4 border-danger p-4 rounded-r-2xl mb-4 shadow-sm flex gap-3">
              <svg className="w-5 h-5 text-danger shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <div>
                <h4 className="text-sm font-semibold text-danger-foreground mb-1">Phiếu đã bị trả lại!</h4>
                <p className="text-sm text-danger-foreground/80 leading-relaxed">
                  Lý do: <span className="font-semibold">{rejectionInfo}</span>. Vui lòng chỉnh sửa lại các mục bị yêu cầu và nộp lại phiếu.
                </p>
              </div>
            </div>
          )}

          {/* Horizontal Score Card */}
          {criteria.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={FileText}
                title="Chưa có tiêu chí đánh giá"
                description="Bộ tiêu chí chấm điểm rèn luyện cho học kỳ này chưa được cấu hình."
              />
            </div>
          ) : (
            <>
              <div className="bg-surface rounded-2xl px-4 py-3 shadow-sm border border-border flex flex-col md:flex-row items-center gap-4">
                {/* Circle */}
                <div className="flex flex-col items-center shrink-0">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Tổng điểm</span>
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-border" strokeWidth="7" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-primary" strokeWidth="7" strokeLinecap="round" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * totalScore) / 100} style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-foreground leading-none">{totalScore}</span>
                      <span className="text-xs text-muted-foreground font-medium">/ 100</span>
                    </div>
                  </div>
                </div>

                {/* Category chips */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 w-full">
                  {TAB_GROUPS.map((tab, idx) => {
                    const tabRoots = criteria.filter(c => (!c.parent_id) && (c.code === tab.id || c.code.startsWith(tab.id + '.') || c.code.startsWith('TC_0' + tab.id) || c.code.startsWith('TC_' + tab.id)));
                    const tabScore = Math.min(tabRoots.reduce((acc, root) => acc + calculateAutoScore(root.id), 0), tab.max);
                    const isFull = tabScore === tab.max;
                    const isEmpty = tabScore === 0;
                    return (
                      <div key={tab.id} className={`flex flex-col items-center px-2 py-2 rounded-xl border transition-colors ${isFull ? 'bg-primary/5 border-primary/20' : isEmpty ? 'bg-surface-muted border-border/50' : 'bg-surface border-border'}`}>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center leading-tight mb-1 line-clamp-1" title={tab.short}>Mục {idx + 1}</span>
                        <span className={`text-xl font-bold leading-none ${isFull ? 'text-primary' : isEmpty ? 'text-muted-foreground' : 'text-foreground'}`}>{tabScore}<span className="text-sm text-muted-foreground font-medium">/{tab.max}</span></span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Accordion List for Criteria */}
              <div className="space-y-2 pb-4">
                {TAB_GROUPS.map((tab, idx) => {
                  const isTabExpanded = expandedTabs.has(tab.id);
                  const tabRoots = criteria.filter(c => (!c.parent_id) && (c.code === tab.id || c.code.startsWith(tab.id + '.') || c.code.startsWith('TC_0' + tab.id) || c.code.startsWith('TC_' + tab.id)));
                  const tabScore = Math.min(tabRoots.reduce((acc, root) => acc + calculateAutoScore(root.id), 0), tab.max);
                  const isFull = tabScore === tab.max;
                  const filtered = sortedCriteria.filter(item => {
                    if (!isVisible(item.id)) return false;
                    const root = getRoot(item.id);
                    if (!root) return true;
                    return root.code === tab.id || root.code.startsWith(tab.id + '.') || root.code.startsWith('TC_0' + tab.id) || root.code.startsWith('TC_' + tab.id);
                  });

                  return (
                    <div key={tab.id} className={`bg-surface rounded-2xl shadow-sm border overflow-hidden transition-all duration-200 ${isTabExpanded ? 'border-primary/50' : 'border-border hover:border-border/80'}`}>
                      {/* Accordion Header */}
                      <button onClick={() => toggleTab(tab.id)} className="w-full px-3 py-2.5 flex items-center justify-between gap-2 outline-none group">
                        <div className="flex items-center gap-2 text-left min-w-0">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-semibold text-base shrink-0 transition-colors ${isTabExpanded ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-primary group-hover:bg-primary/10'}`}>
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-base font-semibold text-foreground truncate">Mục {idx + 1}: {tab.short}</h4>
                            {isTabExpanded && <p className="text-sm text-muted-foreground mt-0.5 leading-snug line-clamp-2">{tab.title}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-base font-semibold px-2 py-0.5 rounded-lg ${isFull ? 'bg-primary/10 text-primary' : 'bg-surface-muted text-foreground'}`}>
                            {tabScore}<span className="text-sm text-muted-foreground font-medium">/{tab.max}</span>
                          </span>
                          <div className={`w-6 h-6 rounded-md bg-surface-muted flex items-center justify-center transition-transform duration-200 ${isTabExpanded ? 'rotate-180' : ''}`}>
                            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                          </div>
                        </div>
                      </button>

                      {/* Accordion Body */}
                      {isTabExpanded && (
                        <div className="border-t border-border overflow-x-auto">
                          <table className="w-full text-left border-collapse min-w-700px">
                            <thead className="bg-surface-muted">
                              <tr className="text-muted-foreground text-sm font-semibold uppercase tracking-wider border-b border-border">
                                <th className="px-2 py-1.5 w-16">Mã</th>
                                <th className="px-2 py-1.5">Nội dung</th>
                                <th className="px-2 py-1.5 w-16 text-center">Điểm</th>
                                <th className="px-2 py-1.5 w-20 text-center">Số lần</th>
                                <th className="px-2 py-1.5 w-24 text-center">Tổng điểm</th>
                                {(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') && (
                                  <th className="px-2 py-1.5 w-24 text-center">BCS Lớp</th>
                                )}
                                {currentRole === 'ADVISOR' && (
                                  <th className="px-2 py-1.5 w-24 text-center">Cố vấn</th>
                                )}
                                <th className="px-2 py-1.5 w-48">Minh chứng</th>
                                <th className="px-2 py-1.5 w-12 text-center"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {filtered.length === 0 ? (
                                <tr><td colSpan={currentRole === 'STUDENT' ? 7 : currentRole === 'CLASS_COMMITTEE' ? 8 : 9} className="p-4 text-center text-muted-foreground text-base">Không có tiêu chí nào.</td></tr>
                              ) : (
                                filtered.map((item) => {
                                  const isParent = parentIds.has(item.id);
                                  const depth = depthMap.get(item.id) || 0;
                                  const isExpanded = expandedIds.has(item.id);
                                  const isFixed = item.score_type === 'FIXED';
                                  const val = inputValues[item.id] || '';
                                  const evidence = evidenceValues?.[item.id] || '';
                                  const isRowSaving = savingId === item.id;

                                  const isDeduction = item.score_type === 'DEDUCTION' || item.point < 0;
                                  const minVal = isDeduction ? item.point : 0;
                                  const maxVal = isDeduction ? 0 : (item.point > 0 ? item.point : 100);

                                  const multiplier = QUANTITY_MULTIPLIERS[item.code];
                                  const isQuantityBased = !!multiplier;
                                  const absMultiplier = isQuantityBased ? Math.abs(multiplier) : 1;
                                  const displayVal = isQuantityBased && val ? String(Math.abs(Number(val)) / absMultiplier) : val;
                                  const displayMinVal = isQuantityBased ? 0 : minVal;
                                  const displayMaxVal = isQuantityBased ? (isDeduction ? 40 : 30) : maxVal;
                                  const onChangeFn = isQuantityBased
                                    ? (e: React.ChangeEvent<HTMLInputElement>) => {
                                      if (e.target.value === '' || e.target.value === '-') {
                                        handleInputChange(item.id, '');
                                      } else {
                                        const num = Number(e.target.value);
                                        if (isNaN(num)) return;
                                        const qty = Math.abs(Math.round(num));
                                        const scoreVal = multiplier < 0 ? -(qty * absMultiplier) : qty * absMultiplier;
                                        handleInputChange(item.id, String(scoreVal));
                                      }
                                    }
                                    : (e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(item.id, e.target.value);

                                  if (isParent) {
                                    return (
                                      <tr key={item.id} className="bg-surface-muted hover:bg-surface-muted/80 cursor-pointer transition-colors" onClick={() => toggleExpand(item.id)}>
                                        <td className="px-2 py-1.5 text-sm font-medium text-muted-foreground">{item.code}</td>
                                        <td className="px-2 py-1.5">
                                          <div className="flex items-center" style={{ paddingLeft: `${depth * 1.2}rem` }}>
                                            <span className={`w-5 h-5 rounded flex items-center justify-center mr-2 text-xs font-semibold ${isExpanded ? 'bg-primary/20 text-primary' : 'bg-primary text-primary-foreground'}`}>{isExpanded ? '−' : '+'}</span>
                                            <span className="text-sm font-semibold text-foreground">{item.content}</span>
                                          </div>
                                        </td>
                                        <td className="px-2 py-1.5 text-center text-sm text-muted-foreground">{item.point}</td>
                                        <td className="px-2 py-1.5"></td>
                                        <td className="px-2 py-1.5 text-center text-sm font-semibold text-foreground">
                                          {currentRole === 'STUDENT' ? calculateAutoScore(item.id) : calculateScoreFromMap(item.id, savedStudentScores)}
                                        </td>
                                        {(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') && (
                                          <td className="px-2 py-1.5 text-center text-sm font-semibold text-foreground">
                                            {currentRole === 'CLASS_COMMITTEE' ? calculateAutoScore(item.id) : calculateScoreFromMap(item.id, savedClassScores)}
                                          </td>
                                        )}
                                        {currentRole === 'ADVISOR' && (
                                          <td className="px-2 py-1.5 text-center text-sm font-semibold text-foreground">
                                            {calculateAutoScore(item.id)}
                                          </td>
                                        )}
                                        <td className="px-2 py-1.5"></td>
                                        <td className="px-2 py-1.5 text-center"><span className="text-xs uppercase font-semibold text-muted-foreground bg-surface px-1.5 py-0.5 rounded border border-border/50">Auto</span></td>
                                      </tr>
                                    );
                                  }

                                  const itemErrors = validationErrors.filter(e => e.criterionId === item.id);
                                  const hasError = itemErrors.length > 0;

                                  return (
                                    <tr key={item.id} id={`criterion-${item.id}`} className={`hover:bg-surface-muted/50 transition-colors group ${isRowSaving ? 'opacity-50' : ''} ${hasError ? 'bg-danger/10' : ''}`}>
                                      <td className="px-2 py-1.5 text-sm text-muted-foreground">{item.code}</td>
                                      <td className="px-2 py-1.5">
                                        <div style={{ paddingLeft: `${depth * 1.2}rem` }}>
                                          <span className="text-sm text-foreground leading-snug">
                                            {item.content}
                                            {item.require_evidence === 1 && <span className="text-danger font-bold ml-1" title="Bắt buộc có minh chứng">*</span>}
                                          </span>
                                          {item.description && <span className="text-xs text-muted-foreground mt-0.5 block leading-relaxed">{item.description}</span>}
                                          {item.require_evidence === 1 && <span className="text-[10px] text-danger font-medium block mt-1 uppercase tracking-wide">⚠️ Bắt buộc đính kèm minh chứng</span>}
                                          {itemErrors.map((err, idx) => (
                                            <span key={idx} className="text-xs text-danger font-semibold mt-1.5 flex items-center gap-1 bg-danger/10 p-1.5 rounded-md border border-danger/20">
                                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {err.message}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="px-2 py-1.5 text-center text-sm text-muted-foreground">
                                        {isQuantityBased ? (multiplier > 0 ? `+${multiplier}` : `${multiplier}`) : item.point}
                                      </td>

                                      {/* Số lượng Column */}
                                      <td className="px-2 py-1.5 text-center">
                                        {!isFixed && isQuantityBased ? (
                                          <div className="relative inline-block">
                                            <input type="number" min={0} max={displayMaxVal} step={1} value={displayVal} disabled={!effectiveCanEdit || isRowSaving || isSavingDraft || isSubmitting} onChange={onChangeFn} className="w-16 h-9 text-center text-sm font-medium text-foreground bg-input border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:bg-surface-muted disabled:text-muted-foreground disabled:border-border hover:border-primary/50" />
                                            {isRowSaving && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin bg-surface"></div>}
                                          </div>
                                        ) : (
                                          <span className="text-sm text-muted-foreground">-</span>
                                        )}
                                      </td>

                                      {/* Student Score Column (Tổng điểm) */}
                                      <td className="px-2 py-1.5 text-center">
                                        {isFixed ? (
                                          <span className="text-sm font-semibold text-foreground bg-surface-muted px-2 py-1 rounded-lg">{item.point}</span>
                                        ) : currentRole === 'STUDENT' ? (
                                          isQuantityBased ? (
                                            <span className="text-sm font-semibold text-foreground">{val ? `${val}` : '0'}</span>
                                          ) : item.score_type === 'OPTIONS' ? (
                                            <div className="flex flex-col items-center gap-1">
                                              <div className="relative inline-block">
                                                <select
                                                  value={val}
                                                  disabled={!effectiveCanEdit || isRowSaving || isSavingDraft || isSubmitting}
                                                  onChange={(e) => handleInputChange(item.id, e.target.value)}
                                                  className="w-16 h-9 px-1 text-center text-sm font-medium text-foreground bg-input border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:bg-surface-muted disabled:text-muted-foreground hover:border-primary/50 cursor-pointer appearance-none"
                                                  style={{ textAlignLast: 'center' }}
                                                >
                                                  <option value="" disabled>-</option>
                                                  {Array.isArray(item.score_options)
                                                    ? item.score_options.map((opt, idx) => (
                                                      <option key={idx} value={String(opt)}>{opt}</option>
                                                    ))
                                                    : <option value={item.point}>{item.point}</option>}
                                                </select>
                                                {isRowSaving && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin bg-surface"></div>}
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex flex-col items-center gap-1">
                                              <div className="relative inline-block">
                                                <input type="number" min={minVal} max={maxVal} value={val} disabled={!effectiveCanEdit || isRowSaving || isSavingDraft || isSubmitting} onChange={(e) => handleInputChange(item.id, e.target.value)} className="w-16 h-9 text-center text-sm font-medium text-foreground bg-input border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:bg-surface-muted disabled:text-muted-foreground hover:border-primary/50" />
                                                {isRowSaving && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin bg-surface"></div>}
                                              </div>
                                            </div>
                                          )
                                        ) : (
                                          <span className="text-sm font-medium text-foreground">{savedStudentScores[item.id] ?? '-'}</span>
                                        )}
                                      </td>

                                      {/* BCS Score Column */}
                                      {(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') && (
                                        <td className="px-2 py-1.5 text-center">
                                          {isFixed ? (
                                            <span className="text-sm font-semibold text-foreground bg-surface-muted px-2 py-1 rounded-lg border border-border/50">{item.point}</span>
                                          ) : currentRole === 'CLASS_COMMITTEE' ? (
                                            isQuantityBased ? (
                                              <span className="text-sm font-semibold text-primary">{val ? `${val}` : '0'}</span>
                                            ) : item.score_type === 'OPTIONS' ? (
                                              <div className="flex flex-col items-center gap-1">
                                                <div className="relative inline-block">
                                                  <select
                                                    value={val}
                                                    disabled={!effectiveCanEdit || isRowSaving || isSavingDraft || isSubmitting}
                                                    onChange={(e) => handleInputChange(item.id, e.target.value)}
                                                    className="w-16 h-9 px-1 text-center text-sm font-medium text-foreground bg-input border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:bg-surface-muted disabled:text-muted-foreground hover:border-primary/50 cursor-pointer appearance-none"
                                                    style={{ textAlignLast: 'center' }}
                                                  >
                                                    <option value="" disabled>-</option>
                                                    {Array.isArray(item.score_options)
                                                      ? item.score_options.map((opt, idx) => (
                                                        <option key={idx} value={String(opt)}>{opt}</option>
                                                      ))
                                                      : <option value={item.point}>{item.point}</option>}
                                                  </select>
                                                  {isRowSaving && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin bg-surface"></div>}
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="flex flex-col items-center gap-1">
                                                <div className="relative inline-block">
                                                  <input type="number" min={minVal} max={maxVal} value={val} disabled={!effectiveCanEdit || isRowSaving || isSavingDraft || isSubmitting} onChange={(e) => handleInputChange(item.id, e.target.value)} className="w-16 h-9 text-center text-sm font-medium text-foreground bg-input border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:bg-surface-muted disabled:text-muted-foreground hover:border-primary/50" />
                                                  {isRowSaving && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin bg-surface"></div>}
                                                </div>
                                              </div>
                                            )
                                          ) : (
                                            <span className="text-sm font-medium text-foreground">{savedClassScores[item.id] ?? '-'}</span>
                                          )}
                                        </td>
                                      )}

                                      {/* Advisor Score Column */}
                                      {currentRole === 'ADVISOR' && (
                                        <td className="px-2 py-1.5 text-center">
                                          {isFixed ? (
                                            <span className="text-sm font-semibold text-foreground bg-surface-muted px-2 py-1 rounded-lg">{item.point}</span>
                                          ) : (
                                            isQuantityBased ? (
                                              <span className="text-sm font-semibold text-foreground">{val ? `${val}` : '0'}</span>
                                            ) : item.score_type === 'OPTIONS' ? (
                                              <div className="flex flex-col items-center gap-1">
                                                <div className="relative inline-block">
                                                  <select
                                                    value={val}
                                                    disabled={!effectiveCanEdit || isRowSaving || isSavingDraft || isSubmitting}
                                                    onChange={(e) => handleInputChange(item.id, e.target.value)}
                                                    className="w-16 h-9 px-1 text-center text-sm font-medium text-foreground bg-input border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:bg-surface-muted disabled:text-muted-foreground hover:border-primary/50 cursor-pointer appearance-none"
                                                    style={{ textAlignLast: 'center' }}
                                                  >
                                                    <option value="" disabled>-</option>
                                                    {Array.isArray(item.score_options)
                                                      ? item.score_options.map((opt, idx) => (
                                                        <option key={idx} value={String(opt)}>{opt}</option>
                                                      ))
                                                      : <option value={item.point}>{item.point}</option>}
                                                  </select>
                                                  {isRowSaving && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin bg-surface"></div>}
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="flex flex-col items-center gap-1">
                                                <div className="relative inline-block">
                                                  <input type="number" min={minVal} max={maxVal} value={val} disabled={!effectiveCanEdit || isRowSaving || isSavingDraft || isSubmitting} onChange={(e) => handleInputChange(item.id, e.target.value)} className="w-16 h-9 text-center text-sm font-medium text-foreground bg-input border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:bg-surface-muted disabled:text-muted-foreground hover:border-primary/50" />
                                                  {isRowSaving && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin bg-surface"></div>}
                                                </div>
                                              </div>
                                            )
                                          )}
                                        </td>
                                      )}
                                      <td className="px-2 py-1.5">
                                        {!isFixed && (
                                          <div className="relative flex items-center">
                                            <input type="text" placeholder="Link minh chứng..." value={evidence} disabled={!effectiveCanEdit || isRowSaving || isSavingDraft || isSubmitting} onChange={(e) => setEvidenceValues(prev => ({ ...prev, [item.id]: e.target.value }))} className="w-full h-9 px-3 text-sm text-foreground bg-input border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all pr-8 disabled:bg-surface-muted disabled:text-muted-foreground hover:border-primary/50 placeholder:text-muted-foreground" />
                                            {evidence && (
                                              <a href={evidence.startsWith('http') ? evidence : `https://${evidence}`} target="_blank" rel="noopener noreferrer" className="absolute right-2 w-6 h-6 bg-primary-light hover:bg-primary/20 rounded-full flex items-center justify-center transition-colors shadow-sm cursor-pointer z-10" title="Mở liên kết minh chứng">
                                                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                              </a>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-2 py-1.5 text-center">
                                        {!isFixed && effectiveCanEdit && (
                                          <button onClick={() => { handleInputChange(item.id, ''); setEvidenceValues(prev => ({ ...prev, [item.id]: '' })); }} disabled={isRowSaving || isSavingDraft || isSubmitting} className="w-7 h-7 rounded-md flex items-center justify-center text-stone-400 hover:text-stone-500 hover:bg-stone-50 transition-colors mx-auto opacity-0 group-hover:opacity-100 disabled:opacity-0" title="Xóa">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
            </>
          )}

        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl p-7 max-w-sm w-full shadow-2xl border border-border">
            <div className="w-14 h-14 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-5 mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <h3 className="text-lg font-semibold text-center text-foreground mb-1.5">
              {(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') ? 'Bạn có chắc chắn xác nhận?' : 'Xác nhận nộp phiếu?'}
            </h3>
            <p className="text-center text-muted-foreground text-xs mb-6 leading-relaxed">
              {(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') ? 'Phiếu điểm sẽ được xác nhận và chuyển sang trạng thái tiếp theo.' : 'Sau khi nộp, bạn sẽ không thể chỉnh sửa điểm. Bạn chắc chắn chứ?'}
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 px-4 bg-surface-muted hover:bg-surface-muted/80 text-foreground font-semibold text-sm rounded-xl transition-colors border border-border">Hủy bỏ</button>
              <button onClick={doSubmitForm} className="flex-1 py-2.5 px-4 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-sm rounded-xl shadow-sm transition-colors">
                {(currentRole === 'CLASS_COMMITTEE' || currentRole === 'ADVISOR') ? 'Đồng ý Xác nhận' : 'Đồng ý Nộp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Now Reject Form) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl p-7 max-w-sm w-full shadow-2xl border border-border">
            <div className="w-14 h-14 bg-danger/10 text-danger rounded-xl flex items-center justify-center mb-5 mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>
            <h3 className="text-lg font-semibold text-center text-foreground mb-2">Trả lại Phiếu Rèn Luyện?</h3>
            <p className="text-center text-muted-foreground text-sm mb-4 leading-relaxed">
              Vui lòng nhập lý do trả lại để sinh viên biết và chỉnh sửa lại phiếu.
            </p>
            <div className="mb-6">
              <textarea
                autoFocus
                rows={3}
                className="w-full text-sm border border-border rounded-xl p-3 focus:border-primary focus:ring-0 outline-none transition-all resize-none bg-surface-muted text-foreground placeholder-muted-foreground"
                placeholder="Nhập lý do trả lại..."
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 px-4 bg-surface-muted hover:bg-surface-muted/80 text-foreground font-semibold text-sm rounded-xl transition-colors border border-border">Hủy bỏ</button>
              <button onClick={doDeleteForm} className="flex-1 py-2.5 px-4 bg-danger hover:bg-danger-hover text-primary-foreground font-semibold text-sm rounded-xl transition-colors shadow-sm shadow-danger/20">Trả lại Phiếu</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
