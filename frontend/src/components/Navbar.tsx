import { PanelButton } from "./PanelButton";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Tooltip } from "./Tooltip";
import { useAuth } from "../lib/authContext";
import {
  Sparkles,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronDown,
  Download,
  Folder,
  Save,
  Keyboard,
  Code2,
  Check,
  Sliders,
  Image as ImageIcon,
  Upload,
  Info,
  Blend,
  PanelLeft,
  PanelRight,
  Columns,
  FilePlus,
  Pencil,
  X,
  LogOut,
  Cloud,
  HardDrive,
  User as UserIcon,
  Database,
  FolderKanban,
  Users,
  Plus,
  BookOpen,
} from "lucide-react";
import { SampleImageMeta, SAMPLE_IMAGES } from "../lib/sampleImages";

// Live thumbnail component that renders a sample image generator into a small canvas preview
const SampleThumbnail: React.FC<{ generator: (w?: number, h?: number) => HTMLCanvasElement }> = React.memo(({ generator }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      const sourceCanvas = generator(120, 120);
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        canvasRef.current.width = 120;
        canvasRef.current.height = 120;
        ctx.drawImage(sourceCanvas, 0, 0, 120, 120);
      }
    } catch {
      // Silently handle any generator errors
    }
  }, [generator]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={120}
      className="w-12 h-12 rounded-lg border border-purple-500/30 shrink-0 shadow-md shadow-purple-900/30 bg-slate-950 object-cover"
    />
  );
});
SampleThumbnail.displayName = "SampleThumbnail";

