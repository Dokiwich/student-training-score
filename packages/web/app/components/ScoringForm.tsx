'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  ChevronDown,
  ChevronRight,
  Save,
  Loader2,
  Check,
  Send,
  AlertCircle,
  CheckCircle2,
  XCircle,
  X,
  Info,
} from 'lucide-react';

const API_BASE = '/proxy-api';

const FIXED_CODES = ['1.1.1', '2.1', '4.1', '3.1.1'];

const TAB_GROUPS = [
  { id: '1', shortTitle: 'Mục 1', fullTitle: 'Đánh giá về ý thức tham gia học tập', title: 'Ý thức tham gia học tập', max: 20 },
  { id: '2', shortTitle: 'Mục 2', fullTitle: 'Đánh giá về ý thức chấp hành Nội quy, Quy chế, Quy định trong Nhà trường', title: 'Chấp hành nội quy, quy chế', max: 20 },
  { id: '3', shortTitle: 'Mục 3', fullTitle: 'Đánh giá về ý thức tham gia các hoạt động chính trị, xã hội, văn hóa, văn nghệ, thể thao, phòng chống tội phạm và các tệ nạn xã hội', title: 'Hoạt động chính trị, xã hội, thể thao', max: 15 },
  { id: '4', shortTitle: 'Mục 4', fullTitle: 'Đánh giá về ý thức công dân trong quan hệ cộng đồng', title: 'Quan hệ cộng đồng', max: 20 },
  { id: '5', shortTitle: 'Mục 5', fullTitle: 'Đánh giá về ý thức và kết quả tham gia công tác cán bộ lớp, các đoàn thể, tổ chức khác trong Nhà trường hoặc sinh viên đạt được thành tích đặc biệt trong học tập, rèn luyện', title: 'Cán bộ lớp & Thành tích đặc biệt', max: 15 },
  { id: '6', shortTitle: 'Mục 6', fullTitle: 'Đánh giá về các thành tích xuất sắc trong học tập, rèn luyện, các hoạt động khác do Nhà trường tổ chức', title: 'Thành tích xuất sắc', max: 10 },
];

const ROLE_CONFIG = {
  STUDENT: { label: 'Sinh viên', colHeader: 'Tự Chấm' },
  CLASS_COMMITTEE: { label: 'Ban cán sự', colHeader: 'BCS Lớp' },
  ADVISOR: { label: 'Cố vấn', colHeader: 'CVHT' },
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
}

