'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { User, Key, Mail, Phone, Book, Building, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ProfileContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const defaultTab = searchParams?.get('tab') === 'security' ? 'security' : 'info';
  const [activeTab, setActiveTab] = useState<'info' | 'security'>(defaultTab);

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Password state
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error('Lỗi khi tải thông tin cá nhân', err);
      } finally {
        setLoading(false);
      }
    };
    if (session) fetchProfile();
  }, [session]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');
    
    if (passwords.new !== passwords.confirm) {
      setPwdError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (passwords.new.length < 8) {
      setPwdError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    
    setIsChangingPwd(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.new })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setPwdError(data.message || 'Lỗi khi đổi mật khẩu.');
      } else {
        setPwdSuccess('Đổi mật khẩu thành công!');
        setPasswords({ current: '', new: '', confirm: '' });
      }
    } catch (err) {
      setPwdError('Đã có lỗi xảy ra. Vui lòng thử lại sau.');
    } finally {
      setIsChangingPwd(false);
    }
  };

  return (
    <DashboardLayout
      pageTitle="Hồ sơ cá nhân"
      pageSubtitle="Quản lý thông tin và bảo mật tài khoản"
      breadcrumbs={[{ label: 'Hồ sơ cá nhân' }]}
    >
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar tabs */}
        <div className="w-full md:w-64 shrink-0">
          <Card>
            <div className="p-2 flex flex-col gap-1">
              <button
                onClick={() => setActiveTab('info')}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'info' 
                    ? 'bg-primary-light text-primary' 
                    : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                }`}
              >
                <User size={18} className={activeTab === 'info' ? 'text-primary' : 'text-muted-foreground'} />
                Thông tin cá nhân
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'security' 
                    ? 'bg-primary-light text-primary' 
                    : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                }`}
              >
                <Key size={18} className={activeTab === 'security' ? 'text-primary' : 'text-muted-foreground'} />
                Bảo mật
              </button>
            </div>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="animate-spin text-primary w-8 h-8" />
            </div>
          ) : (
            <>
              {activeTab === 'info' && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Thông tin cơ bản</CardTitle>
                      <CardDescription>Các thông tin do nhà trường quản lý, bạn không thể tự thay đổi.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-sm">
                          {profile?.fullName?.split(' ').pop()?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{profile?.fullName || 'Đang tải...'}</h3>
                          <p className="text-sm text-muted-foreground">
                            {profile?.roleLabel}
                            {profile?.classPosition ? ` - ${profile.classPosition}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1 border border-border p-3 rounded-md bg-surface-muted">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Họ và tên</p>
                          <p className="text-sm text-foreground font-medium">{profile?.fullName}</p>
                        </div>
                        
                        {(profile?.role === 'STUDENT' || profile?.role === 'CLASS_COMMITTEE') && (
                          <div className="space-y-1 border border-border p-3 rounded-md bg-surface-muted">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Mã số sinh viên</p>
                            <p className="text-sm text-foreground font-medium">{profile?.studentCode}</p>
                          </div>
                        )}
                        
                        {(profile?.role === 'ADVISOR' || profile?.role === 'DEPARTMENT') && profile?.staffCode && (
                          <div className="space-y-1 border border-border p-3 rounded-md bg-surface-muted">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Mã cán bộ</p>
                            <p className="text-sm text-foreground font-medium">{profile?.staffCode}</p>
                          </div>
                        )}
                        
                        {profile?.role === 'SCHOOL_ADMIN' && (
                           <div className="space-y-1 border border-border p-3 rounded-md bg-surface-muted">
                             <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Trạng thái tài khoản</p>
                             <p className="text-sm text-foreground font-medium">{profile?.accountStatus === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</p>
                           </div>
                        )}

                        {profile?.role !== 'SCHOOL_ADMIN' && (
                          <div className="space-y-1 border border-border p-3 rounded-md bg-surface-muted">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Lớp / Khoa</p>
                            <p className="text-sm text-foreground font-medium flex items-center gap-2">
                              {profile?.classCode && (
                                <>
                                  <Book size={14} className="text-muted-foreground" /> {profile.classCode}
                                  <span className="text-border">|</span>
                                </>
                              )}
                              <Building size={14} className="text-muted-foreground" /> {profile?.departmentName || 'Chưa cập nhật'}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Thông tin liên hệ</CardTitle>
                      <CardDescription>Cập nhật số điện thoại và email cá nhân.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form className="space-y-4 max-w-md" onSubmit={(e) => { e.preventDefault(); alert('Tính năng đang phát triển'); }}>
                        <Input label="Email trường" value={profile?.primaryEmail || ''} disabled helperText="Email do trường cung cấp không thể thay đổi." icon={<Mail size={16} className="text-muted-foreground" />} />
                        <Input label="Số điện thoại" type="tel" defaultValue={profile?.phone || ''} placeholder="Nhập số điện thoại của bạn" icon={<Phone size={16} className="text-muted-foreground" />} />
                        <Button type="submit" variant="primary">Lưu thay đổi</Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'security' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Đổi mật khẩu</CardTitle>
                    <CardDescription>Đảm bảo mật khẩu của bạn đủ mạnh để bảo vệ tài khoản.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-4 max-w-md" onSubmit={handlePasswordSubmit}>
                      {pwdError && (
                        <div className="p-3 bg-danger-bg text-danger-foreground text-sm rounded-md border border-danger-border">
                          {pwdError}
                        </div>
                      )}
                      {pwdSuccess && (
                        <div className="p-3 bg-success-bg text-success-foreground text-sm rounded-md border border-success-border">
                          {pwdSuccess}
                        </div>
                      )}
                      
                      <Input 
                        label="Mật khẩu hiện tại" 
                        type="password" 
                        required 
                        value={passwords.current}
                        onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                        disabled={isChangingPwd}
                      />
                      <Input 
                        label="Mật khẩu mới" 
                        type="password" 
                        required 
                        helperText="Tối thiểu 8 ký tự, bao gồm chữ cái và số."
                        value={passwords.new}
                        onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                        disabled={isChangingPwd}
                      />
                      <Input 
                        label="Xác nhận mật khẩu mới" 
                        type="password" 
                        required 
                        value={passwords.confirm}
                        onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                        disabled={isChangingPwd}
                      />
                      
                      <div className="pt-2">
                        <Button type="submit" variant="primary" isLoading={isChangingPwd}>
                          Cập nhật mật khẩu
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>}>
      <ProfileContent />
    </Suspense>
  );
}
