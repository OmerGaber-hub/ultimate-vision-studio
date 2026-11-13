import { PanelButton } from "./PanelButton";
import React, { useState, useEffect } from "react";
import {
  X,
  Info,
  Layers,
  FileText,
  Palette,
  Maximize2,
  HardDrive,
  Copy,
  Check,
  Cpu,
  Eye,
  Sliders,
  Pencil,
} from "lucide-react";
import { Layer } from "../types";

export interface FileMetadataInfo {
  name?: string;
  size?: number;
  type?: string;
  lastModified?: number;
  originalWidth?: number;
  originalHeight?: number;
}

interface ImageMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeLayer: Layer | null;
  layers: Layer[];
  docWidth: number;
  docHeight: number;
  zoom: number;
  fileMetadata?: FileMetadataInfo | null;
  projectName?: string;
  onRenameProject?: (name: string) => void;
}

interface ExtractedMetadata {
  fileName: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  isEstimatedSize: boolean;
  mimeType: string;
  lastModifiedFormatted: string;
  originalDimensions: string;
  currentDimensions: string;
  canvasDimensions: string;
  aspectRatio: string;
  megapixels: string;
  totalPixels: number;
  rawMemoryBytes: number;
  rawMemoryFormatted: string;
  colorModel: string;
  bitDepth: string;
  colorSpace: string;
  hasAlpha: boolean;
  dominantColorHex: string;
  dominantColorRgb: string;
  averageColorHex: string;
  averageColorRgb: string;
  luminance: number;
  channels: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  thumbnailUrl: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 بايت";
  const k = 1024;
  const sizes = ["بايت", "كيلوبايت", "ميجابايت", "جيجابايت"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const ImageMetadataModal: React.FC<ImageMetadataModalProps> = ({
  isOpen,
  onClose,
  activeLayer,
  layers,
  docWidth,
  docHeight,
  zoom,
  fileMetadata,
  projectName,
  onRenameProject,
}) => {
  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "layers" | "colors" | "technical">("overview");
  const [copied, setCopied] = useState<boolean>(false);
  const [isEditingModalName, setIsEditingModalName] = useState(false);
  const [tempModalName, setTempModalName] = useState(projectName || "");

  useEffect(() => {
    setTempModalName(projectName || "");
  }, [projectName]);

  const handleSaveModalName = () => {
    const trimmed = tempModalName.trim();
    if (trimmed && onRenameProject) {
      onRenameProject(trimmed);
    }
    setIsEditingModalName(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const targetCanvas = activeLayer ? activeLayer.canvas : null;
    const w = targetCanvas ? targetCanvas.width : docWidth;
    const h = targetCanvas ? targetCanvas.height : docHeight;
    const totalPixels = w * h;
    const rawMemoryBytes = totalPixels * 4;

    let rSum = 0,
      gSum = 0,
      bSum = 0,
      aSum = 0;
    let transparentPixels = 0;
    const colorBuckets: Record<string, number> = {};
    let thumb = "";

    if (targetCanvas) {
      try {
        thumb = targetCanvas.toDataURL("image/png");
        const ctx = targetCanvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;
          const step = Math.max(1, Math.floor(totalPixels / 20000));
          let sampled = 0;

          for (let i = 0; i < data.length; i += 4 * step) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            rSum += r;
            gSum += g;
            bSum += b;
            aSum += a;
            if (a < 250) transparentPixels++;

            const qr = Math.round(r / 32) * 32;
            const qg = Math.round(g / 32) * 32;
            const qb = Math.round(b / 32) * 32;
            const key = `${qr},${qg},${qb}`;
            colorBuckets[key] = (colorBuckets[key] || 0) + 1;
            sampled++;
          }

          if (sampled > 0) {
            const meanR = Math.round(rSum / sampled);
            const meanG = Math.round(gSum / sampled);
            const meanB = Math.round(bSum / sampled);
            const meanA = Math.round(aSum / sampled);

            let dominantKey = "128,128,128";
            let maxCount = 0;
            for (const [k, count] of Object.entries(colorBuckets)) {
              if (count > maxCount) {
                maxCount = count;
                dominantKey = k;
              }
            }
            const [domR, domG, domB] = dominantKey.split(",").map(Number);
            const toHex = (n: number) => n.toString(16).padStart(2, "0");
            const dominantHex = `#${toHex(domR)}${toHex(domG)}${toHex(domB)}`;
            const averageHex = `#${toHex(meanR)}${toHex(meanG)}${toHex(meanB)}`;
            const lum = Math.round((0.299 * meanR + 0.587 * meanG + 0.114 * meanB) / 2.55);

            const fileBytes = fileMetadata?.size || Math.round(rawMemoryBytes * 0.32);
            const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
            const divisor = gcd(w, h);
            const aspectStr = `${Math.round(w / divisor)}:${Math.round(h / divisor)}`;

            const origW = fileMetadata?.originalWidth || w;
            const origH = fileMetadata?.originalHeight || h;

            setMetadata({
              fileName: fileMetadata?.name || activeLayer?.name || "Ultimate_Vision_Studio_Document",
              fileSizeBytes: fileBytes,
              fileSizeFormatted: formatBytes(fileBytes),
              isEstimatedSize: !fileMetadata?.size,
              mimeType: fileMetadata?.type || "image/png",
              lastModifiedFormatted: fileMetadata?.lastModified
                ? new Date(fileMetadata.lastModified).toLocaleString("ar-EG")
                : new Date().toLocaleString("ar-EG"),
              originalDimensions: `${origW} × ${origH} بكسل`,
              currentDimensions: `${w} × ${h} بكسل`,
              canvasDimensions: `${docWidth} × ${docHeight} بكسل`,
              aspectRatio: aspectStr,
              megapixels: (totalPixels / 1000000).toFixed(2),
              totalPixels,
              rawMemoryBytes,
              rawMemoryFormatted: formatBytes(rawMemoryBytes),
              colorModel: "RGBA (32-bit)",
              bitDepth: "8 بت لكل قناة (24 بت ألوان + 8 بت شفافية)",
              colorSpace: "sRGB (IEC 61966-2-1)",
              hasAlpha: transparentPixels > 0,
              dominantColorHex: dominantHex,
              dominantColorRgb: `rgb(${domR}, ${domG}, ${domB})`,
              averageColorHex: averageHex,
              averageColorRgb: `rgb(${meanR}, ${meanG}, ${meanB})`,
              luminance: lum,
              channels: {
                r: meanR,
                g: meanG,
                b: meanB,
                a: meanA,
              },
              thumbnailUrl: thumb,
            });
          }
        }
      } catch (err) {
        console.warn("Could not extract canvas pixels:", err);
      }
    } else {
      // Fallback
      setMetadata({
        fileName: fileMetadata?.name || "لوحة_الرسم",
        fileSizeBytes: totalPixels * 4 * 0.3,
        fileSizeFormatted: formatBytes(totalPixels * 4 * 0.3),
        isEstimatedSize: true,
        mimeType: "image/png",
        lastModifiedFormatted: new Date().toLocaleString("ar-EG"),
        originalDimensions: `${docWidth} × ${docHeight} بكسل`,
        currentDimensions: `${docWidth} × ${docHeight} بكسل`,
        canvasDimensions: `${docWidth} × ${docHeight} بكسل`,
        aspectRatio: `${(docWidth / docHeight).toFixed(2)}:1`,
        megapixels: (totalPixels / 1000000).toFixed(2),
        totalPixels,
        rawMemoryBytes,
        rawMemoryFormatted: formatBytes(rawMemoryBytes),
        colorModel: "RGBA (32-bit)",
        bitDepth: "8 بت لكل قناة",
        colorSpace: "sRGB",
        hasAlpha: false,
        dominantColorHex: "#3b82f6",
        dominantColorRgb: "rgb(59, 130, 246)",
        averageColorHex: "#64748b",
        averageColorRgb: "rgb(100, 116, 139)",
        luminance: 50,
        channels: { r: 100, g: 116, b: 139, a: 255 },
        thumbnailUrl: "",
      });
    }
  }, [isOpen, activeLayer, docWidth, docHeight, fileMetadata]);

