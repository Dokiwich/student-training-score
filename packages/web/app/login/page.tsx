'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import './login.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [semesterInfo, setSemesterInfo] = useState('Hệ thống đang hoạt động');
  const router = useRouter();

  useEffect(() => {
    setMounted(true);

    const now = new Date();
    const month = now.getMonth(); // 0-11
    const year = now.getFullYear();

    let semester = '';
    let academicYear = '';

    if (month >= 7 && month <= 11) {
      semester = 'Học kỳ 1';
      academicYear = `${year}-${year + 1}`;
    } else if (month >= 0 && month <= 4) {
      semester = 'Học kỳ 2';
      academicYear = `${year - 1}-${year}`;
    } else {
      semester = 'Học kỳ Hè';
      academicYear = `${year - 1}-${year}`;
    }

    setSemesterInfo(`Hệ thống đang hoạt động — ${semester}, Năm học ${academicYear}`);
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
        } else if (res.error === 'INVALID_CREDENTIALS' || res.error === 'CredentialsSignin') {
          setError('Tài khoản hoặc mật khẩu không chính xác!');
        } else {
          setError('Đăng nhập thất bại. Vui lòng kiểm tra lại!');
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

      {/* Top Navigation */}
      <div className="login-top-nav">
        <a href="https://sinhvien.mit.vn" className="login-back-link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Quay lại Cổng Sinh Viên
        </a>
      </div>

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
          <div className="login-logo-container">
            <img src="/assets/login/logo.png" alt="Logo Trường" className="login-logo-image" />
          </div>
          <h1 className="login-title">Cổng Chấm Điểm Rèn Luyện</h1>
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
              placeholder="Nhập gmail sinh viên"
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
                ĐANG ĐĂNG NHẬP...
              </>
            ) : (
              'ĐĂNG NHẬP'
            )}
          </button>

          <div className="login-forgot-password">
            <Link href="/forgot-password" style={{ textDecoration: 'none' }}>
              <p style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={(e) => (e.currentTarget.style.color = '#b91c1c')} onMouseOut={(e) => (e.currentTarget.style.color = '#6b7280')}>
                Quên Mật Khẩu? &rarr; Khôi phục ngay
              </p>
            </Link>
          </div>
        </form>

      </div>

      {/* Decorative bottom bar */}
      <div className="login-bottom-info">
        <span className="login-status-dot" />
        {semesterInfo}
      </div>
    </div>
  );
}
