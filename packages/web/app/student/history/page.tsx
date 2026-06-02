'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { ScoringForm } from '../../components/ScoringForm';

interface Note {
  id: string;
  type: 'comment' | 'review';
  content: string;
  author: string;
  authorRole: string;
  createdAt: string;
  action?: string;
}

interface HistoryRecord {
  semesterId: string;
  semesterCode: string;
  semesterName: string;
  academicYear: string;
  semesterNumber: number;
  semesterStatus: string;
  classCode: string;
  className: string;
  hasSheet: boolean;
  sheetId: string | null;
  status: string;
  studentTotal: number | null;
  classTotal: number | null;
  advisorTotal: number | null;
  finalTotal: number | null;
  classification: string | null;
  classificationLabel: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  notes: Note[];
}

const ROLE_COLORS: Record<string, string> = {
  STUDENT: 'bg-gray-100 text-gray-700',
  CLASS_COMMITTEE: 'bg-blue-100 text-blue-700',
  ADVISOR: 'bg-green-100 text-green-700',
  DEPARTMENT: 'bg-purple-100 text-purple-700',
  SCHOOL_ADMIN: 'bg-red-100 text-red-700',
};

const ACTION_LABELS: Record<string, string> = {
  SUBMIT: 'Đã nộp phiếu',
  APPROVE: 'Đã duyệt phiếu',
  REJECT: 'Đã từ chối phiếu',
  ADJUST_SCORE: 'Đã điều chỉnh điểm',
  COMMENT: 'Đã bình luận',
  RESUBMIT: 'Đã nộp lại',
  APPEAL: 'Đã gửi khiếu nại',
  FINALIZE: 'Đã chốt điểm',
};

export default function StudentHistoryPage() {
  const { data: session } = useSession();
  const studentId = (session as any)?.user?.id || '';

  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedSemester, setSelectedSemester] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!studentId) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/scoring-history`);
        if (!res.ok) throw new Error('Không thể tải lịch sử');
        const json = await res.json();
        setRecords(json.data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [studentId]);

  return (
    <DashboardLayout
      pageTitle="Lịch sử đánh giá"
      pageSubtitle="Xem lại kết quả rèn luyện và nhận xét của các học kỳ trước"
    >
      <div className="p-4 md:p-6 bg-gray-50 flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin"></div>
            </div>
          ) : error ? (
            <div className="bg-white p-8 rounded-2xl text-center border shadow-sm">
              <p className="text-red-500 mb-2">Đã có lỗi xảy ra</p>
              <p className="text-gray-500">{error}</p>
            </div>
          ) : records.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center border shadow-sm">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-lg font-semibold text-gray-800">Chưa có dữ liệu</h3>
              <p className="text-gray-500 mt-2">Bạn chưa có phiếu rèn luyện nào trong lịch sử.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {records.map((record) => (
                <div key={record.semesterId} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
                  
                  {/* Ô 1: Thông tin điểm số */}
                  <div 
                    className="flex-1 p-6 border-b md:border-b-0 md:border-r border-gray-100 hover:bg-sky-50 transition-colors cursor-pointer group"
                    onClick={() => {
                      if (record.hasSheet) {
                        setSelectedSemester({ id: record.semesterId, name: record.semesterName });
                      }
                    }}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-sky-700 transition-colors">
                          {record.semesterName}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">Lớp: {record.className}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        record.status === 'NO_SHEET' ? 'bg-gray-100 text-gray-600' :
                        record.status === 'FINALIZED' ? 'bg-green-100 text-green-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {record.status === 'NO_SHEET' ? 'Chưa tạo' : record.status === 'FINALIZED' ? 'Đã chốt' : 'Đang xử lý'}
                      </span>
                    </div>

                    {!record.hasSheet ? (
                      <div className="py-8 text-center text-gray-400 italic">
                        Chưa có phiếu đánh giá trong học kỳ này
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                            <div className="text-xs text-gray-500 mb-1">SV tự chấm</div>
                            <div className="text-lg font-bold text-gray-800">{record.studentTotal ?? '-'}</div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                            <div className="text-xs text-gray-500 mb-1">BCS chấm</div>
                            <div className="text-lg font-bold text-gray-800">{record.classTotal ?? '-'}</div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                            <div className="text-xs text-gray-500 mb-1">CVHT chấm</div>
                            <div className="text-lg font-bold text-gray-800">{record.advisorTotal ?? '-'}</div>
                          </div>
                          <div className="bg-sky-50 p-3 rounded-xl border border-sky-100 text-center">
                            <div className="text-xs text-sky-600 mb-1">Điểm chốt</div>
                            <div className="text-lg font-bold text-sky-700">{record.finalTotal ?? record.advisorTotal ?? '-'}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Xếp loại:</span>
                            <span className={`font-semibold ${
                              record.classification === 'EXCELLENT' ? 'text-purple-600' :
                              record.classification === 'VERY_GOOD' ? 'text-blue-600' :
                              record.classification === 'GOOD' ? 'text-green-600' :
                              record.classification === 'AVERAGE' ? 'text-orange-600' :
                              'text-red-600'
                            }`}>
                              {record.classificationLabel || 'Chưa xếp loại'}
                            </span>
                          </div>
                          
                          <div className="text-sm text-sky-600 font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                            Xem chi tiết phiếu
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Ô 2: Ghi chú của những người chấm */}
                  <div className="w-full md:w-80 bg-gray-50 p-6 flex flex-col max-h-[300px] overflow-y-auto border-t md:border-t-0">
                    <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2 sticky top-0 bg-gray-50 py-1">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                      Ghi chú & Lịch sử
                    </h4>

                    {!record.hasSheet ? (
                      <p className="text-sm text-gray-400 italic">Trống</p>
                    ) : record.notes.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Không có ghi chú nào.</p>
                    ) : (
                      <div className="space-y-4">
                        {record.notes.map((note) => (
                          <div key={note.id} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm text-sm">
                            <div className="flex items-start justify-between mb-2 gap-2">
                              <div>
                                <span className="font-semibold text-gray-800">{note.author}</span>
                                {note.authorRole && (
                                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[note.authorRole] || 'bg-gray-100 text-gray-600'}`}>
                                    {note.authorRole === 'CLASS_COMMITTEE' ? 'BCS' : note.authorRole === 'ADVISOR' ? 'CVHT' : note.authorRole === 'SCHOOL_ADMIN' ? 'Admin' : note.authorRole}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-400 shrink-0">
                                {new Date(note.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                            
                            {note.action && (
                              <div className="text-[11px] font-medium text-sky-600 mb-1">
                                {ACTION_LABELS[note.action] || note.action}
                              </div>
                            )}
                            
                            <p className="text-gray-600 whitespace-pre-wrap">{note.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Modal chi tiết phiếu điểm */}
      {selectedSemester && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedSemester(null)}
          style={{ animation: 'fadeIn 0.2s forwards' }}
        >
          <div 
            className="bg-white w-full max-w-6xl h-[90vh] sm:h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'modalSlideUp 0.3s forwards' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                Chi tiết phiếu điểm - <span className="text-sky-600">{selectedSemester.name}</span>
              </h3>
              <button 
                onClick={() => setSelectedSemester(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-gray-50 relative">
              <ScoringForm
                forcedRole="STUDENT"
                studentId={studentId}
                viewMode="history"
                semesterId={selectedSemester.id}
              />
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
