'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Save,
  Loader2,
  Check,
  Lock,
  Send,
  AlertCircle,
  CheckCircle2,
  XCircle,
  User,
  Hash,
  BookOpen,
  X,
} from 'lucide-react';

const API_BASE = '/proxy-api';

const FIXED_CODES = ['1.1.1', '2.1', '4.1', '3.1.1'];

const TAB_GROUPS = [
  { id: '1', title: 'Ý thức tham gia học tập', fullTitle: '1. Ý thức tham gia học tập', max: 20 },
  { id: '2', title: 'Chấp hành nội quy, quy chế', fullTitle: '2. Chấp hành nội quy, quy chế', max: 20 },
  { id: '3', title: 'Hoạt động chính trị, xã hội, thể thao', fullTitle: '3. Hoạt động chính trị, xã hội, thể thao', max: 15 },
  { id: '4', title: 'Quan hệ cộng đồng', fullTitle: '4. Quan hệ cộng đồng', max: 20 },
  { id: '5', title: 'Cán bộ lớp & Thành tích đặc biệt', fullTitle: '5. Cán bộ lớp & Thành tích đặc biệt', max: 15 },
  { id: '6', title: 'Thành tích xuất sắc', fullTitle: '6. Thành tích xuất sắc', max: 10 },
];

const ROLE_CONFIG = {
  STUDENT: { label: 'Sinh viên', colHeader: 'Tự Chấm' },
  CLASS_PRESIDENT: { label: 'Ban cán sự', colHeader: 'BCS Lớp' },
  ADVISOR: { label: 'Cố vấn', colHeader: 'CVHT' },
} as const;

type Role = keyof typeof ROLE_CONFIG;
const ALL_ROLES: Role[] = ['STUDENT', 'CLASS_PRESIDENT', 'ADVISOR'];

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
    <div
      className={`flex items-center gap-2.5 pl-3 pr-2 py-2.5 text-sm rounded-lg shadow-xl border backdrop-blur-sm animate-in slide-in-from-right-5 duration-300
        ${message.type === 'success'
          ? 'bg-white/95 border-emerald-200 text-emerald-800'
          : 'bg-white/95 border-red-200 text-red-800'
        }`}
    >
      {message.type === 'success' ? (
        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
      ) : (
        <XCircle size={16} className="text-red-500 shrink-0" />
      )}
      <span className="font-medium">{message.text}</span>
      <button
        onClick={() => onDismiss(message.id)}
        className="ml-1 p-0.5 rounded hover:bg-black/5 transition-colors shrink-0"
      >
        <X size={14} className="opacity-40" />
      </button>
    </div>
  );
}

