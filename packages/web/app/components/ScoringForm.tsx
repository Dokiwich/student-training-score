'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { z } from 'zod';

const API_BASE = 'http://localhost:3000/api';

// =============================================
// CẤU HÌNH CỐ ĐỊNH
// =============================================
const FIXED_CODES = ['1.1.1', '2.1', '4.1', '3.1.1'];

const TAB_GROUPS = [
  { id: '1', title: '1. Ý thức tham gia học tập', max: 20 },
  { id: '2', title: '2. Chấp hành nội quy, quy chế', max: 25 },
  { id: '3', title: '3. Hoạt động chính trị, xã hội, thể thao...', max: 15 },
  { id: '4', title: '4. Quan hệ cộng đồng', max: 15 },
  { id: '5', title: '5. Cán bộ lớp & Thành tích đặc biệt', max: 15 },
  { id: '6', title: '6. Thành tích xuất sắc', max: 10 },
];

const ROLE_CONFIG = {
  STUDENT: { label: '👨‍🎓 Sinh viên', colHeader: 'SV Tự Chấm', accent: 'indigo' },
  CLASS_PRESIDENT: { label: '👔 Lớp trưởng', colHeader: 'BCS Lớp', accent: 'green' },
  ADVISOR: { label: '👨‍🏫 Cố vấn', colHeader: 'CVHT', accent: 'red' },
} as const;

type Role = keyof typeof ROLE_CONFIG;
const ALL_ROLES: Role[] = ['STUDENT', 'CLASS_PRESIDENT', 'ADVISOR'];

// =============================================
// TYPES
// =============================================
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

