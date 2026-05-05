import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./api/auth/[...nextauth]/route";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.replace('/login');
      return;
    }

    const role = (session.user as { role?: string })?.role || 'STUDENT';
    const destination = ROLE_REDIRECTS[role] || '/student';
    router.replace(destination);
  }, [session, status, router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ color: '#9ca3af', fontSize: 14 }}>Đang chuyển hướng...</p>
    </div>
  );
}
