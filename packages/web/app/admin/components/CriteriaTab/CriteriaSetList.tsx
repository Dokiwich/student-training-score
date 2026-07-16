import React, { useState } from 'react';
import { Plus, Search, CheckCircle2, Circle, FileEdit } from 'lucide-react';
import { CriteriaSetCard } from './CriteriaSetCard';
import type { CriteriaVersion } from './types';

interface CriteriaSetListProps {
  versions: CriteriaVersion[];
  onCreateClick: () => void;
  onOpenWorkspace: (version: CriteriaVersion) => void;
  onVersionUpdate: () => void;
}

export function CriteriaSetList({ versions, onCreateClick, onOpenWorkspace, onVersionUpdate }: CriteriaSetListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const activeVersions = versions.filter(v => v.is_active === 1 && (v.name || v.semesters?.code || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const draftVersions = versions.filter(v => v.is_active !== 1 && (v.name || v.semesters?.code || '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="text-[24px] font-[510] tracking-[-0.288px] text-[#1F2937] leading-[1.33]">
            Tiêu chí đánh giá
          </h2>
          <p className="text-[15px] text-[#64748B] font-[400] mt-1">
            Quản lý bộ tiêu chí và thang điểm rèn luyện theo từng học kỳ.
          </p>
        </div>
        
        <button 
          onClick={onCreateClick}
          className="flex items-center gap-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white px-4 py-2 rounded-[6px] text-[14px] font-[510] transition-colors border border-transparent focus:ring-[3px] focus:ring-[#FEF2F2] outline-none"
        >
          <Plus className="w-[18px] h-[18px]" strokeWidth={2} />
          <span>Tạo bộ tiêu chí</span>
        </button>
      </div>

      {/* Toolbar / Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-white border border-[#E5E7EB] p-[6px] rounded-[8px] w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-2 px-3 min-w-[200px] flex-1">
          <Search className="w-4 h-4 text-[#8a8f98]" strokeWidth={2} />
          <input 
            type="text" 
            placeholder="Tìm theo tên..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-[15px] font-[400] text-[#1F2937] w-full placeholder:text-[#8a8f98]"
          />
        </div>
        {/* Additional filters can be added here, currently just search as requested */}
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')} 
            className="text-[13px] font-[510] text-[#64748B] hover:text-[#1F2937] px-3 py-1.5 rounded-[4px] hover:bg-[#F1F5F9] transition-colors"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Empty State */}
      {versions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white border border-[#E5E7EB] rounded-[12px]">
          <FileEdit className="w-12 h-12 text-[#d0d6e0] mb-4" strokeWidth={1.5} />
          <p className="text-[16px] font-[510] text-[#1F2937] mb-2">Chưa có bộ tiêu chí nào</p>
          <p className="text-[14px] text-[#64748B] mb-6">Tạo bộ tiêu chí đầu tiên để bắt đầu hệ thống chấm điểm.</p>
          <button 
            onClick={onCreateClick}
            className="text-[#B91C1C] text-[14px] font-[510] hover:underline"
          >
            Tạo bộ tiêu chí đầu tiên
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Active Section */}
          <section className="flex flex-col gap-4">
            <h3 className="flex items-center gap-2 text-[15px] font-[590] text-[#15803D]">
              <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
              Đang áp dụng
            </h3>
            
            {activeVersions.length === 0 ? (
              <div className="p-6 bg-[#F8FAFC] border border-dashed border-[#E5E7EB] rounded-[8px] text-[14px] text-[#64748B] font-[400] text-center">
                Chưa có bộ tiêu chí nào đang áp dụng.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activeVersions.map(v => (
                  <CriteriaSetCard 
                    key={v.id} 
                    version={v} 
                    onOpen={() => onOpenWorkspace(v)}
                    onUpdate={onVersionUpdate}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Draft Section */}
          <section className="flex flex-col gap-4">
            <h3 className="flex items-center gap-2 text-[15px] font-[590] text-[#64748B]">
              <Circle className="w-4 h-4" strokeWidth={2} />
              Bản nháp / Đã khóa
            </h3>
            
            {draftVersions.length === 0 ? (
              <div className="p-6 bg-[#F8FAFC] border border-dashed border-[#E5E7EB] rounded-[8px] text-[14px] text-[#64748B] font-[400] text-center">
                Không có bản nháp nào.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {draftVersions.map(v => (
                  <CriteriaSetCard 
                    key={v.id} 
                    version={v} 
                    onOpen={() => onOpenWorkspace(v)}
                    onUpdate={onVersionUpdate}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
