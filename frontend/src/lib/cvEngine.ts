/**
 * Ultimate Vision Studio - Core Computer Vision & Mathematical Processing Engine
 * High-performance browser-native implementation matching MATLAB and OpenCV specs.
 */

import {
  HistogramData,
  PointProcessConfig,
  SpatialFilterConfig,
  ToneAdjustments,
  SegmentationConfig,
  SegmentItem,
} from "../types";
import { wsClient } from "./wsClient";

// Helper: Clone canvas
export function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = source.width;
  c.height = source.height;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.drawImage(source, 0, 0);
  }
  return c;
}

// Helper: Get ImageData from canvas
export function getImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not obtain 2D canvas context");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Helper: Put ImageData into canvas
export function putImageData(canvas: HTMLCanvasElement, imageData: ImageData) {
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.putImageData(imageData, 0, 0);
  }
}

// Calculate Histogram (R, G, B, Luminance) & Stats
export function calculateHistogram(imageData: ImageData): HistogramData {
  const r = new Array(256).fill(0);
  const g = new Array(256).fill(0);
  const b = new Array(256).fill(0);
  const luminance = new Array(256).fill(0);

  const data = imageData.data;
  const totalPixels = data.length / 4;
  let sumL = 0;
  let minL = 255;
  let maxL = 0;

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const lum = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);

    r[red]++;
    g[green]++;
    b[blue]++;
    luminance[lum]++;

    sumL += lum;
    if (lum < minL) minL = lum;
    if (lum > maxL) maxL = lum;
  }

  const mean = totalPixels > 0 ? sumL / totalPixels : 0;
  let varianceSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    varianceSum += (lum - mean) * (lum - mean);
  }
  const stdDev = totalPixels > 0 ? Math.sqrt(varianceSum / totalPixels) : 0;

  return { r, g, b, luminance, min: minL, max: maxL, mean, stdDev };
}

// Otsu's Thresholding algorithm
export function calculateOtsuThreshold(histogram: number[], totalPixels: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let optimalThreshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    // Between-class variance
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      optimalThreshold = t;
    }
  }

  return optimalThreshold;
}

