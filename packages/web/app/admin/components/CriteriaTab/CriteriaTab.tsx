'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CriteriaSetList } from './CriteriaSetList';
import { CriteriaWorkspace } from './CriteriaWorkspace';
import { CriteriaSetCreateForm } from './CriteriaSetCreateForm';
import { Loader2 } from 'lucide-react';
import type { CriteriaVersion } from './types';

export function CriteriaTab() {
  const [versions, setVersions] = useState<CriteriaVersion[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Workspace (Preview/Edit Mode) state
  const [activeWorkspaceVersion, setActiveWorkspaceVersion] = useState<CriteriaVersion | null>(null);
  
  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/criteria');
      if (res.ok) {
        const json = await res.json();
        setVersions(json.versions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-8 h-8 text-[#d0d6e0] animate-spin" />
        <span className="text-[#62666d] text-[15px] font-[510]">Đang tải dữ liệu bộ tiêu chí...</span>
      </div>
    );
  }

  if (activeWorkspaceVersion) {
    return (
      <CriteriaWorkspace 
        version={activeWorkspaceVersion} 
        onClose={() => {
          setActiveWorkspaceVersion(null);
          fetchVersions(); // Refresh after closing workspace
        }} 
      />
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-6">
      <CriteriaSetList 
        versions={versions} 
        onCreateClick={() => setShowCreateModal(true)}
        onOpenWorkspace={(v) => setActiveWorkspaceVersion(v)}
        onVersionUpdate={fetchVersions}
      />
      
      {showCreateModal && (
        <CriteriaSetCreateForm 
          versions={versions}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newVersion) => {
            setShowCreateModal(false);
            fetchVersions();
            if (newVersion) {
              setActiveWorkspaceVersion(newVersion);
            }
          }}
        />
      )}
    </div>
  );
}
