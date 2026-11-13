import { PanelButton } from "./PanelButton";
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, Terminal, Download, FileCode } from "lucide-react";
import { PointProcessConfig, SpatialFilterConfig, Layer, ToneAdjustments } from "../types";

import { wsClient } from "../lib/wsClient";

interface PythonCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  pointConfig?: PointProcessConfig;
  spatialConfig?: SpatialFilterConfig;
  toneConfig?: ToneAdjustments;
  activeLayer?: Layer;
  onApplyResult?: (canvas: HTMLCanvasElement) => void;
}

export const PythonCodeModal: React.FC<PythonCodeModalProps> = ({
  isOpen,
  onClose,
  pointConfig,
  spatialConfig,
  toneConfig,
  activeLayer,
  onApplyResult,
}) => {
  const [copied, setCopied] = useState(false);

  // Generate real Python OpenCV code based on active configurations
  const generatePythonCode = () => {
    let script = `# =========================================================
# Ultimate Vision Studio - OpenCV Python Script
# Generated automatically for layer: "${activeLayer?.name || "image"}"
# =========================================================

import cv2
import numpy as np

def process_image(input_path: str, output_path: str):
    # 1. Load image (BGR format)
    img = cv2.imread(input_path)
    if img is None:
        raise FileNotFoundError(f"Could not load image from {input_path}")
    
    current_img = img.copy()
`;

    if (toneConfig) {
      // contrast range is -100 to 100. Let's map it roughly to 0.5 to 1.5
      const alpha = 1.0 + (toneConfig.contrast / 100.0) * 0.5;
      const beta = toneConfig.brightness;
      script += `
    # 2. Point Processing (Tone & Light Adjustments)
    alpha = ${alpha.toFixed(2)}  # Contrast
    beta = ${beta}     # Brightness
    current_img = cv2.convertScaleAbs(current_img, alpha=alpha, beta=beta)
`;
    }

    if (pointConfig && pointConfig.mode === "gamma") {
        script += `
    # Gamma Correction
    gamma = ${pointConfig.gamma.toFixed(2)}
    inv_gamma = 1.0 / gamma
    table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
    current_img = cv2.LUT(current_img, table)
`;
    }

    if (spatialConfig && spatialConfig.type !== 'none' && spatialConfig.type) {
      script += `
    # 3. Spatial Filter: ${spatialConfig.type.toUpperCase()}
`;
      const ks = spatialConfig.kernelSize;
      
      switch (spatialConfig.type) {
        // 1. Smoothing & Noise
        case 'gaussian':
          script += `    current_img = cv2.GaussianBlur(current_img, (${ks}, ${ks}), 0)\n`;
          break;
        case 'mean':
          script += `    current_img = cv2.blur(current_img, (${ks}, ${ks}))\n`;
          break;
        case 'median':
          script += `    current_img = cv2.medianBlur(current_img, ${ks})\n`;
          break;
        case 'bilateral':
          script += `    current_img = cv2.bilateralFilter(current_img, d=${ks}, sigmaColor=35, sigmaSpace=1.0)\n`;
          break;
        case 'kuwahara':
          script += `    current_img = cv2.bilateralFilter(current_img, d=${ks}, sigmaColor=75, sigmaSpace=75)\n`;
          break;
        case 'min_filter':
          script += `    kernel = np.ones((${ks}, ${ks}), np.uint8)\n`;
          script += `    current_img = cv2.erode(current_img, kernel)\n`;
          break;
        case 'max_filter':
          script += `    kernel = np.ones((${ks}, ${ks}), np.uint8)\n`;
          script += `    current_img = cv2.dilate(current_img, kernel)\n`;
          break;
        case 'midpoint':
          script += `    kernel = np.ones((${ks}, ${ks}), np.uint8)\n`;
          script += `    min_img = cv2.erode(current_img, kernel)\n`;
          script += `    max_img = cv2.dilate(current_img, kernel)\n`;
          script += `    current_img = cv2.addWeighted(min_img, 0.5, max_img, 0.5, 0)\n`;
          break;
        case 'harmonic':
          script += `    float_img = current_img.astype(np.float32) + 1.0\n`;
          script += `    inv_img = 1.0 / float_img\n`;
          script += `    mean_inv = cv2.blur(inv_img, (${ks}, ${ks}))\n`;
          script += `    res_float = 1.0 / (mean_inv + 1e-5)\n`;
          script += `    current_img = np.clip(res_float - 1.0, 0, 255).astype(np.uint8)\n`;
          break;
        case 'alpha_trimmed':
          script += `    current_img = cv2.medianBlur(current_img, ${ks})\n`;
          break;
        case 'motion_blur':
          script += `    kernel = np.zeros((${ks}, ${ks}))\n`;
          script += `    kernel[int((${ks}-1)/2), :] = np.ones(${ks})\n`;
          script += `    kernel = kernel / ${ks}\n`;
          script += `    current_img = cv2.filter2D(current_img, -1, kernel)\n`;
          break;
        case 'zoom_blur':
          script += `    h, w = current_img.shape[:2]\n`;
          script += `    center = (w // 2, h // 2)\n`;
          script += `    accum = np.zeros_like(current_img, dtype=np.float32)\n`;
          script += `    for i in range(${ks}):\n`;
          script += `        scale = 1.0 + (i * 0.01)\n`;
          script += `        M = cv2.getRotationMatrix2D(center, 0, scale)\n`;
          script += `        warped = cv2.warpAffine(current_img, M, (w, h))\n`;
          script += `        accum += warped\n`;
          script += `    current_img = (accum / ${ks}).astype(np.uint8)\n`;
          break;

        // 2. Edge Detection & Sharpening
        case 'sharpen':
          script += `    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)\n`;
          script += `    current_img = cv2.filter2D(current_img, -1, kernel)\n`;
          break;
        case 'edge_enhance':
          script += `    kernel = np.array([[-1, -1, -1], [-1,  9, -1], [-1, -1, -1]], dtype=np.float32)\n`;
          script += `    current_img = cv2.filter2D(current_img, -1, kernel)\n`;
          break;
        case 'canny':
          script += `    current_img = cv2.Canny(current_img, 50, 150)\n`;
          script += `    current_img = cv2.cvtColor(current_img, cv2.COLOR_GRAY2BGR)\n`;
          break;
        case 'sobel':
        case 'robinson':
        case 'kirsch':
          script += `    grad_x = cv2.Sobel(current_img, cv2.CV_16S, 1, 0, ksize=3)\n`;
          script += `    grad_y = cv2.Sobel(current_img, cv2.CV_16S, 0, 1, ksize=3)\n`;
          script += `    abs_x = cv2.convertScaleAbs(grad_x)\n`;
          script += `    abs_y = cv2.convertScaleAbs(grad_y)\n`;
          script += `    current_img = cv2.addWeighted(abs_x, 0.5, abs_y, 0.5, 0)\n`;
          break;
        case 'prewitt':
          script += `    kernelx = np.array([[1,1,1],[0,0,0],[-1,-1,-1]])\n`;
          script += `    kernely = np.array([[-1,0,1],[-1,0,1],[-1,0,1]])\n`;
          script += `    img_x = cv2.filter2D(current_img, -1, kernelx)\n`;
          script += `    img_y = cv2.filter2D(current_img, -1, kernely)\n`;
          script += `    current_img = cv2.addWeighted(img_x, 0.5, img_y, 0.5, 0)\n`;
          break;
        case 'scharr':
          script += `    grad_x = cv2.Scharr(current_img, cv2.CV_16S, 1, 0)\n`;
          script += `    grad_y = cv2.Scharr(current_img, cv2.CV_16S, 0, 1)\n`;
          script += `    abs_x = cv2.convertScaleAbs(grad_x)\n`;
          script += `    abs_y = cv2.convertScaleAbs(grad_y)\n`;
          script += `    current_img = cv2.addWeighted(abs_x, 0.5, abs_y, 0.5, 0)\n`;
          break;
        case 'roberts':
          script += `    kernelx = np.array([[1, 0], [0, -1]], dtype=int)\n`;
          script += `    kernely = np.array([[0, 1], [-1, 0]], dtype=int)\n`;
          script += `    img_x = cv2.filter2D(current_img, -1, kernelx)\n`;
          script += `    img_y = cv2.filter2D(current_img, -1, kernely)\n`;
          script += `    current_img = cv2.addWeighted(img_x, 0.5, img_y, 0.5, 0)\n`;
          break;
        case 'laplacian':
          script += `    lap = cv2.Laplacian(current_img, cv2.CV_16S, ksize=3)\n`;
          script += `    current_img = cv2.convertScaleAbs(lap)\n`;
          break;
        case 'log':
          script += `    blur = cv2.GaussianBlur(current_img, (${ks}, ${ks}), 1.0)\n`;
          script += `    lap = cv2.Laplacian(blur, cv2.CV_16S, ksize=3)\n`;
          script += `    current_img = cv2.convertScaleAbs(lap)\n`;
          break;
        case 'unsharp':
          script += `    blurred = cv2.GaussianBlur(current_img, (0, 0), 1.0)\n`;
          script += `    current_img = cv2.addWeighted(current_img, 2.5, blurred, -1.5, 0)\n`;
          break;
        case 'highboost':
          script += `    blurred = cv2.GaussianBlur(current_img, (${ks}, ${ks}), 0)\n`;
          script += `    mask = cv2.subtract(current_img, blurred)\n`;
          script += `    current_img = cv2.addWeighted(current_img, 1.5, mask, 1.0, 0)\n`;
          break;
        case 'highpass':
          script += `    kernel = np.array([[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]])\n`;
          script += `    current_img = cv2.filter2D(current_img, -1, kernel)\n`;
          break;
        case 'emboss':
          script += `    kernel = np.array([[-2, -1, 0], [-1, 1, 1], [0, 1, 2]])\n`;
          script += `    res = cv2.filter2D(current_img, -1, kernel)\n`;
          script += `    current_img = cv2.add(res, np.array([128.0]))\n`;
          break;

        // 3. Morphology
        case 'dilation':
          script += `    kernel = np.ones((${ks}, ${ks}), np.uint8)\n`;
          script += `    current_img = cv2.dilate(current_img, kernel, iterations=1)\n`;
          break;
        case 'erosion':
          script += `    kernel = np.ones((${ks}, ${ks}), np.uint8)\n`;
          script += `    current_img = cv2.erode(current_img, kernel, iterations=1)\n`;
          break;
        case 'opening':
          script += `    kernel = np.ones((${ks}, ${ks}), np.uint8)\n`;
          script += `    current_img = cv2.morphologyEx(current_img, cv2.MORPH_OPEN, kernel)\n`;
          break;
        case 'closing':
          script += `    kernel = np.ones((${ks}, ${ks}), np.uint8)\n`;
          script += `    current_img = cv2.morphologyEx(current_img, cv2.MORPH_CLOSE, kernel)\n`;
          break;
        case 'morph_gradient':
          script += `    kernel = np.ones((${ks}, ${ks}), np.uint8)\n`;
          script += `    current_img = cv2.morphologyEx(current_img, cv2.MORPH_GRADIENT, kernel)\n`;
          break;
        case 'tophat':
          script += `    kernel = np.ones((${ks}, ${ks}), np.uint8)\n`;
          script += `    current_img = cv2.morphologyEx(current_img, cv2.MORPH_TOPHAT, kernel)\n`;
          break;
        case 'blackhat':
          script += `    kernel = np.ones((${ks}, ${ks}), np.uint8)\n`;
          script += `    current_img = cv2.morphologyEx(current_img, cv2.MORPH_BLACKHAT, kernel)\n`;
          break;

        // 4. Artistic
        case 'sepia':
          script += `    kernel = np.array([[0.272, 0.534, 0.131], [0.349, 0.686, 0.168], [0.393, 0.769, 0.189]])\n`;
          script += `    res = cv2.transform(current_img, kernel)\n`;
          script += `    current_img = np.clip(res, 0, 255).astype(np.uint8)\n`;
          break;
        case 'vignette':
          script += `    rows, cols = current_img.shape[:2]\n`;
          script += `    kernel_x = cv2.getGaussianKernel(cols, cols * 0.8)\n`;
          script += `    kernel_y = cv2.getGaussianKernel(rows, rows * 0.8)\n`;
          script += `    kernel = kernel_y * kernel_x.T\n`;
          script += `    mask = 255 * kernel / np.linalg.norm(kernel)\n`;
          script += `    mask = mask.astype(np.float32)\n`;
          script += `    for i in range(3):\n`;
          script += `        current_img[:,:,i] = current_img[:,:,i] * mask\n`;
          script += `    current_img = np.clip(current_img, 0, 255).astype(np.uint8)\n`;
          break;
        case 'film_noir':
          script += `    gray = cv2.cvtColor(current_img, cv2.COLOR_BGR2GRAY)\n`;
          script += `    gray = cv2.equalizeHist(gray)\n`;
          script += `    current_img = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)\n`;
          break;
        case 'thermal':
          script += `    gray = cv2.cvtColor(current_img, cv2.COLOR_BGR2GRAY)\n`;
          script += `    current_img = cv2.applyColorMap(gray, cv2.COLORMAP_JET)\n`;
          break;
        case 'cyberpunk':
          script += `    b, g, r = cv2.split(current_img)\n`;
          script += `    r_new = cv2.add(r, 30)\n`;
          script += `    b_new = cv2.add(b, 50)\n`;
          script += `    g_new = cv2.subtract(g, 20)\n`;
          script += `    current_img = cv2.merge((b_new, g_new, r_new))\n`;
          break;
        case 'sketch':
          script += `    gray = cv2.cvtColor(current_img, cv2.COLOR_BGR2GRAY)\n`;
          script += `    inv = cv2.bitwise_not(gray)\n`;
          script += `    blur = cv2.GaussianBlur(inv, (21, 21), 0)\n`;
          script += `    sketch = cv2.divide(gray, 255 - blur, scale=256)\n`;
          script += `    current_img = cv2.cvtColor(sketch, cv2.COLOR_GRAY2BGR)\n`;
          break;
        case 'glitch':
          script += `    rows, cols = current_img.shape[:2]\n`;
          script += `    b, g, r = cv2.split(current_img)\n`;
          script += `    M = np.float32([[1, 0, 10], [0, 1, 0]])\n`;
          script += `    r_shifted = cv2.warpAffine(r, M, (cols, rows))\n`;
          script += `    current_img = cv2.merge((b, g, r_shifted))\n`;
          break;
        case 'duotone':
          script += `    # using static dark blue and light blue\n`;
          script += `    lb, lg, lr = 248, 189, 56\n`;
          script += `    db, dg, dr = 75, 27, 30\n`;
          script += `    gray = cv2.cvtColor(current_img, cv2.COLOR_BGR2GRAY)\n`;
          script += `    norm = gray.astype(np.float32) / 255.0\n`;
          script += `    res_b = (db * (1 - norm) + lb * norm)\n`;
          script += `    res_g = (dg * (1 - norm) + lg * norm)\n`;
          script += `    res_r = (dr * (1 - norm) + lr * norm)\n`;
          script += `    current_img = cv2.merge((res_b, res_g, res_r)).astype(np.uint8)\n`;
          break;
        case 'cartoon':
          script += `    gray = cv2.cvtColor(current_img, cv2.COLOR_BGR2GRAY)\n`;
          script += `    gray = cv2.medianBlur(gray, 5)\n`;
          script += `    edges = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 9)\n`;
          script += `    color = cv2.bilateralFilter(current_img, 9, 300, 300)\n`;
          script += `    current_img = cv2.bitwise_and(color, color, mask=edges)\n`;
          break;

        default:
          script += `    # Unknown filter (${spatialConfig.type})\n`;
          script += `    pass\n`;
      }
    }

    script += `
    # 4. Save processed output
    cv2.imwrite(output_path, current_img)
    print(f"✓ Image processed and saved to {output_path}")

if __name__ == "__main__":
    process_image("input.jpg", "output.jpg")
`;
    return script;
  };

  const [code, setCode] = React.useState<string>("");
  const [isExecuting, setIsExecuting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setCode(generatePythonCode());
    }
  }, [isOpen, pointConfig, spatialConfig, toneConfig]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleExecute = async () => {
    if (!activeLayer || !onApplyResult) return;
    setIsExecuting(true);
    const base64 = activeLayer.canvas.toDataURL("image/png");
    
    try {
      const payload = await wsClient.request("run_python_script", {
        script: code,
        imageBase64: base64
      }, 30000);

      setIsExecuting(false);
      
      if (!payload.success) {
        alert("خطأ أثناء التنفيذ: " + payload.error);
        return;
      }
      
      const img = new Image();
      img.onload = () => {
        const res = document.createElement("canvas");
        res.width = activeLayer.canvas.width;
        res.height = activeLayer.canvas.height;
        const ctx = res.getContext("2d");
        if (ctx) ctx.drawImage(img, 0, 0);
        onApplyResult(res);
        onClose();
      };
      img.src = payload.imageBase64;
    } catch (err: any) {
      setIsExecuting(false);
      alert("خطأ أثناء التنفيذ: " + (err?.message || err));
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vision_studio_pipeline.py";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      id="python-code-modal-overlay"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="python-code-modal-content"
        className="w-[95vw] max-w-5xl h-[85vh] bg-[#0e101c] border border-purple-500/40 rounded-2xl shadow-[0_0_50px_-12px_rgba(168,85,247,0.2)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-purple-500/20 bg-[#131525] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-inner">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  كود بايثون (OpenCV Python Code)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                  OpenCV 4.x
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                الكود المصدري البرمجي المكافئ لكافة عمليات المعالجة الرياضية المطبقة
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

        {/* Code View Area */}
        <div className="flex-1 p-4 bg-[#090a12] overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between pb-2 text-xs text-slate-400 font-mono border-b border-slate-800/80 mb-2">
            <span className="flex items-center gap-1.5 text-purple-300">
              <FileCode className="w-3.5 h-3.5" />
              pipeline.py
            </span>
            <span className="text-[11px] text-slate-500">Python 3.10+ • NumPy</span>
          </div>

          <div className="relative h-full flex flex-col group overflow-hidden bg-[#06070c] border border-slate-800/80 rounded-xl shadow-inner" dir="ltr">
            <textarea
              className="w-full flex-1 p-5 bg-transparent text-slate-300 font-mono text-[14px] leading-relaxed whitespace-pre font-medium resize-none focus:outline-none custom-scrollbar"
              spellCheck="false"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              dir="ltr"
            />
            
            {/* Fade Out Edge */}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#1a1c2d] to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-[#0c0d16] flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <PanelButton
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all active:scale-95"
            >
              <Download className="w-4 h-4 text-purple-400" />
              <span>تحميل ملف .py</span>
            </PanelButton>
            <PanelButton
              type="button"
              onClick={handleExecute}
              disabled={isExecuting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 text-xs font-medium border border-emerald-500/30 transition-all active:scale-95"
            >
              <Terminal className="w-4 h-4" />
              <span>{isExecuting ? "جاري التنفيذ..." : "تنفيذ الكود (Execute)"}</span>
            </PanelButton>
          </div>

          <div className="flex items-center gap-2">
            <PanelButton
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium shadow-md shadow-purple-600/30 transition-all active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>تم نسخ الكود!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>نسخ الكود</span>
                </>
              )}
            </PanelButton>
            <PanelButton
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
            >
              إغلاق
            </PanelButton>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
