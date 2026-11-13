import { PanelButton } from "./PanelButton";
import React from "react";
import { X, Folder, Image, Clock, Plus, Trash2, ArrowRight } from "lucide-react";
import { Layer } from "../types";

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  layers: Layer[];
  onNewProject: () => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  layers,
  onNewProject,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="projects-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="projects-modal-content"
        className="w-full max-w-xl bg-[#0e101c] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-purple-500/20 bg-[#131525] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-inner">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">مشاريعي المحفوظة</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                إدارة ملفات التصميم، الجلسات السابقة، ونقاط الاستعادة
              </p>
            </div>
          </div>

          <PanelButton
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </PanelButton>
        </div>

        {/* Project List */}
        <div className="p-4 overflow-y-auto space-y-3 custom-scrollbar">
          {/* Current Active Project */}
          <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-slate-900 border border-purple-500/40 overflow-hidden flex items-center justify-center">
                {layers[0]?.canvas ? (
                  <img
                    src={layers[0].canvas.toDataURL()}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Image className="w-6 h-6 text-purple-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-100">
                    تصميم إبداعي جديد
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    المشروع النشط الحالي
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-purple-400" />
                    منذ دقيقة
                  </span>
                  <span>•</span>
                  <span>{layers.length} طبقات</span>
                </div>
              </div>
            </div>

            <PanelButton
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow transition-all"
            >
              متابعة العمل
            </PanelButton>
          </div>

          {/* Preset Sample Projects */}
          <div className="text-xs font-bold text-slate-400 pt-2 pb-1">
            مشاريع ونماذج سريعة
          </div>

          <div
            onClick={() => {
              onNewProject();
              onClose();
            }}
            className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 hover:bg-slate-900 cursor-pointer transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">
                  بدء مشروع فارغ جديد
                </div>
                <div className="text-[10px] text-slate-400">
                  لوحة رسم بيضاء نقية بنسب وأبعاد قياسية
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 rtl:rotate-180" />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 px-5 border-t border-slate-800/80 bg-[#0c0d16] flex items-center justify-end">
          <PanelButton
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
          >
            إغلاق
          </PanelButton>
        </div>
      </div>
    </div>
  );
};
