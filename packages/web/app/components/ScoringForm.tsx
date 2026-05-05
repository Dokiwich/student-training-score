'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { useSession } from 'next-auth/react';

const API_BASE = '/proxy-api';

const FIXED_CODES = ['1.1.1', '2.1', '4.1', '3.1.1'];

const TAB_GROUPS = [
  { id: '1', title: '1. Ý thức tham gia học tập', max: 20 },
  { id: '2', title: '2. Chấp hành nội quy, quy chế', max: 20 },
  { id: '3', title: '3. Hoạt động chính trị, xã hội, thể thao...', max: 15 },
  { id: '4', title: '4. Quan hệ cộng đồng', max: 20 },
  { id: '5', title: '5. Cán bộ lớp & Thành tích đặc biệt', max: 15 },
  { id: '6', title: '6. Thành tích xuất sắc', max: 10 },
];

const ROLE_CONFIG = {
  STUDENT: { label: 'Sinh viên', colHeader: 'SV Tự Chấm' },
  CLASS_PRESIDENT: { label: 'Ban cán sự', colHeader: 'BCS Lớp' },
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
    <div className={`px-4 py-3 text-sm font-medium border ${message.type === 'success' ? 'bg-white border-gray-300 text-black' : 'bg-gray-100 border-gray-400 text-black'}`}>
      <span className="font-bold">{message.type === 'success' ? 'OK:' : 'Loi:'}</span>{' '}
      {message.text}
    </div>
  );
}

