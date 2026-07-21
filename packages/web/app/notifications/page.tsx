'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardLayout } from '../components/DashboardLayout';
import { fetchWithCache, invalidateRequestCache } from '../lib/client-request-cache';
import { getNotificationTargetUrl } from '../lib/notification-target';
import { NOTIFICATION_EVENTS } from '../lib/notification-events';
import { useRouter } from 'next/navigation';
import { CheckCircle, ClipboardCheck, Check, XCircle, ShieldCheck, MessageSquare, MessageSquareCheck, Calendar, Clock, Info, Bell, Loader2 } from 'lucide-react';

const NOTIF_TYPE_META: Record<string, { icon: React.ReactNode; colorClass: string }> = {
  SCORE_SUBMITTED: { icon: <CheckCircle size={20} />, colorClass: 'text-success' },
  SCORE_REVIEWED: { icon: <ClipboardCheck size={20} />, colorClass: 'text-warning' },
  SCORE_APPROVED: { icon: <Check size={20} />, colorClass: 'text-success' },
  SCORE_REJECTED: { icon: <XCircle size={20} />, colorClass: 'text-danger' },
  SCORE_FINALIZED: { icon: <ShieldCheck size={20} />, colorClass: 'text-success' },
  APPEAL_SUBMITTED: { icon: <MessageSquare size={20} />, colorClass: 'text-warning' },
  APPEAL_RESOLVED: { icon: <MessageSquareCheck size={20} />, colorClass: 'text-success' },
  SCORING_OPENED: { icon: <Calendar size={20} />, colorClass: 'text-danger' },
  DEADLINE_REMINDER: { icon: <Clock size={20} />, colorClass: 'text-warning' },
  SYSTEM_ANNOUNCEMENT: { icon: <Info size={20} />, colorClass: 'text-info' },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

export default function NotificationsPage() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;
  const role = (session?.user as any)?.role || 'STUDENT';
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  
  const fetchIdRef = useRef(0);
  const markAllInProgressRef = useRef(false);

  const fetchPage = useCallback(async (isLoadMore = false, forceRefresh = false, cursorToUse = nextCursor) => {
    if (!userId) return;
    
    fetchIdRef.current += 1;
    const currentFetchId = fetchIdRef.current;
    
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      let url = `/api/notifications?filter=${activeTab}&limit=20`;
      if (isLoadMore && cursorToUse) {
        url += `&cursor=${cursorToUse}`;
      }

      const res = await fetchWithCache<any>(url, userId, { ttl: 30000, forceRefresh });
      
      // If a newer fetch was started, discard these stale results
      if (fetchIdRef.current !== currentFetchId) return;
      
      if (isLoadMore) {
        setNotifications(prev => {
          const newItems = res.data.filter((newItem: any) => !prev.some((oldItem: any) => oldItem.id === newItem.id));
          return [...prev, ...newItems];
        });
      } else {
        setNotifications(res.data || []);
      }
      setHasMore(res.hasMore);
      setNextCursor(res.nextCursor);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      if (fetchIdRef.current === currentFetchId) {
        if (isLoadMore) setLoadingMore(false);
        else setLoading(false);
      }
    }
  }, [userId, activeTab, nextCursor]);

  useEffect(() => {
    // Reset state and fetch when tab changes
    setNextCursor(null);
    setHasMore(false);
    setNotifications([]);
    
    // Call API with no cursor
    const doFetch = async () => {
      if (!userId) return;
      
      fetchIdRef.current += 1;
      const currentFetchId = fetchIdRef.current;
      setLoading(true);
      
      try {
        const url = `/api/notifications?filter=${activeTab}&limit=20`;
        const res = await fetchWithCache<any>(url, userId, { ttl: 30000 });
        if (fetchIdRef.current !== currentFetchId) return;
        
        setNotifications(res.data || []);
        setHasMore(res.hasMore);
        setNextCursor(res.nextCursor);
      } catch (err) {
        console.error(err);
      } finally {
        if (fetchIdRef.current === currentFetchId) {
          setLoading(false);
        }
      }
    };
    doFetch();
  }, [activeTab, userId]); 

  const markAsRead = async (ids?: string[]) => {
    if (!userId) return;
    
    if (!ids && markAllInProgressRef.current) return;
    if (!ids) markAllInProgressRef.current = true;

    // Snapshot state for rollback
    const prevNotifications = notifications;

    // Optimistic Update
    setNotifications(prev => {
      if (activeTab === 'unread') {
        if (!ids) return [];
        return prev.filter(n => !ids.includes(n.id));
      } else {
        return prev.map(n => {
          if (!ids || ids.includes(n.id)) {
            return { ...n, isRead: true };
          }
          return n;
        });
      }
    });

    try {
      const body = ids ? { ids } : { markAllRead: true };
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark read');
      }
      
      // Dispatch event to sync with Bell
      window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENTS.UPDATED));
      
      // Force refresh data in background to keep nextCursor and list perfectly synced
      invalidateRequestCache(userId, '/api/notifications');
    } catch (err) {
      console.error(err);
      alert('Đã có lỗi xảy ra khi cập nhật thông báo.');
      // Rollback
      setNotifications(prevNotifications);
    } finally {
      if (!ids) {
        markAllInProgressRef.current = false;
      }
    }
  };

  const handleItemClick = (item: any) => {
    if (!item.isRead) markAsRead([item.id]);
    const targetUrl = getNotificationTargetUrl({ type: item.type, currentRole: role, data: item.data });
    if (targetUrl) {
      router.push(targetUrl);
    }
  };

  const defaultMeta = { icon: <Bell size={20} />, colorClass: 'text-muted-foreground' };

  return (
    <DashboardLayout pageTitle="Trung tâm Thông báo" breadcrumbs={[{ label: 'Thông báo' }]}>
      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden max-w-4xl mx-auto">
        
        {/* Tabs */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-muted">
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab('all')}
              className={`pb-1 text-sm font-medium transition-colors border-b-2 ${activeTab === 'all' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              Tất cả
            </button>
            <button 
              onClick={() => setActiveTab('unread')}
              className={`pb-1 text-sm font-medium transition-colors border-b-2 ${activeTab === 'unread' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              Chưa đọc
            </button>
          </div>
          
          <button 
            onClick={() => markAsRead()} 
            className="text-sm font-medium text-primary hover:text-primary-hover flex items-center gap-1.5"
          >
            <CheckCircle size={16} /> Đánh dấu tất cả đã đọc
          </button>
        </div>

        {/* Content */}
        <div className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-muted-foreground">
              <Bell size={48} className="opacity-20 mb-4" />
              <p className="font-medium text-lg text-foreground">
                {activeTab === 'unread' ? 'Không có thông báo chưa đọc' : 'Bạn chưa có thông báo nào'}
              </p>
              <p className="text-sm mt-2">Khi có sự kiện mới, thông báo sẽ hiển thị tại đây.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map(n => {
                const meta = NOTIF_TYPE_META[n.type] || defaultMeta;
                return (
                  <div 
                    key={n.id} 
                    className={`flex items-start gap-4 p-6 transition-colors cursor-pointer hover:bg-surface-muted ${!n.isRead ? 'bg-primary-light/10' : ''}`}
                    onClick={() => handleItemClick(n)}
                  >
                    <div className={`shrink-0 p-2 rounded-full bg-surface shadow-sm border border-border ${meta.colorClass}`}>
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <h4 className={`text-base ${!n.isRead ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
                          {n.title}
                        </h4>
                        <span className="text-xs text-muted-foreground whitespace-nowrap pt-1">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {n.content}
                      </p>
                    </div>
                    {!n.isRead && (
                      <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-primary mt-2 shadow-sm" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Load More */}
        {hasMore && !loading && (
          <div className="p-6 border-t border-border flex justify-center bg-surface">
            <button
              disabled={loadingMore}
              onClick={() => fetchPage(true)}
              className="px-6 py-2.5 rounded-full bg-surface-muted border border-border text-foreground text-sm font-medium hover:bg-surface-muted/80 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loadingMore && <Loader2 size={16} className="animate-spin" />}
              {loadingMore ? 'Đang tải...' : 'Tải thêm'}
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
