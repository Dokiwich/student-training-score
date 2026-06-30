'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import '../login/login.css';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Có lỗi xảy ra');
      }

      setSuccess('Mã xác nhận đã được gửi đến email của bạn.');
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Không thể gửi yêu cầu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Mã xác nhận không hợp lệ');
      }

      setError('');
      setSuccess('');
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Đổi mật khẩu thất bại');
      }

      setSuccess('Đổi mật khẩu thành công. Đang chuyển hướng...');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-bg-overlay" />

      <div className="login-top-nav">
        <button onClick={() => step > 1 ? setStep(step - 1) : router.push('/login')} className="login-back-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          {step > 1 ? 'Quay lại' : 'Trở về trang Đăng nhập'}
        </button>
      </div>

      <div className="login-card" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.98)' }}>
        <div className="login-brand">
          <div className="login-logo-container">
            <img src="/assets/login/logo.png" alt="Logo" className="login-logo-image" />
          </div>
          <h1 className="login-title">Khôi phục mật khẩu</h1>
          <p className="login-subtitle">
            {step === 1 && 'Nhập email sinh viên (Outlook) để nhận mã xác nhận'}
            {step === 2 && 'Nhập mã gồm 6 chữ số đã được gửi đến email'}
            {step === 3 && 'Tạo mật khẩu mới cho tài khoản của bạn'}
          </p>
        </div>

        <div className="login-divider" />

        {step === 1 && (
          <form className="login-form" onSubmit={handleRequestCode}>
            <div className="login-field">
              <label className="login-label">Email tài khoản</label>
              <input
                type="email"
                required
                className="login-input"
                placeholder="Nhập email (VD: sv123@mit.vn)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" disabled={isLoading} className="login-submit">
              {isLoading ? 'ĐANG GỬI...' : 'GỬI MÃ XÁC NHẬN'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form className="login-form" onSubmit={handleVerifyCode}>
            <div className="login-field">
              <label className="login-label">Mã xác nhận (OTP)</label>
              <input
                type="text"
                required
                maxLength={6}
                className="login-input"
                placeholder="Nhập 6 số"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isLoading}
                style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '18px' }}
              />
            </div>
            {error && <div className="login-error">{error}</div>}
            {success && <div style={{ color: '#059669', fontSize: '13px', background: '#ecfdf5', padding: '10px', borderRadius: '8px' }}>{success}</div>}
            <button type="submit" disabled={isLoading} className="login-submit">
              {isLoading ? 'ĐANG XÁC THỰC...' : 'XÁC THỰC'}
            </button>
          </form>
        )}

        {step === 3 && (
          <form className="login-form" onSubmit={handleResetPassword}>
            <div className="login-field">
              <label className="login-label">Mật khẩu mới</label>
              <div className="login-password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="login-input"
                  placeholder="Nhập mật khẩu mới"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button type="button" className="login-password-toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
            </div>
            <div className="login-field">
              <label className="login-label">Xác nhận mật khẩu</label>
              <div className="login-password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="login-input"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
            {error && <div className="login-error">{error}</div>}
            {success && <div style={{ color: '#059669', fontSize: '13px', background: '#ecfdf5', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>{success}</div>}
            <button type="submit" disabled={isLoading} className="login-submit">
              {isLoading ? 'ĐANG XỬ LÝ...' : 'ĐỔI MẬT KHẨU'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