// High-performance client-side Point Processing (instant 60fps, offline & sub-millisecond)
export function applyPointProcessingClient(
  source: HTMLCanvasElement,
  config: PointProcessConfig
): HTMLCanvasElement {
  const result = document.createElement("canvas");
  result.width = source.width;
  result.height = source.height;
  const ctx = result.getContext("2d", { willReadFrequently: true });
  if (!ctx) return source;

  ctx.drawImage(source, 0, 0);

  if (!config || config.mode === "none") {
    return result;
  }

  const { mode } = config;

  if (mode === "sampling") {
    const factor = Math.max(2, Math.min(128, config.sampleFactor || 8));
    const smallW = Math.max(1, Math.floor(source.width / factor));
    const smallH = Math.max(1, Math.floor(source.height / factor));

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = smallW;
    tempCanvas.height = smallH;
    const tempCtx = tempCanvas.getContext("2d");
    if (tempCtx) {
      tempCtx.drawImage(source, 0, 0, smallW, smallH);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, result.width, result.height);
      ctx.drawImage(tempCanvas, 0, 0, smallW, smallH, 0, 0, result.width, result.height);
      ctx.imageSmoothingEnabled = true;
    }
    return result;
  }

  const imgData = ctx.getImageData(0, 0, result.width, result.height);
  const data = imgData.data;
  const len = data.length;

  if (mode === "negative") {
    for (let i = 0; i < len; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
  } else if (mode === "gamma") {
    const gamma = Math.max(0.01, config.gamma ?? 1.0);
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.min(255, Math.max(0, Math.round(Math.pow(i / 255, gamma) * 255)));
    }
    for (let i = 0; i < len; i += 4) {
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
  } else if (mode === "log") {
    const c = config.logC ?? 45;
    const c_adj = c * (255.0 / Math.log(256.0));
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.min(255, Math.max(0, Math.round((c_adj * Math.log(1 + i)) / 100.0)));
    }
    for (let i = 0; i < len; i += 4) {
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
  } else if (mode === "threshold") {
    const th = config.thresholdValue ?? 128;
    for (let i = 0; i < len; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const val = gray >= th ? 255 : 0;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
  } else if (mode === "otsu") {
    const hist = new Array(256).fill(0);
    const totalPixels = len / 4;
    for (let i = 0; i < len; i += 4) {
      const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      hist[Math.min(255, Math.max(0, g))]++;
    }
    const threshold = calculateOtsuThreshold(hist, totalPixels);
    for (let i = 0; i < len; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const val = gray >= threshold ? 255 : 0;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
  } else if (mode === "hist_eq") {
    const hist = new Int32Array(256);
    const totalPixels = len / 4;
    for (let i = 0; i < len; i += 4) {
      const y = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      hist[Math.min(255, Math.max(0, y))]++;
    }

    const cdf = new Int32Array(256);
    let accum = 0;
    let minCdf = -1;
    for (let i = 0; i < 256; i++) {
      accum += hist[i];
      cdf[i] = accum;
      if (minCdf === -1 && accum > 0) {
        minCdf = accum;
      }
    }

    const lut = new Uint8Array(256);
    const denom = Math.max(1, totalPixels - minCdf);
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.min(255, Math.max(0, Math.round(((cdf[i] - minCdf) / denom) * 255)));
    }

    for (let i = 0; i < len; i += 4) {
      const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const newY = lut[Math.min(255, Math.max(0, Math.round(y)))];
      if (y > 0) {
        const factor = newY / y;
        data[i] = Math.min(255, Math.max(0, Math.round(data[i] * factor)));
        data[i + 1] = Math.min(255, Math.max(0, Math.round(data[i + 1] * factor)));
        data[i + 2] = Math.min(255, Math.max(0, Math.round(data[i + 2] * factor)));
      } else {
        data[i] = newY;
        data[i + 1] = newY;
        data[i + 2] = newY;
      }
    }
  } else if (mode === "bit_plane") {
    const bit = Math.max(0, Math.min(7, config.bitPlaneIndex ?? 7));
    const mask = 1 << bit;
    for (let i = 0; i < len; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      const val = (gray & mask) ? 255 : 0;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
  } else if (mode === "channel_r") {
    for (let i = 0; i < len; i += 4) {
      data[i + 1] = 0; // G
      data[i + 2] = 0; // B
    }
  } else if (mode === "channel_g") {
    for (let i = 0; i < len; i += 4) {
      data[i] = 0;     // R
      data[i + 2] = 0; // B
    }
  } else if (mode === "channel_b") {
    for (let i = 0; i < len; i += 4) {
      data[i] = 0;     // R
      data[i + 1] = 0; // G
    }
  } else if (mode === "channel_gray") {
    for (let i = 0; i < len; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
  } else if (mode === "quantization") {
    const levels = Math.max(2, Math.min(256, config.quantLevels ?? 8));
    const step = 255.0 / (levels - 1);
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.min(255, Math.max(0, Math.round(Math.round(i / step) * step)));
    }
    for (let i = 0; i < len; i += 4) {
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return result;
}

// Apply Point Operations (Synchronous instant execution via client engine)
export async function applyPointProcessing(
  source: HTMLCanvasElement,
  config: PointProcessConfig,
  isPreview: boolean = false
): Promise<HTMLCanvasElement> {
  return applyPointProcessingClient(source, config);
}
// Master Dispatcher for Spatial Filters
export async function applySpatialFilter(
  source: HTMLCanvasElement,
  config: SpatialFilterConfig,
  isPreview: boolean = false
): Promise<HTMLCanvasElement> {
  const MAX_PREVIEW_SIZE = 1200;
  let processSource = source;
  let scale = 1.0;

  if (isPreview && (source.width > MAX_PREVIEW_SIZE || source.height > MAX_PREVIEW_SIZE)) {
    scale = Math.min(MAX_PREVIEW_SIZE / source.width, MAX_PREVIEW_SIZE / source.height);
    processSource = document.createElement("canvas");
    processSource.width = Math.round(source.width * scale);
    processSource.height = Math.round(source.height * scale);
    const ctx = processSource.getContext("2d");
    if (ctx) ctx.drawImage(source, 0, 0, processSource.width, processSource.height);
  }

  // Preserve faithful kernel size and ensure odd dimension >= 3
  let adjustedConfig = { ...config };
  if (adjustedConfig.kernelSize) {
    let k = Math.max(3, Math.round(adjustedConfig.kernelSize));
    if (k % 2 === 0) k += 1;
    adjustedConfig.kernelSize = k;
  }

  const base64 = processSource.toDataURL(isPreview ? "image/jpeg" : "image/png", isPreview ? 0.85 : 1.0);
  
  const payload = await wsClient.request("apply_spatial_filter", {
    imageBase64: base64,
    config: adjustedConfig,
    isPreview,
  }, isPreview ? 10000 : 20000);

  if (payload.error) {
    throw new Error(payload.error);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const res = document.createElement("canvas");
      res.width = source.width;
      res.height = source.height;
      const ctx = res.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0, source.width, source.height);
      resolve(res);
    };
    img.onerror = reject;
    img.src = payload.imageBase64;
  });
}

export async function applyBackgroundRemoval(
  source: HTMLCanvasElement,
  config: {
    mode?: "smart" | "ai_click" | "chroma" | "magic_wand" | "preset_white" | "preset_green" | "preset_black";
    color?: { r: number; g: number; b: number };
    tolerance?: number;
    feather?: number;
    contiguous?: boolean;
    invert?: boolean;
    clickX?: number;
    clickY?: number;
  }
): Promise<HTMLCanvasElement> {
  const base64 = source.toDataURL("image/png");
  
  const payload = await wsClient.request("apply_bg_removal", {
    imageBase64: base64,
    config,
  }, 35000);

  if (payload.error) {
    throw new Error(payload.error || "فشل إزالة الخلفية");
  }

  if (!payload.imageBase64) {
    throw new Error("لم يتم استلام الصورة المفرغة من الخادم");
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const res = document.createElement("canvas");
      res.width = img.naturalWidth || source.width;
      res.height = img.naturalHeight || source.height;
      const ctx = res.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0, res.width, res.height);
      resolve(res);
    };
    img.onerror = () => reject(new Error("فشل تحميل الصورة المفرغة"));
    img.src = payload.imageBase64;
  });
}

