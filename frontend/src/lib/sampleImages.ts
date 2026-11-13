/**
 * High-definition programmatic sample generators for immediate testing
 * Includes product mockup, portrait, OCR document (English & Arabic), and CV calibration chart.
 */

export interface SampleImageMeta {
  id: string;
  title: string;
  category: string;
  description: string;
  generator: (width?: number, height?: number) => HTMLCanvasElement;
}

export function createProductMockup(w = 800, h = 800): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Smooth studio background with radial spotlight
  const bgGrad = ctx.createRadialGradient(w / 2, h / 2 - 50, 50, w / 2, h / 2, w * 0.65);
  bgGrad.addColorStop(0, "#2a2d42");
  bgGrad.addColorStop(0.5, "#161826");
  bgGrad.addColorStop(1, "#0d0e17");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Soft floor shadow
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.76, w * 0.3, 30, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.filter = "blur(20px)";
  ctx.fill();
  ctx.restore();

  // Ceramic cylindrical podium
  ctx.save();
  const podiumTopY = h * 0.68;
  const podiumGrad = ctx.createLinearGradient(w * 0.25, podiumTopY, w * 0.75, podiumTopY + 80);
  podiumGrad.addColorStop(0, "#e2e8f0");
  podiumGrad.addColorStop(0.5, "#cbd5e1");
  podiumGrad.addColorStop(1, "#94a3b8");

  // Podium base
  ctx.fillStyle = podiumGrad;
  ctx.beginPath();
  ctx.ellipse(w / 2, podiumTopY + 50, w * 0.26, 35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(w * 0.24, podiumTopY, w * 0.52, 50);

  // Podium surface
  const surfaceGrad = ctx.createRadialGradient(w / 2, podiumTopY, 10, w / 2, podiumTopY, w * 0.26);
  surfaceGrad.addColorStop(0, "#ffffff");
  surfaceGrad.addColorStop(0.7, "#e2e8f0");
  surfaceGrad.addColorStop(1, "#94a3b8");
  ctx.fillStyle = surfaceGrad;
  ctx.beginPath();
  ctx.ellipse(w / 2, podiumTopY, w * 0.26, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Smart Watch Body
  const cx = w / 2;
  const cy = h * 0.44;

  // Watch Strap
  ctx.save();
  const strapGrad = ctx.createLinearGradient(cx - 50, 0, cx + 50, 0);
  strapGrad.addColorStop(0, "#475569");
  strapGrad.addColorStop(0.5, "#64748b");
  strapGrad.addColorStop(1, "#334155");
  ctx.fillStyle = strapGrad;
  // Top strap
  ctx.fillRect(cx - 45, cy - 220, 90, 150);
  // Bottom strap
  ctx.fillRect(cx - 45, cy + 80, 90, 160);
  ctx.restore();

  // Watch Case (Titanium / Obsidian)
  ctx.save();
  const caseGrad = ctx.createLinearGradient(cx - 100, cy - 100, cx + 100, cy + 100);
  caseGrad.addColorStop(0, "#38bdf8");
  caseGrad.addColorStop(0.3, "#1e293b");
  caseGrad.addColorStop(0.8, "#0f172a");
  caseGrad.addColorStop(1, "#a855f7");

  ctx.strokeStyle = caseGrad;
  ctx.lineWidth = 14;
  ctx.fillStyle = "#020617";

  ctx.beginPath();
  ctx.roundRect(cx - 95, cy - 105, 190, 210, [40]);
  ctx.fill();
  ctx.stroke();

  // Screen display
  const screenGrad = ctx.createLinearGradient(cx - 80, cy - 90, cx + 80, cy + 90);
  screenGrad.addColorStop(0, "#090d16");
  screenGrad.addColorStop(1, "#180e29");
  ctx.fillStyle = screenGrad;
  ctx.beginPath();
  ctx.roundRect(cx - 80, cy - 90, 160, 180, [30]);
  ctx.fill();

  // Digital Screen UI
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 34px 'Fira Code', monospace";
  ctx.textAlign = "center";
  ctx.fillText("10:42", cx, cy - 15);

  ctx.fillStyle = "#a855f7";
  ctx.font = "600 14px 'Outfit', sans-serif";
  ctx.fillText("HEART RATE 74 BPM", cx, cy + 20);

  // Health activity ring
  ctx.beginPath();
  ctx.arc(cx, cy + 48, 22, 0, Math.PI * 1.6);
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.restore();
  return canvas;
}

export function createOcrDocument(w = 800, h = 800): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Paper background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, w, h);

  // Subtle paper texture / margins
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.1)";
  ctx.shadowBlur = 15;
  ctx.fillRect(40, 40, w - 80, h - 80);
  ctx.shadowBlur = 0;

  // Header banner
  ctx.fillStyle = "#7c3aed";
  ctx.fillRect(70, 70, w - 140, 6);

  // Title in English & Arabic
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 28px 'Outfit', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("COMPUTER VISION REPORT 2026", 70, 115);

  ctx.fillStyle = "#6b21a8";
  ctx.font = "bold 24px 'Outfit', sans-serif";
  ctx.fillText("استوديو الرؤية ومعالجة الصور المتقدم", 70, 155);

  // Paragraph text
  ctx.fillStyle = "#334155";
  ctx.font = "16px 'Outfit', sans-serif";
  ctx.fillText("Image processing transforms spatial domain signals into feature maps.", 70, 205);
  ctx.fillText("Using discrete convolution kernels for Gaussian smoothing and Sobel edges.", 70, 235);
  ctx.fillText("Canny edge detection applies non-maximum suppression with hysteresis.", 70, 265);

  // Arabic paragraph
  ctx.font = "18px 'Outfit', sans-serif";
  ctx.fillText("تعتمد معالجة الصور الرقمية على التحويلات الهندسية ومصفوفات الالتفاف.", 70, 310);
  ctx.fillText("التعرف البصري على الحروف (OCR) يستخرج النصوص ويحولها إلى طبقات رقمية.", 70, 345);

  // Math Formula Box
  ctx.fillStyle = "#f1f5f9";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(70, 385, w - 140, 120, [8]);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#1e293b";
  ctx.font = "600 16px 'Fira Code', monospace";
  ctx.fillText("Gaussian 2D Kernel Formula:", 90, 420);
  ctx.fillStyle = "#7c3aed";
  ctx.font = "15px 'Fira Code', monospace";
  ctx.fillText("G(x, y) = (1 / 2πσ²) * exp(-(x² + y²) / 2σ²)", 90, 455);
  ctx.fillStyle = "#0284c7";
  ctx.fillText("Sobel Gradient: Magnitude = √(Gx² + Gy²), θ = atan2(Gy, Gx)", 90, 485);

  // Table
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 16px 'Outfit', sans-serif";
  ctx.fillText("BENCHMARK METRICS", 70, 550);

  const tableY = 570;
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(70, tableY, w - 140, 32);

  ctx.fillStyle = "#1e293b";
  ctx.font = "600 14px 'Outfit', sans-serif";
  ctx.fillText("ALGORITHM", 85, tableY + 22);
  ctx.fillText("KERNEL SIZE", 280, tableY + 22);
  ctx.fillText("LATENCY (ms)", 450, tableY + 22);
  ctx.fillText("STATUS", 620, tableY + 22);

  const rows = [
    ["Gaussian Blur 2D", "5x5 (σ=1.4)", "1.8 ms", "PASSED"],
    ["Canny Hysteresis", "Separable", "3.2 ms", "PASSED"],
    ["Otsu Binarization", "256 Bins", "0.4 ms", "OPTIMAL"],
  ];

  rows.forEach((row, idx) => {
    const ry = tableY + 36 + idx * 30;
    ctx.fillStyle = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
    ctx.fillRect(70, ry - 4, w - 140, 28);
    ctx.fillStyle = "#334155";
    ctx.font = "14px 'Fira Code', monospace";
    ctx.fillText(row[0], 85, ry + 16);
    ctx.fillText(row[1], 280, ry + 16);
    ctx.fillText(row[2], 450, ry + 16);
    ctx.fillStyle = "#16a34a";
    ctx.fillText(row[3], 620, ry + 16);
  });

  return canvas;
}

