import React, { useState, useRef, useEffect } from "react";
import {
  Layers,
  Upload,
  X,
  Sparkles,
  Sliders,
  Check,
  Columns,
  Rows,
  Blend,
  Maximize2,
  ArrowRightLeft,
  Eye,
  RefreshCw,
  Download,
} from "lucide-react";
import { BlendMode } from "../types";
import { SAMPLE_IMAGES } from "../lib/sampleImages";

export interface ImageBlendModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseCanvas?: HTMLCanvasElement | null;
  onApplyBlend: (resultCanvas: HTMLCanvasElement, blendName: string) => void;
}

type BlendType = "overlay" | "side_by_side" | "vertical_split" | "masked_transition";

const BLEND_MODES: Array<{ id: BlendMode; label: string }> = [
  { id: "normal", label: "عادي (Normal)" },
  { id: "multiply", label: "ضرب (Multiply)" },
  { id: "screen", label: "شاشة (Screen)" },
  { id: "overlay", label: "تراكب (Overlay)" },
  { id: "darken", label: "تعتيم (Darken)" },
  { id: "lighten", label: "تفتيح (Lighten)" },
  { id: "color-dodge", label: "تفادي لوني (Color Dodge)" },
  { id: "difference", label: "الفرق (Difference)" },
  { id: "exclusion", label: "استبعاد (Exclusion)" },
];

