'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface SemesterInfo {
  id: string;
  code: string;
  name: string;
  academic_year: string;
  status: string;
  student_deadline?: string | null;
  class_committee_deadline?: string | null;
  advisor_deadline?: string | null;
  school_deadline?: string | null;
  start_date?: string;
  end_date?: string;
}

interface SemesterContextValue {
  semester: SemesterInfo | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
  loading: boolean;
}

const SemesterContext = createContext<SemesterContextValue>({
  semester: null,
  lastUpdated: null,
  refetch: async () => {},
  loading: true,
});

// Module-level cache to share across unmounts/remounts within the same session
let globalSemesterCache: SemesterInfo | null = null;
let globalCacheTime: number = 0;
const CACHE_TTL = 60000; // 60 seconds

export function SemesterProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;
  const [semester, setSemester] = useState<SemesterInfo | null>(globalSemesterCache);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(globalCacheTime ? new Date(globalCacheTime) : null);
  const [loading, setLoading] = useState<boolean>(!globalSemesterCache);
  const isFetchingRef = useRef(false);

  // Clear cache if user changes (e.g., logout/login)
  const prevUserId = useRef(userId);
  useEffect(() => {
    if (prevUserId.current !== userId) {
      globalSemesterCache = null;
      globalCacheTime = 0;
      setSemester(null);
      setLastUpdated(null);
      prevUserId.current = userId;
    }
  }, [userId]);

  const fetchSemester = useCallback(async (force = false) => {
    const now = Date.now();
    
    // Use cache if valid and not forcing
    if (!force && globalSemesterCache && now - globalCacheTime < CACHE_TTL) {
      setSemester(globalSemesterCache);
      setLastUpdated(new Date(globalCacheTime));
      setLoading(false);
      return;
    }

    // Deduplicate concurrent requests
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    try {
      const res = await fetch('/api/semester/active', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          globalSemesterCache = json.data;
          globalCacheTime = Date.now();
          setSemester(json.data);
          setLastUpdated(new Date(globalCacheTime));
        } else {
          globalSemesterCache = null;
          globalCacheTime = Date.now();
          setSemester(null);
          setLastUpdated(new Date(globalCacheTime));
        }
      }
    } catch { 
      /* silent fail */ 
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSemester();
  }, [fetchSemester]);

  const value = React.useMemo(() => ({
    semester,
    lastUpdated,
    refetch: () => fetchSemester(true),
    loading
  }), [semester, lastUpdated, fetchSemester, loading]);

  return (
    <SemesterContext.Provider value={value}>
      {children}
    </SemesterContext.Provider>
  );
}

export function useSemester() {
  return useContext(SemesterContext);
}