export function createCyberPortrait(w = 800, h = 800): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Dark atmospheric background with dual neon rim light
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#0a0a14");
  bg.addColorStop(0.5, "#121124");
  bg.addColorStop(1, "#08070d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h * 0.48;

  // Neon halo glow behind
  const halo = ctx.createRadialGradient(cx, cy - 20, 40, cx, cy, 320);
  halo.addColorStop(0, "rgba(168, 85, 247, 0.4)");
  halo.addColorStop(0.6, "rgba(56, 189, 248, 0.15)");
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  // Shoulders & Body Silhouette
  ctx.save();
  ctx.fillStyle = "#1e1b2e";
  ctx.beginPath();
  ctx.ellipse(cx, h * 0.88, w * 0.38, h * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Neck
  ctx.fillStyle = "#3d2d48";
  ctx.fillRect(cx - 45, cy + 80, 90, 100);

  // Head Silhouette
  ctx.fillStyle = "#4a3556";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 110, 145, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cyber Visor / Glasses with Neon reflection
  const visorGrad = ctx.createLinearGradient(cx - 95, cy - 20, cx + 95, cy + 20);
  visorGrad.addColorStop(0, "#38bdf8");
  visorGrad.addColorStop(0.5, "#a855f7");
  visorGrad.addColorStop(1, "#ec4899");

  ctx.fillStyle = visorGrad;
  ctx.shadowColor = "#a855f7";
  ctx.shadowBlur = 25;
  ctx.beginPath();
  ctx.roundRect(cx - 95, cy - 28, 190, 44, [14]);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Neon rim light on cheek and jaw (Cyan left, Magenta right)
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx - 100, cy + 40, 60, Math.PI * 0.5, Math.PI * 1.1);
  ctx.stroke();

  ctx.strokeStyle = "#f43f5e";
  ctx.beginPath();
  ctx.arc(cx + 100, cy + 40, 60, -Math.PI * 0.1, Math.PI * 0.5);
  ctx.stroke();

  ctx.restore();
  return canvas;
}

