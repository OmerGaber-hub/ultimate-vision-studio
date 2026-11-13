export type ToolType =
  | "select"
  | "transform"
  | "crop"
  | "lasso"
  | "shape"
  | "point"
  | "spatial"
  | "ai"
  | "segmentation"
  | "ocr"
  | "object_detection"
  | "enhance"
  | "bg_remove"
  | "draw"
  | "eraser"
  | "text"
  | "backdrop"
  | "vectorize";

export type ShapeType =
  | "rectangle"
  | "rounded_rect"
  | "circle"
  | "ellipse"
  | "triangle"
  | "star"
  | "line"
  | "arrow"
  | "polygon";

export interface GradientColorStop {
  offset: number; // 0 to 1
  color: string; // hex or rgba
}

export interface GradientConfig {
  enabled: boolean;
  type: "linear" | "radial";
  angle: number; // in degrees (0 to 360)
  stops: GradientColorStop[];
}

export interface ShapeConfig {
  type: ShapeType;
  fillColor: string; // hex color or "transparent"
  strokeColor: string; // hex color or "transparent"
  strokeWidth: number; // in pixels
  strokeDash?: "solid" | "dashed" | "dotted";
  cornerRadius?: number; // for rounded_rect / rectangle
  starPoints?: number; // for star (e.g. 5)
  arrowEnd?: boolean; // for arrow
  gradient?: GradientConfig;
}

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "difference"
  | "exclusion";

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ToneAdjustments {
  brightness: number; // -100 to 100, default 0
  contrast: number; // -100 to 100, default 0
  exposure: number; // -100 to 100, default 0
  lightBalance: number; // -100 to 100, default 0
  highlights: number; // -100 to 100, default 0
  shadows: number; // -100 to 100, default 0
  saturation: number; // -100 to 100, default 0
}

export interface Layer {
  id: string;
  name: string;
  type: "image" | "text" | "drawing" | "backdrop" | "raster" | "adjustment" | "shape" | "gradient";
  visible: boolean;
  locked: boolean;
  opacity: number; // 0 to 1
  blendMode: BlendMode;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  scaleX: number;
  scaleY: number;
  flipX: boolean;
  flipY: boolean;
  canvas: HTMLCanvasElement;
  textConfig?: {
    text: string;
    fontSize: number;
    color: string;
    fontFamily: string;
    fontWeight: string;
    textAlign?: "left" | "center" | "right";
    gradient?: GradientConfig;
  };
  shapeConfig?: ShapeConfig;
  gradientConfig?: GradientConfig;
}

export type FilterCategory = "smoothing" | "edges" | "morphology" | "artistic";

export type SpatialFilterType =
  // Smoothing & Noise
  | "gaussian"
  | "mean"
  | "median"
  | "bilateral"
  | "kuwahara"
  | "min_filter"
  | "max_filter"
  | "midpoint"
  | "harmonic"
  | "alpha_trimmed"
  | "motion_blur"
  | "zoom_blur"
  // Edge Detection & Sharpening
  | "sharpen"
  | "edge_enhance"
  | "canny"
  | "sobel"
  | "prewitt"
  | "scharr"
  | "roberts"
  | "laplacian"
  | "log"
  | "robinson"
  | "kirsch"
  | "unsharp"
  | "highboost"
  | "highpass"
  | "emboss"
  // Morphology
  | "dilation"
  | "erosion"
  | "opening"
  | "closing"
  | "morph_gradient"
  | "tophat"
  | "blackhat"
  // Artistic & Photographic
  | "sepia"
  | "vignette"
  | "film_noir"
  | "thermal"
  | "cyberpunk"
  | "sketch"
  | "glitch"
  | "duotone"
  | "cartoon";

export interface SpatialFilterConfig {
  type: SpatialFilterType;
  category?: FilterCategory;
  kernelSize: number; // 3, 5, 7, 9, 11, 15
  sigma: number; // for Gaussian / LoG / Canny (0.5 to 10.0)
  sigmaColor?: number; // for Bilateral filter (10 to 150)
  unsharpAmount: number; // for unsharp mask (0.5 to 5.0)
  unsharpRadius: number; // 1 to 10
  boostFactor: number; // for High-Boost (1.0 to 3.5)
  edgeThreshold: number; // for Sobel / Prewitt / Scharr / Roberts (0 to 255)
  cannyLow: number; // for Canny low threshold (5 to 150)
  cannyHigh: number; // for Canny high threshold (30 to 255)
  laplacianDiagonal: boolean;
  embossAngle?: number; // 0, 45, 90, 135
  vignetteRadius?: number; // 0.2 to 1.0
  vignetteStrength?: number; // 0.1 to 1.0
  glitchOffset?: number; // 2 to 30 px
  duotoneLightColor?: string; // hex
  duotoneDarkColor?: string; // hex
  trimAlpha?: number; // 1 to 4 pixels
}

