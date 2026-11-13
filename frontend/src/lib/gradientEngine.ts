import { GradientConfig } from "../types";

export interface GradientPreset {
  id: string;
  nameAr: string;
  nameEn: string;
  config: GradientConfig;
}

export const DEFAULT_GRADIENT_CONFIG: GradientConfig = {
  enabled: true,
  type: "linear",
  angle: 135,
  stops: [
    { offset: 0, color: "#8b5cf6" },
    { offset: 0.5, color: "#ec4899" },
    { offset: 1, color: "#f97316" },
  ],
};

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: "sunset",
    nameAr: "غروب دافئ",
    nameEn: "Sunset Glow",
    config: {
      enabled: true,
      type: "linear",
      angle: 135,
      stops: [
        { offset: 0, color: "#f97316" },
        { offset: 0.5, color: "#ec4899" },
        { offset: 1, color: "#8b5cf6" },
      ],
    },
  },
  {
    id: "cyberpunk",
    nameAr: "سايبربانك نيون",
    nameEn: "Cyberpunk Glow",
    config: {
      enabled: true,
      type: "linear",
      angle: 90,
      stops: [
        { offset: 0, color: "#06b6d4" },
        { offset: 0.5, color: "#3b82f6" },
        { offset: 1, color: "#ec4899" },
      ],
    },
  },
  {
    id: "aurora",
    nameAr: "أورورا قطبية",
    nameEn: "Aurora Borealis",
    config: {
      enabled: true,
      type: "linear",
      angle: 45,
      stops: [
        { offset: 0, color: "#10b981" },
        { offset: 0.5, color: "#06b6d4" },
        { offset: 1, color: "#6366f1" },
      ],
    },
  },
  {
    id: "royal_violet",
    nameAr: "أرجواني ملكي",
    nameEn: "Royal Violet",
    config: {
      enabled: true,
      type: "linear",
      angle: 160,
      stops: [
        { offset: 0, color: "#c084fc" },
        { offset: 0.5, color: "#8b5cf6" },
        { offset: 1, color: "#1e1b4b" },
      ],
    },
  },
  {
    id: "fiery_ember",
    nameAr: "لهب مشتعل",
    nameEn: "Fiery Ember",
    config: {
      enabled: true,
      type: "linear",
      angle: 45,
      stops: [
        { offset: 0, color: "#ef4444" },
        { offset: 0.5, color: "#f97316" },
        { offset: 1, color: "#eab308" },
      ],
    },
  },
  {
    id: "ocean_deep",
    nameAr: "أوشن ديب",
    nameEn: "Oceanic Depth",
    config: {
      enabled: true,
      type: "linear",
      angle: 180,
      stops: [
        { offset: 0, color: "#38bdf8" },
        { offset: 0.5, color: "#0284c7" },
        { offset: 1, color: "#0f172a" },
      ],
    },
  },
  {
    id: "emerald_jade",
    nameAr: "زمرد فخم",
    nameEn: "Emerald Jade",
    config: {
      enabled: true,
      type: "linear",
      angle: 120,
      stops: [
        { offset: 0, color: "#34d399" },
        { offset: 0.5, color: "#10b981" },
        { offset: 1, color: "#064e3b" },
      ],
    },
  },
  {
    id: "liquid_gold",
    nameAr: "ذهب سائل",
    nameEn: "Liquid Gold",
    config: {
      enabled: true,
      type: "linear",
      angle: 45,
      stops: [
        { offset: 0, color: "#fef08a" },
        { offset: 0.5, color: "#f59e0b" },
        { offset: 1, color: "#b45309" },
      ],
    },
  },
  {
    id: "dreamy_pastel",
    nameAr: "باستيل حالم",
    nameEn: "Dreamy Pastel",
    config: {
      enabled: true,
      type: "linear",
      angle: 135,
      stops: [
        { offset: 0, color: "#fbcfe8" },
        { offset: 0.5, color: "#c7d2fe" },
        { offset: 1, color: "#bae6fd" },
      ],
    },
  },
  {
    id: "dark_obsidian",
    nameAr: "فحم معدني",
    nameEn: "Dark Obsidian",
    config: {
      enabled: true,
      type: "linear",
      angle: 180,
      stops: [
        { offset: 0, color: "#475569" },
        { offset: 0.5, color: "#1e293b" },
        { offset: 1, color: "#020617" },
      ],
    },
  },
  {
    id: "radial_spot",
    nameAr: "هالة إضاءة دائرية",
    nameEn: "Radial Spotlight",
    config: {
      enabled: true,
      type: "radial",
      angle: 0,
      stops: [
        { offset: 0, color: "#a855f7" },
        { offset: 0.6, color: "#3b82f6" },
        { offset: 1, color: "#0c0d16" },
      ],
    },
  },
  {
    id: "rose_twilight",
    nameAr: "شفق وردي",
    nameEn: "Rose Twilight",
    config: {
      enabled: true,
      type: "linear",
      angle: 60,
      stops: [
        { offset: 0, color: "#fda4af" },
        { offset: 0.5, color: "#e879f9" },
        { offset: 1, color: "#6366f1" },
      ],
    },
  },
];

/**
 * Creates a native CanvasGradient based on the GradientConfig and the bounding rectangle.
 */
export function createCanvasGradient(
  ctx: CanvasRenderingContext2D,
  config: GradientConfig,
  x: number,
  y: number,
  width: number,
  height: number
): CanvasGradient {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const stops = config.stops && config.stops.length >= 2
    ? config.stops
    : [
        { offset: 0, color: "#8b5cf6" },
        { offset: 1, color: "#3b82f6" },
      ];

  if (config.type === "radial") {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const radius = Math.max(w, h) / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    for (const stop of stops) {
      const offset = Math.max(0, Math.min(1, stop.offset));
      grad.addColorStop(offset, stop.color);
    }
    return grad;
  }

  // Linear gradient: Calculate angle vector (CSS standard: 0deg = Up, 90deg = Right, 180deg = Down, 270deg = Left)
  const angleDeg = (config.angle ?? 135) % 360;
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const halfLen = Math.hypot(w, h) / 2;

  const x0 = cx - Math.cos(angleRad) * halfLen;
  const y0 = cy - Math.sin(angleRad) * halfLen;
  const x1 = cx + Math.cos(angleRad) * halfLen;
  const y1 = cy + Math.sin(angleRad) * halfLen;

  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const stop of stops) {
    const offset = Math.max(0, Math.min(1, stop.offset));
    grad.addColorStop(offset, stop.color);
  }
  return grad;
}

/**
 * Renders a full pristine Canvas containing the specified gradient.
 */
export function renderGradientToCanvas(
  config: GradientConfig,
  width: number = 800,
  height: number = 600
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const w = Math.max(10, Math.round(width));
  const h = Math.max(10, Math.round(height));
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  const grad = createCanvasGradient(ctx, config, 0, 0, w, h);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  return canvas;
}

/**
 * Generates a CSS gradient string for live preview thumbnails and UI chips.
 */
export function getGradientCSS(config: GradientConfig): string {
  const stops = config.stops && config.stops.length >= 2
    ? config.stops
    : [
        { offset: 0, color: "#8b5cf6" },
        { offset: 1, color: "#3b82f6" },
      ];

  const stopStr = stops
    .slice()
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
    .join(", ");

  if (config.type === "radial") {
    return `radial-gradient(circle at center, ${stopStr})`;
  }

  const angle = config.angle ?? 135;
  return `linear-gradient(${angle}deg, ${stopStr})`;
}