export async function removeBackgroundChroma(
  source: HTMLCanvasElement,
  targetColor: { r: number; g: number; b: number },
  tolerance: number,
  startX?: number,
  startY?: number,
  options?: { contiguous?: boolean; feather?: number; invert?: boolean }
): Promise<HTMLCanvasElement> {
  return applyBackgroundRemoval(source, {
    mode: "chroma",
    color: targetColor,
    tolerance,
    clickX: startX,
    clickY: startY,
    ...(options || {}),
  });
}

// Background Removal: Smart AI / Saliency & Alpha Matting
export async function removeBackgroundSmart(
  source: HTMLCanvasElement,
  clickX?: number,
  clickY?: number,
  options?: { feather?: number; invert?: boolean }
): Promise<HTMLCanvasElement> {
  return applyBackgroundRemoval(source, {
    mode: "smart",
    clickX,
    clickY,
    ...(options || {}),
  });
}

// Convert raster image to SVG Vector with path tracing
export async function traceImageToSVG(source: HTMLCanvasElement, numColors = 6): Promise<string> {
  const base64 = source.toDataURL("image/png");
  
  const payload = await wsClient.request("trace_svg", {
    imageBase64: base64,
    config: { numColors },
  }, 20000);

  if (payload.error) {
    throw new Error(payload.error || "فشل تحويل الصورة إلى فكتور");
  }

  return payload.svg || "";
}

