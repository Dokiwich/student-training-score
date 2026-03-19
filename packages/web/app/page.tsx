import Link from 'next/link';

export default function Home() {
  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">Xin chào, Trần Đức Anh 👋</h1>
        <p className="text-text-secondary mt-1">Chào mừng bạn quay trở lại hệ thống Điểm Rèn Luyện.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-surface rounded-2xl p-6 shadow-md border border-border hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <span className="text-xs font-medium text-primary bg-primary-50 px-2.5 py-1 rounded-full">HK1</span>
          </div>
          <p className="text-text-muted text-sm font-medium">Phiếu điểm</p>
          <p className="text-3xl font-bold text-text-primary mt-1">1</p>
          <p className="text-xs text-success font-medium mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success inline-block"></span>
            Trạng thái: Nháp
          </p>
        </div>

        <div className="bg-surface rounded-2xl p-6 shadow-md border border-border hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
          <p className="text-text-muted text-sm font-medium">Tiêu chí đã chấm</p>
          <p className="text-3xl font-bold text-text-primary mt-1">0</p>
          <p className="text-xs text-text-muted mt-2">Chưa chấm tiêu chí nào</p>
        </div>

        <div className="bg-surface rounded-2xl p-6 shadow-md border border-border hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
          <p className="text-text-muted text-sm font-medium">Hạn nộp phiếu</p>
          <p className="text-xl font-bold text-text-primary mt-1">15/01/2024</p>
          <p className="text-xs text-warning font-medium mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block"></span>
            Còn thời hạn
          </p>
        </div>
      </div>

      {/* Quick Action */}
      <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Bắt đầu chấm điểm</h2>
            <p className="text-white/70 text-sm max-w-md">
              Truy cập phiếu chấm điểm rèn luyện để tự đánh giá các tiêu chí trong học kỳ hiện tại.
            </p>
          </div>
          <Link
            href="/scoring"
            className="bg-white text-primary font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 text-sm flex items-center gap-2"
          >
            Chấm điểm ngay
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