export interface PointProcessConfig {
  mode:
    | "none"
    | "negative"
    | "log"
    | "gamma"
    | "threshold"
    | "otsu"
    | "hist_eq"
    | "bit_plane"
    | "channel_r"
    | "channel_g"
    | "channel_b"
    | "channel_gray"
    | "sampling"
    | "quantization";
  gamma: number; // 0.1 to 5.0
  logC: number; // 1 to 100
  thresholdValue: number; // 0 to 255
  bitPlaneIndex: number; // 0 to 7
  sampleFactor: number; // 2 to 64 (pixelation block size)
  quantLevels: number; // 2 to 256 (levels per channel)
}

export interface BgRemovalConfig {
  mode: "ai_click" | "magic_wand" | "preset_white" | "preset_green" | "preset_black" | "eraser";
  wandColor: { r: number; g: number; b: number };
  tolerance: number; // 5 to 150
  feather: number; // 0 to 15
  eraserRadius: number; // 5 to 150
  eraserHardness: number; // 0 to 100
  eraserOpacity: number; // 0 to 100
  contiguous?: boolean; // true = connected floodFill, false = global
  invert?: boolean; // invert alpha mask
  asNewLayer?: boolean; // output as separate new transparent layer
}

export interface BrushConfig {
  color: string;
  size: number;
  opacity: number;
  mode: "brush" | "neon" | "highlighter" | "eraser" | "rectangle" | "circle" | "arrow" | "line";
  eraserTarget?: "overlay" | "layer" | "both";
  eraserHardness?: number; // 0 to 100
  eraserOpacity?: number; // 10 to 100
  eraserSubMode?: "alpha" | "ai_object"; // alpha = transparent erase, ai_object = AI inpainting
  inpaintRadius?: number; // 3 to 20 (OpenCV inpainting radius)
  inpaintMethod?: "telea" | "ns"; // Telea or Navier-Stokes
  autoInpaintOnRelease?: boolean; // automatically inpaint when mouse stroke ends
  inpaintDilate?: number; // dilation in pixels to cover boundary artifacts

  fillShape?: boolean; // false = outline frame only, true = filled
  fillColor?: string; // hex or rgba or "transparent"
  strokeDash?: "solid" | "dashed" | "dotted";
  targetLayer?: "active" | "new"; // draw directly onto active layer or create new layer
}

export interface DetectedObject {
  id?: string;
  label: string;
  labelAr?: string;
  confidence: number;
  box2d: [number, number, number, number]; // ymin, xmin, ymax, xmax [0..1000]
  boxPixels?: [number, number, number, number]; // [x, y, w, h] in pixels
  category?: string;
  colorHex?: string;
}

export interface OCRBlock {
  text: string;
  confidence?: number;
  box2d: [number, number, number, number]; // ymin, xmin, ymax, xmax [0..1000]
  language?: string;
  langCode?: string;
  suggestedFontSize?: number;
  fontColorHex?: string;
}

export interface SegmentItem {
  segmentId: string;
  name: string;
  type: string;
  box2d: [number, number, number, number];
  description?: string;
  backgroundRemovalAdvice?: string;
  colorHex?: string;
  pixelCount?: number;
  maskCanvas?: HTMLCanvasElement;
}

export type SegmentationMethod =
  | "kmeans"
  | "watershed"
  | "foreground_cut"
  | "otsu"
  | "adaptive"
  | "color_slicing";

export interface SegmentationConfig {
  method: SegmentationMethod;
  kClusters: number; // 2 to 8 (default 4)
  watershedSensitivity: number; // 1 to 10 (default 5)
  watershedShowBorders: boolean; // default true
  otsuInvert: boolean; // default false
  otsuAsMask: boolean; // default false
  adaptiveBlockSize: number; // 3, 5, 7, 9, 15, 21, 31 (default 15)
  adaptiveC: number; // -25 to 25 (default 5)
  adaptiveMethod: "mean" | "gaussian"; // default "mean"
  adaptiveInvert: boolean; // default false
  foregroundSensitivity: number; // 10 to 90 (default 45)
  colorTolerance: number; // 10 to 90 (default 35)
}

export type LassoMode = "none" | "polygon" | "magnetic" | "freehand";

export interface SelectionRegion {
  mode: LassoMode;
  points: Array<{ x: number; y: number }>;
  isClosed: boolean;
  feather: number;
}

export interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
  luminance: number[];
  min: number;
  max: number;
  mean: number;
  stdDev: number;
}