/**
 * Apply Tone, Lighting & Color adjustments directly matching modern photo studios
 * (Brightness, Contrast, Exposure, Light Balance, Highlights, Shadows, Saturation)
 */
export async function applyToneLightAdjustments(
  source: HTMLCanvasElement,
  adjustments: ToneAdjustments,
  isPreview: boolean = false
): Promise<HTMLCanvasElement> {
  const MAX_PREVIEW_SIZE = 800;
  let processSource = source;
  let scale = 1.0;

  if (isPreview && (source.width > MAX_PREVIEW_SIZE || source.height > MAX_PREVIEW_SIZE)) {
    scale = Math.min(MAX_PREVIEW_SIZE / source.width, MAX_PREVIEW_SIZE / source.height);
    processSource = document.createElement("canvas");
    processSource.width = source.width * scale;
    processSource.height = source.height * scale;
    const ctx = processSource.getContext("2d");
    if (ctx) ctx.drawImage(source, 0, 0, processSource.width, processSource.height);
  }

  // Use JPEG for faster preview transmission, PNG for final
  const base64 = processSource.toDataURL(isPreview ? "image/jpeg" : "image/png", isPreview ? 0.8 : 1.0);
  
  const payload = await wsClient.request("apply_tone_adjustments", {
    imageBase64: base64,
    config: adjustments,
    isPreview,
  }, isPreview ? 8000 : 15000);

  if (payload.error) {
    throw new Error(payload.error);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const res = document.createElement("canvas");
      res.width = source.width;
      res.height = source.height;
      const ctx = res.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0, source.width, source.height);
      resolve(res);
    };
    img.onerror = reject;
    img.src = payload.imageBase64;
  });
}

// =========================================================
// ADVANCED IMAGE SEGMENTATION ENGINE
// =========================================================

// Color palette for watershed and segment labeling
const SEGMENT_PALETTE = [
  "#a855f7", // Purple
  "#38bdf8", // Sky
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#6366f1", // Indigo
  "#14b8a6", // Teal
  "#f43f5e", // Rose
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
];

// Helper: RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  const toH = (c: number) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0");
  return `#${toH(r)}${toH(g)}${toH(b)}`;
}

export async function applySegmentation(
  source: HTMLCanvasElement,
  config: SegmentationConfig,
  isPreview: boolean = false
): Promise<{ resultCanvas: HTMLCanvasElement; segments: SegmentItem[] }> {
  const MAX_PREVIEW_SIZE = 800;
  let processSource = source;
  let scale = 1.0;

  if (isPreview && (source.width > MAX_PREVIEW_SIZE || source.height > MAX_PREVIEW_SIZE)) {
    scale = Math.min(MAX_PREVIEW_SIZE / source.width, MAX_PREVIEW_SIZE / source.height);
    processSource = document.createElement("canvas");
    processSource.width = source.width * scale;
    processSource.height = source.height * scale;
    const ctx = processSource.getContext("2d");
    if (ctx) ctx.drawImage(source, 0, 0, processSource.width, processSource.height);
  }

  const base64 = processSource.toDataURL(isPreview ? "image/jpeg" : "image/png", isPreview ? 0.85 : 1.0);
  
  const payload = await wsClient.request("apply_segmentation", {
    imageBase64: base64,
    config,
    isPreview,
  }, 20000);

  if (payload.error) {
    throw new Error(payload.error || "Segmentation failed");
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const res = document.createElement("canvas");
      res.width = source.width;
      res.height = source.height;
      const ctx = res.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0, source.width, source.height);
      resolve({ resultCanvas: res, segments: payload.segments || [] });
    };
    img.onerror = (err) => reject(err);
    img.src = payload.imageBase64;
  });
}

/**
 * Applies a filter or transformation ONLY within a polygon selection mask
 */