interface ScoreDetail {
  criteria_id: number;
  student_score: number | null;
  class_score: number | null;
  advisor_score: number | null;
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
    <div className={`sf-toast ${message.type}`}>
      {message.type === 'success' ? (
        <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
      ) : (
        <XCircle size={16} style={{ flexShrink: 0 }} />
      )}
      <span style={{ flex: 1 }}>{message.text}</span>
      <button
        onClick={() => onDismiss(message.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, borderRadius: 4, display: 'flex', opacity: 0.5 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

/* ─── Hero Score Ring ─── */
function HeroScoreRing({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const radius = 46;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="sf-hero-ring">
      <svg style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5e6ad2" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke="url(#scoreGrad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="sf-hero-ring-center">
        <span className="sf-hero-ring-value">{value}</span>
        <span className="sf-hero-ring-max">/ {max}</span>
      </div>
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
}: ScoringFormProps) {
  const { data: session } = useSession();

  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [savedStudentScores, setSavedStudentScores] = useState<Record<number, number>>({});
  const [savedClassScores, setSavedClassScores] = useState<Record<number, number>>({});
  const [savedAdvisorScores, setSavedAdvisorScores] = useState<Record<number, number>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [proofUrls, setProofUrls] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('1');
  const [currentRole] = useState<Role>(forcedRole || 'STUDENT');
  const [formStatus, setFormStatus] = useState<string>('DRAFT');
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    setIsLoading(true);
    try {
      const customJwt = (session as any)?.customJwt;
      const headersInit: HeadersInit = { 'Content-Type': 'application/json' };
      if (customJwt) headersInit['Authorization'] = `Bearer ${customJwt}`;

      const [criteriaRes, scoresRes] = await Promise.all([
        fetch(`${API_BASE}/scoring/criteria`, {
          headers: headersInit,
          credentials: 'include',
        }),
        fetch(`${API_BASE}/scoring/${formId}/scores?studentId=${studentId}`, {
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
        const text = await criteriaRes.text();
        setFetchError(`Khong the tai tieu chi: ${criteriaRes.status} ${text}`);
      }

      if (scoresRes.ok) {
        const scoresData = await scoresRes.json();
        const sMap: Record<number, number> = {};
        const cMap: Record<number, number> = {};
        const aMap: Record<number, number> = {};
        const pMap: Record<number, string> = {};
        scoresData.data.forEach((s: any) => {
          if (s.student_score !== null && s.student_score !== undefined) sMap[s.criteria_id] = Number(s.student_score);
          if (s.class_score !== null && s.class_score !== undefined) cMap[s.criteria_id] = Number(s.class_score);
          if (s.advisor_score !== null && s.advisor_score !== undefined) aMap[s.criteria_id] = Number(s.advisor_score);
          if (s.proof_url) pMap[s.criteria_id] = s.proof_url;
        });
        setSavedStudentScores(sMap);
        setSavedClassScores(cMap);
        setSavedAdvisorScores(aMap);
        setProofUrls(pMap);
        if (scoresData.formStatusDetail) setFormStatus(scoresData.formStatusDetail);
        if (scoresData.rejectionReason) setRejectionInfo(scoresData.rejectionReason);
        else setRejectionInfo(null);
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
        const cappedSum = item.max_points > 0 ? Math.min(sum, item.max_points) : sum;
        return Math.max(0, cappedSum);
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
        const cappedSum = item.max_points > 0 ? Math.min(sum, item.max_points) : sum;
        return Math.max(0, cappedSum);
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
            c.code.startsWith(`TC_0${tab.id}`) ||
            c.code.startsWith(`TC_${tab.id}`)),
      );
      const tabSum = tabRoots.reduce((sum, root) => sum + calculateAutoScore(root.id), 0);
      const safeTabSum = Math.max(0, Math.min(tabSum, tab.max));
      return acc + safeTabSum;
    }, 0);
  }, [criteria, calculateAutoScore]);

  const handleInputChange = (criteriaId: number, value: string) => {
    setInputValues((prev) => ({ ...prev, [criteriaId]: value }));
    setIsDirty(true);
  };

  // Save all leaf scores as draft (no status change)
  const handleSaveDraft = async () => {
    const leafItems = criteria.filter((c) => !criteria.some((x) => x.parent_id === c.id) && !FIXED_CODES.includes(c.code));
    if (leafItems.length === 0) return;
    setIsSavingDraft(true);
    try {
      const customJwt = (session as any)?.customJwt;
      const headersInit: HeadersInit = { 'Content-Type': 'application/json' };
      if (customJwt) headersInit['Authorization'] = `Bearer ${customJwt}`;

      const results: { id: number; score: number }[] = [];
      let failCount = 0;
      let lastError = '';

      // Helper to save a single criteria item
      const saveSingleItem = async (item: typeof leafItems[0]) => {
        const raw = inputValues[item.id] ?? '';
        const score = raw === '' ? 0 : parseFloat(raw);
        if (isNaN(score)) return null;

        try {
          const r = await fetch(`${API_BASE}/scoring/${formId}/submit-criteria`, {
            method: 'POST', credentials: 'include', headers: headersInit,
            body: JSON.stringify({ criteriaId: item.id, score, role: currentRole, studentId, proofUrl: proofUrls[item.id], isDraft: true }),
          });
          if (r.ok) return { id: item.id, score };
          // Read actual error from backend
          const errData = await r.json().catch(() => null);
          lastError = errData?.message || `HTTP ${r.status}`;
          failCount++;
        } catch (e) {
          console.error('Save item error:', e);
          failCount++;
        }
        return null;
      };

      // Send the FIRST request sequentially to ensure the scoring sheet is created
      if (leafItems.length > 0) {
        const firstResult = await saveSingleItem(leafItems[0]);
        if (firstResult) results.push(firstResult);
      }

      // Batch the remaining items with Promise.all
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
      // Refetch from server to ensure local state is 100% in sync with DB
      await fetchData();
    } catch {
      addToast('error', 'Lỗi khi lưu nháp');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSaveRow = async (criteriaId: number, maxPoints: number) => {
    const raw = inputValues[criteriaId] ?? '';
    const score = raw === '' ? 0 : parseFloat(raw);
    if (isNaN(score)) return addToast('error', 'Vui lòng nhập số hợp lệ');

    setSavingId(criteriaId);
    try {
      const customJwt = (session as any)?.customJwt;
      const headersInit: HeadersInit = { 'Content-Type': 'application/json' };
      if (customJwt) headersInit['Authorization'] = `Bearer ${customJwt}`;

      const response = await fetch(`${API_BASE}/scoring/${formId}/submit-criteria`, {
        method: 'POST',
        credentials: 'include',
        headers: headersInit,
        body: JSON.stringify({ criteriaId, score, role: currentRole, studentId, proofUrl: proofUrls[criteriaId], isDraft: true }),
      });

      if (response.ok) {
        if (currentRole === 'STUDENT')
          setSavedStudentScores((prev) => ({ ...prev, [criteriaId]: score }));
        if (currentRole === 'CLASS_COMMITTEE')
          setSavedClassScores((prev) => ({ ...prev, [criteriaId]: score }));
        if (currentRole === 'ADVISOR')
          setSavedAdvisorScores((prev) => ({ ...prev, [criteriaId]: score }));
        addToast('success', 'Đã lưu thành công!');
        // Đồng bộ lại dữ liệu sau khi lưu lẻ để tính toán tổng điểm mới từ server
        await fetchData();
      } else {
        const errData = await response.json().catch(() => null);
        addToast('error', errData?.message || `Lỗi khi lưu điểm (${response.status})`);
      }
    } finally {
      setSavingId(null);
    }
  };

  const doSubmitForm = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    try {
      // Auto-save draft if there are unsaved changes or if the form has never been saved (empty form)
      const currentSavedMap = getSavedMap(currentRole);
      const isCompletelyEmpty = Object.keys(currentSavedMap).length === 0;
      if (isDirty || isCompletelyEmpty) {
        await handleSaveDraft();
      }

      const customJwt = (session as any)?.customJwt;
      const headersInit: HeadersInit = { 'Content-Type': 'application/json' };
      if (customJwt) headersInit['Authorization'] = `Bearer ${customJwt}`;

      const response = await fetch(`${API_BASE}/scoring/${formId}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: headersInit,
        body: JSON.stringify({ role: currentRole, studentId }),
      });

      if (response.ok) {
        const data = await response.json();

        if (currentRole === 'STUDENT') setFormStatus('STUDENT_SUBMITTED');
        else if (currentRole === 'CLASS_COMMITTEE') setFormStatus('CLASS_REVIEWED');
        else if (currentRole === 'ADVISOR') setFormStatus('ADVISOR_APPROVED');

        setIsDirty(false);
        addToast('success', data.message || 'Nộp phiếu thành công!');
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


  const doResetForm = async () => {
    if (!window.confirm("CẢNH BÁO: Hành động này sẽ XÓA HOÀN TOÀN phiếu điểm hiện tại và mọi dữ liệu chấm điểm của sinh viên này. Sinh viên sẽ phải làm lại từ đầu. Bạn có chắc chắn muốn tiếp tục?")) return;

    setIsSubmitting(true);
    try {
      const customJwt = (session as any)?.customJwt;
      const headersInit: HeadersInit = { 'Content-Type': 'application/json' };
      if (customJwt) headersInit['Authorization'] = `Bearer ${customJwt}`;

      const response = await fetch(`${API_BASE}/scoring/${formId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: headersInit,
        body: JSON.stringify({ studentId }),
      });

      if (response.ok) {
        addToast('success', 'Đã xóa và reset phiếu điểm thành công!');
        // Tải lại dữ liệu - Backend sẽ tự tạo phiếu DRAFT mới hoàn toàn
        await fetchData();
      } else {
        const errorData = await response.json().catch(() => null);
        addToast('error', errorData?.message || 'Lỗi khi xóa phiếu');
      }
    } catch {
      addToast('error', 'Không thể kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForm = () => setShowConfirm(true);

  /* ─── Status banner config ─── */
  const STATUS_INFO: Record<string, { label: string; icon: string; bg: string; color: string; border: string }> = {
    DRAFT: { label: 'Bản nháp — chưa nộp', icon: '', bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
    STUDENT_SUBMITTED: { label: 'SV đã nộp → Chờ BCS xét duyệt', icon: '', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
    CLASS_REVIEWING: { label: 'BCS đang xét duyệt', icon: '', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
    CLASS_REVIEWED: { label: 'BCS đã duyệt → Chờ CVHT phê duyệt', icon: '', bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
    ADVISOR_REVIEWING: { label: 'CVHT đang xét duyệt', icon: '', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
    ADVISOR_APPROVED: { label: 'CVHT đã phê duyệt', icon: '', bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
    SCHOOL_REVIEWING: { label: 'Nhà trường đang xét duyệt', icon: '', bg: '#f5f3ff', color: '#5b21b6', border: '#c4b5fd' },
    SCHOOL_APPROVED: { label: 'Nhà trường đã duyệt', icon: '', bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
    APPEALING: { label: 'Đang phúc khảo', icon: '', bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
    FINALIZED: { label: 'Đã chốt điểm chính thức', icon: '', bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
  };
  const statusInfo = STATUS_INFO[formStatus] || STATUS_INFO.DRAFT;

  // Role-aware edit permission: each role can edit at the status meant for them
  const effectiveCanEdit = canEdit && (() => {
    if (currentRole === 'STUDENT') return formStatus === 'DRAFT';
    if (currentRole === 'CLASS_COMMITTEE') return ['STUDENT_SUBMITTED', 'CLASS_REVIEWING'].includes(formStatus);
    if (currentRole === 'ADVISOR') return ['CLASS_REVIEWED', 'ADVISOR_REVIEWING'].includes(formStatus);
    return false;
  })();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 12 }}>
        <Loader2 size={28} style={{ color: '#d1d5db' }} />
        <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>Đang tải dữ liệu...</span>
      </div>
    );
  }

  // History page: only show if form has passed all review stages
  if (viewMode === 'history' && requiredStatuses && requiredStatuses.length > 0) {
    if (!requiredStatuses.includes(formStatus)) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 16 }}>
          <div style={{ fontSize: 48 }}>📋</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#374151', margin: 0 }}>Chưa có lịch sử đánh giá</h3>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, textAlign: 'center', maxWidth: 320 }}>
            Phiếu rèn luyện cần được duyệt qua tất cả các vòng (BCS + CVHT) trước khi xuất hiện trong lịch sử.
          </p>
          <p style={{ fontSize: 12, color: '#d1d5db', margin: 0 }}>
            Trạng thái hiện tại: <strong style={{ color: '#6b7280' }}>{statusInfo.label}</strong>
          </p>
        </div>
      );
    }
  }

  return (
    <>
      {/* Toast */}
      {toasts.length > 0 && (
        <div className="sf-toast-container">
          {toasts.map((t) => <Toast key={t.id} message={t} onDismiss={removeToast} />)}
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="sf-modal-overlay">
          <div className="sf-modal-card">

            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', textAlign: 'center', marginBottom: 8 }}>Xác nhận nộp phiếu</h3>
            <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 4 }}>
              Tổng điểm tự chấm: <strong style={{ color: '#5e6ad2', fontSize: 24 }}>{totalScore}</strong> / 100
            </p>
            <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginBottom: 28 }}>Sau khi nộp bạn sẽ không thể chỉnh sửa.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setShowConfirm(false)} className="btn-secondary" style={{ minWidth: 100 }}>Hủy</button>
              <button onClick={doSubmitForm} className="sf-action-btn primary" style={{ minWidth: 120 }}>
                <Send size={14} /> Nộp chính thức
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ CARD-BASED LAYOUT ══════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* 1. STATUS + STEPPER */}
        <div className="sf-status-card">
          <div className="sf-status-banner" style={{ background: statusInfo.bg, color: statusInfo.color, borderBottom: `1px solid ${statusInfo.border}` }}>
            <span>{statusInfo.label}</span>
            {isDirty && <span style={{ marginLeft: 'auto', fontSize: 12, display: 'flex', alignItems: 'center' }}><span className="sf-unsaved-dot" />Chưa lưu</span>}
          </div>
          {rejectionInfo && formStatus === 'DRAFT' && (
            <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#991b1b', fontWeight: 500 }}>
              {rejectionInfo}
            </div>
          )}
          <div className="sf-stepper">
            {[
              { step: 1, label: 'SV tự chấm', active: ['STUDENT_SUBMITTED', 'CLASS_REVIEWING', 'CLASS_REVIEWED', 'ADVISOR_REVIEWING', 'ADVISOR_APPROVED', 'FINALIZED'].includes(formStatus) },
              { step: 2, label: 'BCS duyệt', active: ['CLASS_REVIEWED', 'ADVISOR_REVIEWING', 'ADVISOR_APPROVED', 'FINALIZED'].includes(formStatus) },
              { step: 3, label: 'CVHT duyệt', active: ['ADVISOR_APPROVED', 'FINALIZED'].includes(formStatus) },
            ].map((s, idx) => (
              <div key={idx} className="sf-stepper-step">
                <div className={`sf-stepper-dot ${s.active ? 'active' : 'inactive'}`}>{s.active ? '✓' : s.step}</div>
                <span className="sf-stepper-label" style={{ fontWeight: s.active ? 600 : 400, color: s.active ? '#111' : '#9ca3af' }}>{s.label}</span>
                {idx < 2 && <div className="sf-stepper-line" style={{ background: s.active ? '#10b981' : '#e5e7eb' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* 2. HERO SCORE */}
        <div className="sf-hero">
          <HeroScoreRing value={totalScore} max={100} />
          <div className="sf-hero-breakdown">
            {TAB_GROUPS.map((tab) => {
              const tabRoots = criteria.filter(c => (c.parent_id === null || c.parent_id === 0) && (c.code === tab.id || c.code.startsWith(tab.id + '.') || c.code.startsWith(`TC_0${tab.id}`) || c.code.startsWith(`TC_${tab.id}`)));
              const tabScore = Math.max(0, Math.min(tabRoots.reduce((sum, r) => sum + calculateAutoScore(r.id), 0), tab.max));
              return (
                <div key={tab.id} className="sf-hero-stat">
                  <div className="sf-hero-stat-label">{tab.title}</div>
                  <div className="sf-hero-stat-value">{tabScore}<span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>/{tab.max}</span></div>
                  <div className="sf-hero-stat-bar"><div className="sf-hero-stat-bar-fill" style={{ width: `${tab.max > 0 ? (tabScore / tab.max) * 100 : 0}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. PILL TABS with compact "Mục X" labels + popover on click */}
        <div className="sf-pill-tabs-row">
          <div className="sf-pill-tabs">
            {TAB_GROUPS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`sf-pill-tab ${activeTabId === tab.id ? 'active' : ''}`}
              >
                {tab.shortTitle}
                <span className="sf-pill-tab-badge">{tab.max}</span>
              </button>
            ))}
          </div>
          {/* Active tab detail popover */}
          {(() => {
            const activeTab = TAB_GROUPS.find(t => t.id === activeTabId);
            if (!activeTab) return null;
            return (
              <div className="sf-tab-detail">
                <Info size={14} style={{ flexShrink: 0, color: '#5e6ad2' }} />
                <span>{activeTab.fullTitle}</span>
                <span className="sf-tab-detail-max">Điểm: {activeTab.max} điểm</span>
              </div>
            );
          })()}
        </div>

        {/* 4. CRITERIA CARDS */}
        <div className="sf-criteria-list">

          {fetchError && (
            <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#991b1b' }}>
              <AlertCircle size={18} /> <span><strong>Lỗi:</strong> {fetchError}</span>
            </div>
          )}

          {(() => {
            const filtered = sortedCriteria.filter((item) => {
              if (!isVisible(item.id)) return false;
              const root = getRoot(item.id);
              if (!root) return true;
              return root.code === activeTabId || root.code.startsWith(activeTabId + '.') || root.code.startsWith(`TC_0${activeTabId}`) || root.code.startsWith(`TC_${activeTabId}`);
            });
            const itemsToRender = filtered.length > 0 ? filtered : sortedCriteria.filter((item) => isVisible(item.id));

            if (itemsToRender.length === 0 && criteria.length === 0) {
              return (
                <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
                  <AlertCircle size={24} style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13 }}>Không có tiêu chí đánh giá nào.</p>
                </div>
              );
            }

            return itemsToRender.map((item) => {
              const isParent = parentIds.has(item.id);
              const depth = depthMap.get(item.id) || 0;
              const isExpanded = expandedIds.has(item.id);
              const isFixed = FIXED_CODES.includes(item.code);
              const autoScore = calculateAutoScore(item.id);
              const currentVal = parseFloat(inputValues[item.id] || '');
              const activeSavedMap = getSavedMap(currentRole);
              const isSaved = !isParent && !isFixed && activeSavedMap[item.id] !== undefined && activeSavedMap[item.id] === currentVal;

              /* ── Parent Card ── */
              if (isParent) {
                return (
                  <div key={item.id} className={`sf-card-parent ${depth === 0 ? 'depth-0' : ''}`} style={{ marginLeft: depth > 0 ? depth * 16 : 0 }} onClick={() => toggleExpand(item.id)}>
                    <div className="sf-card-parent-header">
                      <div className="sf-card-expand">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
                      <span className={`sf-card-code ${depth === 0 ? 'root' : 'child'}`}>{item.code}</span>
                      <span className="sf-card-parent-content" style={{ fontWeight: depth === 0 ? 700 : 600, color: depth === 0 ? '#111' : '#374151' }}>{item.content}</span>
                      <div className="sf-card-parent-score">
                        <span className="sf-card-parent-score-val">{autoScore}</span>
                        <span className="sf-card-parent-score-max">/ {item.max_points}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              /* ── Leaf Card (horizontal: input left, content right) ── */
              return (
                <div key={item.id} className="sf-card-leaf" style={{ marginLeft: depth * 16 }}>
                  <div className="sf-card-leaf-row">
                    {/* LEFT: Scoring inputs */}
                    <div className="sf-card-leaf-left">
                      {isFixed ? (
                        <span className="sf-card-leaf-fixed">Cố định: {item.max_points}đ</span>
                      ) : (
                        <>
                          <div className="sf-card-leaf-input-group">
                            <span className="sf-card-leaf-input-label">{ROLE_CONFIG[currentRole].colHeader}</span>
                            <input
                              type="number"
                              value={inputValues[item.id] || ''}
                              disabled={!effectiveCanEdit}
                              onChange={(e) => handleInputChange(item.id, e.target.value)}
                              className={isSaved ? 'saved' : ''}
                              placeholder="0"
                            />
                          </div>
                          {effectiveCanEdit && (
                            <button
                              onClick={() => handleSaveRow(item.id, item.max_points)}
                              disabled={savingId === item.id || isSaved}
                              className={`sf-card-leaf-save ${isSaved ? 'saved' : savingId === item.id ? 'saving' : 'unsaved'}`}
                            >
                              {savingId === item.id ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /></> : isSaved ? <><Check size={12} /></> : <><Save size={12} /></>}
                            </button>
                          )}
                          {/* Show other roles' scores in history/review mode */}
                          {visibleRoles.filter(r => r !== currentRole).map(role => {
                            const roleMap = role === 'STUDENT' ? savedStudentScores : role === 'CLASS_COMMITTEE' ? savedClassScores : savedAdvisorScores;
                            const val = roleMap[item.id];
                            return (
                              <div key={role} className="sf-card-leaf-input-group sf-card-leaf-other-role">
                                <span className="sf-card-leaf-input-label">{ROLE_CONFIG[role].colHeader}</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', minWidth: 30, textAlign: 'center' }}>{val !== undefined ? val : '--'}</span>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                    {/* RIGHT: Content info */}
                    <div className="sf-card-leaf-right">
                      <div className="sf-card-leaf-header">
                        <span className="sf-card-code child">{item.code}</span>
                        <span className={`sf-card-leaf-content ${isFixed ? 'opacity-60' : ''}`}>{item.content}</span>
                        <span className="sf-card-leaf-max">Điểm: {item.max_points}</span>
                      </div>
                      {!isFixed && (
                        <div className="sf-card-leaf-proof-row">
                          <span className="sf-card-leaf-input-label">Minh chứng</span>
                          {currentRole === 'STUDENT' && effectiveCanEdit ? (
                            <input type="text" placeholder="Link drive..." value={proofUrls[item.id] || ''} onChange={(e) => setProofUrls(prev => ({ ...prev, [item.id]: e.target.value }))} className="sf-card-leaf-proof" />
                          ) : proofUrls[item.id] ? (
                            <a href={proofUrls[item.id]} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#5e6ad2' }}>Xem MC</a>
                          ) : <span style={{ fontSize: 11, color: '#d1d5db' }}>--</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* 5. FLOATING ACTION BAR */}
        {effectiveCanEdit && (
          <div className="sf-action-bar">
            <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>
              Tổng: <strong style={{ color: '#5e6ad2', fontSize: 18 }}>{totalScore}</strong> / 100
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {currentRole !== 'STUDENT' && (
                <button onClick={doResetForm} disabled={isSubmitting} className="sf-action-btn danger">Xóa & Reset</button>
              )}
              <button onClick={handleSaveDraft} disabled={isSavingDraft} className="sf-action-btn primary">
                {isSavingDraft ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />} Lưu nháp
              </button>
              <button onClick={handleSubmitForm} disabled={isSubmitting} className="sf-action-btn success">
                {isSubmitting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />} Nộp phiếu
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}