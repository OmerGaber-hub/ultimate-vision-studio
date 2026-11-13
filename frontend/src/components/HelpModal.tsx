import React, { useEffect, useState } from "react";
import {
  X,
  BookOpen,
  Download,
  ExternalLink,
  Sparkles,
  FileText,
  CheckCircle2,
  Layers,
  Wand2,
  Cpu,
  Keyboard,
  ShieldCheck,
  Search,
  ArrowRight,
  Palette,
  Eye,
  FolderKanban,
  Sliders,
  Scissors
} from "lucide-react";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenShortcuts?: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  onOpenShortcuts,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "contents" | "tips">("overview");
  const [searchQuery, setSearchQuery] = useState("");

  // Close modal on Escape
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

  const manualFileName = "Ultimate_Vision_Studio_User_Manual.pdf";
  const manualDownloadUrl = `/Ultimate_Vision_Studio_User_Manual.pdf`;
  const manualApiDownloadUrl = `/api/manual/download`;

  const handleDownload = () => {
    setDownloading(true);
    // Create temporary link element to trigger browser download
    const link = document.createElement("a");
    link.href = manualDownloadUrl;
    link.download = manualFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(false), 1500);
  };

  const manualChapters = [
    {
      id: "ch1",
      num: "01",
      title: "نظرة عامة وهندسة الواجهة الرئيسية",
      desc: "شرح الشريط العلوي، مساحة اللوحة التفاعلية، شريط الحالة، وأشرطة التحكم السريعة.",
      icon: Eye,
      tag: "الأساسيات",
    },
    {
      id: "ch2",
      num: "02",
      title: "شريط الأدوات الـ 18 (Full Toolbar Reference)",
      desc: "توثيق شامل لكل أداة: التحديد والتحريك (V)، اللاسو الذكي (L)، القص (C)، التدوير (R)، الفرشاة (B)، والترميم (I).",
      icon: Scissors,
      tag: "أدوات التحرير",
    },
    {
      id: "ch3",
      num: "03",
      title: "استوديو الذكاء الاصطناعي وإزالة الخلفية الفائقة",
      desc: "خوارزمية U2-Net، العصا السحرية، الكروما الخضراء مع Despill، وتنعيم الحواف واستخراج الطبقات.",
      icon: Wand2,
      tag: "ذكاء اصطناعي",
    },
    {
      id: "ch4",
      num: "04",
      title: "استوديو التجزئة والقص الذكي (Segmentation Studio)",
      desc: "خوارزميات K-Means، حوض الترسيب Watershed، تقطيع المقدمة Foreground Cut، والعتبة التكيفية Otsu.",
      icon: Cpu,
      tag: "الرؤية الحاسوبية",
    },
    {
      id: "ch5",
      num: "05",
      title: "معالجة الصور الرقمية المتقدمة (DIP)",
      desc: "الفلاتر المكانية (Laplacian, Sobel, Gaussian)، ضبط النغمات، المنحنيات، والعمليات المورفولوجية.",
      icon: Sliders,
      tag: "معالجة رقمية",
    },
    {
      id: "ch6",
      num: "06",
      title: "إدارة الطبقات وأنماط المزج والتدرجات",
      desc: "شرح 9 أنماط مزج احترافية (Multiply, Screen, Overlay..)، طبقات التدرج اللوني، والأشكال الهندسية.",
      icon: Layers,
      tag: "الطبقات",
    },
    {
      id: "ch7",
      num: "07",
      title: "خزنة المشاريع السحابية وإدارة الوسائط",
      desc: "الحفظ السحابي التلقائي، سعة التخزين 150 ميجابايت، استيراد وسائط سريعة وإعادة الفتح.",
      icon: FolderKanban,
      tag: "المشاريع والسحابة",
    },
    {
      id: "ch8",
      num: "08",
      title: "جدول الاختصارات الشامل واستكشاف الأخطاء",
      desc: "قاموس لكافة اختصارات لوحة المفاتيح لتسريع الإنتاجية، ودليل حل المشاكل وحالات الاستخدام.",
      icon: Keyboard,
      tag: "الإنتاجية",
    },
  ];

  const filteredChapters = manualChapters.filter(
    (c) =>
      c.title.includes(searchQuery) ||
      c.desc.includes(searchQuery) ||
      c.tag.includes(searchQuery)
  );

  return (
    <div
      id="help-user-manual-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="help-user-manual-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0c0d16] border border-purple-500/30 shadow-2xl shadow-purple-950/80 overflow-hidden font-['Cairo',sans-serif] text-slate-100 relative"
      >
        {/* Glow ambient effects */}
        <div className="absolute top-0 right-1/4 w-96 h-36 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-10 w-80 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* 1. Header */}
        <div className="p-4 sm:p-6 border-b border-purple-500/20 bg-slate-900/40 flex items-center justify-between relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/40 border border-purple-300/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  مساعدة ودليل المستخدم (Help & User Manual)
                </h2>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-500/40">
                  توثيق شامل ومفصل
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Ultimate Vision Studio • الدليل الفني والتشغيلي المعتمد للمحرر
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/50 text-slate-400 hover:text-rose-300 flex items-center justify-center transition-all cursor-pointer shadow-sm"
            title="إغلاق (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Navigation Tabs */}
        <div className="px-4 sm:px-6 pt-3 pb-2 bg-slate-950/60 border-b border-purple-500/15 flex items-center justify-between gap-2 overflow-x-auto text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "overview"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>نظرة عامة وتنزيل الدليل</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("contents")}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "contents"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>فهرس ومحتويات الدليل ({manualChapters.length} أقسام)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("tips")}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "tips"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>إرشادات واختصارات سريعة</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-purple-300 hidden md:flex items-center gap-1 bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-800/40">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>PDF جاهز للطباعة والتحميل</span>
          </span>
        </div>

        {/* 3. Modal Body Content (Scrollable) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
          {activeTab === "overview" && (
            <>
              {/* PRIMARY PROMINENT CALLOUT BANNER (Requested by User) */}
              <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-gradient-to-r from-purple-950/80 via-indigo-950/60 to-slate-900 border-2 border-purple-500/40 shadow-xl shadow-purple-950/60">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div className="space-y-2 max-w-xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-200 text-xs font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>دليل المستخدم الرسمي الكامل • PDF جاهز</span>
                    </div>

                    {/* Exact Requested Message */}
                    <h3 className="text-base sm:text-xl font-bold text-white leading-relaxed">
                      لمعرفة تفاصيل المحرر اضغط على الزر لتنزيل دليل المستخدم
                    </h3>

                    <p className="text-xs sm:text-sm text-purple-200/90 leading-relaxed">
                      وثيقة توثيقية احترافية شاملة ومصورة (أكثر من 30 فصلاً تفصيلياً) تشرح كامل مكونات المحرر، الأدوات الـ 18، خوارزميات التجزئة الذكية والذكاء الاصطناعي، أنماط المزج، وإدارة الطبقات، مدعومة بلقطات شاشة حقيقية من صلب البرنامج.
                    </p>
                  </div>

                  {/* Actions: Download & Preview */}
                  <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={downloading}
                      className="flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-purple-600/40 border border-purple-400/30 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Download className={`w-4 h-4 ${downloading ? "animate-bounce" : ""}`} />
                      <span>{downloading ? "جاري التنزيل..." : "تنزيل دليل المستخدم (PDF)"}</span>
                    </button>

                    <a
                      href={manualDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white border border-slate-700 hover:border-purple-400/50 text-xs font-semibold transition-all shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                      <span>فتح وقراءة الدليل في نافذة جديدة</span>
                    </a>
                  </div>
                </div>

                {/* File Specs Bar */}
                <div className="mt-4 pt-3 border-t border-purple-500/20 flex flex-wrap items-center gap-4 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1 font-mono text-purple-300 font-semibold">
                    <FileText className="w-3.5 h-3.5" />
                    <span>اسم الملف: Ultimate_Vision_Studio_User_Manual.pdf</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>الحجم: ~17.5 ميجابايت (عالي الدقة)</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>اللغة: العربية الفصحى الكاملة</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span>تنسيق جاهز للطباعة وعرض الشاشات (A4)</span>
                  </span>
                </div>
              </div>

              {/* Quick Feature Pillars Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>أبرز المحاور المشروحة بالتفصيل في الدليل:</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 transition-all space-y-1.5 group">
                    <div className="w-8 h-8 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                      <Scissors className="w-4 h-4" />
                    </div>
                    <h5 className="font-bold text-xs text-white">18 أداة تحرير متكاملة</h5>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      شرح دقيق لكل أداة: التحديد، اللاسو، القص، التدوير، الفرشاة، والممحاة، وإزالة العيوب.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 transition-all space-y-1.5 group">
                    <div className="w-8 h-8 rounded-xl bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                      <Wand2 className="w-4 h-4" />
                    </div>
                    <h5 className="font-bold text-xs text-white">استوديو الذكاء الاصطناعي</h5>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      إزالة الخلفيات بدقة U2-Net، وفحص YOLO11s للأجسام، واستخراج النصوص الذكي EasyOCR.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 transition-all space-y-1.5 group">
                    <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <h5 className="font-bold text-xs text-white">القص والتجزئة (Segmentation)</h5>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      خوارزميات K-Means، Watershed، وفصل العناصر، والعتبة الذكية Otsu لتحليل وفصل الصور.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 transition-all space-y-1.5 group">
                    <div className="w-8 h-8 rounded-xl bg-pink-950/80 border border-pink-800/60 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h5 className="font-bold text-xs text-white">الطبقات وأنماط المزج والتدرج</h5>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      9 أنماط مزج سينمائية، طبقات التدرج اللوني، والأشكال والنصوص وتصدير الأعمال بـ 6 صيغ.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "contents" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white">فهرس الفصول والأبواب التوثيقية</h4>
                  <p className="text-xs text-slate-400">
                    استعرض الأقسام الموثقة داخل كتيب الاستخدام الرسمي المرفق في ملف الـ PDF.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث في فصول الدليل..."
                    className="w-full bg-slate-900/80 border border-slate-700 focus:border-purple-400 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredChapters.map((ch) => {
                  const IconComponent = ch.icon;
                  return (
                    <div
                      key={ch.id}
                      className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 transition-all flex items-start gap-3 group"
                    >
                      <span className="font-mono text-xs font-bold text-purple-400 bg-purple-950/60 border border-purple-800/40 w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
                        {ch.num}
                      </span>
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="font-bold text-xs text-white group-hover:text-purple-300 transition-colors truncate">
                            {ch.title}
                          </h5>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-medium shrink-0">
                            {ch.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {ch.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Quick Download Strip */}
              <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/20 flex items-center justify-between gap-3">
                <span className="text-xs text-purple-200">
                  هل تريد تصفح كافة الفصول بالكامل بصيغة PDF الملونة؟
                </span>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل الدليل الكامل</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "tips" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-white">إرشادات سريعة لزيادة إنتاجيتك</h4>
                <p className="text-xs text-slate-400">
                  مفاتيح واختصارات سريعة تمكنك من العمل على المحرر كالمحترفين:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">لوحة المفاتيح والاختصارات</span>
                    <span className="font-mono text-purple-300 text-xs px-2 py-0.5 rounded bg-purple-950 border border-purple-800">
                      F1
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    اضغط زر <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-[10px] text-purple-300">F1</kbd> في أي وقت لإظهار نافذة الاختصارات التفاعلية الشاملة لكافة أدوات المحرر.
                  </p>
                  {onOpenShortcuts && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenShortcuts();
                      }}
                      className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 cursor-pointer pt-1"
                    >
                      <span>فتح نافذة الاختصارات الآن</span>
                      <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                    </button>
                  )}
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">إعادة تسمية المشروع</span>
                    <span className="font-mono text-cyan-300 text-xs px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                      F2
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    اضغط <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-[10px] text-cyan-300">F2</kbd> لتعديل اسم العمل الفني فوراً من الشريط العلوي ليظهر بالاسم المناسب عند التصدير والحفظ.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">إظهار وطي لوحة الطبقات</span>
                    <span className="font-mono text-emerald-300 text-xs px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">
                      F7
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    استخدم <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-[10px] text-emerald-300">F7</kbd> لتوفير مساحة رؤية كاملة للوحة عبر إخفاء أو إظهار لوحة الطبقات في اليمين.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">إظهار وطي لوحة الخصائص</span>
                    <span className="font-mono text-amber-300 text-xs px-2 py-0.5 rounded bg-amber-950 border border-amber-800">
                      F8
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    اضغط <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-[10px] text-amber-300">F8</kbd> للتحكم في لوحة الخصائص والأدوات المتقدمة على يسار الشاشة.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Footer */}
        <div className="p-3.5 sm:p-4 border-t border-purple-500/20 bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Ultimate Vision Studio v2.5.0 • يعمل محلياً بالكامل (Offline-First Ready)</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-900/30 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تنزيل الدليل (PDF)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
