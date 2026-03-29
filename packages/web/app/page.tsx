import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./api/auth/[...nextauth]/route";

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/login');
  }

  const role = (session.user as { role?: string })?.role;
  const studentId = (session.user as { studentId?: string })?.studentId;

  if (role === 'STUDENT') {
    redirect('/student');
  } else if (role === 'CLASS_COMMITTEE' || role === 'CLASS_PRESIDENT') {
    // Hiển thị list sinh viên hoặc redirect tạm vào form của chính lớp trưởng để thử nghiệm
    redirect(`/class-president/${studentId}`);
  } else if (role === 'ADVISOR') {
    // Chuyển tới giao diện của cố vấn
    redirect(`/advisor/${studentId}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="p-8 text-center bg-white rounded-xl shadow-md">
        <h2 className="text-xl font-bold text-gray-800">Không hỗ trợ chức năng</h2>
        <p className="text-gray-600 mt-2">Vai trò của bạn chưa được thiết lập trên hệ thống.</p>
      </div>
    </div>
  );
}
