'use client';

import { useState } from 'react';
import { Paperclip, Link as LinkIcon, ExternalLink, X, UploadCloud } from 'lucide-react';

interface EvidenceInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
  required?: boolean;
}

export function EvidenceInput({ value, onChange, disabled, required }: EvidenceInputProps) {
  const [isHovered, setIsHovered] = useState(false);

  // If there's a value, display it nicely
  if (value) {
    const isUrl = value.startsWith('http');
    const displayHref = isUrl ? value : `https://${value}`;
    
    return (
      <div 
        className={`relative flex items-center gap-2 p-1.5 pl-3 border rounded-lg transition-all ${
          disabled ? 'bg-surface-muted border-border' : 'bg-primary-light/10 border-primary-light hover:border-primary/40'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Paperclip size={14} className="text-primary shrink-0" />
        <span className="text-xs text-primary font-medium truncate flex-1 min-w-0">
          {value.replace(/^https?:\/\//, '')}
        </span>
        
        <div className="flex items-center gap-1 shrink-0">
          <a 
            href={displayHref} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="p-1 rounded text-primary hover:bg-primary-light transition-colors"
            title="M�x liên kết"
          >
            <ExternalLink size={14} />
          </a>
          {!disabled && (
            <button 
              type="button"
              onClick={() => onChange('')}
              className="p-1 rounded text-danger hover:bg-danger-bg transition-colors"
              title="Xóa minh chứng"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // If no value, show the input
  return (
    <div className="relative group">
      <div className={`absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none ${disabled ? 'text-muted-foreground' : 'text-primary/50 group-hover:text-primary transition-colors'}`}>
        <LinkIcon size={14} />
      </div>
      <input 
        type="text" 
        placeholder="Dán link minh chứng..." 
        value={value} 
        disabled={disabled} 
        onChange={(e) => onChange(e.target.value)} 
        className={`w-full h-9 pl-8 pr-3 text-xs text-foreground border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary-ring outline-none transition-all placeholder:text-muted-foreground disabled:bg-surface-muted disabled:text-muted-foreground disabled:border-border ${
          required ? 'bg-red-50/30 border-red-200 placeholder:text-red-300 hover:border-red-300' : 'hover:border-primary/40'
        }`} 
      />
      
      {/* Fake file upload trigger (visual only) */}
      {!disabled && (
        <button 
          type="button"
          className="absolute inset-y-1 right-1 px-2 flex items-center justify-center gap-1 bg-surface-muted hover:bg-surface-elevated text-muted-foreground hover:text-foreground rounded text-[10px] font-medium transition-colors border border-transparent"
          title="Tải t�!p lên (Sắp ra mắt)"
          onClick={() => alert("Tính nĒng tải t�!p �ính kèm �ang �ược phát triỒn. Vui lòng dán link Google Drive hoặc OneDrive.")}
        >
          <UploadCloud size={12} />
        </button>
      )}
    </div>
  );
}