// =============================================
// SUB-COMPONENTS
// =============================================
function Toast({
  message,
  onDismiss,
}: {
  message: ToastMessage;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(message.id), 3000);
    return () => clearTimeout(timer);
  }, [message.id, onDismiss]);

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all
        ${message.type === 'success'
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-red-50 text-red-800 border border-red-200'
        }`}
    >
      <span>{message.type === 'success' ? '✅' : '❌'}</span>
      <span>{message.text}</span>
    </div>
  );
}

function MiniProgress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color =
    pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-400';
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

// =============================================
// ROLE-SPECIFIC COLORS (Tailwind class maps)
// =============================================
const ROLE_STYLES: Record<
  Role,
  {
    headerBg: string;
    headerText: string;
    cellBg: string;
    btnActive: string;
    btnActiveText: string;
  }
> = {
  STUDENT: {
    headerBg: 'bg-indigo-50',
    headerText: 'text-indigo-700',
    cellBg: 'bg-indigo-50/40',
    btnActive: 'bg-indigo-600',
    btnActiveText: 'text-white',
  },
  CLASS_PRESIDENT: {
    headerBg: 'bg-green-50',
    headerText: 'text-green-700',
    cellBg: 'bg-green-50/40',
    btnActive: 'bg-green-600',
    btnActiveText: 'text-white',
  },
  ADVISOR: {
    headerBg: 'bg-red-50',
    headerText: 'text-red-700',
    cellBg: 'bg-red-50/40',
    btnActive: 'bg-red-600',
    btnActiveText: 'text-white',
  },
};

// =============================================
// MAIN COMPONENT
// =============================================
interface ScoringFormProps { 
  forcedRole?: Role; 
  studentId?: string; 
  formId?: string; 
  viewMode?: 'edit' | 'history';
  stickyTop?: string; // e.g. "top-0" or "top-[72px]"
}
export function ScoringForm({ 
  forcedRole, 
  studentId, 
  formId = 'PHIEU_THAT_01', 
  viewMode = 'edit',
  stickyTop = 'top-0'
}: ScoringFormProps) {
  const { data: session } = useSession();
  const token = (session as { customJwt?: string })?.customJwt || '';

  const [criteria, setCriteria] = useState<Criterion[]>([]);

  // 3 rổ điểm đã lưu (mỗi vai trò 1 rổ)
  const [savedStudentScores, setSavedStudentScores] = useState<
    Record<number, number>
  >({});
  const [savedClassScores, setSavedClassScores] = useState<
    Record<number, number>
  >({});
  const [savedAdvisorScores, setSavedAdvisorScores] = useState<
    Record<number, number>
  >({});

  // Giá trị đang gõ (chỉ dùng cho cột vai trò đang active)
  const [inputValues, setInputValues] = useState<Record<number, string>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('1');

  const [currentRole, setCurrentRole] = useState<Role>(forcedRole || 'STUDENT');

  // Cột hiển thị: STUDENT edit → chỉ cột SV; history/BCS/CVHT → đủ 3 cột
  const visibleRoles: Role[] = (currentRole === 'STUDENT' && viewMode === 'edit')
    ? ['STUDENT']
    : ALL_ROLES;

  // Quyền sửa: history mode → cấm tuyệt đối
  const canEdit = viewMode !== 'history';

  // formId từ props
  // ✅ STATE TRẠNG THÁI PHIẾU_THAT_01';

  // Ref để chỉ sync inputValues khi đổi vai trò hoặc tải lần đầu
  const prevRoleRef = useRef<Role>(currentRole);
  const didInitRef = useRef(false);

  // ------------------------------------------
  // TOAST
  // ------------------------------------------
  const addToast = useCallback(
    (type: 'success' | 'error', text: string) => {
      setToasts((prev) => [...prev, { id: Date.now(), type, text }]);
    },
    [],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ------------------------------------------
  // HELPER: lấy rổ điểm theo role
  // ------------------------------------------
  const getSavedMap = useCallback(
    (role: Role): Record<number, number> => {
      if (role === 'STUDENT') return savedStudentScores;
      if (role === 'CLASS_PRESIDENT') return savedClassScores;
      return savedAdvisorScores;
    },
    [savedStudentScores, savedClassScores, savedAdvisorScores],
  );

  // ------------------------------------------
  // FETCH DATA (chạy 1 lần khi mount)
  // ------------------------------------------
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
      const [criteriaRes, scoresRes] = await Promise.all([
        fetch(`${API_BASE}/scoring/criteria`, { headers }),
        fetch(`${API_BASE}/scoring/${formId}/scores?studentId=${studentId}`, { headers }),
      ]);

      if (criteriaRes.ok) {
        const data = await criteriaRes.json();
        setCriteria(data.data || []);
        const roots = (data.data || [])
          .filter((c: Criterion) => c.parent_id === null)
          .map((c: Criterion) => c.id);
        setExpandedIds(new Set(roots));
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
  }, [formId, studentId, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ------------------------------------------
  // SYNC inputValues khi đổi vai trò HOẶC khi tải xong lần đầu
  // ------------------------------------------
  useEffect(() => {
    if (isLoading) return;

    const shouldSync =
      !didInitRef.current || prevRoleRef.current !== currentRole;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole, isLoading]);

  // ------------------------------------------
  // SORT TREE (DFS theo code tự nhiên)
  // ------------------------------------------
  const sortedCriteria = useMemo(() => {
    if (!criteria.length) return [];
    const childrenMap = new Map<number | null, Criterion[]>();
    criteria.forEach((c) => {
      const pid = c.parent_id;
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(c);
    });
    childrenMap.forEach((list) =>
      list.sort((a, b) =>
        a.code.localeCompare(b.code, undefined, { numeric: true }),
      ),
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

  // ------------------------------------------
  // PARENT IDS SET
  // ------------------------------------------
  const parentIds = useMemo(() => {
    const ids = new Set<number>();
    criteria.forEach((c) => {
      if (c.parent_id !== null) ids.add(c.parent_id);
    });
    return ids;
  }, [criteria]);

  // ------------------------------------------
  // EXPAND / COLLAPSE
  // ------------------------------------------
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

  // ------------------------------------------
  // VISIBILITY (is item visible given expansions?)
  // ------------------------------------------
  const isVisible = useCallback(
    (itemId: number): boolean => {
      const item = criteria.find((c) => c.id === itemId);
      if (!item) return false;
      if (item.parent_id === null) return true;
      if (!expandedIds.has(item.parent_id)) return false;
      return isVisible(item.parent_id);
    },
    [criteria, expandedIds],
  );

  // ------------------------------------------
  // DEPTH MAP
  // ------------------------------------------
  const depthMap = useMemo(() => {
    const map = new Map<number, number>();
    const getDepth = (item: Criterion): number => {
      if (map.has(item.id)) return map.get(item.id)!;
      if (item.parent_id === null) {
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

  // ------------------------------------------
  // CALCULATE SCORE FROM MAP (dùng cho cột không active)
  // ------------------------------------------
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
        return item.max_points > 0 ? Math.min(sum, item.max_points) : sum;
      }
      return scoreMap[itemId] ?? 0;
    },
    [criteria],
  );

  // ------------------------------------------
  // CALCULATE AUTO SCORE (dùng inputValues - cột active)
  // ------------------------------------------
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
        return item.max_points > 0 ? Math.min(sum, item.max_points) : sum;
      }
      return parseFloat(inputValues[itemId]) || 0;
    },
    [criteria, inputValues],
  );

  // ------------------------------------------
  // TOTAL SCORE (cột active)
  // ------------------------------------------
  const totalScore = useMemo(() => {
    return TAB_GROUPS.reduce((acc, tab) => {
      const tabRoots = criteria.filter(
        (c) =>
          c.parent_id === null && c.code.startsWith(tab.id + '.'),
      );
      const tabSum = tabRoots.reduce(
        (sum, root) => sum + calculateAutoScore(root.id),
        0,
      );
      return acc + Math.min(tabSum, tab.max);
    }, 0);
  }, [criteria, calculateAutoScore]);

  // ------------------------------------------
  // HANDLERS
  // ------------------------------------------
  const handleInputChange = (criteriaId: number, value: string) => {
    setInputValues((prev) => ({ ...prev, [criteriaId]: value }));
  };

  const handleSaveRow = async (criteriaId: number, maxPoints: number) => {
    const raw = inputValues[criteriaId];
    const RowSchema = z.object({
      criteriaId: z.number().int().positive(),
      score: z
        .number({ invalid_type_error: 'Vui lòng nhập số' })
        .min(0, 'Không được âm')
        .max(maxPoints, `Tối đa ${maxPoints}đ`),
    });

    const result = RowSchema.safeParse({
      criteriaId,
      score: parseFloat(raw),
    });
    if (!result.success)
      return addToast('error', result.error.errors[0].message);

    setSavingId(criteriaId);
    try {
      const response = await fetch(
        `${API_BASE}/scoring/${formId}/submit-criteria`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            criteriaId,
            score: result.data.score,
            role: currentRole,
            studentId: studentId,
          }),
        },
      );

      if (response.ok) {
        const score = result.data.score;
        // Cập nhật rổ điểm tương ứng với vai trò đang chọn
        if (currentRole === 'STUDENT')
          setSavedStudentScores((prev) => ({
            ...prev,
            [criteriaId]: score,
          }));
        if (currentRole === 'CLASS_PRESIDENT')
          setSavedClassScores((prev) => ({
            ...prev,
            [criteriaId]: score,
          }));
        if (currentRole === 'ADVISOR')
          setSavedAdvisorScores((prev) => ({
            ...prev,
            [criteriaId]: score,
          }));
        addToast('success', 'Đã lưu thành công!');
      } else {
        addToast('error', 'Lỗi khi lưu điểm');
      }
    } finally {
      setSavingId(null);
    }
  };

  // ------------------------------------------
  // SUBMIT FORM (chốt nộp phiếu)
  // ------------------------------------------
  const handleSubmitForm = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/scoring/${formId}/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            role: currentRole,
            studentId: studentId,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        addToast('success', data.message || 'Nộp phiếu thành công!');
      } else {
        const errorData = await response.json().catch(() => null);
        addToast('error', errorData?.message || 'Lỗi khi nộp phiếu');
      }
    } catch {
      addToast('error', 'Không thể kết nối máy chủ');
    }
  };

  // ------------------------------------------
  // LOADING STATE
  // ------------------------------------------
  if (isLoading)
    return (
      <div className="p-8 text-center text-gray-500">
        Đang khởi tạo thuật toán...
      </div>
    );

  // =============================================
  // RENDER
  // =============================================
  return (
    <>
      {/* TOAST CONTAINER */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((t) => (
            <Toast key={t.id} message={t} onDismiss={removeToast} />
          ))}
        </div>
      )}

      {/* ========== MOCK ROLE SWITCHER ========== */}
      {!forcedRole && (
        <div className="bg-yellow-100 border-b-2 border-yellow-400 p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold text-yellow-800 text-sm">
                CHẾ ĐỘ GIẢ LẬP QUYỀN (MOCK ROLE)
              </p>
              <p className="text-xs text-yellow-700">
                Chuyển đổi vai trò để test tính năng khóa/mở cột điểm.
              </p>
            </div>
          </div>
          <div className="flex bg-white rounded-lg p-1 border border-yellow-300 shadow-sm">
            {ALL_ROLES.map((role) => {
              const isActive = currentRole === role;
              const style = ROLE_STYLES[role];
              return (
                <button
                  key={role}
                  onClick={() => setCurrentRole(role)}
                  className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${isActive
                      ? `${style.btnActive} ${style.btnActiveText}`
                      : 'text-gray-500 hover:bg-gray-100'
                    }`}
                >
                  {ROLE_CONFIG[role].label}
                </button>
              );
            })}
            {/* Hiển thị canEdit */}
            {/* Note: 'canEdit' variable is not defined in the provided context. */}
            {/* This part assumes 'canEdit' would be defined elsewhere in the component. */}
            {/* For now, it's commented out or needs a placeholder if it's meant to be dynamic. */}
            {/* <span className={`text-xs font-bold px-2 py-1 rounded ${canEdit ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
              {canEdit ? '🔓 Được sửa' : '🔒 Bị khóa'}
            </span> */}
          </div>
        </div>
      )}

      {/* ========== MAIN CARD ========== */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-10">
        {/* HEADER */}
        <div className="bg-indigo-600 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between text-white gap-4">
          <div>
            <h2 className="text-xl font-bold">
              📋 Phiếu Đánh Giá Rèn Luyện
            </h2>
            <p className="text-indigo-200 text-sm mt-1">
              Học kỳ 1 - 2026 &nbsp;|&nbsp; Vai trò:{' '}
              <strong>{ROLE_CONFIG[currentRole].label}</strong>
            </p>
          </div>
          <div className="md:text-right bg-indigo-700/50 p-3 rounded-lg border border-indigo-500/30">
            <p className="text-indigo-200 text-xs uppercase tracking-wide">
              Tổng điểm ({ROLE_CONFIG[currentRole].colHeader})
            </p>
            <p className="text-3xl font-bold tabular-nums">
              {totalScore}
              <span className="text-indigo-300 text-lg">/100</span>
            </p>
            <MiniProgress value={totalScore} max={100} />
          </div>
        </div>

        {/* BODY: Tabs + Table */}
        <div className="flex flex-col bg-gray-50">
          {/* ───── TOP TABS ───── */}
          <div className="w-full border-b border-gray-200 bg-white p-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-2 hidden sm:block">
              Danh mục đánh giá
            </h3>
            <div className="flex overflow-x-auto pb-2 gap-3 snap-x custom-scrollbar">
              {TAB_GROUPS.map((tab) => {
                const isActive = activeTabId === tab.id;
                const tabRoots = criteria.filter(
                  (c) =>
                    c.parent_id === null &&
                    c.code.startsWith(tab.id + '.'),
                );
                const tabScore = Math.min(
                  tabRoots.reduce(
                    (acc, root) => acc + calculateAutoScore(root.id),
                    0,
                  ),
                  tab.max,
                );

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`shrink-0 snap-start text-left p-3 rounded-xl border-2 transition-all min-w-[260px] max-w-[320px] ${isActive
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                        : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${isActive
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-gray-100 text-gray-500'
                          }`}
                      >
                        Mục {tab.id}
                      </span>
                      <span
                        className={`text-xs font-bold ${isActive ? 'text-indigo-600' : 'text-gray-500'
                          }`}
                      >
                        {tabScore}/{tab.max}
                      </span>
                    </div>
                    <p
                      className={`text-sm font-medium line-clamp-1 truncate ${isActive ? 'text-indigo-900' : 'text-gray-600'
                        }`}
                      title={tab.title}
                    >
                      {tab.title}
                    </p>
                    <div className="mt-2">
                      <MiniProgress value={tabScore} max={tab.max} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ───── BOTTOM: SCORING TABLE ───── */}
          <div className="w-full flex flex-col">
            {/* Toolbar */}
            {currentRole === 'STUDENT' && viewMode === 'edit' && (
              <div className="px-6 py-2 bg-blue-50 border-b border-blue-200 text-blue-700 text-xs font-medium flex items-center gap-2">
                <span>💡</span>
                <p><strong>Hướng dẫn:</strong> Chỉ nhập điểm vào các mục bạn có tham gia. Các mục không tham gia vui lòng để trống (mặc định 0 điểm). Nguyên tắc: 1 điểm / 1 hoạt động (trừ mục có quy định riêng).</p>
              </div>
            )}
            <div className={`px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between sticky ${stickyTop} z-10`}>
              <p className="text-xs text-gray-500">
                Điểm mục lớn <strong>tự động cộng dồn</strong>. Cột đang sửa:{' '}
                <strong className="text-indigo-600">
                  {ROLE_CONFIG[currentRole].colHeader}
                </strong>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={expandAll}
                  className="text-xs px-3 py-1.5 rounded-md bg-white border border-gray-300 hover:bg-gray-100"
                >
                  Mở hết
                </button>
                <button
                  onClick={collapseAll}
                  className="text-xs px-3 py-1.5 rounded-md bg-white border border-gray-300 hover:bg-gray-100"
                >
                  Thu gọn
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto bg-white flex-1 min-h-[400px]">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead className={`sticky ${stickyTop === 'top-0' ? 'top-12' : 'top-[128px]'} z-20`}>
                  <tr className="bg-gray-50/90 backdrop-blur-sm text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200 shadow-sm">
                    <th className="p-3 w-16">Mã</th>
                    <th className="p-3">Nội dung</th>
                    <th className="p-3 w-20 text-center">Điểm</th>

                    {/* CỘT ĐIỂM (lọc theo visibleRoles) */}
                    {visibleRoles.map((role) => {
                      const isActiveCol = role === currentRole;
                      const rs = ROLE_STYLES[role];
                      return (
                        <th
                          key={role}
                          className={`p-3 w-24 text-center border-l border-gray-200 ${isActiveCol
                              ? `${rs.headerBg} ${rs.headerText} font-bold`
                              : ''
                            }`}
                        >
                          {ROLE_CONFIG[role].colHeader}
                          {isActiveCol && (
                            <span className="block text-[9px] mt-0.5 opacity-70">
                              ✏️ đang sửa
                            </span>
                          )}
                        </th>
                      );
                    })}

                    {canEdit && <th className="p-3 w-24 text-center">Thao tác</th>}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {sortedCriteria
                    .filter(
                      (item) =>
                        isVisible(item.id) &&
                        item.code.startsWith(activeTabId + '.'),
                    )
                    .map((item) => {
                      const isParent = parentIds.has(item.id);
                      const depth = depthMap.get(item.id) || 0;
                      const isExpanded = expandedIds.has(item.id);
                      const isFixed = FIXED_CODES.includes(item.code);

                      // Tính điểm cho từng cột
                      const scoreByRole: Record<Role, number> = {
                        STUDENT:
                          currentRole === 'STUDENT'
                            ? calculateAutoScore(item.id)
                            : calculateScoreFromMap(
                              item.id,
                              savedStudentScores,
                            ),
                        CLASS_PRESIDENT:
                          currentRole === 'CLASS_PRESIDENT'
                            ? calculateAutoScore(item.id)
                            : calculateScoreFromMap(
                              item.id,
                              savedClassScores,
                            ),
                        ADVISOR:
                          currentRole === 'ADVISOR'
                            ? calculateAutoScore(item.id)
                            : calculateScoreFromMap(
                              item.id,
                              savedAdvisorScores,
                            ),
                      };

                      // Check đã lưu chưa (chỉ cho cột active, leaf node, không phải fixed)
                      const currentVal = parseFloat(
                        inputValues[item.id] || '',
                      );
                      const activeSavedMap = getSavedMap(currentRole);
                      const isSaved =
                        !isParent &&
                        !isFixed &&
                        activeSavedMap[item.id] !== undefined &&
                        activeSavedMap[item.id] === currentVal;

                      // ---- PARENT ROW ----
                      if (isParent) {
                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors cursor-pointer hover:bg-indigo-50/30 ${depth === 0 ? 'bg-indigo-50/50' : ''
                              }`}
                            onClick={() => toggleExpand(item.id)}
                          >
                            <td className="p-3">
                              <span className="text-xs font-bold text-indigo-700 bg-indigo-100/50 px-2 py-1 rounded">
                                {item.code}
                              </span>
                            </td>
                            <td className="p-3">
                              <div
                                className="flex items-center"
                                style={{
                                  paddingLeft: `${depth * 1.5}rem`,
                                }}
                              >
                                <button
                                  className="mr-2 p-1 rounded text-indigo-500 hover:bg-indigo-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpand(item.id);
                                  }}
                                >
                                  <ChevronIcon isExpanded={isExpanded} />
                                </button>
                                <span
                                  className={`text-sm ${depth === 0
                                      ? 'font-bold text-indigo-900'
                                      : 'font-semibold text-gray-800'
                                    }`}
                                >
                                  {item.content}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-center text-xs font-bold text-gray-500">
                              {item.max_points}
                            </td>

                            {/* cột điểm tự cộng */}
                            {visibleRoles.map((role) => {
                              const isActiveCol = role === currentRole;
                              const rs = ROLE_STYLES[role];
                              return (
                                <td
                                  key={role}
                                  className={`p-3 text-center border-l border-gray-100 ${isActiveCol ? rs.cellBg : ''
                                    }`}
                                >
                                  <span
                                    className={`text-lg font-bold ${isActiveCol
                                        ? rs.headerText
                                        : 'text-gray-400'
                                      }`}
                                  >
                                    {scoreByRole[role]}
                                  </span>
                                </td>
                              );
                            })}

                            {canEdit && (
                            <td className="p-3 text-center">
                              <span className="text-[10px] text-gray-400 uppercase">
                                Σ Tự cộng
                              </span>
                            </td>
                            )}
                          </tr>
                        );
                      }

                      // ---- LEAF ROW ----
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="p-3">
                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {item.code}
                            </span>
                          </td>
                          <td className="p-3">
                            <div
                              className="flex items-center"
                              style={{
                                paddingLeft: `${depth * 1.5}rem`,
                              }}
                            >
                              <div className="w-6 mr-2" />
                              <span
                                className={`text-sm ${isFixed
                                    ? 'text-gray-500 font-medium'
                                    : 'text-gray-600'
                                  }`}
                              >
                                {item.content}
                              </span>
                              {isFixed && (
                                <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">
                                  🔒
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center text-xs text-gray-500">
                            {item.max_points}
                          </td>

                          {/* CỘT ĐIỂM */}
                          {visibleRoles.map((role) => {
                            const isActiveCol = role === currentRole;
                            const rs = ROLE_STYLES[role];
                            const roleMap =
                              role === 'STUDENT'
                                ? savedStudentScores
                                : role === 'CLASS_PRESIDENT'
                                  ? savedClassScores
                                  : savedAdvisorScores;

                            // ① Mục cố định → hiện max, disabled
                            if (isFixed) {
                              return (
                                <td
                                  key={role}
                                  className={`p-3 text-center border-l border-gray-100 ${isActiveCol ? rs.cellBg : ''
                                    }`}
                                >
                                  <span className="text-sm font-bold text-gray-500">
                                    {item.max_points}
                                  </span>
                                </td>
                              );
                            }

                            // ② Cột đang active → INPUT EDITABLE
                            if (isActiveCol) {
                              return (
                                <td
                                  key={role}
                                  className={`p-3 border-l border-gray-100 ${rs.cellBg}`}
                                >
                                  <input
                                    type="number"
                                    min={0}
                                    max={item.max_points}
                                    value={inputValues[item.id] || ''}
                                    disabled={!canEdit}
                                    readOnly={!canEdit}
                                    onChange={(e) =>
                                      handleInputChange(
                                        item.id,
                                        e.target.value,
                                      )
                                    }
                                    className={`w-full border rounded-md px-2 py-1.5 text-center text-sm outline-none transition-all ${!canEdit
                                        ? 'bg-gray-100/80 border-gray-200 text-gray-400 cursor-not-allowed'
                                        : isSaved
                                          ? 'bg-green-50 border-green-300 text-green-700 font-bold'
                                          : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30'
                                      }`}
                                  />
                                </td>
                              );
                            }

                            // ③ Cột không active → READ-ONLY
                            const val = roleMap[item.id];
                            return (
                              <td
                                key={role}
                                className="p-3 border-l border-gray-100 bg-gray-50/50"
                              >
                                <input
                                  type="text"
                                  disabled
                                  readOnly
                                  value={val !== undefined ? val : '–'}
                                  className="w-full border border-gray-200 bg-gray-100/80 rounded-md px-2 py-1.5 text-center text-sm font-bold text-gray-400 cursor-not-allowed select-none"
                                />
                              </td>
                            );
                          })}

                          {/* CỘT THAO TÁC */}
                          {canEdit && (
                          <td className="p-3 text-center">
                            {!isFixed && (
                              <button
                                onClick={() =>
                                  handleSaveRow(item.id, item.max_points)
                                }
                                disabled={savingId === item.id || isSaved}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all w-full ${isSaved
                                    ? 'bg-green-100 text-green-600 cursor-default'
                                    : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                  }`}
                              >
                                {savingId === item.id
                                  ? '⏳...'
                                  : isSaved
                                    ? '✓ Đã lưu'
                                    : 'Lưu nháp'}
                              </button>
                            )}
                          </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* FOOTER */}
            {canEdit && (
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button onClick={handleSubmitForm} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm transition-all">
                ✅ CHỐT NỘP PHIẾU NÀY
              </button>
            </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}