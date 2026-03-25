'use client';

import Link from 'next/link';

// =============================================
// MOCK DATA (Dữ liệu giả lập để thiết kế UI)
// =============================================
const MOCK_STUDENTS = [
    { id: 1, studentCode: '032411001', name: 'Trần Đức Anh', gender: 'Nam', score: 92, classification: 'Xuất sắc', status: 'ADVISOR_APPROVED', note: 'Lớp trưởng' },
    { id: 2, studentCode: '032411002', name: 'Nguyễn Thị Bích', gender: 'Nữ', score: 85, classification: 'Tốt', status: 'CLASS_APPROVED', note: 'Đã nộp minh chứng GCN' },
    { id: 3, studentCode: '032411003', name: 'Lê Văn Cường', gender: 'Nam', score: 78, classification: 'Khá', status: 'SUBMITTED', note: 'Chờ lớp trưởng duyệt' },
    { id: 4, studentCode: '032411004', name: 'Phạm Thu Dung', gender: 'Nữ', score: 62, classification: 'Trung bình', status: 'DRAFT', note: 'Đang làm nháp' },
    { id: 5, studentCode: '032411005', name: 'Hoàng Minh Tuấn', gender: 'Nam', score: 45, classification: 'Yếu', status: 'DRAFT', note: 'Cảnh báo học vụ' },
];

// =============================================
// COMPONENT TIỆN ÍCH (BADGES)
// =============================================
const getClassificationBadge = (type: string) => {
    switch (type) {
        case 'Xuất sắc': return <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold border border-purple-200">💎 Xuất sắc</span>;
        case 'Tốt': return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">⭐ Tốt</span>;
        case 'Khá': return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">👍 Khá</span>;
        case 'Trung bình': return <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold border border-yellow-200">😐 Trung bình</span>;
        default: return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">⚠️ Yếu</span>;
    }
};

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'ADVISOR_APPROVED': return <span className="flex items-center gap-1 text-green-600 text-xs font-bold"><span className="w-2 h-2 rounded-full bg-green-500"></span>Đã chốt sổ</span>;
        case 'CLASS_APPROVED': return <span className="flex items-center gap-1 text-yellow-600 text-xs font-bold"><span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>Chờ CVHT</span>;
        case 'SUBMITTED': return <span className="flex items-center gap-1 text-blue-600 text-xs font-bold"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>Chờ BCS Lớp</span>;
        default: return <span className="flex items-center gap-1 text-gray-400 text-xs font-bold"><span className="w-2 h-2 rounded-full bg-gray-300"></span>Đang nháp</span>;
    }
};

// =============================================
// MAIN COMPONENT
// =============================================
export default function StudentList() {
    return (
        <div className="p-8 animate-fadeIn">
            {/* HEADER BẢNG ĐIỀU KHIỂN */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Danh sách Lớp 24IT</h1>
                    <p className="text-gray-500 mt-1">Quản lý và xét duyệt điểm rèn luyện Học kỳ 1 (2025-2026)</p>
                </div>

                {/* Thanh tìm kiếm và Lọc */}
                <div className="flex gap-3 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="🔍 Tìm mã SV, tên..."
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-64"
                    />
                    <button className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold border border-indigo-200 hover:bg-indigo-100 transition-colors">
                        Lọc trạng thái
                    </button>
                </div>
            </div>

            {/* BẢNG DỮ LIỆU */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                                <th className="p-4 w-12 text-center">STT</th>
                                <th className="p-4">Sinh viên</th>
                                <th className="p-4 w-24 text-center">Giới tính</th>
                                <th className="p-4 w-32 text-center">Tổng điểm</th>
                                <th className="p-4 w-36 text-center">Xếp loại</th>
                                <th className="p-4 w-40">Trạng thái (Ghi chú)</th>
                                <th className="p-4 w-24 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {MOCK_STUDENTS.map((student, index) => (
                                <tr key={student.id} className="hover:bg-gray-50/80 transition-colors group">
                                    {/* STT */}
                                    <td className="p-4 text-center text-gray-400 font-medium">{index + 1}</td>

                                    {/* Cột Sinh Viên (Gộp Tên + Mã SV + Avatar) */}
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-indigo-700 font-bold border border-indigo-300 shadow-sm">
                                                {student.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{student.name}</p>
                                                <p className="text-xs text-gray-500 font-mono mt-0.5">{student.studentCode}</p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Giới tính */}
                                    <td className="p-4 text-center">
                                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${student.gender === 'Nam' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                                            {student.gender}
                                        </span>
                                    </td>

                                    {/* Điểm số */}
                                    <td className="p-4 text-center">
                                        <span className="text-xl font-bold text-gray-800">{student.score}</span>
                                    </td>

                                    {/* Xếp loại (Dùng Badge) */}
                                    <td className="p-4 text-center">
                                        {getClassificationBadge(student.classification)}
                                    </td>

                                    {/* Trạng thái & Ghi chú */}
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            {getStatusBadge(student.status)}
                                            <span className="text-[10px] text-gray-500 italic line-clamp-1" title={student.note}>
                                                {student.note}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Thao tác */}
                                    <td className="p-4 text-center">
                                        <Link
                                            href={`/scoring?studentId=${student.id}`}
                                            className="inline-flex items-center justify-center px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        >
                                            Duyệt ➔
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* PHÂN TRANG (Pagination) */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                    <p className="text-sm text-gray-500">Hiển thị <span className="font-bold text-gray-700">1</span> đến <span className="font-bold text-gray-700">5</span> trong số <span className="font-bold text-gray-700">50</span> sinh viên</p>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-500 bg-white disabled:opacity-50" disabled>Trước</button>
                        <button className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-100">Sau</button>
                    </div>
                </div>
            </div>
        </div>
    );
}