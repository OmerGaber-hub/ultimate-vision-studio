import { ShapeConfig, ShapeType } from "../types";
import { createCanvasGradient } from "./gradientEngine";

export interface ShapeRenderResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export const AVAILABLE_SHAPES: Array<{
  id: ShapeType;
  label: string;
  iconName: string;
  defaultWidth: number;
  defaultHeight: number;
}> = [
  { id: "rectangle", label: "مستطيل", iconName: "Square", defaultWidth: 200, defaultHeight: 140 },
  { id: "rounded_rect", label: "مستطيل دائري", iconName: "RectangleHorizontal", defaultWidth: 200, defaultHeight: 140 },
  { id: "circle", label: "دائرة", iconName: "Circle", defaultWidth: 160, defaultHeight: 160 },
  { id: "ellipse", label: "شكل بيضاوي", iconName: "Egg", defaultWidth: 220, defaultHeight: 140 },
  { id: "triangle", label: "مثلث", iconName: "Triangle", defaultWidth: 180, defaultHeight: 160 },
  { id: "star", label: "نجمة", iconName: "Star", defaultWidth: 180, defaultHeight: 180 },
  { id: "polygon", label: "مضلع خماسي", iconName: "Hexagon", defaultWidth: 180, defaultHeight: 180 },
  { id: "arrow", label: "سهم توجيهي", iconName: "ArrowRight", defaultWidth: 220, defaultHeight: 80 },
  { id: "line", label: "خط مستقيم", iconName: "Minus", defaultWidth: 220, defaultHeight: 40 },
];

export const SHAPE_COLOR_PRESETS = [
  "#8b5cf6", // Purple
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#eab308", // Yellow
  "#f97316", // Orange
  "#ef4444", // Red
  "#ec4899", // Pink
  "#ffffff", // White
  "#0f172a", // Dark Slate
];

/**
 * Renders any geometric shape onto a pristine, high-DPI canvas buffer.
 * Accurately calculates stroke padding so anti-aliased borders are never clipped.
 */
export function renderShapeToCanvas(
  config: ShapeConfig,
  targetWidth: number = 200,
  targetHeight: number = 150
): ShapeRenderResult {
  const w = Math.max(10, Math.round(targetWidth));
  const h = Math.max(10, Math.round(targetHeight));
  const strokeW = Math.max(0, config.strokeWidth || 0);
  const padding = Math.ceil(strokeW / 2) + 4;

  const totalWidth = w + padding * 2;
  const totalHeight = h + padding * 2;

  const canvas = document.createElement("canvas");
  canvas.width = totalWidth;
  canvas.height = totalHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { canvas, width: totalWidth, height: totalHeight };

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.save();

  // Apply stroke styling
  const hasStroke = strokeW > 0 && config.strokeColor && config.strokeColor !== "transparent";
  const hasFill = config.fillColor && config.fillColor !== "transparent";

  if (hasStroke) {
    ctx.strokeStyle = config.strokeColor;
    ctx.lineWidth = strokeW;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (config.strokeDash === "dashed") {
      ctx.setLineDash([Math.max(6, strokeW * 3), Math.max(4, strokeW * 2)]);
    } else if (config.strokeDash === "dotted") {
      ctx.setLineDash([Math.max(2, strokeW), Math.max(4, strokeW * 1.5)]);
    } else {
      ctx.setLineDash([]);
    }
  }

  // Draw paths centered within padded boundaries
  const left = padding;
  const top = padding;
  const right = left + w;
  const bottom = top + h;
  const centerX = left + w / 2;
  const centerY = top + h / 2;

  if (hasFill) {
    if (config.gradient && config.gradient.enabled) {
      ctx.fillStyle = createCanvasGradient(ctx, config.gradient, left, top, w, h);
    } else {
      ctx.fillStyle = config.fillColor;
    }
  }

  ctx.beginPath();

  switch (config.type) {
    case "rectangle": {
      ctx.rect(left, top, w, h);
      break;
    }

    case "rounded_rect": {
      const radius = Math.min(
        Math.max(4, config.cornerRadius ?? 20),
        Math.min(w / 2, h / 2)
      );
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(left, top, w, h, radius);
      } else {
        // Fallback arcTo implementation
        ctx.moveTo(left + radius, top);
        ctx.lineTo(right - radius, top);
        ctx.arcTo(right, top, right, top + radius, radius);
        ctx.lineTo(right, bottom - radius);
        ctx.arcTo(right, bottom, right - radius, bottom, radius);
        ctx.lineTo(left + radius, bottom);
        ctx.arcTo(left, bottom, left, bottom - radius, radius);
        ctx.lineTo(left, top + radius);
        ctx.arcTo(left, top, left + radius, top, radius);
      }
      break;
    }

    case "circle": {
      const radius = Math.min(w, h) / 2;
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      break;
    }

    case "ellipse": {
      ctx.ellipse(centerX, centerY, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    }

    case "triangle": {
      ctx.moveTo(centerX, top);
      ctx.lineTo(right, bottom);
      ctx.lineTo(left, bottom);
      ctx.closePath();
      break;
    }

    case "star": {
      const points = Math.max(3, config.starPoints || 5);
      const outerRadius = Math.min(w, h) / 2;
      const innerRadius = outerRadius * 0.45;
      const step = Math.PI / points;

      let angle = -Math.PI / 2;
      ctx.moveTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius);

      for (let i = 0; i < points; i++) {
        angle += step;
        ctx.lineTo(centerX + Math.cos(angle) * innerRadius, centerY + Math.sin(angle) * innerRadius);
        angle += step;
        ctx.lineTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius);
      }
      ctx.closePath();
      break;
    }

    case "polygon": {
      const sides = Math.max(3, config.starPoints || 5);
      const radius = Math.min(w, h) / 2;
      const step = (Math.PI * 2) / sides;
      const startAngle = -Math.PI / 2;

      ctx.moveTo(centerX + Math.cos(startAngle) * radius, centerY + Math.sin(startAngle) * radius);
      for (let i = 1; i <= sides; i++) {
        const a = startAngle + i * step;
        ctx.lineTo(centerX + Math.cos(a) * radius, centerY + Math.sin(a) * radius);
      }
      ctx.closePath();
      break;
    }

    case "line": {
      ctx.moveTo(left, centerY);
      ctx.lineTo(right, centerY);
      break;
    }

    case "arrow": {
      const arrowHeadSize = Math.max(12, Math.min(28, strokeW * 2.5 + 14));
      const shaftY = centerY;
      const arrowTipX = right;

      // Arrow line shaft
      ctx.moveTo(left, shaftY);
      ctx.lineTo(arrowTipX - arrowHeadSize * 0.8, shaftY);

      // Arrow head (filled triangle at end)
      ctx.moveTo(arrowTipX, shaftY);
      ctx.lineTo(arrowTipX - arrowHeadSize, shaftY - arrowHeadSize * 0.55);
      ctx.lineTo(arrowTipX - arrowHeadSize * 0.7, shaftY);
      ctx.lineTo(arrowTipX - arrowHeadSize, shaftY + arrowHeadSize * 0.55);
      ctx.closePath();
      break;
    }

    default:
      ctx.rect(left, top, w, h);
  }

  if (hasFill && config.type !== "line") {
    ctx.fill();
  }

  if (hasStroke) {
    ctx.stroke();
  }

  ctx.restore();

  return { canvas, width: totalWidth, height: totalHeight };
}