  if (!isOpen || !metadata) return null;

  const handleCopyText = () => {
    const summary = `
=== تقرير بيانات الصورة (Metadata) - Ultimate Vision Studio ===
- اسم الملف: ${metadata.fileName}
- الصيغة: ${metadata.mimeType}
- الأبعاد الأصلية: ${metadata.originalDimensions}
- الأبعاد الحالية: ${metadata.currentDimensions}
- أبعاد اللوحة الكلية: ${metadata.canvasDimensions}
- نسبة الأبعاد: ${metadata.aspectRatio}
- الدقة: ${metadata.megapixels} ميغابكسل (${metadata.totalPixels.toLocaleString()} بكسل)
- حجم الملف: ${metadata.fileSizeFormatted} (${metadata.fileSizeBytes.toLocaleString()} بايت)${metadata.isEstimatedSize ? " [تقديري]" : ""}
- استهلاك ذاكرة الرام الأولية: ${metadata.rawMemoryFormatted}
- نموذج الألوان: ${metadata.colorModel}
- عمق البت: ${metadata.bitDepth}
- فضاء الألوان: ${metadata.colorSpace}
- الشفافية: ${metadata.hasAlpha ? "تحتوي على شفافية (Alpha Channel)" : "معتمة تماماً"}
- اللون السائد: ${metadata.dominantColorHex} (${metadata.dominantColorRgb})
- متوسط اللون: ${metadata.averageColorHex} (${metadata.averageColorRgb})
- متوسط مستوى الإضاءة: ${metadata.luminance}%
- عدد الطبقات: ${layers.length}
- تاريخ الاستخراج: ${new Date().toLocaleString("ar-EG")}
============================================================
`.trim();

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="image-metadata-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        id="image-metadata-modal-content"
        className="w-full max-w-2xl bg-[#0e101c] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-purple-500/20 bg-[#131525] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-inner">
              <Info className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>معلومات وتفاصيل الصورة (Metadata)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/50">
                  Ultimate Vision Studio
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                فحص فوري للأبعاد، البايت، ونموذج الألوان، والقنوات الرياضية
              </p>
            </div>
          </div>

          <PanelButton
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="إغلاق النافذة (Esc)"
          >
            <X className="w-5 h-5" />
          </PanelButton>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 pt-3 pb-0 border-b border-slate-800 bg-[#101221] flex items-center gap-2 text-xs">
          <PanelButton
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-2 rounded-t-lg font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "overview"
                ? "border-purple-500 text-purple-300 bg-purple-950/40"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>نظرة عامة والأبعاد</span>
          </PanelButton>

          <PanelButton
            onClick={() => setActiveTab("color")}
            className={`px-3 py-2 rounded-t-lg font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "color"
                ? "border-purple-500 text-purple-300 bg-purple-950/40"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>معلومات وتحليل اللون</span>
          </PanelButton>

          <PanelButton
            onClick={() => setActiveTab("technical")}
            className={`px-3 py-2 rounded-t-lg font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "technical"
                ? "border-purple-500 text-purple-300 bg-purple-950/40"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>المواصفات التقنية والذاكرة</span>
          </PanelButton>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 custom-scrollbar flex-1">
          {/* Top Quick Preview Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              {metadata.thumbnailUrl ? (
                <div className="w-16 h-16 rounded-lg bg-slate-950 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
                  <img
                    src={metadata.thumbnailUrl}
                    alt="معاينة"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                  <FileText className="w-8 h-8 text-slate-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {isEditingModalName ? (
                  <div className="flex items-center gap-1.5 my-0.5">
                    <input
                      type="text"
                      value={tempModalName}
                      onChange={(e) => setTempModalName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveModalName();
                        if (e.key === "Escape") {
                          setTempModalName(projectName || "");
                          setIsEditingModalName(false);
                        }
                      }}
                      className="bg-slate-950 border border-purple-400 rounded-lg px-2.5 py-1 text-xs text-white font-bold outline-none w-56 font-['Cairo',sans-serif]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveModalName}
                      className="p-1 text-emerald-400 hover:text-emerald-300 rounded hover:bg-emerald-950/40 transition-colors"
                      title="حفظ"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingModalName(false)}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-950/40 transition-colors"
                      title="إلغاء"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-100 truncate">
                      {projectName || metadata.fileName}
                    </h3>
                    {onRenameProject && (
                      <button
                        type="button"
                        onClick={() => {
                          setTempModalName(projectName || metadata.fileName);
                          setIsEditingModalName(true);
                        }}
                        className="p-1 rounded hover:bg-purple-950/60 text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                        title="تعديل اسم المشروع"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                  <span className="font-mono px-1.5 py-0.5 rounded bg-slate-800 text-purple-300">
                    {metadata.mimeType}
                  </span>
                  <span>•</span>
                  <span>{metadata.currentDimensions}</span>
                  <span>•</span>
                  <span className="font-mono text-cyan-300">
                    {metadata.fileSizeFormatted}
                  </span>
                </div>
              </div>
            </div>

            <PanelButton
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/50 hover:bg-purple-900/70 border border-purple-500/40 text-purple-200 text-xs font-medium transition-colors shrink-0"
              title="نسخ جميع بيانات الميتاداتا للحافظة"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تم النسخ!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ البيانات</span>
                </>
              )}
            </PanelButton>
          </div>

          {/* TAB 1: OVERVIEW & DIMENSIONS */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Primary Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#121422] border border-slate-800 flex flex-col">
                  <span className="text-[11px] text-slate-400">الأبعاد الأصلية</span>
                  <span className="text-sm font-mono font-bold text-slate-100 mt-1">
                    {metadata.originalDimensions}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">العرض × الارتفاع</span>
                </div>

                <div className="p-3 rounded-xl bg-[#121422] border border-slate-800 flex flex-col">
                  <span className="text-[11px] text-slate-400">حجم الصورة بالبايت</span>
                  <span className="text-sm font-mono font-bold text-purple-300 mt-1">
                    {metadata.fileSizeFormatted}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
                    {metadata.fileSizeBytes.toLocaleString()} بايت
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#121422] border border-slate-800 flex flex-col">
                  <span className="text-[11px] text-slate-400">الدقة الإجمالية</span>
                  <span className="text-sm font-mono font-bold text-cyan-300 mt-1">
                    {metadata.megapixels} MP
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    {metadata.totalPixels.toLocaleString()} بكسل
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#121422] border border-slate-800 flex flex-col">
                  <span className="text-[11px] text-slate-400">نسبة العرض للارتفاع</span>
                  <span className="text-sm font-mono font-bold text-amber-300 mt-1">
                    {metadata.aspectRatio}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Aspect Ratio</span>
                </div>
              </div>

              {/* Detailed Breakdown List */}
              <div className="p-3.5 rounded-xl bg-[#111320] border border-slate-800/80 space-y-2.5 text-xs">
                <h4 className="font-bold text-slate-200 text-xs border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span>تفاصيل الملف والطبقة المحددة</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    الطبقة: {activeLayer?.name || "الطبقة الأساسية"}
                  </span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-slate-300">
                  <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/40">
                    <span className="text-slate-400">أبعاد اللوحة الكاملة:</span>
                    <span className="font-mono text-slate-200">{metadata.canvasDimensions}</span>
                  </div>

                  <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/40">
                    <span className="text-slate-400">صيغة الملف (MIME):</span>
                    <span className="font-mono text-purple-300">{metadata.mimeType}</span>
                  </div>

                  <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/40">
                    <span className="text-slate-400">معامل التكبير الحالي:</span>
                    <span className="font-mono text-cyan-300">{Math.round(zoom * 100)}%</span>
                  </div>

                  <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/40">
                    <span className="text-slate-400">إجمالي طبقات المشروع:</span>
                    <span className="font-mono text-amber-300">{layers.length} طبقات</span>
                  </div>

                  <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/40 sm:col-span-2">
                    <span className="text-slate-400">تاريخ آخر تعديل أو حفظ:</span>
                    <span className="font-mono text-slate-300 text-[11px]">
                      {metadata.lastModifiedFormatted}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COLOR INFORMATION */}
          {activeTab === "color" && (
            <div className="space-y-4">
              {/* Color Swatches Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Dominant Color */}
                <div className="p-3.5 rounded-xl bg-[#121422] border border-slate-800 flex items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-xl border-2 border-white/20 shadow-lg shrink-0"
                    style={{ backgroundColor: metadata.dominantColorHex }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] text-slate-400 block">اللون السائد (Dominant)</span>
                    <span className="text-sm font-mono font-bold text-slate-100 uppercase">
                      {metadata.dominantColorHex}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                      {metadata.dominantColorRgb}
                    </span>
                  </div>
                </div>

                {/* Average Color */}
                <div className="p-3.5 rounded-xl bg-[#121422] border border-slate-800 flex items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-xl border-2 border-white/20 shadow-lg shrink-0"
                    style={{ backgroundColor: metadata.averageColorHex }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] text-slate-400 block">متوسط اللون (Average)</span>
                    <span className="text-sm font-mono font-bold text-slate-100 uppercase">
                      {metadata.averageColorHex}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                      {metadata.averageColorRgb}
                    </span>
                  </div>
                </div>
              </div>

              {/* Luminance Bar */}
              <div className="p-3.5 rounded-xl bg-[#121422] border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">متوسط الإضاءة والسطوع (Luminance):</span>
                  <span className="font-mono text-amber-300 font-bold">{metadata.luminance}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-slate-900 via-amber-600 to-amber-300 transition-all duration-500"
                    style={{ width: `${metadata.luminance}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0% داكن تماماً</span>
                  <span>50% متوازن</span>
                  <span>100% شديد السطوع</span>
                </div>
              </div>

              {/* Color Model & Profile Specifications */}
              <div className="p-3.5 rounded-xl bg-[#111320] border border-slate-800/80 space-y-2 text-xs">
                <h4 className="font-bold text-slate-200 text-xs border-b border-slate-800 pb-2">
                  نموذج التمثيل اللوني والفضاء اللوني
                </h4>

                <div className="space-y-1.5 text-slate-300">
                  <div className="flex items-center justify-between px-2 py-1.5 rounded bg-slate-900/40">
                    <span className="text-slate-400">نموذج الألوان (Color Model):</span>
                    <span className="font-mono text-purple-300 font-bold">{metadata.colorModel}</span>
                  </div>

                  <div className="flex items-center justify-between px-2 py-1.5 rounded bg-slate-900/40">
                    <span className="text-slate-400">عمق البت (Bit Depth):</span>
                    <span className="font-mono text-slate-200">{metadata.bitDepth}</span>
                  </div>

                  <div className="flex items-center justify-between px-2 py-1.5 rounded bg-slate-900/40">
                    <span className="text-slate-400">فضاء الألوان (Color Space):</span>
                    <span className="font-mono text-slate-200">{metadata.colorSpace}</span>
                  </div>

                  <div className="flex items-center justify-between px-2 py-1.5 rounded bg-slate-900/40">
                    <span className="text-slate-400">قناة الشفافية (Alpha Channel):</span>
                    <span
                      className={`font-mono font-bold ${
                        metadata.hasAlpha ? "text-cyan-400" : "text-slate-400"
                      }`}
                    >
                      {metadata.hasAlpha ? "موجودة (تحتوي شفافية)" : "معتمة بالكامل (بدون شفافية)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Individual Channel Means */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-lg bg-red-950/30 border border-red-800/40">
                  <span className="text-[10px] text-red-400 block font-bold">الأحمر (R)</span>
                  <span className="text-xs font-mono text-red-200 mt-1 block">
                    {metadata.channels.r} / 255
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40">
                  <span className="text-[10px] text-emerald-400 block font-bold">الأخضر (G)</span>
                  <span className="text-xs font-mono text-emerald-200 mt-1 block">
                    {metadata.channels.g} / 255
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-blue-950/30 border border-blue-800/40">
                  <span className="text-[10px] text-blue-400 block font-bold">الأزرق (B)</span>
                  <span className="text-xs font-mono text-blue-200 mt-1 block">
                    {metadata.channels.b} / 255
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-purple-950/30 border border-purple-800/40">
                  <span className="text-[10px] text-purple-400 block font-bold">ألفا (A)</span>
                  <span className="text-xs font-mono text-purple-200 mt-1 block">
                    {metadata.channels.a} / 255
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TECHNICAL SPECS & MEMORY */}
          {activeTab === "technical" && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#121422] border border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-200 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-purple-400" />
                  <span>استهلاك الذاكرة العشوائية (RAM Footprint)</span>
                </h4>

                <div className="space-y-2 text-slate-300">
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900/50">
                    <span>حجم مخزن البكسلات الخام (Uncompressed Buffer):</span>
                    <span className="font-mono text-purple-300 font-bold">
                      {metadata.rawMemoryFormatted}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-900/50">
                    <span>حجم الملف المضغوط على القرص:</span>
                    <span className="font-mono text-cyan-300 font-bold">
                      {metadata.fileSizeFormatted}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-900/50">
                    <span>معدل الضغط التقريبي:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {(
                        (1 - metadata.fileSizeBytes / Math.max(1, metadata.rawMemoryBytes)) *
                        100
                      ).toFixed(1)}
                      % وفر
                    </span>
                  </div>
                </div>
              </div>

              {/* Technical Specifications Table */}
              <div className="p-3.5 rounded-xl bg-[#111320] border border-slate-800 space-y-2.5">
                <h4 className="font-bold text-slate-200">البيانات الرياضية للمصفوفة (Tensor / Matrix)</h4>

                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/30">
                    <span className="text-slate-400">Matrix Shape:</span>
                    <span className="text-slate-200">
                      ({metadata.currentDimensions.split("×")[1]?.trim().split(" ")[0] || "H"},{" "}
                      {metadata.currentDimensions.split("×")[0]?.trim() || "W"}, 4)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/30">
                    <span className="text-slate-400">Data Type:</span>
                    <span className="text-slate-200">Uint8ClampedArray (RGBA)</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/30">
                    <span className="text-slate-400">Rendering Engine:</span>
                    <span className="text-slate-200">HTML5 Canvas 2D / WebGL Accel</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/30">
                    <span className="text-slate-400">OpenCV Interop:</span>
                    <span className="text-slate-200">cv2.COLOR_RGBA2BGR / cv2.imread</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-purple-500/20 bg-[#131525] flex items-center justify-between text-xs">
          <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-purple-400" />
            <span>يمكن فتح هذه النافذة في أي وقت بالنقر على مقاس الصورة أو الضغط على Ctrl+I</span>
          </div>

          <div className="flex items-center gap-2">
            <PanelButton
              type="button"
              onClick={handleCopyText}
              className="px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/40 text-purple-200 font-medium transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "تم النسخ" : "نسخ التقرير"}</span>
            </PanelButton>

            <PanelButton
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-md shadow-purple-600/30 transition-all active:scale-95"
            >
              إغلاق
            </PanelButton>
          </div>
        </div>
      </div>
    </div>
  );
};