export function createCVCalibrationChart(w = 800, h = 800): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(0, 0, w, h);

  // Center Siemens Star / Radial Frequency Bars (ideal for testing spatial filters!)
  const cx = w / 2;
  const cy = h / 2;
  const numSpokes = 36;
  const maxR = 180;

  ctx.fillStyle = "#0f172a";
  for (let i = 0; i < numSpokes; i++) {
    const angle1 = (i * 2 * Math.PI) / numSpokes;
    const angle2 = ((i + 0.5) * 2 * Math.PI) / numSpokes;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, angle1, angle2);
    ctx.closePath();
    ctx.fill();
  }

  // Frequency line gratings (horizontal & vertical)
  const drawGrating = (x: number, y: number, isVert: boolean) => {
    const barWidths = [16, 12, 8, 5, 3, 2, 1];
    let offset = 0;
    for (const bw of barWidths) {
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k % 2 === 0 ? "#000000" : "#ffffff";
        if (isVert) {
          ctx.fillRect(x + offset, y, bw, 80);
        } else {
          ctx.fillRect(x, y + offset, 80, bw);
        }
        offset += bw;
      }
    }
  };

  drawGrating(60, 60, true);
  drawGrating(w - 200, 60, false);
  drawGrating(60, h - 160, false);
  drawGrating(w - 200, h - 160, true);

  // 8-Level Grayscale Ramp
  const rampY = h - 60;
  for (let i = 0; i < 8; i++) {
    const val = Math.round((i / 7) * 255);
    ctx.fillStyle = `rgb(${val},${val},${val})`;
    ctx.fillRect(160 + i * 60, rampY, 60, 40);
  }

  // Standard color blocks
  const colors = ["#ef4444", "#22c55e", "#3b82f6", "#eab308", "#a855f7", "#06b6d4"];
  colors.forEach((col, idx) => {
    ctx.fillStyle = col;
    ctx.fillRect(160 + idx * 80, 20, 70, 30);
  });

  return canvas;
}

export const SAMPLE_IMAGES: SampleImageMeta[] = [
  {
    id: "product",
    title: "استوديو الساعة الذكية",
    category: "تصوير المنتجات",
    description: "منتج فوتوغرافي عالي التباين على منصة سيراميك مع ظلال واقعية وتفاصيل معدنية.",
    generator: createProductMockup,
  },
  {
    id: "ocr_doc",
    title: "وثيقة OCR ثنائية اللغة",
    category: "نصوص ومستندات",
    description: "وثيقة عالية الدقة تحتوي على نصوص عربية وإنجليزية ومعادلات رياضية وجداول اختبارية.",
    generator: createOcrDocument,
  },
  {
    id: "portrait",
    title: "بورتريه الرؤية السايبرانية",
    category: "أشخاص وبورتريه",
    description: "شخصية سايبربانك مع إضاءات نيون جانبية ودرجات ألوان بشرة فائقة النقاء.",
    generator: createCyberPortrait,
  },
  {
    id: "calibration",
    title: "مخطط معايرة الرؤية الحاسوبية",
    category: "معيار بصري هندسي",
    description: "نجمة سيمنز، وشبكات ترددية، ومدرج تدرج رمادي لاختبار دقة المرشحات الرياضية.",
    generator: createCVCalibrationChart,
  },
];
