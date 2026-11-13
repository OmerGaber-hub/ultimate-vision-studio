export interface ProductBackdrop {
  id: string;
  name: string;
  category: string;
  generate: (width: number, height: number) => HTMLCanvasElement;
}

export const PRODUCT_BACKDROPS: ProductBackdrop[] = [
  {
    id: "minimal_podium",
    name: "منصة استوديو حجرية بسيطة",
    category: "استوديو احترافي",
    generate: (w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      // Soft modern gradient wall
      const wall = ctx.createLinearGradient(0, 0, 0, h * 0.7);
      wall.addColorStop(0, "#f1f5f9");
      wall.addColorStop(1, "#e2e8f0");
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, w, h * 0.7);

      // Floor
      const floor = ctx.createLinearGradient(0, h * 0.7, 0, h);
      floor.addColorStop(0, "#cbd5e1");
      floor.addColorStop(1, "#94a3b8");
      ctx.fillStyle = floor;
      ctx.fillRect(0, h * 0.7, w, h * 0.3);

      // Stone cylinder podium
      const cx = w / 2;
      const cy = h * 0.74;
      ctx.save();
      // Floor shadow
      ctx.beginPath();
      ctx.ellipse(cx, cy + 50, w * 0.32, 25, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.filter = "blur(14px)";
      ctx.fill();
      ctx.restore();

      // Podium body
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 40, w * 0.28, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - w * 0.28, cy, w * 0.56, 40);

      // Podium top
      const topGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.28);
      topGrad.addColorStop(0, "#ffffff");
      topGrad.addColorStop(1, "#e2e8f0");
      ctx.fillStyle = topGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.28, 28, 0, 0, Math.PI * 2);
      ctx.fill();

      return c;
    },
  },
  {
    id: "cyber_neon",
    name: "شبكة نيون سايبربانك",
    category: "مستقبلي ورقمي",
    generate: (w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      // Dark cyber background
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#05050f");
      bg.addColorStop(0.65, "#150d2a");
      bg.addColorStop(1, "#030208");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Glowing horizon
      ctx.save();
      ctx.strokeStyle = "#a855f7";
      ctx.shadowColor = "#ec4899";
      ctx.shadowBlur = 30;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.65);
      ctx.lineTo(w, h * 0.65);
      ctx.stroke();

      // Perspective floor grid lines
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      const vanishingX = w / 2;
      const vanishingY = h * 0.65;
      for (let i = -10; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(vanishingX, vanishingY);
        ctx.lineTo(vanishingX + i * (w / 8), h);
        ctx.stroke();
      }

      // Horizontal grid lines with increasing spacing
      let y = vanishingY;
      let step = 10;
      while (y < h) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        y += step;
        step *= 1.35;
      }
      ctx.restore();

      return c;
    },
  },
  {
    id: "luxury_marble",
    name: "رخام أسود فاخر مع إطار ذهبي",
    category: "فخامة وأناقة",
    generate: (w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;

      // Deep rich charcoal
      ctx.fillStyle = "#121316";
      ctx.fillRect(0, 0, w, h);

      // Spotlight
      const spot = ctx.createRadialGradient(w / 2, h * 0.4, 40, w / 2, h * 0.4, w * 0.6);
      spot.addColorStop(0, "#252730");
      spot.addColorStop(1, "#0a0a0c");
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, w, h);

      // Gold geometric frame
      ctx.save();
      ctx.strokeStyle = "rgba(234, 179, 8, 0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.15, h * 0.15, w * 0.7, h * 0.7);
      ctx.strokeStyle = "rgba(234, 179, 8, 0.2)";
      ctx.strokeRect(w * 0.18, h * 0.18, w * 0.64, h * 0.64);

      // Hexagonal pedestal
      const cx = w / 2;
      const cy = h * 0.76;
      ctx.fillStyle = "#1e2025";
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.28, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      return c;
    },
  },
  {
    id: "sunset_studio",
    name: "استوديو الغروب والساعة الذهبية",
    category: "إضاءة دافئة",
    generate: (w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;

      // Beautiful warm sunset gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#f97316");
      grad.addColorStop(0.4, "#ec4899");
      grad.addColorStop(0.8, "#8b5cf6");
      grad.addColorStop(1, "#3b82f6");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Soft sun flare
      const sun = ctx.createRadialGradient(w * 0.25, h * 0.25, 20, w * 0.25, h * 0.25, w * 0.5);
      sun.addColorStop(0, "rgba(255, 255, 255, 0.45)");
      sun.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, w, h);

      return c;
    },
  },
  {
    id: "dark_spotlight",
    name: "بقعة ضوء الأوبسيديان العميقة",
    category: "بسيط وداكن",
    generate: (w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;

      ctx.fillStyle = "#030305";
      ctx.fillRect(0, 0, w, h);

      // Sharp top-down cone spotlight
      const spot = ctx.createRadialGradient(w / 2, h * 0.48, 20, w / 2, h * 0.48, w * 0.48);
      spot.addColorStop(0, "rgba(139, 92, 246, 0.28)");
      spot.addColorStop(0.5, "rgba(56, 189, 248, 0.12)");
      spot.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, w, h);

      return c;
    },
  },
];