interface NavbarProps {
  canUndo: boolean;
  canRedo: boolean;
  undoCount?: number;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitZoom: () => void;
  splitView: boolean;
  onToggleSplitView: () => void;
  onLoadSample: (sample: SampleImageMeta) => void;
  onUploadImage: (file: File) => void;
  onExport: (format: "png" | "jpeg" | "webp" | "svg" | "pdf" | "docx", quality?: number) => void;
  isProcessing: boolean;
  onOpenShortcuts?: () => void;
  onOpenPythonCode?: () => void;
  onOpenProjects?: () => void;
  onOpenMetadata?: () => void;
  onOpenBlendModal?: () => void;
  projectName?: string;
  onRenameProject?: (name: string) => void;
  docWidth?: number;
  docHeight?: number;
  onChangeCanvasSize?: (width: number, height: number) => void;
  isLayersOpen?: boolean;
  isPropertiesOpen?: boolean;
  onToggleLayers?: () => void;
  onToggleProperties?: () => void;
  onToggleBothPanels?: () => void;
  onNewProject?: (width?: number, height?: number, background?: "transparent" | "white") => void;
  onOpenAuthModal?: () => void;
  onSaveProject?: () => void;
  isSavingProject?: boolean;
  onOpenHelp?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  canUndo,
  canRedo,
  undoCount = 2,
  onUndo,
  onRedo,
  zoom,
  onZoomChange,
  onFitZoom,
  splitView,
  onToggleSplitView,
  onLoadSample,
  onUploadImage,
  onExport,
  isProcessing,
  onOpenShortcuts,
  onOpenPythonCode,
  onOpenProjects,
  onOpenMetadata,
  onOpenBlendModal,
  projectName = "تصميم إبداعي جديد",
  onRenameProject,
  docWidth = 1000,
  docHeight = 750,
  onChangeCanvasSize,
  isLayersOpen = true,
  isPropertiesOpen = true,
  onToggleLayers,
  onToggleProperties,
  onToggleBothPanels,
  onNewProject,
  onOpenAuthModal,
  onSaveProject,
  isSavingProject = false,
  onOpenHelp,
}) => {
  const { user, savedAccounts, switchAccount, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSampleMenu, setShowSampleMenu] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [savedNotification, setSavedNotification] = useState(false);
  const [exportMenuPos, setExportMenuPos] = useState({ top: 0, left: 0 });
  const [sampleMenuPos, setSampleMenuPos] = useState({ top: 0, right: 0 });
  const [sizeMenuPos, setSizeMenuPos] = useState({ top: 0, right: 0 });

  // Project Name Inline Renaming State
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(projectName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Sync tempName when projectName prop changes
  useEffect(() => {
    setTempName(projectName);
  }, [projectName]);

  // Auto-focus and select text when editing begins
  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [isEditingName]);

  // Listen to F2 / focus-project-name event from anywhere in the application
  useEffect(() => {
    const handleFocusRename = () => {
      setIsEditingName(true);
    };
    window.addEventListener("focus-project-name", handleFocusRename);
    return () => window.removeEventListener("focus-project-name", handleFocusRename);
  }, []);

  const handleCommitName = () => {
    const trimmed = tempName.trim();
    if (trimmed && onRenameProject) {
      onRenameProject(trimmed);
    } else {
      setTempName(projectName);
    }
    setIsEditingName(false);
  };

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportContainerRef = useRef<HTMLDivElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const sampleContainerRef = useRef<HTMLDivElement>(null);
  const sampleButtonRef = useRef<HTMLButtonElement>(null);
  const sizeContainerRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;

      // Export menu: don't close if clicking inside button or its portal
      const isInsideExportBtn = exportContainerRef.current?.contains(target);
      const isInsideExportPortal = document.querySelector('[data-export-portal]')?.contains(target);
      if (!isInsideExportBtn && !isInsideExportPortal) {
        setShowExportMenu(false);
      }

      // Sample menu: don't close if clicking inside button or its portal
      const isInsideSampleBtn = sampleContainerRef.current?.contains(target);
      const isInsideSamplePortal = document.querySelector('[data-sample-portal]')?.contains(target);
      if (!isInsideSampleBtn && !isInsideSamplePortal) {
        setShowSampleMenu(false);
      }

      // Size menu: don't close if clicking inside button or its portal
      const isInsideSizeBtn = sizeContainerRef.current?.contains(target);
      const isInsideSizePortal = document.querySelector('[data-size-portal]')?.contains(target);
      if (!isInsideSizeBtn && !isInsideSizePortal) {
        setShowSizeMenu(false);
      }
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, []);

  const handleSaveClick = () => {
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2000);
  };

  const CANVAS_PRESETS = [
    { label: "1000 × 750", desc: "افتراضي", w: 1000, h: 750, icon: "⬜" },
    { label: "1920 × 1080", desc: "FHD سينمائي", w: 1920, h: 1080, icon: "🎬" },
    { label: "1080 × 1080", desc: "مربع إنستغرام", w: 1080, h: 1080, icon: "📸" },
    { label: "1080 × 1920", desc: "ستوري وريلز", w: 1080, h: 1920, icon: "📱" },
    { label: "1200 × 630", desc: "غلاف ويب", w: 1200, h: 630, icon: "🌐" },
  ];

  return (
    <header
      id="vision-studio-navbar"
      className="h-14 border-b border-purple-500/20 bg-[#0c0d16]/95 backdrop-blur-xl px-3 flex items-center justify-between z-30 select-none text-slate-200 overflow-x-auto custom-scrollbar"
      dir="rtl"
    >
      {/* Hidden File Input for Direct Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/bmp,image/svg+xml,image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            onUploadImage(e.target.files[0]);
            e.target.value = "";
          }
        }}
      />

      {/* ========================================================= */}
      {/* RIGHT SIDE (in RTL): Brand, Title, Dimensions, Auto-save  */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Brand Badge: Ultimate Vision Studio */}
        <div
          id="brand-badge"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/30 border border-purple-400/40 cursor-pointer hover:brightness-110 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-200 animate-pulse" />
          <span className="font-['Cairo',sans-serif] tracking-wide">Ultimate Vision Studio</span>
        </div>

        {/* User Requested: Help Tab: مساعدة (Help) - بجانب اسم الموقع تماماً */}
        <Tooltip
          content="مساعدة ودليل المستخدم (Help & User Manual)"
          description="تنزيل الدليل الإرشادي الكامل والتعرف على كافة أدوات وخوارزميات المحرر"
          position="bottom"
        >
          <button
            type="button"
            id="help-navbar-tab"
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/70 hover:bg-purple-900/90 text-purple-200 hover:text-white border border-purple-500/40 hover:border-purple-400 font-bold text-xs transition-all cursor-pointer shadow-md shadow-purple-950/40 active:scale-95 group"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-200 group-hover:scale-110 transition-transform" />
            <span className="font-['Cairo',sans-serif]">مساعدة (Help)</span>
            <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-md bg-purple-800/70 text-[9px] font-mono text-purple-300 border border-purple-600/40">
              PDF
            </span>
          </button>
        </Tooltip>

        {/* Project Name (Interactive & Editable) & Dimensions */}
        {isEditingName ? (
          <div className="flex items-center gap-1 bg-slate-900/95 border border-purple-400 rounded-xl px-2 py-1 shadow-lg shadow-purple-950/60 transition-all">
            <input
              ref={nameInputRef}
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCommitName();
                if (e.key === "Escape") {
                  setTempName(projectName);
                  setIsEditingName(false);
                }
              }}
              onBlur={handleCommitName}
              className="bg-transparent text-xs font-bold text-white outline-none w-36 sm:w-52 placeholder-slate-500 font-['Cairo',sans-serif]"
              placeholder="اكتب اسم المشروع..."
              maxLength={60}
            />
            <button
              type="button"
              onClick={handleCommitName}
              className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded transition-colors cursor-pointer"
              title="حفظ الاسم الجديد (Enter)"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setTempName(projectName);
                setIsEditingName(false);
              }}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
              title="إلغاء (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5">
            <Tooltip
              content="انقر لتعديل اسم المشروع"
              shortcut="F2"
              description="تغيير اسم العمل الفني وحفظه في المستندات والملفات المصدرة"
              position="bottom"
            >
              <button
                type="button"
                id="btn-edit-project-name"
                onClick={() => setIsEditingName(true)}
                className="flex items-center gap-1.5 text-xs text-slate-200 font-bold px-2.5 py-1.5 rounded-xl hover:bg-purple-950/50 hover:text-purple-200 transition-all border border-purple-500/20 hover:border-purple-500/50 group cursor-pointer max-w-[170px] sm:max-w-[240px] bg-slate-900/40 shadow-sm"
              >
                <span className="truncate">{projectName}</span>
                <Pencil className="w-3 h-3 text-purple-400 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all shrink-0" />
              </button>
            </Tooltip>

            <Tooltip
              content="مواصفات ومعلومات الصورة"
              shortcut="Ctrl+I"
              description="عرض الأبعاد والميغابكسل وخصائص الملف"
              position="bottom"
            >
              <PanelButton
                type="button"
                onClick={onOpenMetadata}
                className="text-[11px] font-mono text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 px-2 py-1 rounded-lg border border-purple-500/25 hover:border-purple-400/50 transition-colors cursor-pointer"
              >
                ({docWidth}x{docHeight}px)
              </PanelButton>
            </Tooltip>
          </div>
        )}

        {/* New Clean Canvas Button */}
        {onNewProject && (
          <Tooltip
            content="لوحة عمل جديدة"
            shortcut="Ctrl+Alt+N"
            description="إنشاء لوحة عمل فارغة ونظيفة بمقاس جديد"
            position="bottom"
          >
            <PanelButton
              type="button"
              onClick={() => onNewProject(1000, 750, "white")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">لوحة جديدة</span>
            </PanelButton>
          </Tooltip>
        )}

        {/* Upload Image Button */}
        <Tooltip
          content="رفع صورة جديدة"
          shortcut="سحب وإفلات"
          description="استيراد صورة من جهازك كلوحة عمل رئيسية"
          position="bottom"
        >
          <PanelButton
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/40 text-purple-200 hover:text-white transition-all shadow-sm active:scale-95"
          >
            <Upload className="w-3.5 h-3.5 text-purple-400" />
            <span>رفع صورة</span>
          </PanelButton>
        </Tooltip>

        {/* Quick Save Project Button */}
        {onSaveProject && (
          <Tooltip
            content="حفظ المشروع"
            shortcut="Ctrl+S"
            description={user ? "حفظ المشروع في حسابك السحابي مع كامل الطبقات" : "حفظ المشروع محلياً في متصفحك"}
            position="bottom"
          >
            <PanelButton
              type="button"
              disabled={isSavingProject}
              onClick={onSaveProject}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-200 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSavingProject ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>حفظ</span>
            </PanelButton>
          </Tooltip>
        )}

        {/* My Projects & Storage Vault Button */}
        {onOpenProjects && (
          <Tooltip
            content="مشاريعي والمساحة السحابية"
            description="عرض وتصفح المشاريع المحفوظة واستعراض خزنة الوسائط الخاصة"
            position="bottom"
          >
            <PanelButton
              type="button"
              onClick={onOpenProjects}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/40 text-indigo-200 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <FolderKanban className="w-3.5 h-3.5 text-indigo-400" />
              <span>مشاريعي</span>
            </PanelButton>
          </Tooltip>
        )}

        {/* Smart Image Blend Button */}
        {onOpenBlendModal && (
          <Tooltip
            content="دمج صورتين ذكياً"
            description="رفع صورتين ومزجهما معاً بسلاسة بأنماط مزج وانتقال ناعم"
            position="bottom"
          >
            <PanelButton
              type="button"
              onClick={onOpenBlendModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-700/80 to-indigo-700/80 hover:from-purple-600 hover:to-indigo-600 border border-purple-400/50 text-white transition-all shadow-sm active:scale-95 cursor-pointer ring-1 ring-purple-400/30"
            >
              <Blend className="w-3.5 h-3.5 text-purple-200" />
              <span>دمج صورتين</span>
              <span className="text-[9px] px-1 py-0.2 rounded-full bg-purple-400 text-purple-950 font-extrabold mr-0.5">
                جديد
              </span>
            </PanelButton>
          </Tooltip>
        )}

        {/* Dimensions Dropdown ("المقاس ▾") — Portal-based */}
        <div className="relative" ref={sizeContainerRef}>
          <PanelButton
            type="button"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setSizeMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
              setShowSizeMenu(!showSizeMenu);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
          >
            <Maximize2 className="w-3 h-3 text-indigo-400" />
            <span>المقاس</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showSizeMenu ? "rotate-180" : ""}`} />
          </PanelButton>

          {showSizeMenu &&
            createPortal(
              <div
                data-size-portal
                className="fixed w-64 rounded-xl bg-[#121320]/95 border border-purple-500/30 shadow-2xl p-2 z-[99999] text-xs backdrop-blur-2xl"
                style={{
                  top: `${sizeMenuPos.top}px`,
                  right: `${sizeMenuPos.right}px`,
                  animation: "sizeDropdownIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                dir="rtl"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <style>{`
                  @keyframes sizeDropdownIn {
                    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                  }
                `}</style>
                <div className="px-2 py-1 text-[10px] font-bold text-purple-400 flex items-center gap-1.5">
                  <Maximize2 className="w-3 h-3" />
                  أبعاد لوحة التصميم
                </div>
                <div className="space-y-1 mt-1.5">
                  {CANVAS_PRESETS.map((p) => {
                    const isActive = docWidth === p.w && docHeight === p.h;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          onChangeCanvasSize?.(p.w, p.h);
                          setShowSizeMenu(false);
                        }}
                        className={`w-full text-right px-2.5 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-2.5 group border ${
                          isActive
                            ? "bg-purple-950/60 border-purple-500/40 text-purple-200"
                            : "bg-slate-900/30 border-transparent hover:bg-purple-950/40 hover:border-purple-500/30 text-slate-300 hover:text-purple-200"
                        }`}
                      >
                        {/* Aspect ratio mini preview */}
                        <div className="w-8 h-8 rounded border border-purple-500/30 bg-slate-950/80 flex items-center justify-center shrink-0 overflow-hidden">
                          <div
                            className={`rounded-sm ${
                              isActive ? "bg-purple-500" : "bg-slate-600 group-hover:bg-purple-400"
                            } transition-colors`}
                            style={{
                              width: `${Math.round((p.w / Math.max(p.w, p.h)) * 22)}px`,
                              height: `${Math.round((p.h / Math.max(p.w, p.h)) * 22)}px`,
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono font-semibold text-[11px]">{p.label}</span>
                            {isActive && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                          </div>
                          <div className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors">
                            <span>{p.icon} {p.desc}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>,
              document.body
            )}
        </div>

        {/* Auto-Save Toggle matching screenshot: "حفظ تلقائي: متوقف" */}
        <div className="hidden xl:flex items-center gap-2 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-800/80 text-xs">
          <span className="text-slate-400 text-[11px]">
            حفظ تلقائي: {autoSaveEnabled ? "مفعّل" : "متوقف"}
          </span>
          <PanelButton
            type="button"
            role="switch"
            aria-checked={autoSaveEnabled}
            onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
            className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 border flex items-center cursor-pointer ${
              autoSaveEnabled
                ? "bg-purple-600 border-purple-400 justify-start"
                : "bg-slate-800 border-slate-700 justify-end"
            }`}
          >
            <span className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
          </PanelButton>
        </div>

        {/* Python Code Editor Toggle */}
        <div className="hidden md:block">
          <Tooltip
            content="توليد كود OpenCV بايثون"
            description="معاينة ونسخ كود معالجة الصور المقابل لعملياتك الحالية"
            position="bottom"
          >
            <PanelButton
              type="button"
              id="python-code-btn"
              onClick={onOpenPythonCode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 transition-colors cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>كود بايثون</span>
            </PanelButton>
          </Tooltip>
        </div>

        {/* Sample Images Dropdown: "صور للتجربة ▾" — Portal-based with live thumbnails */}
        <div className="relative" ref={sampleContainerRef}>
          <PanelButton
            type="button"
            ref={sampleButtonRef}
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setSampleMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
              setShowSampleMenu(!showSampleMenu);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 text-slate-300 transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">صور للتجربة</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showSampleMenu ? "rotate-180" : ""}`} />
          </PanelButton>

          {showSampleMenu &&
            createPortal(
              <div
                data-sample-portal
                className="fixed w-80 rounded-xl bg-[#121320]/95 border border-purple-500/30 shadow-2xl p-2.5 z-[99999] text-xs backdrop-blur-2xl"
                style={{
                  top: `${sampleMenuPos.top}px`,
                  right: `${sampleMenuPos.right}px`,
                  animation: "sampleDropdownIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                dir="rtl"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <style>{`
                  @keyframes sampleDropdownIn {
                    from { opacity: 0; transform: translateY(-8px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                  }
                `}</style>
                <div className="px-2 py-1 text-[10px] font-bold text-purple-400 flex items-center gap-1.5">
                  <ImageIcon className="w-3 h-3" />
                  نماذج صور قياسية عالية الجودة
                </div>
                <div className="space-y-1.5 mt-1.5">
                  {SAMPLE_IMAGES.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => {
                        onLoadSample(sample);
                        setShowSampleMenu(false);
                      }}
                      className="w-full text-right px-2 py-2 rounded-lg hover:bg-purple-950/50 bg-slate-900/30 transition-all cursor-pointer border border-transparent hover:border-purple-500/30 flex items-center gap-2.5 group"
                    >
                      {/* Live Canvas Thumbnail */}
                      <SampleThumbnail generator={sample.generator} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-200 flex items-center justify-between gap-1">
                          <span className="truncate">{sample.title}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-950/80 text-purple-400 border border-purple-500/30 shrink-0">
                            {sample.category}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 leading-snug mt-0.5 line-clamp-2 group-hover:text-slate-400 transition-colors">
                          {sample.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>,
              document.body
            )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MIDDLE: Undo / Redo with step counter badge & Zoom        */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Undo / Redo matching screenshot: "تراجع 2" and "إعادة" */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
          <Tooltip
            content="تراجع"
            shortcut="Ctrl+Z"
            description="التراجع عن آخر عملية تم تنفيذها"
            position="bottom"
          >
            <PanelButton
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-purple-950/40 disabled:opacity-30 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تراجع</span>
              {undoCount > 0 && (
                <span className="text-[10px] font-mono font-bold px-1 rounded-full bg-purple-900/80 text-purple-300 border border-purple-600/40">
                  {undoCount}
                </span>
              )}
            </PanelButton>
          </Tooltip>

          <Tooltip
            content="إعادة"
            shortcut="Ctrl+Y"
            description="إعادة تنفيذ العملية التي تم التراجع عنها"
            position="bottom"
          >
            <PanelButton
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-purple-950/40 disabled:opacity-30 transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>إعادة</span>
            </PanelButton>
          </Tooltip>
        </div>

        {/* Compare matching screenshot: "قبل / بعد" */}
        <Tooltip
          content="مقارنة الصورة الأصلية"
          shortcut="\"
          description="معاينة فورية وسريعة للصورة قبل التعديلات"
          position="bottom"
        >
          <PanelButton
            type="button"
            onClick={onToggleSplitView}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              splitView
                ? "bg-purple-600/30 text-purple-200 border-purple-500 shadow-sm shadow-purple-500/30"
                : "bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700"
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">قبل / بعد</span>
          </PanelButton>
        </Tooltip>

        {/* Zoom Controls matching screenshot: 1:1, Zoom In, Zoom Level %, Zoom Out */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-300">
          <Tooltip
            content="ملاءمة الشاشة"
            shortcut="Ctrl+0"
            description="إعادة تعيين مستوى التكبير إلى 100%"
            position="bottom"
          >
            <PanelButton
              type="button"
              onClick={onFitZoom}
              className="px-1.5 py-0.5 rounded hover:text-cyan-300 transition-colors text-[11px]"
            >
              1:1
            </PanelButton>
          </Tooltip>
          <Tooltip
            content="تصغير مساحة العمل"
            shortcut="-"
            description="الابتعاد عن تفاصيل اللوحة"
            position="bottom"
          >
            <PanelButton
              type="button"
              onClick={() => onZoomChange(Math.max(0.2, zoom - 0.1))}
              className="p-1 hover:text-purple-300 transition-colors"
            >
              <ZoomOut className="w-3 h-3" />
            </PanelButton>
          </Tooltip>
          <span className="min-w-[36px] text-center font-semibold text-purple-200">
            {Math.round(zoom * 100)}%
          </span>
          <Tooltip
            content="تكبير مساحة العمل"
            shortcut="+"
            description="الاقتراب من تفاصيل اللوحة"
            position="bottom"
          >
            <PanelButton
              type="button"
              onClick={() => onZoomChange(Math.min(4.0, zoom + 0.1))}
              className="p-1 hover:text-purple-300 transition-colors"
            >
              <ZoomIn className="w-3 h-3" />
            </PanelButton>
          </Tooltip>
        </div>

        {/* Workspace Panels & Layout Toggle Controls */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
          {/* Toggle Left/Properties Panel */}
          {onToggleProperties && (
            <Tooltip
              content={isPropertiesOpen ? "طي لوحة الخصائص" : "إظهار لوحة الخصائص"}
              shortcut="F8"
              description="التحكم في ظهور لوحة الأدوات وتعديل الخصائص"
              position="bottom"
            >
              <PanelButton
                type="button"
                onClick={onToggleProperties}
                className={`p-1.5 rounded text-xs transition-all ${
                  isPropertiesOpen
                    ? "bg-purple-950/80 text-purple-300 border border-purple-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <PanelLeft className="w-3.5 h-3.5" />
              </PanelButton>
            </Tooltip>
          )}

          {/* Toggle Right/Layers Panel */}
          {onToggleLayers && (
            <Tooltip
              content={isLayersOpen ? "طي لوحة الطبقات" : "إظهار لوحة الطبقات"}
              shortcut="F7"
              description="التحكم في ظهور لوحة الطبقات وقائمة العناصر"
              position="bottom"
            >
              <PanelButton
                type="button"
                onClick={onToggleLayers}
                className={`p-1.5 rounded text-xs transition-all ${
                  isLayersOpen
                    ? "bg-purple-950/80 text-purple-300 border border-purple-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <PanelRight className="w-3.5 h-3.5" />
              </PanelButton>
            </Tooltip>
          )}

          {/* Zen Mode / Toggle Both Panels */}
          {onToggleBothPanels && (
            <Tooltip
              content="ملء مساحة العمل (إخفاء/إظهار اللوحات)"
              shortcut="Tab"
              description="توسيع مساحة الرسم بالكامل بدون لوحات جانبية"
              position="bottom"
            >
              <PanelButton
                type="button"
                onClick={onToggleBothPanels}
                className={`p-1.5 rounded text-xs transition-all ${
                  !isLayersOpen && !isPropertiesOpen
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/40"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
              </PanelButton>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* LEFT SIDE (in RTL): Projects, Save, Shortcuts, Python, Export */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Projects matching screenshot: "مشاريعي" */}
        <Tooltip
          content="مشاريعي المحفوظة"
          description="استعراض وإدارة تصاميمك وأعمالك المحفوظة"
          position="bottom"
        >
          <PanelButton
            type="button"
            onClick={onOpenProjects}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <Folder className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">مشاريعي</span>
          </PanelButton>
        </Tooltip>

        {/* Save matching screenshot: "حفظ" */}
        <Tooltip
          content="حفظ المشروع"
          shortcut="Ctrl+S"
          description="حفظ التعديلات والتصاميم الحالية في المتصفح"
          position="bottom"
        >
          <PanelButton
            type="button"
            onClick={handleSaveClick}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors relative"
          >
            {savedNotification ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Save className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="hidden md:inline">
              {savedNotification ? "تم الحفظ!" : "حفظ"}
            </span>
          </PanelButton>
        </Tooltip>

        {/* Image Metadata Info matching request */}
        <Tooltip
          content="معلومات ومواصفات الصورة"
          shortcut="Ctrl+I"
          description="أبعاد الصورة، حجم البكسل، وقيم الألوان"
          position="bottom"
        >
          <PanelButton
            type="button"
            onClick={onOpenMetadata}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-purple-300 transition-colors"
          >
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">معلومات الصورة</span>
          </PanelButton>
        </Tooltip>

        {/* Shortcuts matching screenshot: "الاختصارات" */}
        <Tooltip
          content="دليل مفاتيح الاختصار"
          shortcut="F1"
          description="عرض جميع اختصارات لوحة المفاتيح المتاحة"
          position="bottom"
        >
          <PanelButton
            type="button"
            onClick={onOpenShortcuts}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-purple-300 transition-colors"
          >
            <Keyboard className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden xl:inline">الاختصارات</span>
          </PanelButton>
        </Tooltip>



        {/* Export Button matching screenshot: "تصدير" with purple gradient fill */}
        <div ref={exportContainerRef} className="relative">
          <Tooltip
            content="تصدير وحفظ الصورة"
            description="تنزيل العمل الفني بصيغ PNG أو JPG أو WebP أو SVG"
            position="bottom"
            disabled={showExportMenu}
          >
            <button
              type="button"
              id="btn-export-dropdown"
              ref={exportButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                // Calculate position from button for portal placement
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setExportMenuPos({ top: rect.bottom + 6, left: rect.left });
                setShowExportMenu((prev) => !prev);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-600/30 transition-all active:scale-95 border border-purple-400/30 cursor-pointer select-none"
            >
              <Download className="w-3.5 h-3.5 pointer-events-none" />
              <span className="pointer-events-none">تصدير</span>
              <ChevronDown className={`w-3 h-3 opacity-80 pointer-events-none transition-transform duration-200 ${showExportMenu ? "rotate-180" : ""}`} />
            </button>
          </Tooltip>

          {showExportMenu &&
            createPortal(
              <div
                data-export-portal
                className="fixed w-64 rounded-xl bg-[#121320]/95 border border-purple-500/30 shadow-2xl p-2.5 z-[99999] text-xs backdrop-blur-2xl"
                style={{
                  top: `${exportMenuPos.top}px`,
                  left: `${exportMenuPos.left}px`,
                  animation: "exportDropdownIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                dir="rtl"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <style>{`
                  @keyframes exportDropdownIn {
                    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                  }
                `}</style>
                <div className="px-2 py-1 text-[10px] font-bold text-purple-400">
                  تصدير العمل الفني
                </div>
                <div className="space-y-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onExport("png");
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-purple-950/60 bg-slate-900/40 text-slate-200 transition-colors cursor-pointer border border-transparent hover:border-purple-500/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-purple-300">PNG</span>
                      <span className="text-[11px] text-slate-400">دقة فائقة وشفاف</span>
                    </div>
                    <span className="text-[10px] font-mono text-purple-400 bg-purple-950/70 px-1.5 py-0.5 rounded border border-purple-500/30">الأفضل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onExport("jpeg", 0.92);
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-purple-950/60 bg-slate-900/40 text-slate-200 transition-colors cursor-pointer border border-transparent hover:border-indigo-500/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-300">JPG</span>
                      <span className="text-[11px] text-slate-400">مضغوط للويب</span>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/70 px-1.5 py-0.5 rounded border border-indigo-500/30">92%</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onExport("webp", 0.9);
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-purple-950/60 bg-slate-900/40 text-slate-200 transition-colors cursor-pointer border border-transparent hover:border-cyan-500/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-cyan-300">WEBP</span>
                      <span className="text-[11px] text-slate-400">عصري فائق السرعة</span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-500/30">حديث</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onExport("svg");
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-purple-950/60 bg-slate-900/40 text-slate-200 transition-colors cursor-pointer border border-transparent hover:border-emerald-500/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-300">SVG</span>
                      <span className="text-[11px] text-slate-400">فيكتور ومسارات</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-500/30">متجه</span>
                  </button>

                  {/* Office & Documents Divider */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="text-[10px] font-bold text-slate-400 px-1 pb-1 flex items-center justify-between">
                      <span>مستندات وملفات مكتبية:</span>
                      <span className="text-[9px] text-purple-400 font-normal">طباعة وتحرير</span>
                    </div>

                    {/* PDF Export */}
                    <button
                      type="button"
                      id="btn-export-pdf"
                      onClick={() => {
                        onExport("pdf");
                        setShowExportMenu(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-rose-950/50 bg-slate-900/50 text-slate-200 transition-all cursor-pointer border border-slate-800/80 hover:border-rose-500/40 group mb-1.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-300 font-bold font-mono text-xs flex items-center justify-center border border-rose-500/30 group-hover:bg-rose-600 group-hover:text-white transition-all shadow-sm">
                          PDF
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-rose-200 text-xs">مستند PDF</div>
                          <div className="text-[10px] text-slate-400">ملف عالي الدقة جاهز للطباعة</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-500/40">
                        طباعة
                      </span>
                    </button>

                    {/* Word (DOCX) Export */}
                    <button
                      type="button"
                      id="btn-export-word"
                      onClick={() => {
                        onExport("docx");
                        setShowExportMenu(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-blue-950/50 bg-slate-900/50 text-slate-200 transition-all cursor-pointer border border-slate-800/80 hover:border-blue-500/40 group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 font-bold font-mono text-xs flex items-center justify-center border border-blue-500/30 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                          DOC
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-blue-200 text-xs">مستند وورد (Word)</div>
                          <div className="text-[10px] text-slate-400">ملف .docx منسق وقابل للتعديل</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-500/40">
                        DOCX
                      </span>
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
        </div>

        {/* User Profile / Auth Section */}
        {user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-full p-0.5 border border-purple-400/40 cursor-pointer hover:scale-105 transition-transform flex items-center justify-center overflow-hidden shadow-md shadow-purple-900/30"
              style={{ background: user.avatarColor || "linear-gradient(to top right, #9333ea, #4f46e5)" }}
              title={`الحساب: ${user.username}`}
            >
              <div className="w-full h-full rounded-full bg-[#0c0d16] flex items-center justify-center font-bold text-[11px] text-white">
                {user.username.substring(0, 2).toUpperCase()}
              </div>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div
                dir="rtl"
                className="absolute left-0 top-10 w-72 rounded-2xl bg-[#0f111f]/95 border border-purple-500/30 shadow-2xl p-3 z-[99999] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 font-['Cairo',sans-serif]"
              >
                {/* Active User info */}
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-sm border border-white/20"
                    style={{ backgroundColor: user.avatarColor || "#a855f7" }}
                  >
                    {user.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="overflow-hidden min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white truncate">{user.username}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                        نشط
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
                  </div>
                </div>

                {/* Storage Quick Stats */}
                <div className="py-2.5 border-b border-slate-800/80">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>المساحة السحابية الخاصة:</span>
                    <span className="font-mono text-purple-300 font-bold">
                      {Math.round(user.storageUsedBytes / (1024 * 1024))}MB / {Math.round(user.storageQuotaBytes / (1024 * 1024))}MB
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round((user.storageUsedBytes / user.storageQuotaBytes) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Multi-Account Switching Section */}
                {savedAccounts.length > 1 && (
                  <div className="py-2.5 border-b border-slate-800/80">
                    <div className="text-[10px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                      <Users className="w-3 h-3 text-purple-400" />
                      <span>تبديل الحساب:</span>
                    </div>
                    <div className="space-y-1">
                      {savedAccounts
                        .filter((acc) => acc.user.id !== user.id)
                        .map((acc) => (
                          <button
                            key={acc.user.id}
                            type="button"
                            onClick={() => {
                              setShowUserMenu(false);
                              switchAccount(acc.user.id);
                            }}
                            className="w-full flex items-center justify-between p-1.5 rounded-xl hover:bg-purple-950/40 bg-slate-900/40 text-slate-200 transition-all cursor-pointer border border-transparent hover:border-purple-500/30"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                style={{ backgroundColor: acc.user.avatarColor || "#6366f1" }}
                              >
                                {acc.user.username.substring(0, 2).toUpperCase()}
                              </div>
                              <span className="text-xs truncate font-medium">{acc.user.username}</span>
                            </div>
                            <span className="text-[10px] text-purple-400 font-semibold px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/30">
                              تبديل
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Menu items */}
                <div className="pt-2 space-y-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenProjects?.();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl font-semibold text-slate-200 hover:text-white hover:bg-purple-950/60 transition-colors cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5 text-purple-400" />
                    <span>خزنة ومشاريع السحابة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenAuthModal?.();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl font-semibold text-slate-200 hover:text-white hover:bg-purple-950/60 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                    <span>إضافة حساب آخر</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      logout(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl font-semibold text-rose-400 hover:text-rose-200 hover:bg-rose-950/50 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>تسجيل الخروج من الحساب الحالي</span>
                  </button>

                  {savedAccounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        logout(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] text-rose-500/80 hover:text-rose-300 hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <span>الخروج من جميع الحسابات ({savedAccounts.length})</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <PanelButton
            type="button"
            onClick={onOpenAuthModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:brightness-110 text-white text-xs font-bold shadow-md shadow-purple-900/40 cursor-pointer transition-all border border-purple-400/40 shrink-0"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">تسجيل الدخول / حساب جديد</span>
            <span className="sm:hidden">دخول</span>
          </PanelButton>
        )}
      </div>
    </header>
  );
};