export const ImageBlendModal: React.FC<ImageBlendModalProps> = ({
  isOpen,
  onClose,
  baseCanvas,
  onApplyBlend,
}) => {
  const [img1Src, setImg1Src] = useState<string | null>(null);
  const [img2Src, setImg2Src] = useState<string | null>(null);
  const [img1Name, setImg1Name] = useState<string>("الصورة الأولى (الأساسية)");
  const [img2Name, setImg2Name] = useState<string>("الصورة الثانية (الطبقة)");

  const [blendType, setBlendType] = useState<BlendType>("overlay");
  const [opacity, setOpacity] = useState<number>(0.7);
  const [blendMode, setBlendMode] = useState<BlendMode>("overlay");
  const [splitRatio, setSplitRatio] = useState<number>(50); // 0-100%
  const [feather, setFeather] = useState<number>(20); // blur/feather pixels for split

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef1 = useRef<HTMLInputElement | null>(null);
  const fileInputRef2 = useRef<HTMLInputElement | null>(null);

  // Initialize image 1 with current workspace baseCanvas if available
  useEffect(() => {
    if (isOpen && baseCanvas && !img1Src) {
      setImg1Src(baseCanvas.toDataURL());
      setImg1Name("مساحة العمل الحالية");
    }
  }, [isOpen, baseCanvas, img1Src]);

  // Handle file uploads
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isFirst: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (isFirst) {
        setImg1Src(result);
        setImg1Name(file.name);
      } else {
        setImg2Src(result);
        setImg2Name(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  // Swap images
  const handleSwap = () => {
    const tempSrc = img1Src;
    const tempName = img1Name;
    setImg1Src(img2Src);
    setImg1Name(img2Name);
    setImg2Src(tempSrc);
    setImg2Name(tempName);
  };

  // Re-render blend preview whenever settings change
  useEffect(() => {
    if (!isOpen) return;
    if (!img1Src && !img2Src) return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const im1 = new Image();
    const im2 = new Image();

    let loadedCount = 0;
    const totalToLoad = (img1Src ? 1 : 0) + (img2Src ? 1 : 0);

    const onImageLoaded = () => {
      loadedCount++;
      if (loadedCount < totalToLoad) return;

      // Determine dimensions
      const targetW = im1.width || im2.width || 800;
      const targetH = im1.height || im2.height || 600;

      if (blendType === "side_by_side") {
        canvas.width = targetW * 2;
        canvas.height = targetH;
      } else if (blendType === "vertical_split") {
        canvas.width = targetW;
        canvas.height = targetH * 2;
      } else {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (blendType === "side_by_side") {
        // Draw Image 1 on left, Image 2 on right
        if (img1Src) ctx.drawImage(im1, 0, 0, targetW, targetH);
        if (img2Src) ctx.drawImage(im2, targetW, 0, targetW, targetH);
        // Draw subtle dividing line
        ctx.strokeStyle = "rgba(168, 85, 247, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(targetW, 0);
        ctx.lineTo(targetW, targetH);
        ctx.stroke();
      } else if (blendType === "vertical_split") {
        // Draw Image 1 top, Image 2 bottom
        if (img1Src) ctx.drawImage(im1, 0, 0, targetW, targetH);
        if (img2Src) ctx.drawImage(im2, 0, targetH, targetW, targetH);
        ctx.strokeStyle = "rgba(168, 85, 247, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, targetH);
        ctx.lineTo(targetW, targetH);
        ctx.stroke();
      } else if (blendType === "masked_transition") {
        // Smooth gradient transition from image 1 to image 2 based on splitRatio
        if (img1Src) ctx.drawImage(im1, 0, 0, targetW, targetH);
        if (img2Src) {
          // Create offscreen canvas for faded image 2
          const off = document.createElement("canvas");
          off.width = targetW;
          off.height = targetH;
          const offCtx = off.getContext("2d");
          if (offCtx) {
            offCtx.drawImage(im2, 0, 0, targetW, targetH);
            offCtx.globalCompositeOperation = "destination-in";

            const splitPos = (splitRatio / 100) * targetW;
            const featherPx = Math.max(10, (feather / 100) * targetW * 0.5);

            const grad = offCtx.createLinearGradient(
              splitPos - featherPx,
              0,
              splitPos + featherPx,
              0
            );
            grad.addColorStop(0, "rgba(0,0,0,0)");
            grad.addColorStop(1, "rgba(0,0,0,1)");

            offCtx.fillStyle = grad;
            offCtx.fillRect(0, 0, targetW, targetH);

            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.drawImage(off, 0, 0);
            ctx.restore();
          }
        }
      } else {
        // Standard Layer Overlay with blendMode & opacity
        if (img1Src) {
          ctx.drawImage(im1, 0, 0, targetW, targetH);
        }
        if (img2Src) {
          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
          ctx.drawImage(im2, 0, 0, targetW, targetH);
          ctx.restore();
        }
      }
    };

    if (img1Src) {
      im1.onload = onImageLoaded;
      im1.src = img1Src;
    }
    if (img2Src) {
      im2.onload = onImageLoaded;
      im2.src = img2Src;
    }
  }, [isOpen, img1Src, img2Src, blendType, opacity, blendMode, splitRatio, feather]);

  if (!isOpen) return null;

  const handleApply = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    // Create a standalone canvas copy
    const finalCopy = document.createElement("canvas");
    finalCopy.width = canvas.width;
    finalCopy.height = canvas.height;
    const ctx = finalCopy.getContext("2d");
    ctx?.drawImage(canvas, 0, 0);

    onApplyBlend(finalCopy, `دمج: ${blendType === "overlay" ? blendMode : blendType}`);
    onClose();
  };

  // Direct quick download from the modal preview
  const handleDirectDownload = (format: "png" | "jpeg") => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    try {
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const ext = format === "jpeg" ? "jpg" : "png";
      const filename = `blended_${blendType}_${Date.now()}.${ext}`;

      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 200);
        }, mime, 0.95);
      } else {
        const dataUrl = canvas.toDataURL(mime, 0.95);
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 200);
      }
    } catch (e) {
      console.error("Direct download failed", e);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="relative w-full max-w-5xl bg-[#111222] border border-purple-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-500/20 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Blend className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>دمج ومزج صورتين ذكياً</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white shadow-sm">
                  ميزة فورية
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ارفع صورتين وامزجهما معاً بسهولة باستخدام أنماط المزج، التدريج الناعم، أو التركيب جنباً إلى جنب
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Controls Column (Right on RTL) */}
          <div className="lg:col-span-5 p-5 border-l border-slate-800/80 overflow-y-auto space-y-5 bg-slate-950/40">
            {/* Step 1: Upload Both Images */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                1. اختيار وتحديد الصورتين:
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* Image 1 Box */}
                <div
                  onClick={() => fileInputRef1.current?.click()}
                  className="relative group border-2 border-dashed border-slate-700 hover:border-purple-500/80 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-900/60 hover:bg-purple-950/20 transition-all min-h-[110px]"
                >
                  <input
                    ref={fileInputRef1}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, true)}
                  />
                  {img1Src ? (
                    <div className="w-full h-full flex flex-col items-center">
                      <img
                        src={img1Src}
                        alt="1"
                        className="w-14 h-14 object-cover rounded-lg shadow-md border border-purple-500/40 mb-1.5"
                      />
                      <span className="text-[11px] font-medium text-slate-200 truncate w-full px-1">
                        {img1Name}
                      </span>
                      <span className="text-[9px] text-purple-400 mt-0.5">تغيير الصورة</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-purple-400 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-slate-200">الصورة الأولى (الأساس)</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">انقر للرفع</span>
                    </>
                  )}
                </div>

                {/* Image 2 Box */}
                <div
                  onClick={() => fileInputRef2.current?.click()}
                  className="relative group border-2 border-dashed border-slate-700 hover:border-purple-500/80 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-900/60 hover:bg-purple-950/20 transition-all min-h-[110px]"
                >
                  <input
                    ref={fileInputRef2}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, false)}
                  />
                  {img2Src ? (
                    <div className="w-full h-full flex flex-col items-center">
                      <img
                        src={img2Src}
                        alt="2"
                        className="w-14 h-14 object-cover rounded-lg shadow-md border border-indigo-500/40 mb-1.5"
                      />
                      <span className="text-[11px] font-medium text-slate-200 truncate w-full px-1">
                        {img2Name}
                      </span>
                      <span className="text-[9px] text-indigo-400 mt-0.5">تغيير الصورة</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-indigo-400 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-slate-200">الصورة الثانية (الدمج)</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">انقر للرفع</span>
                    </>
                  )}
                </div>
              </div>

              {/* Swap Button */}
              {img1Src && img2Src && (
                <button
                  type="button"
                  onClick={handleSwap}
                  className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs transition-colors cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
                  <span>تبديل ترتيب الصورتين</span>
                </button>
              )}

              {/* Quick Preset Samples to Test Immediately */}
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 block mb-1.5">أو جرّب نماذج جاهزة فوراً بنقرة واحدة:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const c1 = SAMPLE_IMAGES[0]?.generator(800, 800);
                      const c2 = SAMPLE_IMAGES[2]?.generator(800, 800);
                      if (c1 && c2) {
                        setImg1Src(c1.toDataURL());
                        setImg1Name("منتج الاستوديو");
                        setImg2Src(c2.toDataURL());
                        setImg2Name("بورتريه سايبر");
                      }
                    }}
                    className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/40 text-[10px] text-slate-300 hover:text-white transition-colors text-right"
                  >
                    منتج + بورتريه ⚡
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const c1 = SAMPLE_IMAGES[2]?.generator(800, 800);
                      const c2 = SAMPLE_IMAGES[3]?.generator(800, 800);
                      if (c1 && c2) {
                        setImg1Src(c1.toDataURL());
                        setImg1Name("بورتريه سايبر");
                        setImg2Src(c2.toDataURL());
                        setImg2Name("مخطط المعايرة");
                      }
                    }}
                    className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/40 text-[10px] text-slate-300 hover:text-white transition-colors text-right"
                  >
                    بورتريه + مخطط ⚡
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Choose Blend Strategy */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                2. نوع وأسلوب الدمج:
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setBlendType("overlay")}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                    blendType === "overlay"
                      ? "bg-purple-600/30 border-purple-500 text-white font-bold shadow-sm"
                      : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Blend className="w-4 h-4 text-purple-400 shrink-0" />
                  <div>
                    <div>تراكب ومزج فوتوشوب</div>
                    <div className="text-[10px] text-slate-400 font-normal">شفافية وأنماط مزج</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBlendType("masked_transition")}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                    blendType === "masked_transition"
                      ? "bg-purple-600/30 border-purple-500 text-white font-bold shadow-sm"
                      : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <div>تدرج ناعم (Fade)</div>
                    <div className="text-[10px] text-slate-400 font-normal">انتقال انسيابي بينهما</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBlendType("side_by_side")}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                    blendType === "side_by_side"
                      ? "bg-purple-600/30 border-purple-500 text-white font-bold shadow-sm"
                      : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Columns className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div>جنباً إلى جنب (أفقي)</div>
                    <div className="text-[10px] text-slate-400 font-normal">دمج الصورتين عرضياً</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBlendType("vertical_split")}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                    blendType === "vertical_split"
                      ? "bg-purple-600/30 border-purple-500 text-white font-bold shadow-sm"
                      : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Rows className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div>أعلى وأسفل (رأسي)</div>
                    <div className="text-[10px] text-slate-400 font-normal">دمج الصورتين طولياً</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 3: Granular Settings based on Blend Type */}
            <div className="space-y-4 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                3. خصائص التعديل والتحكم:
              </label>

              {blendType === "overlay" && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">نمط المزج (Blend Mode):</span>
                      <span className="font-mono text-purple-300">{blendMode}</span>
                    </div>
                    <select
                      value={blendMode}
                      onChange={(e) => setBlendMode(e.target.value as BlendMode)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      {BLEND_MODES.map((bm) => (
                        <option key={bm.id} value={bm.id}>
                          {bm.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">نسبة الشفافية والدمج:</span>
                      <span className="font-mono text-purple-300">{Math.round(opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.02"
                      value={opacity}
                      onChange={(e) => setOpacity(parseFloat(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>
                </>
              )}

              {blendType === "masked_transition" && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">نقطة الانتقال بين الصورتين:</span>
                      <span className="font-mono text-purple-300">{splitRatio}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="90"
                      value={splitRatio}
                      onChange={(e) => setSplitRatio(parseInt(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">نعومة الحواف والتدرج (Feather):</span>
                      <span className="font-mono text-cyan-300">{feather}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="80"
                      value={feather}
                      onChange={(e) => setFeather(parseInt(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">شفافية الصورة المدمجة:</span>
                      <span className="font-mono text-purple-300">{Math.round(opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.02"
                      value={opacity}
                      onChange={(e) => setOpacity(parseFloat(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>
                </>
              )}

              {(blendType === "side_by_side" || blendType === "vertical_split") && (
                <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200">
                  سيتم جمع الصورتين معاً في لوحة عمل واحدة متناسقة تلقائياً بأعلى دقة ممكنة.
                </div>
              )}
            </div>
          </div>

          {/* Preview Area (Left on RTL) */}
          <div className="lg:col-span-7 bg-[#0b0c16] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-xs text-slate-300 backdrop-blur-sm">
                <Eye className="w-3.5 h-3.5 text-purple-400" />
                معاينة فورية
              </span>
            </div>

            {/* Canvas Container */}
            <div className="max-w-full max-h-[58vh] overflow-auto flex items-center justify-center border border-purple-500/20 rounded-xl p-2 bg-[#121320] shadow-inner">
              <canvas
                ref={previewCanvasRef}
                className="max-h-[52vh] max-w-full object-contain rounded-lg shadow-2xl"
              />
            </div>

            {!img1Src && !img2Src && (
              <div className="text-center text-slate-400 text-xs mt-3">
                يرجى رفع صورة أولى وصورة ثانية لبدء المعاينة والدمج الفوري.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-purple-500/20 bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {img1Src && img2Src ? "✓ تم تجهيز الصورتين بنجاح" : "يرجى تحديد الصورتين لتفعيل الدمج"}
            </span>

            {img1Src && img2Src && (
              <div className="flex items-center gap-1.5 border-r border-slate-700 pr-3 mr-1">
                <span className="text-[11px] text-slate-400">تنزيل مباشر للنتيجة:</span>
                <button
                  type="button"
                  onClick={() => handleDirectDownload("png")}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-purple-900/60 text-purple-300 hover:text-white border border-slate-700 hover:border-purple-500/50 text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectDownload("jpeg")}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-900/60 text-indigo-300 hover:text-white border border-slate-700 hover:border-indigo-500/50 text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>JPG</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={!img1Src || !img2Src}
              onClick={handleApply}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>تطبيق الدمج في مساحة العمل</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
