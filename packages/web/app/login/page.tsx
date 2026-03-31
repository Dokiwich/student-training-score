'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await signIn('credentials', {
        redirect: false,
        username,
        password,
      });

      if (res?.error) {
        setError('Tài khoản hoặc mật khẩu không chính xác!');
      } else {
        router.push('/');
        router.refresh();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-sm w-full border border-gray-200 p-8 animate-fade-in">
        <div className="mb-8">
          <h2 className="text-center text-2xl font-bold text-black tracking-tight">
            Đăng nhập
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Hệ thống đánh giá rèn luyện sinh viên
          </p>
        </div>
        <form className="space-y-5" onSubmit={handleLogin} method="POST">
          <div>
            <label className="block text-sm font-medium text-black mb-1">Tài khoản</label>
            <input
              name="username"
              type="text"
              required
              className="block w-full px-3 py-2.5 border border-gray-300 text-black text-sm focus:outline-none focus:border-black transition-colors"
              placeholder="Ví dụ: 123"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              id="login-username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Mật khẩu</label>
            <input
              name="password"
              type="password"
              required
              className="block w-full px-3 py-2.5 border border-gray-300 text-black text-sm focus:outline-none focus:border-black transition-colors"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              id="login-password"
            />
          </div>

          {error && (
            <div className="text-sm text-black bg-gray-100 border border-gray-300 p-3 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 text-sm font-bold text-white bg-black hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            id="login-submit"
          >
            {isLoading ? 'Đang đăng nhập...' : 'ĐĂNG NHẬP'}
          </button>
        </form>
      </div>
    </div>
  );
}
