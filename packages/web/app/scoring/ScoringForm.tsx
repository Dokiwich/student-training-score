'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';

const API_BASE = 'http://localhost:3000/api';

// =============================================
// CẤU HÌNH CỐ ĐỊNH (FIXED CONFIG)
// =============================================
const FIXED_CODES = ['1.1.1', '2.1', '4.1', '3.1.1']; // Các mục không được sửa, điểm tự động max

// 6 Danh mục gốc để làm Menu Tab (Đúng chuẩn Excel)
const TAB_GROUPS = [
  { id: '1', title: '1. Ý thức tham gia học tập', max: 20 },
  { id: '2', title: '2. Chấp hành nội quy, quy chế', max: 25 },
  { id: '3', title: '3. Hoạt động chính trị, xã hội, thể thao...', max: 15 },
  { id: '4', title: '4. Quan hệ cộng đồng', max: 15 },
  { id: '5', title: '5. Cán bộ lớp & Thành tích đặc biệt', max: 15 },
  { id: '6', title: '6. Thành tích xuất sắc', max: 10 },
];

// =============================================
// TYPES & COMPONENTS (Thu gọn)
// =============================================
interface Criterion { id: number; code: string; content: string; max_points: number; score_type: string; parent_id: number | null; }
interface ScoreDetail { criteria_id: number; student_score: number; }
interface ToastMessage { id: number; type: 'success' | 'error'; text: string; }

function Toast({ message, onDismiss }: { message: ToastMessage; onDismiss: (id: number) => void; }) {
  useEffect(() => { const timer = setTimeout(() => onDismiss(message.id), 3000); return () => clearTimeout(timer); }, [message.id, onDismiss]);
  return (
    <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all animate-slide-in ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
      <span>{message.type === 'success' ? '✅' : '❌'}</span><span>{message.text}</span>
    </div>
  );
}

function MiniProgress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-400';
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1"><div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} /></div>
  );
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (<svg className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>);
}

