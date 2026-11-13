import { GradientConfig } from "../types";
import { createCanvasGradient } from "./gradientEngine";

export interface TextRenderConfig {
  text: string;
  fontSize: number;
  color: string;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
  gradient?: GradientConfig;
}

export const AVAILABLE_FONTS = [
  { id: "'Cairo', sans-serif", label: "كايرو (Cairo)", category: "arabic" },
  { id: "'Tajawal', sans-serif", label: "تجوال (Tajawal)", category: "arabic" },
  { id: "'Amiri', serif", label: "أميري كلاسيك (Amiri)", category: "arabic" },
  { id: "'Outfit', sans-serif", label: "Outfit (عصري)", category: "latin" },
  { id: "'Inter', sans-serif", label: "Inter (واضح)", category: "latin" },
  { id: "sans-serif", label: "Sans Serif افتراضي", category: "generic" },
];

export function renderTextToCanvas(config: TextRenderConfig): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
} {
  const {
    text = "نص جديد",
    fontSize = 36,
    color = "#ffffff",
    fontFamily = "'Cairo', 'Tajawal', 'Outfit', sans-serif",
    fontWeight = "bold",
    textAlign = "center",
  } = config;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    canvas.width = 120;
    canvas.height = 50;
    return { canvas, width: 120, height: 50 };
  }

  const rawLines = text.split("\n");
  const lines = rawLines.length === 0 ? [" "] : rawLines;

  // Measure text dimensions
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  let maxLineWidth = 20;
  for (const line of lines) {
    const textSample = line.length === 0 ? " " : line;
    const metrics = ctx.measureText(textSample);
    const w = metrics.actualBoundingBoxRight
      ? metrics.actualBoundingBoxRight + (metrics.actualBoundingBoxLeft || 0)
      : metrics.width;
    if (w > maxLineWidth) maxLineWidth = w;
  }

  const lineHeight = Math.round(fontSize * 1.35);
  const paddingX = Math.max(12, Math.round(fontSize * 0.4));
  const paddingY = Math.max(8, Math.round(fontSize * 0.25));

  const totalWidth = Math.max(50, Math.ceil(maxLineWidth + paddingX * 2));
  const totalHeight = Math.max(Math.ceil(fontSize * 1.4), Math.ceil(lines.length * lineHeight + paddingY * 2));

  canvas.width = totalWidth;
  canvas.height = totalHeight;

  // Re-apply context font and styling after canvas dimensions change
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  if (config.gradient && config.gradient.enabled) {
    ctx.fillStyle = createCanvasGradient(ctx, config.gradient, 0, 0, totalWidth, totalHeight);
  } else {
    ctx.fillStyle = color;
  }
  ctx.textAlign = textAlign;
  ctx.textBaseline = "middle";

  lines.forEach((line, index) => {
    const y = paddingY + (index + 0.5) * lineHeight;
    let x = totalWidth / 2;
    if (textAlign === "left") {
      x = paddingX;
    } else if (textAlign === "right") {
      x = totalWidth - paddingX;
    }
    ctx.fillText(line, x, y);
  });

  return { canvas, width: totalWidth, height: totalHeight };
}
