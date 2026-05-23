'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import './login.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

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
        if (res.error === 'ACCOUNT_LOCKED') {
          setError('Tài khoản đã bị khóa do sai mật khẩu quá 5 lần. Vui lòng thử lại sau 30 phút!');
        } else if (res.error === 'INVALID_CREDENTIALS') {
          setError('Tài khoản hoặc mật khẩu không chính xác!');
        } else {
          setError(res.error || 'Tài khoản hoặc mật khẩu không chính xác!');
        }
      } else {
        // Middleware will redirect to the correct dashboard based on role
        router.push('/');
        router.refresh();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Background panoramic image */}
      <div className="login-bg" />
      <div className="login-bg-overlay" />

      {/* Login card */}
      <div
        className="login-card"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.98)',
        }}
      >
        {/* Logo / Brand area */}
        <div className="login-brand">
          <div className="login-logo-icon">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
            </svg>
          </div>
          <h1 className="login-title">Hệ thống Đánh giá Rèn luyện</h1>
          <p className="login-subtitle">
            Đăng nhập để truy cập hệ thống chấm điểm rèn luyện sinh viên
          </p>
        </div>

        {/* Divider */}
        <div className="login-divider" />

        {/* Form */}
        <form className="login-form" onSubmit={handleLogin} method="POST">
          <div className="login-field">
            <label htmlFor="login-username" className="login-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Tài khoản
            </label>
            <input
              name="username"
              type="text"
              required
              className="login-input"
              placeholder="Nhập mã số sinh viên"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              id="login-username"
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password" className="login-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Mật khẩu
            </label>
            <div className="login-password-wrapper">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                className="login-input"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                id="login-password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error" id="login-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="login-submit"
            id="login-submit"
          >
            {isLoading ? (
              <>
                <span className="login-spinner" />
                Đang đăng nhập...
              </>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p>© 2026 Hệ thống Đánh giá Rèn luyện Sinh viên</p>
        </div>
      </div>

      {/* Decorative bottom bar */}
      <div className="login-bottom-info">
        <span className="login-status-dot" />
        Hệ thống đang hoạt động — Học kỳ 1, Năm học 2025-2026
      </div>
    </div>
  );
}
