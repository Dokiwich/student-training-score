const fs = require('fs');

const code = `// ponytail: no more hardcoded DIEU_CONFIG — uses dieuMeta prop from CSV auto-detection
"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { StudentRecord, CeilingConfig, DieuMeta } from "./types";
import { DEFAULT_DIEU_META, formatSharePointLink, calculateRank } from "./constants";
import { X, Check, Copy, ExternalLink, Image as ImageIcon, Link as LinkIcon, AlertTriangle } from "lucide-react";

interface StudentDetailModalProps {
  student: StudentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedStudent: StudentRecord, autoNext?: boolean) => void;
  ceilingConfig: CeilingConfig;
  sharePointDomain: string;
  dieuMeta?: DieuMeta[];
  onPrevStudent?: () => void;
  onNextStudent?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  currentIndex?: number;
  totalStudents?: number;
}

export default function StudentDetailModal({
  student,
  isOpen,
  onClose,
  onSave,
  ceilingConfig,
  sharePointDomain,
  dieuMeta = DEFAULT_DIEU_META,
  onPrevStudent,
  onNextStudent,
  hasPrev,
  hasNext,
  currentIndex,
  totalStudents,
}: StudentDetailModalProps) {
  const [formData, setFormData] = useState<StudentRecord | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  
  useEffect(() => {
    if (student) {
      setFormData({ ...student });
    }
  }, [student]);

  const triggerCopyFeedback = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  // derived state
  const totalBCS = formData 
    ? Number(formData.d1_bcs || 0) + Number(formData.d2_bcs || 0) + Number(formData.d3_bcs || 0) + Number(formData.d4_bcs || 0) + Number(formData.d5_bcs || 0) + Number(formData.d6_bcs || 0)
    : 0;
  
  const totalSV = formData 
    ? Number(formData.d1_sv || 0) + Number(formData.d2_sv || 0) + Number(formData.d3_sv || 0) + Number(formData.d4_sv || 0) + Number(formData.d5_sv || 0) + Number(formData.d6_sv || 0)
    : 0;

  const currentRank = calculateRank(totalBCS);

  const handleSaveAndExit = useCallback(() => {
    if (formData) {
      onSave({
        ...formData,
        tongDiem_bcs: totalBCS,
        xepLoai: currentRank,
        banCanSu: String(totalBCS),
        isModified: true,
      });
    }
    onClose();
  }, [formData, totalBCS, currentRank, onSave, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      const isInputActive = activeTag === "input" || activeTag === "textarea" || activeTag === "select";

      if (e.key === "Escape") {
        onClose();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveAndExit();
        return;
      }
      if (!isInputActive) {
        if (e.key === "ArrowLeft" && hasPrev) {
          e.preventDefault();
          onPrevStudent?.();
        } else if (e.key === "ArrowRight" && hasNext) {
          e.preventDefault();
          onNextStudent?.();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose, hasPrev, hasNext, onPrevStudent, onNextStudent, handleSaveAndExit]);

  if (!isOpen || !formData) return null;

  const handleScoreChange = (field: keyof StudentRecord, val: number) => {
    setFormData((prev) => {
      if (!prev) return null;
      const safeVal = isNaN(val) ? 0 : val;
      const updated = { ...prev, [field]: safeVal };
      return {
        ...updated,
        tongDiem_bcs: totalBCS, // it updates naturally next render
        xepLoai: currentRank,
        isModified: true,
      };
    });
  };

  const handleCopyForSharePoint = (format: "tsv" | "summary") => {
    if (!formData) return;
    let textToCopy = "";
    if (format === "tsv") {
      textToCopy = \`\${formData.d1_bcs}\t\${formData.d2_bcs}\t\${formData.d3_bcs}\t\${formData.d4_bcs}\t\${formData.d5_bcs}\t\${formData.d6_bcs}\t\${totalBCS}\t\${formData.trangThai}\t\${currentRank}\t\${formData.nguoiDuyet || ""}\`;
      navigator.clipboard.writeText(textToCopy);
      triggerCopyFeedback("Đã sao chép dạng cột (TSV)!");
    }
  };

  const evidenceLinks = formData.linkMinhChung
    ? formData.linkMinhChung.split(/[,;\\n]+/).map(s => s.trim()).filter(Boolean)
    : [];

  const isImageUrl = (url: string) => {
    return url.match(/\\.(jpeg|jpg|gif|png|webp)$/i) != null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-1600px h-[92vh] flex flex-col overflow-hidden text-foreground">
        
        {/* Header */}
        <div className="px-5 py-3 border-b border-border bg-surface flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex flex-col min-w-0">
              <h2 className="text-sm font-semibold truncate flex items-center gap-2">
                {formData.hoVaTen}
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-muted text-muted-foreground border border-border">
                  {formData.maSV}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-muted text-muted-foreground border border-border">
                  {formData.lop}
                </span>
              </h2>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                <span>Trạng thái: <strong className={formData.trangThai === "DaDuyet" ? "text-success" : "text-warning"}>{formData.trangThai}</strong></span>
                {totalStudents && (
                  <>
                    <span className="text-border">•</span>
                    <span>SV thứ {currentIndex! + 1} / {totalStudents}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {copyFeedback && (
              <span className="text-xs text-success bg-success-bg px-2 py-1 rounded-md animate-in fade-in">
                {copyFeedback}
              </span>
            )}
            <div className="flex items-center border border-border rounded-lg bg-surface-muted p-1">
              <button
                onClick={onPrevStudent}
                disabled={!hasPrev}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                Trở lại
              </button>
              <div className="w-px h-3 bg-border mx-1" />
              <button
                onClick={onNextStudent}
                disabled={!hasNext}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                Tiếp theo
              </button>
            </div>
            
            <button
              onClick={() => handleCopyForSharePoint("tsv")}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy SharePoint (TSV)
            </button>
            <button
              onClick={handleSaveAndExit}
              className="p-1.5 text-muted-foreground hover:text-foreground bg-surface-muted rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Split Pane */}
        <div className="flex-1 flex min-h-0">
          
          {/* LEFT PANE: Evidence */}
          <div className="w-1/2 border-r border-border bg-surface-muted/20 flex flex-col">
            <div className="px-4 py-2 border-b border-border bg-surface flex justify-between items-center shrink-0">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Minh Chứng Trực Tiếp</span>
              {formData.linkMinhChung && (
                <a href={formatSharePointLink(formData.linkMinhChung, sharePointDomain)} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Mở thư mục SharePoint <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {evidenceLinks.length > 0 ? (
                evidenceLinks.map((link, idx) => {
                  const url = formatSharePointLink(link, sharePointDomain);
                  const isImage = isImageUrl(link);
                  return (
                    <div key={idx} className="border border-border rounded-lg bg-surface overflow-hidden shadow-xs">
                      <div className="bg-surface-muted px-3 py-1.5 border-b border-border flex items-center justify-between">
                        <span className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                          {isImage ? <ImageIcon className="w-3 h-3" /> : <LinkIcon className="w-3 h-3" />}
                          {link}
                        </span>
                        <a href={url} target="_blank" rel="noreferrer" className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded text-foreground hover:bg-surface-muted">
                          Mở tab mới
                        </a>
                      </div>
                      {isImage ? (
                        <div className="p-2 flex justify-center bg-black/5">
                          <img src={url} alt={\`Minh chứng \${idx+1}\`} className="max-w-full h-auto rounded border border-border/50" loading="lazy" />
                        </div>
                      ) : (
                        <iframe src={url} className="w-full h-96 border-0 bg-white" sandbox="allow-scripts allow-same-origin" loading="lazy" />
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <AlertTriangle className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-sm font-medium">Không có link minh chứng</p>
                  <p className="text-xs opacity-60">Sinh viên không cung cấp đường dẫn minh chứng nào.</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANE: Scoring Form */}
          <div className="w-1/2 flex flex-col bg-background">
            <div className="px-4 py-2 border-b border-border bg-surface flex justify-between items-center shrink-0">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bảng Điểm (Chuẩn)</span>
              <div className="flex items-center gap-3 text-xs">
                <span>Tự chấm: <strong className="text-foreground">{totalSV}</strong></span>
                <span>BCS chấm: <strong className="text-primary">{totalBCS}</strong> / {ceilingConfig.maxTotal}</span>
                <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">{currentRank}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="max-w-xl mx-auto space-y-4">
                {dieuMeta.map((dieu) => {
                  const svVal = Number(formData[dieu.svKey]) || 0;
                  const bcsVal = Number(formData[dieu.bcsKey]) || 0;
                  const ceilingMax = ceilingConfig[dieu.key];
                  const isExceeded = bcsVal > ceilingMax;

                  return (
                    <div key={dieu.key} className={\`p-4 rounded-xl border bg-surface transition-colors flex items-center justify-between gap-4 \${isExceeded ? 'border-danger bg-danger-bg/10' : 'border-border'}\`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-5 h-5 flex items-center justify-center bg-surface-muted text-[10px] font-bold text-muted-foreground rounded border border-border shrink-0">{dieu.num}</span>
                          <h4 className="text-sm font-medium text-foreground truncate" title={dieu.label}>{dieu.label}</h4>
                        </div>
                        <div className="text-[11px] text-muted-foreground pl-7">
                          Trần điểm: {ceilingMax} | Tự chấm: {svVal}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleScoreChange(dieu.bcsKey, svVal)}
                            className="text-[10px] px-1.5 py-0.5 text-muted-foreground hover:text-foreground border border-border rounded bg-surface-muted"
                          >
                            Lấy SV
                          </button>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max={ceilingMax}
                              value={bcsVal}
                              onChange={(e) => handleScoreChange(dieu.bcsKey, Number(e.target.value))}
                              className={\`w-16 h-8 text-center font-mono text-sm border rounded-md outline-hidden \${isExceeded ? 'border-danger text-danger bg-danger-bg' : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'}\`}
                            />
                          </div>
                        </div>
                        {isExceeded && <span className="text-[10px] text-danger">Vượt trần!</span>}
                      </div>
                    </div>
                  );
                })}

                <div className="pt-4 mt-6 border-t border-border grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">Trạng thái duyệt</label>
                    <select
                      value={formData.trangThai}
                      onChange={(e) => setFormData({ ...formData, trangThai: e.target.value as "ChoDuyet" | "DaDuyet", isModified: true })}
                      className="w-full h-8 px-2 text-xs border border-border rounded-md bg-surface text-foreground focus:ring-1 focus:ring-primary outline-hidden"
                    >
                      <option value="ChoDuyet">Chờ duyệt</option>
                      <option value="DaDuyet">Đã duyệt</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">Người duyệt</label>
                    <input
                      type="text"
                      value={formData.nguoiDuyet || ""}
                      onChange={(e) => setFormData({ ...formData, nguoiDuyet: e.target.value, isModified: true })}
                      placeholder="Tên BCS..."
                      className="w-full h-8 px-2 text-xs border border-border rounded-md bg-surface text-foreground focus:ring-1 focus:ring-primary outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
`;

fs.writeFileSync('d:/duan/packages/web/app/tool/StudentDetailModal.tsx', code);
console.log('updated modal');