export function applyFilterToPolygonRegion(
  sourceCanvas: HTMLCanvasElement,
  polygon: Array<{ x: number; y: number }>,
  filteredCanvas: HTMLCanvasElement
): HTMLCanvasElement {
  if (!polygon || polygon.length < 3) return filteredCanvas;

  const result = cloneCanvas(sourceCanvas);
  const ctx = result.getContext("2d");
  if (!ctx) return filteredCanvas;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < polygon.length; i++) {
    ctx.lineTo(polygon[i].x, polygon[i].y);
  }
  ctx.closePath();
  ctx.clip();

  // Draw filtered canvas inside the clipped region
  ctx.drawImage(filteredCanvas, 0, 0);
  ctx.restore();

  return result;
}

/**
 * Magnetic Lasso Helper: Finds the pixel with highest gradient within search radius
 */
export function findMagneticEdgePoint(
  canvas: HTMLCanvasElement,
  cx: number,
  cy: number,
  searchRadius = 8
): { x: number; y: number } {
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { x: cx, y: cy };

    const rx = Math.max(0, Math.floor(cx - searchRadius));
    const ry = Math.max(0, Math.floor(cy - searchRadius));
    const rw = Math.min(canvas.width - rx, searchRadius * 2 + 1);
    const rh = Math.min(canvas.height - ry, searchRadius * 2 + 1);

    if (rw <= 2 || rh <= 2) return { x: cx, y: cy };

    const imgData = ctx.getImageData(rx, ry, rw, rh);
    const d = imgData.data;

    let maxGrad = -1;
    let bestX = cx;
    let bestY = cy;

    for (let y = 1; y < rh - 1; y++) {
      for (let x = 1; x < rw - 1; x++) {
        const idx = (y * rw + x) * 4;
        const rightIdx = (y * rw + (x + 1)) * 4;
        const downIdx = ((y + 1) * rw + x) * 4;

        const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
        const lumR = 0.299 * d[rightIdx] + 0.587 * d[rightIdx + 1] + 0.114 * d[rightIdx + 2];
        const lumD = 0.299 * d[downIdx] + 0.587 * d[downIdx + 1] + 0.114 * d[downIdx + 2];

        const gx = lumR - lum;
        const gy = lumD - lum;
        const grad = gx * gx + gy * gy;

        if (grad > maxGrad) {
          maxGrad = grad;
          bestX = rx + x;
          bestY = ry + y;
        }
      }
    }

    return { x: bestX, y: bestY };
  } catch {
    return { x: cx, y: cy };
  }
}

/**
 * Smart AI Inpainting - Object Removal
 * Sends source image + binary mask to FastAPI OpenCV backend to seamlessly reconstruct background.
 */
export async function applyInpaintBackend(
  source: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  config?: {
    method?: "telea" | "ns";
    radius?: number;
    dilate?: number;
  }
): Promise<HTMLCanvasElement> {
  const imageBase64 = source.toDataURL("image/png");
  const maskBase64 = maskCanvas.toDataURL("image/png");

  const payload = await wsClient.request(
    "apply_inpaint",
    {
      imageBase64,
      maskBase64,
      config: {
        method: config?.method || "telea",
        radius: config?.radius ?? 5,
        dilate: config?.dilate ?? 3,
      },
    },
    30000
  );

  if (payload.error) {
    throw new Error(payload.error || "فشل إزالة العنصر المحدد");
  }

  if (!payload.imageBase64) {
    throw new Error("لم يتم استلام الصورة الناتجة من الخادم");
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const res = document.createElement("canvas");
      res.width = img.naturalWidth || source.width;
      res.height = img.naturalHeight || source.height;
      const ctx = res.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0, res.width, res.height);
      resolve(res);
    };
    img.onerror = () => reject(new Error("فشل تحميل الصورة بعد إزالة العنصر"));
    const srcUrl = payload.imageBase64.startsWith("data:")
      ? payload.imageBase64
      : `data:image/png;base64,${payload.imageBase64}`;
    img.src = srcUrl;
  });
}