function MiniProgress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const radius = 46;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="w-full h-1 bg-gray-200 mt-1">
      <div className="h-full bg-black transition-all duration-500" style={{ width: `${pct}%` }} />
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

        scoresData.data.forEach((s: ScoreDetail) => {
          if (s.student_score !== null) sMap[s.criteria_id] = s.student_score;
          if (s.class_score !== null) cMap[s.criteria_id] = s.class_score;
          if (s.advisor_score !== null) aMap[s.criteria_id] = s.advisor_score;
        });
        setSavedStudentScores(sMap);
        setSavedClassScores(cMap);
        setSavedAdvisorScores(aMap);
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
    const raw = inputValues[criteriaId];
    const score = parseFloat(raw);
    if (isNaN(score)) return addToast('error', 'Vui long nhap so');
    if (score < 0) return addToast('error', 'Khong duoc am');
    if (score > maxPoints) return addToast('error', `Toi da ${maxPoints}d`);

    setSavingId(criteriaId);
    try {
      const customJwt = (session as any)?.customJwt;
      const headersInit: HeadersInit = { 'Content-Type': 'application/json' };
      if (customJwt) headersInit['Authorization'] = `Bearer ${customJwt}`;

      const response = await fetch(`${API_BASE}/scoring/${formId}/submit-criteria`, {
        method: 'POST',
        credentials: 'include',
        headers: headersInit,
        body: JSON.stringify({ criteriaId, score, role: currentRole, studentId }),
      });

      if (response.ok) {
        // score is already defined above
        if (currentRole === 'STUDENT') setSavedStudentScores((prev) => ({ ...prev, [criteriaId]: score }));
        if (currentRole === 'CLASS_PRESIDENT') setSavedClassScores((prev) => ({ ...prev, [criteriaId]: score }));
        if (currentRole === 'ADVISOR') setSavedAdvisorScores((prev) => ({ ...prev, [criteriaId]: score }));
        addToast('success', 'Da luu thanh cong!');
      } else {
        addToast('error', 'Loi khi luu diem');
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
        addToast('success', data.message || 'Nop phieu thanh cong!');
      } else {
        const errorData = await response.json().catch(() => null);
        addToast('error', errorData?.message || 'Loi khi nop phieu');
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

  if (isLoading) return <div className="p-8 text-center text-gray-500">Dang tai...</div>;

  return (
    <>
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((t) => (
            <Toast key={t.id} message={t} onDismiss={removeToast} />
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-200 overflow-hidden flex-1 mb-0 flex flex-col">
        {/* HEADER */}
        <div className="bg-white px-6 pt-3 pb-2 flex flex-col items-center justify-center text-center border-b border-gray-200">
          <h2 className="text-base font-bold text-black uppercase tracking-wide mb-1">
            Phiếu Đánh Giá Điểm Rèn Luyện Sinh Viên Đại Học Chính Quy
          </h2>
          <p className="text-gray-500 text-xs mb-3">Học kỳ: I - Năm học 2025 - 2026</p>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs border border-gray-100 px-4 py-1.5 bg-gray-50">
            <p className="text-gray-500">Ho va ten: <strong className="text-black">{studentName || session?.user?.name || '...'}</strong></p>
            <p className="text-gray-500">MSSV: <strong className="text-black font-mono">{studentId || (session?.user as { studentId?: string })?.studentId || '...'}</strong></p>
            <p className="text-gray-500">Lop: <strong className="text-black">{classNameStr || '...'}</strong></p>
          </div>

          <div className="mt-3 text-right self-end">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Tong diem {ROLE_CONFIG[currentRole].colHeader}</p>
            <p className="text-2xl font-black text-black">{totalScore}<span className="text-sm text-gray-400 font-normal">/100</span></p>
            <MiniProgress value={totalScore} max={100} />
          </div>
        </div>

        {/* BODY */}
        <div className="flex flex-col lg:flex-row bg-white items-start">
          {/* LEFT TABS */}
          <div className="w-full lg:w-[250px] shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50 p-2 lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2 hidden lg:block">
              Danh mục
            </h3>
            <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 gap-2">
              {TAB_GROUPS.map((tab) => {
                const isActive = activeTabId === tab.id;
                const tabRoots = criteria.filter(
                  (c) => (c.parent_id === null || c.parent_id === 0) && (c.code === tab.id || c.code.startsWith(tab.id + '.') || c.code.startsWith(`TC_0${tab.id}`) || c.code.startsWith(`TC_${tab.id}`)),
                );
                const tabScore = Math.min(
                  tabRoots.reduce((acc, root) => acc + calculateAutoScore(root.id), 0),
                  tab.max,
                );

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`shrink-0 text-left p-3 border transition-colors min-w-[240px] lg:min-w-0 lg:w-full ${isActive ? 'border-black bg-gray-50' : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-xs font-bold px-1.5 py-0.5 ${isActive ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}`}>
                        Mục {tab.id}
                      </span>
                      <span className={`text-xs font-bold ${isActive ? 'text-black' : 'text-gray-400'}`}>
                        {tabScore}/{tab.max}
                      </span>
                    </div>
                    <p className={`text-sm line-clamp-2 ${isActive ? 'text-black font-medium' : 'text-gray-500'}`} title={tab.title}>
                      {tab.title}
                    </p>
                    <MiniProgress value={tabScore} max={tab.max} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT TABLE */}
          <div className="flex-1 w-full min-w-0 flex flex-col">
            <div className={`px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-end sticky ${stickyTop} z-10`}>
              <div className="flex gap-2">
                <button onClick={expandAll} className="text-xs px-3 py-1.5 border border-gray-300 hover:bg-gray-50">Mở hết</button>
                <button onClick={collapseAll} className="text-xs px-3 py-1.5 border border-gray-300 hover:bg-gray-50">Thu gọn</button>
              </div>
            </div>

            <div className="overflow-x-auto bg-white flex-1 min-h-[400px]">
              <table className="w-full text-left border-collapse min-w-full md:min-w-[700px]">
                <thead className={`sticky ${stickyTop === 'top-0' ? 'top-12' : 'top-[128px]'} z-20`}>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-300">
                    <th className="p-3 w-16 text-center">Mã</th>
                    <th className="p-3">Nội dung đánh giá</th>
                    <th className="p-3 w-20 text-center">Điểm QĐ</th>
                    {visibleRoles.map((role) => {
                      const isActiveCol = role === currentRole;
                      return (
                        <th key={role} className={`p-3 w-24 text-center border-l border-gray-200 ${isActiveCol ? 'bg-gray-100 font-bold text-black' : ''}`}>
                          {ROLE_CONFIG[role].colHeader}
                          {isActiveCol && <span className="block text-[9px] mt-0.5 text-gray-400">đang sửa</span>}
                        </th>
                      );
                    })}
                    {canEdit && <th className="p-3 w-24 text-center">Thao tác</th>}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {/* DEBUG INFO TO FIGURE OUT WHY TABLE IS EMPTY */}
                  {criteria.length > 0 && (
                    <tr className="bg-yellow-50">
                      <td colSpan={4} className="p-2 text-[10px] text-gray-500 font-mono border-b border-yellow-200">
                        Total items: {criteria.length}. Sorted: {sortedCriteria.length}. Tab {activeTabId} matching roots: {criteria.filter(c => (c.parent_id === null || c.parent_id === 0) && (c.code === activeTabId || c.code.startsWith(activeTabId + '.') || c.code.startsWith(`TC_0${activeTabId}`))).length}.
                      </td>
                    </tr>
                  )}

                  {fetchError && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-red-600 bg-red-50 border border-red-200">
                        <strong>Lỗi hệ thống:</strong> {fetchError}
                      </td>
                    </tr>
                  )}
                  {(() => {
                    const filtered = sortedCriteria.filter((item) => {
                      if (!isVisible(item.id)) return false;
                      const root = getRoot(item.id);
                      if (!root) return true; // failsafe
                      return root.code === activeTabId || root.code.startsWith(activeTabId + '.') || root.code.startsWith(`TC_0${activeTabId}`) || root.code.startsWith(`TC_${activeTabId}`);
                    });

                    // FALLBACK: If filter blocked EVERYTHING, but there are criteria, something is wrong with matching! Render everything to save the day.
                    const itemsToRender = filtered.length > 0 ? filtered : (sortedCriteria.length > 0 ? sortedCriteria.filter(item => isVisible(item.id)) : []);

                    if (itemsToRender.length === 0 && !isLoading && criteria.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-gray-500">
                            Không có tiêu chí đánh giá nào. Vui lòng liên hệ quản trị viên.
                          </td>
                        </tr>
                      );
                    }

                    return itemsToRender.map((item) => {
                      const isParent = parentIds.has(item.id);
                      const depth = depthMap.get(item.id) || 0;
                      const isExpanded = expandedIds.has(item.id);
                      const isFixed = FIXED_CODES.includes(item.code);

                      const scoreByRole: Record<Role, number> = {
                        STUDENT: currentRole === 'STUDENT' ? calculateAutoScore(item.id) : calculateScoreFromMap(item.id, savedStudentScores),
                        CLASS_PRESIDENT: currentRole === 'CLASS_PRESIDENT' ? calculateAutoScore(item.id) : calculateScoreFromMap(item.id, savedClassScores),
                        ADVISOR: currentRole === 'ADVISOR' ? calculateAutoScore(item.id) : calculateScoreFromMap(item.id, savedAdvisorScores),
                      };

                      const currentVal = parseFloat(inputValues[item.id] || '');
                      const activeSavedMap = getSavedMap(currentRole);
                      const isSaved = !isParent && !isFixed && activeSavedMap[item.id] !== undefined && activeSavedMap[item.id] === currentVal;

                      if (isParent) {
                        return (
                          <tr key={item.id} className={`cursor-pointer hover:bg-gray-50 ${depth === 0 ? 'bg-gray-50' : ''}`} onClick={() => toggleExpand(item.id)}>
                            <td className="p-3">
                              <span className="text-xs font-bold text-black bg-gray-200 px-2 py-1">{item.code}</span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center" style={{ paddingLeft: `${depth * 1.5}rem` }}>
                                <button className="mr-2 p-1 text-gray-500 hover:text-black" onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}>
                                  {isExpanded ? '[-]' : '[+]'}
                                </button>
                                <span className={`text-sm ${depth === 0 ? 'font-bold text-black' : 'font-semibold text-gray-800'}`}>{item.content}</span>
                              </div>
                            </td>
                            <td className="p-3 text-center text-xs font-bold text-gray-500">{item.max_points}</td>
                            {visibleRoles.map((role) => {
                              const isActiveCol = role === currentRole;
                              return (
                                <td key={role} className={`p-3 text-center border-l border-gray-100 ${isActiveCol ? 'bg-gray-50' : ''}`}>
                                  <span className={`text-lg font-bold ${isActiveCol ? 'text-black' : 'text-gray-400'}`}>{scoreByRole[role]}</span>
                                </td>
                              );
                            })}
                            {canEdit && <td className="p-3 text-center"><span className="text-[10px] text-gray-400">Tự cộng</span></td>}
                          </tr>
                        );
                      }

                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1">{item.code}</span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center" style={{ paddingLeft: `${depth * 1.5}rem` }}>
                              <div className="w-6 mr-2" />
                              <span className={`text-sm ${isFixed ? 'text-gray-500' : 'text-gray-600'}`}>{item.content}</span>
                              {isFixed && <span className="ml-2 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 font-bold">Cố định</span>}
                            </div>
                          </td>
                          <td className="p-3 text-center text-xs text-gray-500">{item.max_points}</td>

                          {visibleRoles.map((role) => {
                            const isActiveCol = role === currentRole;
                            const roleMap = role === 'STUDENT' ? savedStudentScores : role === 'CLASS_PRESIDENT' ? savedClassScores : savedAdvisorScores;

                            if (isFixed) {
                              return (
                                <td key={role} className={`p-3 text-center border-l border-gray-100 ${isActiveCol ? 'bg-gray-50' : ''}`}>
                                  <span className="text-sm font-bold text-gray-500">{item.max_points}</span>
                                </td>
                              );
                            }

                            if (isActiveCol) {
                              return (
                                <td key={role} className="p-3 border-l border-gray-100 bg-gray-50">
                                  <input
                                    type="number"
                                    min={0}
                                    max={item.max_points}
                                    value={inputValues[item.id] || ''}
                                    disabled={!canEdit}
                                    readOnly={!canEdit}
                                    onChange={(e) => handleInputChange(item.id, e.target.value)}
                                    className={`w-full border px-2 py-1.5 text-center text-sm outline-none transition-colors ${!canEdit
                                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                        : isSaved
                                          ? 'bg-gray-50 border-gray-400 text-black font-bold'
                                          : 'border-gray-300 focus:border-black'
                                      }`}
                                  />
                                </td>
                              );
                            }

                            const val = roleMap[item.id];
                            return (
                              <td key={role} className="p-3 border-l border-gray-100">
                                <input type="text" disabled readOnly value={val !== undefined ? val : '-'} className="w-full border border-gray-200 bg-gray-100 px-2 py-1.5 text-center text-sm text-gray-400 cursor-not-allowed" />
                              </td>
                            );
                          })}

                          {canEdit && (
                            <td className="p-3 text-center">
                              {!isFixed && (
                                <button
                                  onClick={() => handleSaveRow(item.id, item.max_points)}
                                  disabled={savingId === item.id || isSaved}
                                  className={`px-3 py-1.5 text-xs font-bold transition-colors w-full ${isSaved ? 'bg-gray-100 text-gray-500 cursor-default' : 'bg-black text-white hover:bg-gray-800'
                                    }`}
                                >
                                  {savingId === item.id ? 'Đang lưu...' : isSaved ? 'Đã lưu' : 'Lưu'}
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {canEdit && (
              <div className="fixed bottom-6 right-6 z-50">
                <button onClick={handleSubmitForm} className="bg-black hover:bg-gray-800 text-white font-bold py-3 px-8 shadow-2xl transition-transform hover:scale-105 rounded border border-gray-700">
                  CHỐT NỘP PHIẾU NÀY
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}