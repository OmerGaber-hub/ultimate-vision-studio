import { PanelButton } from "./PanelButton";
import React, { useState, useEffect } from "react";
import {
  Keyboard,
  X,
  Search,
  SlidersHorizontal,
  Activity,
  BrainCircuit,
  Scissors,
  Brush,
  Type,
  Sparkles,
  FileCode,
  MousePointer,
  Crop,
  Eye,
  RotateCcw,
  RotateCw,
  Copy,
  Trash2,
  ZoomIn,
  Move,
  Shapes,
  Pencil,
} from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: "tools" | "canvas" | "edit" | "system";
  icon?: React.ElementType;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts: ShortcutItem[] = [
    // Tools
    {
      keys: ["V"],
      description: "أداة التحديد والتحريك في مساحة العمل",
      category: "tools",
      icon: MousePointer,
    },
    {
      keys: ["C"],
      description: "أداة القص التفاعلي وتأطير المشهد (Crop & Frame)",
      category: "tools",
      icon: Crop,
    },
    {
      keys: ["T"],
      description: "أداة التحويل والتدوير الحر للطبقات (Free Transform)",
      category: "tools",
      icon: Move,
    },
    {
      keys: ["P"],
      description: "معالجة النقط، تصحيح الألوان، وتحليل الهيستوغرام",
      category: "tools",
      icon: SlidersHorizontal,
    },
    {
      keys: ["F"],
      description: "المرشحات المكانية، كشف الحواف (Sobel/Canny)، ونواة الالتفاف",
      category: "tools",
      icon: Activity,
    },
    {
      keys: ["A"],
      description: "محرك الرؤية الحاسوبية، استخراج النصوص (OCR)، وتحديد الكائنات",
      category: "tools",
      icon: BrainCircuit,
    },
    {
      keys: ["B"],
      description: "إزالة الخلفية التلقائية بالذكاء الاصطناعي والعصا السحرية",
      category: "tools",
      icon: Scissors,
    },
    {
      keys: ["D"],
      description: "فرشاة الرسم الحر والتوهج النيوني",
      category: "tools",
      icon: Brush,
    },
    {
      keys: ["X"],
      description: "إدراج طبقة نص قابلة للتحرير بالخطوط العربية",
      category: "tools",
      icon: Type,
    },
    {
      keys: ["S"],
      description: "استوديو خلفيات ومنصات المنتجات الذكية",
      category: "tools",
      icon: Sparkles,
    },
    {
      keys: ["U"],
      description: "أداة الأشكال الهندسية المتجهة (مستطيل، دائرة، نجمة، سهم، مضلع)",
      category: "tools",
      icon: Shapes,
    },
    {
      keys: ["E"],
      description: "تتبع المسارات وتصدير الفكتور المتجهي SVG",
      category: "tools",
      icon: FileCode,
    },

    // Canvas & View
    {
      keys: ["\\"],
      description: "تبديل فوري للمقارنة بين الصورة الأصلية والمعدلة الحالية",
      category: "canvas",
      icon: Eye,
    },
    {
      keys: ["Alt", "C"],
      description: "اختصار بديل للمقارنة الفورية مع الأصل",
      category: "canvas",
      icon: Eye,
    },
    {
      keys: ["Space", "سحب بالماوس"],
      description: "تحريك وتمرير مساحة العمل بحرية (Pan)",
      category: "canvas",
      icon: Move,
    },
    {
      keys: ["Ctrl", "عجلة الفأرة"],
      description: "تكبير وتصغير سلس حول موضع المؤشر",
      category: "canvas",
      icon: ZoomIn,
    },
    {
      keys: ["+", "-"],
      description: "تكبير أو تصغير العرض بنسبة ثابتة",
      category: "canvas",
      icon: ZoomIn,
    },
    {
      keys: ["Ctrl", "0"],
      description: "ملاءمة عرض العمل مع حجم الشاشة الحالي (Fit to Screen)",
      category: "canvas",
    },
    {
      keys: ["Tab"],
      description: "ملء مساحة العمل بالكامل (إخفاء / إظهار كافة اللوحات الجانبية)",
      category: "canvas",
    },
    {
      keys: ["F7"],
      description: "تبديل ظهور / طي لوحة الطبقات الجانبية",
      category: "canvas",
    },
    {
      keys: ["F8"],
      description: "تبديل ظهور / طي لوحة الخصائص والأدوات الجانبية",
      category: "canvas",
    },

    // Editing & Layers
    {
      keys: ["Ctrl", "Alt", "N"],
      description: "إنشاء لوحة عمل فارغة جديدة (مشروع جديد)",
      category: "edit",
    },
    {
      keys: ["Ctrl", "Z"],
      description: "تراجع عن آخر عملية أو تعديل (Undo)",
      category: "edit",
      icon: RotateCcw,
    },
    {
      keys: ["Ctrl", "Y"],
      description: "إعادة تنفيذ العملية المتراجع عنها (Redo)",
      category: "edit",
      icon: RotateCw,
    },
    {
      keys: ["Ctrl", "Shift", "Z"],
      description: "إعادة تنفيذ بديلة متوافقة مع أنظمة ماك وبرامج أدوبي",
      category: "edit",
      icon: RotateCw,
    },
    {
      keys: ["Ctrl", "D"],
      description: "إلغاء التحديد الشامل لكافة الطبقات والنصوص والمناطق (Deselect All)",
      category: "edit",
      icon: X,
    },
    {
      keys: ["Ctrl", "J"],
      description: "تكرار الطبقة النشطة المحددة (Duplicate Layer)",
      category: "edit",
      icon: Copy,
    },
    {
      keys: ["Enter"],
      description: "تأكيد وتطبيق القص على مساحة العمل أو الطبقة الحالية",
      category: "edit",
      icon: Crop,
    },
    {
      keys: ["Esc"],
      description: "إلغاء التحديد والخروج من الأوضاع التفاعلية إلى أداة التحديد الافتراضية",
      category: "edit",
      icon: X,
    },
    {
      keys: ["Delete"],
      description: "حذف الطبقة المحددة الحالية",
      category: "edit",
      icon: Trash2,
    },

    // System & Navigation
    {
      keys: ["Ctrl", "I"],
      description: "فتح نافذة تفاصيل ومعلومات الصورة (Metadata)",
      category: "system",
      icon: Keyboard,
    },
    {
      keys: ["F1"],
      description: "فتح / إغلاق دليل اختصارات لوحة المفاتيح هذا",
      category: "system",
      icon: Keyboard,
    },
    {
      keys: ["F2"],
      description: "تسمية وإعادة تسمية المشروع مباشرة (تعديل اسم التصميم)",
      category: "system",
      icon: Pencil,
    },
    {
      keys: ["Esc"],
      description: "إغلاق النوافذ المنبثقة وإلغاء أي وضع تحديد نشط",
      category: "system",
      icon: X,
    },
  ];

  const categories = [
    { id: "all", label: "جميع الاختصارات" },
    { id: "tools", label: "أدوات شريط الأدوات" },
    { id: "canvas", label: "العرض ومساحة العمل" },
    { id: "edit", label: "التحرير والطبقات" },
    { id: "system", label: "النظام والعامة" },
  ];

  const filteredShortcuts = shortcuts.filter((s) => {
    const matchesCategory =
      activeCategory === "all" || s.category === activeCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.keys.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div
      id="shortcuts-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="shortcuts-modal-content"
        className="w-full max-w-2xl bg-[#0e101c] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-purple-500/20 bg-[#131525] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-inner">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  اختصارات لوحة المفاتيح
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-500/20 border border-purple-500/40 text-purple-300">
                  مفتاح F1
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تنقل وأنجز مهام معالجة الصور والتصميم بسرعة فائقة
              </p>
            </div>
          </div>

          <PanelButton
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors border border-transparent hover:border-slate-700"
          >
            <X className="w-5 h-5" />
          </PanelButton>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-slate-800 bg-[#0c0d16] flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن اختصار أو وظيفة معينة..."
              className="w-full pr-9 pl-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-xs text-slate-200 placeholder-slate-500 outline-none transition-all"
            />
            {searchQuery && (
              <PanelButton
                onClick={() => setSearchQuery("")}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                مسح
              </PanelButton>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
            {categories.map((c) => (
              <PanelButton
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === c.id
                    ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                    : "bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800"
                }`}
              >
                {c.label}
              </PanelButton>
            ))}
          </div>
        </div>

        {/* Shortcuts List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {filteredShortcuts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <p className="text-sm font-medium">لم يتم العثور على اختصارات مطابقة</p>
              <p className="text-xs text-slate-500">جرب البحث بكلمات أخرى أو اختر فئة مختلفة</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredShortcuts.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-purple-500/40 hover:bg-slate-900/90 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {Icon ? (
                        <div className="w-7 h-7 rounded-lg bg-slate-800/70 border border-slate-700/60 flex items-center justify-center text-purple-400 shrink-0 group-hover:text-purple-300">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-slate-800/40 flex items-center justify-center text-slate-400 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        </div>
                      )}
                      <span className="text-xs text-slate-200 group-hover:text-white leading-tight">
                        {item.description}
                      </span>
                    </div>

                    {/* Key combo badge */}
                    <div className="flex items-center gap-1 shrink-0 dir-ltr">
                      {item.keys.map((k, kIdx) => (
                        <React.Fragment key={kIdx}>
                          {kIdx > 0 && (
                            <span className="text-slate-500 text-[10px] font-bold">
                              +
                            </span>
                          )}
                          <kbd className="px-2 py-1 min-w-[24px] text-center text-[11px] font-mono font-bold text-slate-200 bg-slate-800 border border-slate-700/80 rounded-md shadow-sm shadow-black/40 group-hover:border-purple-500/50 group-hover:text-purple-200 transition-colors">
                            {k}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 px-5 border-t border-slate-800/80 bg-[#0c0d16] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>تلميح: اضغط مفتاح</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px] border border-slate-700">
              Esc
            </kbd>
            <span>أو</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px] border border-slate-700">
              F1
            </kbd>
            <span>للإغلاق في أي وقت</span>
          </div>

          <PanelButton
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-md shadow-purple-600/30 transition-all active:scale-95"
          >
            فهمت
          </PanelButton>
        </div>
      </div>
    </div>
  );
};