/* ─── Progress Bar ─── */
function ProgressBar({
  value,
  max,
  height = 'h-1',
  bg = 'bg-gray-200',
  fill = 'bg-black',
}: {
  value: number;
  max: number;
  height?: string;
  bg?: string;
  fill?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={`w-full ${height} ${bg} rounded-full overflow-hidden`}>
      <div
        className={`h-full ${fill} rounded-full transition-all duration-500 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ─── Score Ring ─── */
function ScoreRing({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const radius = 36;
  const stroke = 4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={stroke}
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#000"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-black leading-none">{value}</span>
        <span className="text-[10px] text-gray-400 font-medium">/ {max}</span>
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
}

export function ScoringForm({
  forcedRole,
  studentId,
  studentName,
  classNameStr,
  formId = 'PHIẾU_01',
  viewMode = 'edit',
  stickyTop = 'top-0',
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
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('1');
  const [currentRole] = useState<Role>(forcedRole || 'STUDENT');

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
      if (role === 'CLASS_PRESIDENT') return savedClassScores;
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
          if (s.student_score !== null) sMap[s.criteria_id] = s.student_score;
          if (s.class_score !== null) cMap[s.criteria_id] = s.class_score;
          if (s.advisor_score !== null) aMap[s.criteria_id] = s.advisor_score;
          if (s.proof_url) pMap[s.criteria_id] = s.proof_url;
        });
        setSavedStudentScores(sMap);
        setSavedClassScores(cMap);
        setSavedAdvisorScores(aMap);
        setProofUrls(pMap);
      }
    } finally {
      setIsLoading(false);
    }
  }, [formId, studentId]);

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
  };

  const handleSaveRow = async (criteriaId: number, maxPoints: number) => {
    const raw = inputValues[criteriaId];
    const score = parseFloat(raw);
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
        body: JSON.stringify({ criteriaId, score, role: currentRole, studentId, proofUrl: proofUrls[criteriaId] }),
      });

      if (response.ok) {
        if (currentRole === 'STUDENT')
          setSavedStudentScores((prev) => ({ ...prev, [criteriaId]: score }));
        if (currentRole === 'CLASS_PRESIDENT')
          setSavedClassScores((prev) => ({ ...prev, [criteriaId]: score }));
        if (currentRole === 'ADVISOR')
          setSavedAdvisorScores((prev) => ({ ...prev, [criteriaId]: score }));
        addToast('success', 'Đã lưu thành công!');
      } else {
        addToast('error', 'Lỗi khi lưu điểm, vui lòng thử lại');
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleSubmitForm = async () => {
    try {
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
        addToast('success', data.message || 'Nộp phiếu thành công!');
      } else {
        const errorData = await response.json().catch(() => null);
        addToast('error', errorData?.message || 'Lỗi khi nộp phiếu');
      }
    } catch {
      addToast('error', 'Khong the ket noi may chu');
    }
  };

  /* ─── Loading state ─── */
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-3">
        <Loader2 size={28} className="animate-spin text-gray-300" />
        <span className="text-sm text-gray-400 font-medium">Dang tai du lieu...</span>
      </div>
    );
  }

  return (
    <>
      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
          {toasts.map((t) => (
            <Toast key={t.id} message={t} onDismiss={removeToast} />
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex-1 flex flex-col min-h-0 h-full shadow-sm">
        {/* ══════════ HEADER ══════════ */}
        <div className="shrink-0">
          {/* Row 1: Student info + Score ring */}
          <div className="px-6 py-4 flex items-center gap-6 border-b border-gray-100">
            {/* Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-black tracking-tight leading-snug">
                Phiếu Đánh Giá Điểm Rèn Luyện
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Học kỳ I (2025 - 2026)</p>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                </div>
              </div>
            </div>

            {/* Score ring */}
            <div className="shrink-0 flex flex-col items-center gap-1">
              <ScoreRing value={totalScore} max={100} />
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                {ROLE_CONFIG[currentRole].colHeader}
              </span>
            </div>

            {/* Expand / Collapse */}
            <div className="shrink-0 flex flex-col gap-1.5 border-l border-gray-100 pl-5">
              <button
                onClick={expandAll}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors font-medium text-gray-500 hover:text-black"
              >
                <ChevronsUpDown size={14} />
                Mở hết
              </button>
              <button
                onClick={collapseAll}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors font-medium text-gray-500 hover:text-black"
              >
                <ChevronsDownUp size={14} />
                Thu gọn
              </button>
            </div>
          </div>

          {/* Row 2: Tabs */}
          <div className="flex overflow-x-auto scrollbar-none border-b border-gray-200 bg-gray-50/50">
            {TAB_GROUPS.map((tab) => {
              const isActive = activeTabId === tab.id;
              const tabRoots = criteria.filter(
                (c) =>
                  (c.parent_id === null || c.parent_id === 0) &&
                  (c.code === tab.id ||
                    c.code.startsWith(tab.id + '.') ||
                    c.code.startsWith(`TC_0${tab.id}`) ||
                    c.code.startsWith(`TC_${tab.id}`)),
              );
              const tabScore = Math.max(
                0,
                Math.min(
                  tabRoots.reduce((acc, root) => acc + calculateAutoScore(root.id), 0),
                  tab.max,
                ),
              );

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`shrink-0 px-5 py-3 text-left transition-all relative min-w-[160px] group
                    ${isActive ? 'bg-white' : 'hover:bg-white/60'}`}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-black rounded-full" />
                  )}

                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span
                      className={`text-xs font-bold tabular-nums ${isActive ? 'text-black' : 'text-gray-400 group-hover:text-gray-600'
                        }`}
                    >
                      Mục {tab.id}
                    </span>
                    <span
                      className={`text-xs font-bold tabular-nums ${isActive ? 'text-black' : 'text-gray-300'
                        }`}
                    >
                      {tabScore}
                      <span className="text-gray-300 font-normal">/{tab.max}</span>
                    </span>
                  </div>

                  <p
                    className={`text-[11px] leading-snug truncate ${isActive ? 'text-gray-600' : 'text-gray-400'
                      }`}
                    title={tab.fullTitle}
                  >
                    {tab.title}
                  </p>

                  <div className="mt-2">
                    <ProgressBar
                      value={tabScore}
                      max={tab.max}
                      height="h-[3px]"
                      bg={isActive ? 'bg-gray-200' : 'bg-gray-200/60'}
                      fill={isActive ? 'bg-black' : 'bg-gray-300'}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ══════════ TABLE ══════════ */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-50/95 backdrop-blur-sm border-b border-gray-200">
                <th className="px-4 py-2.5 w-16 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Mã
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Nội dung đánh giá
                </th>
                <th className="px-4 py-2.5 w-28 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Tối đa
                </th>
                {visibleRoles.map((role) => {
                  const isActiveCol = role === currentRole;
                  return (
                    <Fragment key={role}>
                      <th
                        className={`px-4 py-2.5 w-28 text-center text-[10px] font-semibold uppercase tracking-wider border-l border-gray-200
                          ${isActiveCol ? 'bg-black/[0.03] text-black' : 'text-gray-400'}`}
                      >
                        {ROLE_CONFIG[role].colHeader}
                      </th>
                      {role === 'STUDENT' && (
                        <th className="px-4 py-2.5 w-28 text-center text-[10px] font-semibold uppercase tracking-wider border-l border-gray-200 text-gray-400 bg-gray-50/20">
                          Minh chứng
                        </th>
                      )}
                    </Fragment>
                  );
                })}
                {canEdit && (
                  <th className="px-4 py-2.5 w-24 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100/80">
              {fetchError && (
                <tr>
                  <td colSpan={99} className="p-6">
                    <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                      <AlertCircle size={18} className="text-red-400 shrink-0" />
                      <div className="text-sm text-red-700">
                        <span className="font-semibold">Loi he thong: </span>
                        {fetchError}
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {(() => {
                const filtered = sortedCriteria.filter((item) => {
                  if (!isVisible(item.id)) return false;
                  const root = getRoot(item.id);
                  if (!root) return true;
                  return (
                    root.code === activeTabId ||
                    root.code.startsWith(activeTabId + '.') ||
                    root.code.startsWith(`TC_0${activeTabId}`) ||
                    root.code.startsWith(`TC_${activeTabId}`)
                  );
                });

                const itemsToRender =
                  filtered.length > 0
                    ? filtered
                    : sortedCriteria.filter((item) => isVisible(item.id));

                if (itemsToRender.length === 0 && criteria.length === 0) {
                  return (
                    <tr>
                      <td colSpan={99} className="p-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                          <AlertCircle size={24} />
                          <p className="text-sm">Khong co tieu chi danh gia nao.</p>
                          <p className="text-xs">Vui long lien he quan tri vien.</p>
                        </div>
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
                    STUDENT:
                      currentRole === 'STUDENT'
                        ? calculateAutoScore(item.id)
                        : calculateScoreFromMap(item.id, savedStudentScores),
                    CLASS_PRESIDENT:
                      currentRole === 'CLASS_PRESIDENT'
                        ? calculateAutoScore(item.id)
                        : calculateScoreFromMap(item.id, savedClassScores),
                    ADVISOR:
                      currentRole === 'ADVISOR'
                        ? calculateAutoScore(item.id)
                        : calculateScoreFromMap(item.id, savedAdvisorScores),
                  };

                  const currentVal = parseFloat(inputValues[item.id] || '');
                  const activeSavedMap = getSavedMap(currentRole);
                  const isSaved =
                    !isParent &&
                    !isFixed &&
                    activeSavedMap[item.id] !== undefined &&
                    activeSavedMap[item.id] === currentVal;

                  /* ── Parent row ── */
                  if (isParent) {
                    return (
                      <tr
                        key={item.id}
                        className={`cursor-pointer select-none transition-colors group
                          ${depth === 0 ? 'bg-gray-50/80 hover:bg-gray-100/80' : 'hover:bg-gray-50/40'}`}
                        onClick={() => toggleExpand(item.id)}
                      >
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded
                            ${depth === 0 ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'}`}
                          >
                            {item.code}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center" style={{ paddingLeft: `${depth * 1.25}rem` }}>
                            <button
                              className="mr-2 w-5 h-5 flex items-center justify-center rounded transition-colors text-gray-400 group-hover:text-black shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(item.id);
                              }}
                              aria-label={isExpanded ? 'Thu gon' : 'Mo rong'}
                            >
                              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                            <span
                              className={`text-sm leading-snug ${depth === 0 ? 'font-bold text-black' : 'font-semibold text-gray-700'
                                }`}
                            >
                              {item.content}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-[11px] font-bold text-gray-400">{item.max_points}</span>
                        </td>
                        {visibleRoles.map((role) => {
                          const isActiveCol = role === currentRole;
                          return (
                            <Fragment key={role}>
                              <td
                                className={`px-4 py-2.5 text-center border-l border-gray-100
                                  ${isActiveCol ? 'bg-black/[0.02]' : ''}`}
                              >
                                <span
                                  className={`text-base font-bold tabular-nums
                                    ${isActiveCol ? 'text-black' : 'text-gray-300'}`}
                                >
                                  {scoreByRole[role]}
                                </span>
                              </td>
                              {role === 'STUDENT' && (
                                <td className="px-4 py-2.5 border-l border-gray-100 bg-gray-50/20" />
                              )}
                            </Fragment>
                          );
                        })}
                        {canEdit && <td className="px-4 py-2.5" />}
                      </tr>
                    );
                  }

                  /* ── Leaf row ── */
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-4 py-2">
                        <span className="text-[11px] text-gray-400 font-mono">{item.code}</span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center" style={{ paddingLeft: `${depth * 1.25}rem` }}>
                          <div className="w-5 shrink-0" />
                          <span className={`text-sm leading-snug ${isFixed ? 'text-gray-400' : 'text-gray-700'}`}>
                            {item.content}
                          </span>
                          {isFixed && (
                            <span className="ml-2 inline-flex items-center gap-0.5 text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-medium shrink-0">
                              <Lock size={9} />
                              Co dinh
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center text-[11px] text-gray-400 tabular-nums">
                        {item.max_points}
                      </td>

                      {visibleRoles.map((role) => {
                        const isActiveCol = role === currentRole;
                        const roleMap =
                          role === 'STUDENT'
                            ? savedStudentScores
                            : role === 'CLASS_PRESIDENT'
                              ? savedClassScores
                              : savedAdvisorScores;

                        if (isFixed) {
                          return (
                            <Fragment key={role}>
                              <td
                                className={`px-3 py-2 text-center border-l border-gray-100 ${isActiveCol ? 'bg-black/[0.02]' : ''}`}
                              >
                                <span className="text-sm font-semibold text-gray-400 tabular-nums">
                                  {item.max_points}
                                </span>
                              </td>
                              {role === 'STUDENT' && (
                                <td className="px-3 py-2 border-l border-gray-100 bg-gray-50/20" />
                              )}
                            </Fragment>
                          );
                        }

                        if (isActiveCol) {
                          return (
                            <Fragment key={role}>
                              <td className="px-3 py-1.5 border-l border-gray-100 bg-black/[0.015]">
                                <input
                                  type="number"
                                  value={inputValues[item.id] || ''}
                                  disabled={!canEdit}
                                  readOnly={!canEdit}
                                  onChange={(e) => handleInputChange(item.id, e.target.value)}
                                  className={`w-full rounded-lg px-2.5 py-1.5 text-center text-sm tabular-nums outline-none transition-all
                                    ${!canEdit
                                      ? 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                                      : isSaved
                                        ? 'bg-white border-2 border-black text-black font-bold'
                                        : 'border border-gray-300 focus:border-black focus:ring-2 focus:ring-black/5 bg-white'
                                    }`}
                                />
                              </td>
                              {role === 'STUDENT' && (
                                <td className="px-2 py-1.5 border-l border-gray-100 bg-gray-50/40">
                                  {currentRole === 'STUDENT' ? (
                                    <input
                                      type="text"
                                      placeholder="Link drive"
                                      value={proofUrls[item.id] || ''}
                                      onChange={(e) => setProofUrls((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                      readOnly={!canEdit}
                                      className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-600 outline-none focus:border-black transition-colors"
                                    />
                                  ) : (
                                    <div className="text-center w-full">
                                      {proofUrls[item.id] ? (
                                        <a href={proofUrls[item.id]} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:underline">Xem MC</a>
                                      ) : <span className="text-[10px] text-gray-300">--</span>}
                                    </div>
                                  )}
                                </td>
                              )}
                            </Fragment>
                          );
                        }

                        const val = roleMap[item.id];
                        const link = proofUrls[item.id];
                        return (
                          <Fragment key={role}>
                            <td className="px-3 py-1.5 border-l border-gray-100">
                              <div className="w-full rounded-lg bg-gray-100 px-2.5 py-1.5 text-center text-sm text-gray-400 tabular-nums">
                                {val !== undefined ? val : '--'}
                              </div>
                            </td>
                            {role === 'STUDENT' && (
                              <td className="px-2 py-1.5 border-l border-gray-100 text-center">
                                {link ? (
                                  <a href={link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:underline inline-block w-full text-center">
                                    Xem MC
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-gray-300 inline-block w-full text-center">--</span>
                                )}
                              </td>
                            )}
                          </Fragment>
                        );
                      })}

                      {canEdit && (
                        <td className="px-3 py-1.5 text-center">
                          {!isFixed && (
                            <button
                              onClick={() => handleSaveRow(item.id, item.max_points)}
                              disabled={savingId === item.id || isSaved}
                              className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all w-full
                                ${isSaved
                                  ? 'bg-gray-100 text-gray-400 cursor-default'
                                  : savingId === item.id
                                    ? 'bg-gray-200 text-gray-500 cursor-wait'
                                    : 'bg-black text-white hover:bg-gray-800 active:scale-[0.97] shadow-sm'
                                }`}
                            >
                              {savingId === item.id ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  <span>Lưu</span>
                                </>
                              ) : isSaved ? (
                                <>
                                  <Check size={12} />
                                  <span>Đã lưu</span>
                                </>
                              ) : (
                                <>
                                  <Save size={12} />
                                  <span>Lưu</span>
                                </>
                              )}
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

          {/* ══════════ SUBMIT BUTTON ══════════ */}
          {canEdit && (
            <div className="p-8 mt-4 flex justify-end">
              <button
                onClick={handleSubmitForm}
                className="inline-flex items-center gap-2 bg-black hover:bg-gray-900 text-white font-bold py-3.5 px-8 rounded-2xl shadow-lg transition-all hover:scale-[1.03] active:scale-100 text-sm tracking-wide"
              >
                <Send size={18} />
                Chốt nộp phiếu
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}