// =============================================
// MAIN COMPONENT
// =============================================
export function ScoringForm() {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [savedScores, setSavedScores] = useState<Record<number, number>>({});
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Quản lý Tab 1->6
  const [activeTabId, setActiveTabId] = useState<string>('1');

  const formId = 'PHIEU_THAT_01';

  const addToast = useCallback((type: 'success' | 'error', text: string) => { setToasts((prev) => [...prev, { id: Date.now(), type, text }]); }, []);
  const removeToast = useCallback((id: number) => { setToasts((prev) => prev.filter((t) => t.id !== id)); }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [criteriaRes, scoresRes] = await Promise.all([fetch(`${API_BASE}/scoring/criteria`), fetch(`${API_BASE}/scoring/${formId}/scores`)]);
      if (criteriaRes.ok) {
        const data = await criteriaRes.json();
        setCriteria(data.data || []);
        // Mở sẵn các mục cấp 1 (VD: 1.1, 1.2, 2.1...)
        const roots = (data.data || []).filter((c: Criterion) => c.parent_id === null).map((c: Criterion) => c.id);
        setExpandedIds(new Set(roots));
      }
      if (scoresRes.ok) {
        const scoresData = await scoresRes.json();
        const scoresMap: Record<number, number> = {};
        const inputsMap: Record<number, string> = {};
        scoresData.data.forEach((s: ScoreDetail) => {
          scoresMap[s.criteria_id] = s.student_score;
          inputsMap[s.criteria_id] = s.student_score.toString();
        });
        setSavedScores(scoresMap);
        setInputValues(inputsMap);
      }
    } finally { setIsLoading(false); }
  }, [formId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // THUẬT TOÁN SẮP XẾP LẠI (TRỊ LỖI 1.2 NẰM SAU CÙNG)
  const sortedCriteria = useMemo(() => {
    if (!criteria.length) return [];
    const childrenMap = new Map<number | null, Criterion[]>();
    criteria.forEach(c => {
      const pid = c.parent_id;
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(c);
    });

    // Sắp xếp tự nhiên theo chuỗi 'code' (VD: "1.1" < "1.2" < "1.10")
    childrenMap.forEach(list => {
      list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    });

    const result: Criterion[] = [];
    const traverse = (parentId: number | null) => {
      const children = childrenMap.get(parentId) || [];
      children.forEach(child => {
        result.push(child);
        traverse(child.id);
      });
    };
    traverse(null);
    return result;
  }, [criteria]);

  const parentIds = useMemo(() => {
    const ids = new Set<number>();
    criteria.forEach((c) => { if (c.parent_id !== null) ids.add(c.parent_id); });
    return ids;
  }, [criteria]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const isVisible = useCallback((itemId: number): boolean => {
    const item = criteria.find((c) => c.id === itemId);
    if (!item) return false;
    if (item.parent_id === null) return true;
    if (!expandedIds.has(item.parent_id)) return false;
    return isVisible(item.parent_id);
  }, [criteria, expandedIds]);

  const depthMap = useMemo(() => {
    const map = new Map<number, number>();
    const getDepth = (item: Criterion): number => {
      if (map.has(item.id)) return map.get(item.id)!;
      if (item.parent_id === null) { map.set(item.id, 0); return 0; }
      const parent = criteria.find((c) => c.id === item.parent_id);
      const depth = parent ? getDepth(parent) + 1 : 0;
      map.set(item.id, depth);
      return depth;
    };
    criteria.forEach((c) => getDepth(c));
    return map;
  }, [criteria]);

  // THUẬT TOÁN ĐỆ QUY KẾT HỢP CỐ ĐỊNH (FIXED SCORES)
  const calculateAutoScore = useCallback((itemId: number): number => {
    const item = criteria.find((c) => c.id === itemId);
    if (!item) return 0;

    // NẾU LÀ MỤC CỐ ĐỊNH -> Lập tức trả về điểm tối đa (VD 10, 15) không cần đệ quy
    if (FIXED_CODES.includes(item.code)) return item.max_points;

    const children = criteria.filter((c) => c.parent_id === itemId);
    if (children.length > 0) {
      const sum = children.reduce((acc, child) => acc + calculateAutoScore(child.id), 0);
      return item.max_points > 0 ? Math.min(sum, item.max_points) : sum;
    }
    return parseFloat(inputValues[itemId]) || 0;
  }, [criteria, inputValues]);

  // TỔNG ĐIỂM TOÀN PHIẾU THEO 6 DANH MỤC
  const totalScore = useMemo(() => {
    return TAB_GROUPS.reduce((acc, tab) => {
      // Lấy các mục cha cao nhất của từng Tab (VD: 1.1, 1.2 thuộc Tab 1)
      const tabRoots = criteria.filter(c => c.parent_id === null && c.code.startsWith(tab.id + '.'));
      const tabSum = tabRoots.reduce((sum, root) => sum + calculateAutoScore(root.id), 0);
      return acc + Math.min(tabSum, tab.max); // Khóa trần điểm từng Tab (VD: Tab 1 max 20đ)
    }, 0);
  }, [criteria, calculateAutoScore]);

  const handleInputChange = (criteriaId: number, value: string) => { setInputValues((prev) => ({ ...prev, [criteriaId]: value })); };

  const handleSaveRow = async (criteriaId: number, maxPoints: number) => {
    const raw = inputValues[criteriaId];
    const RowSchema = z.object({
      criteriaId: z.number().int().positive(),
      studentScore: z.number({ invalid_type_error: 'Vui lòng nhập số' }).min(0, 'Không được âm').max(maxPoints, `Tối đa ${maxPoints}đ`),
    });

    const result = RowSchema.safeParse({ criteriaId, studentScore: parseFloat(raw) });
    if (!result.success) return addToast('error', result.error.errors[0].message);

    setSavingId(criteriaId);
    try {
      const response = await fetch(`${API_BASE}/scoring/${formId}/submit-criteria`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteriaId, studentScore: result.data.studentScore }),
      });
      if (response.ok) {
        setSavedScores((prev) => ({ ...prev, [criteriaId]: result.data.studentScore }));
        addToast('success', `Đã lưu thành công!`);
      } else addToast('error', 'Lỗi khi lưu điểm');
    } finally { setSavingId(null); }
  };

  const expandAll = () => { const allParents = new Set<number>(); criteria.forEach((c) => { if (parentIds.has(c.id)) allParents.add(c.id); }); setExpandedIds(allParents); };
  const collapseAll = () => { setExpandedIds(new Set()); };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Đang khởi tạo thuật toán...</div>;

  return (
    <>
      {toasts.length > 0 && <div className="fixed top-4 right-4 z-50 space-y-2">{toasts.map((t) => (<Toast key={t.id} message={t} onDismiss={removeToast} />))}</div>}

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-10">
        <div className="bg-indigo-600 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between text-white gap-4">
          <div>
            <h2 className="text-xl font-bold"> Phiếu Đánh Giá Rèn Luyện</h2>
            <p className="text-indigo-200 text-sm mt-1">Học kỳ 1 - 2026</p>
          </div>
          <div className="md:text-right bg-indigo-700/50 p-3 rounded-lg border border-indigo-500/30">
            <p className="text-indigo-200 text-xs uppercase tracking-wide">Tổng điểm toàn phiếu</p>
            <p className="text-3xl font-bold tabular-nums">
              {totalScore}<span className="text-indigo-300 text-lg">/100</span>
            </p>
            <MiniProgress value={totalScore} max={100} />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row bg-gray-50">

          {/* CỘT TRÁI: MENU TAB CỨNG */}
          <div className="w-full lg:w-1/3 border-r border-gray-200 bg-white p-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Danh mục đánh giá</h3>
            <div className="flex flex-col gap-2">
              {TAB_GROUPS.map(tab => {
                const isActive = activeTabId === tab.id;

                // Tính điểm tự động cho cái Tab này
                const tabRoots = criteria.filter(c => c.parent_id === null && c.code.startsWith(tab.id + '.'));
                const tabScore = Math.min(tabRoots.reduce((acc, root) => acc + calculateAutoScore(root.id), 0), tab.max);

                return (
                  <button key={tab.id} onClick={() => setActiveTabId(tab.id)} className={`text-left p-3 rounded-xl border-2 transition-all group ${isActive ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-transparent hover:bg-gray-50 hover:border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>Mục {tab.id}</span>
                      <span className={`text-xs font-bold ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>{tabScore}/{tab.max}</span>
                    </div>
                    <p className={`text-sm font-medium line-clamp-2 ${isActive ? 'text-indigo-900' : 'text-gray-600'}`}>{tab.title}</p>
                    <div className="mt-2"><MiniProgress value={tabScore} max={tab.max} /></div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CỘT PHẢI: BẢNG NHẬP ĐIỂM */}
          <div className="w-full lg:w-2/3 flex flex-col">
            <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between sticky top-0 z-10">
              <p className="text-xs text-gray-500"> Điểm mục lớn <strong>tự động cộng dồn</strong>.</p>
              <div className="flex gap-2">
                <button onClick={expandAll} className="text-xs px-3 py-1.5 rounded-md bg-white border border-gray-300 hover:bg-gray-100">Mở hết</button>
                <button onClick={collapseAll} className="text-xs px-3 py-1.5 rounded-md bg-white border border-gray-300 hover:bg-gray-100">Thu gọn</button>
              </div>
            </div>

            <div className="overflow-x-auto bg-white flex-1">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                    <th className="p-4 w-20">Mã</th>
                    <th className="p-4">Nội dung</th>
                    <th className="p-4 w-28 text-center">Tối đa</th>
                    <th className="p-4 w-32 text-center">Điểm của bạn</th>
                    <th className="p-4 w-28 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* LỌC THEO TAB ĐANG CHỌN (VD: Tab '1' -> chỉ hiện code 1.x) */}
                  {sortedCriteria
                    .filter((item) => isVisible(item.id) && item.code.startsWith(activeTabId + '.'))
                    .map((item) => {
                      const isParent = parentIds.has(item.id);
                      const depth = depthMap.get(item.id) || 0;
                      const isExpanded = expandedIds.has(item.id);
                      const autoScore = calculateAutoScore(item.id);
                      const isFixed = FIXED_CODES.includes(item.code);
                      const currentVal = parseFloat(inputValues[item.id] || '');
                      const isSaved = !isParent && !isFixed && savedScores[item.id] !== undefined && savedScores[item.id] === currentVal;

                      if (isParent) {
                        return (
                          <tr key={item.id} className={`transition-colors cursor-pointer hover:bg-indigo-50/30 ${depth === 0 ? 'bg-indigo-50/50' : ''}`} onClick={() => toggleExpand(item.id)}>
                            <td className="p-4"><span className="text-xs font-bold text-indigo-700 bg-indigo-100/50 px-2 py-1 rounded">{item.code}</span></td>
                            <td className="p-4">
                              <div className="flex items-center" style={{ paddingLeft: `${depth * 1.5}rem` }}>
                                <button className="mr-2 p-1 rounded text-indigo-500 hover:bg-indigo-100" onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}>
                                  <ChevronIcon isExpanded={isExpanded} />
                                </button>
                                <span className={`text-sm ${depth === 0 ? 'font-bold text-indigo-900' : 'font-semibold text-gray-800'}`}>{item.content}</span>
                              </div>
                            </td>
                            <td className="p-4 text-center text-xs font-bold text-gray-500">{item.max_points}</td>
                            <td className="p-4 text-center"><span className="text-lg font-bold text-indigo-600">{autoScore}</span></td>
                            <td className="p-4 text-center"><span className="text-[10px] text-gray-400 uppercase">Σ Tự cộng</span></td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4"><span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">{item.code}</span></td>
                          <td className="p-4">
                            <div className="flex items-center" style={{ paddingLeft: `${depth * 1.5}rem` }}>
                              <div className="w-6 mr-2" />
                              <span className={`text-sm ${isFixed ? 'text-gray-500 font-medium' : 'text-gray-600'}`}>{item.content}</span>
                              {isFixed && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold"></span>}
                            </div>
                          </td>
                          <td className="p-4 text-center text-xs text-gray-500">{item.max_points}</td>
                          <td className="p-4">
                            <input
                              type="number" min={0} max={item.max_points}
                              value={isFixed ? item.max_points : (inputValues[item.id] || '')}
                              disabled={isFixed}
                              onChange={(e) => handleInputChange(item.id, e.target.value)}
                              className={`w-full border rounded-md px-2 py-1.5 text-center text-sm outline-none transition-all ${isFixed ? 'bg-gray-100 text-gray-500 font-bold cursor-not-allowed border-gray-200' : isSaved ? 'bg-green-50 border-green-300 text-green-700 font-bold' : 'border-gray-300 focus:border-indigo-500'}`}
                            />
                          </td>
                          <td className="p-4 text-center">
                            {!isFixed && (
                              <button onClick={() => handleSaveRow(item.id, item.max_points)} disabled={savingId === item.id || isSaved} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all w-full ${isSaved ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>
                                {savingId === item.id ? '⏳...' : isSaved ? '✓ Đã lưu' : 'Lưu nháp'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm transition-all">
                ✅ CHỐT NỘP PHIẾU NÀY
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}