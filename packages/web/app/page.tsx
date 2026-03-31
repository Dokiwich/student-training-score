import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./api/auth/[...nextauth]/route";

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/login');
  }

  const role = (session.user as { role?: string })?.role;

  if (role === 'STUDENT') {
    redirect('/student');
  } else if (role === 'CLASS_COMMITTEE' || role === 'CLASS_PRESIDENT') {
    redirect('/class-president');
  } else if (role === 'ADVISOR') {
    redirect('/advisor');
  } else if (role === 'SCHOOL_ADMIN' || role === 'SUPER_ADMIN') {
    redirect('/admin');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="p-8 text-center border border-gray-200">
        <h2 className="text-lg font-bold text-black">Khong ho tro chuc nang</h2>
        <p className="text-gray-500 mt-2 text-sm">Vai tro cua ban chua duoc thiet lap tren he thong.</p>
      </div>
    </div>
  );
}
