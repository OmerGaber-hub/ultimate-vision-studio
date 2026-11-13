import { PanelButton } from "./PanelButton";
import { Tooltip } from "./Tooltip";
import React, { useState, useEffect, useRef } from "react";
import {
  ToolType,
  Layer,
  PointProcessConfig,
  SpatialFilterConfig,
  SpatialFilterType,
  FilterCategory,
  BgRemovalConfig,
  BrushConfig,
  DetectedObject,
  OCRBlock,
  SegmentItem,
  SegmentationConfig,
  SegmentationMethod,
  SelectionRegion,
  ToneAdjustments,
  CropRegion,
} from "../types";
import {
  calculateHistogram,
  calculateOtsuThreshold,
  traceImageToSVG,
} from "../lib/cvEngine";
import { PRODUCT_BACKDROPS } from "../lib/productBackdrops";

export interface FilterCatalogItem {
  id: SpatialFilterType;
  category: FilterCategory;
  nameAr: string;
  nameEn: string;
  badge: string;
  description: string;
}

export const SPATIAL_FILTERS_CATALOG: FilterCatalogItem[] = [
  // 1. Smoothing & Noise
  {
    id: "gaussian",
    category: "smoothing",
    nameAr: "تنعيم غاوسي",
    nameEn: "Gaussian Blur",
    badge: "خطي مرجح",
    description: "طمس وتنعيم متدرج وفق التوزيع الطبيعي الغاوسي (σ)، مثالي لتقليل الضوضاء العشوائية.",
  },
  {
    id: "mean",
    category: "smoothing",
    nameAr: "طمس بالمتوسط",
    nameEn: "Box Mean Blur",
    badge: "صندوقي منتظم",
    description: "يحسب متوسط قيم البكسلات في الجوار، فعال في إخفاء التفاصيل غير المرغوبة بسرعة.",
  },
  {
    id: "median",
    category: "smoothing",
    nameAr: "مرشح الوسيط",
    nameEn: "Median Filter",
    badge: "الملح والفلفل",
    description: "مرشح غير خطي عالي الدقة لإزالة الضوضاء النبضية مع الحفاظ على وضوح الحواف.",
  },
  {
    id: "bilateral",
    category: "smoothing",
    nameAr: "ثنائي الأطراف",
    nameEn: "Bilateral Filter",
    badge: "حفظ الحواف",
    description: "يدمج المسافة المكانية وفروق الألوان؛ ينعم الأسطح والوجوه دون المساس بحدة الحواف.",
  },
  {
    id: "kuwahara",
    category: "smoothing",
    nameAr: "مرشح كواهارا",
    nameEn: "Kuwahara Filter",
    badge: "رسم زيتي",
    description: "يقسم الجوار إلى 4 مناطق ويختار الأقل تبايناً؛ يمنح مظهراً فنياً شبيهاً بالرسم الزيتي.",
  },
  {
    id: "min_filter",
    category: "smoothing",
    nameAr: "مرشح الأدنى",
    nameEn: "Minimum Filter",
    badge: "تعزيز الظلال",
    description: "يختار أدنى قيمة في الجوار؛ يزيل النقاط البيضاء العشوائية ويعزز قتامة الظلال.",
  },
  {
    id: "max_filter",
    category: "smoothing",
    nameAr: "مرشح الأقصى",
    nameEn: "Maximum Filter",
    badge: "تعزيز السطوع",
    description: "يختار أعلى قيمة في الجوار؛ يزيل النقاط السوداء العشوائية ويعزز إشراق المعالم.",
  },
  {
    id: "midpoint",
    category: "smoothing",
    nameAr: "نقطة المنتصف",
    nameEn: "Midpoint Filter",
    badge: "متوسط المدى",
    description: "يحسب (الحد الأدنى + الحد الأقصى) / 2؛ فعال مع الضوضاء ذات التوزيع المنتظم.",
  },
  {
    id: "harmonic",
    category: "smoothing",
    nameAr: "المتوسط التوافقي",
    nameEn: "Harmonic Mean",
    badge: "توافقي",
    description: "يحسب التوسط التوافقي للقيم؛ يتفوق في تنقية ضوضاء الملح والمناطق عالية التشويش.",
  },
  {
    id: "alpha_trimmed",
    category: "smoothing",
    nameAr: "مشذب ألفا",
    nameEn: "Alpha-Trimmed",
    badge: "ضوضاء مركبة",
    description: "يفرز القيم ويستبعد الأطراف الشاذة (ألفا) ثم يحسب المتوسط؛ ممتاز للضوضاء المتعددة.",
  },

  {
    id: "motion_blur",
    category: "smoothing",
    nameAr: "طمس حركي",
    nameEn: "Motion Blur",
    badge: "محاكاة الحركة",
    description: "محاكاة تأثير ضبابية الحركة الناتجة عن اهتزاز الكاميرا أو حركة الأجسام السريعة.",
  },
  {
    id: "zoom_blur",
    category: "smoothing",
    nameAr: "طمس شعاعي (تكبير)",
    nameEn: "Zoom/Radial Blur",
    badge: "تأثير السرعة",
    description: "تطبيق ضبابية شعاعية مركزية تمنح إحساساً بالاندفاع والسرعة نحو نقطة التلاشي.",
  },

  // 2. Edge Detection & Sharpening
  // 2. Edge Detection & Sharpening
  {
    id: "sharpen",
    category: "edges",
    nameAr: "شحذ أساسي",
    nameEn: "Standard Sharpen",
    badge: "توضيح التفاصيل",
    description: "فلتر تلافيفي كلاسيكي لتعزيز تباين الحواف الدقيقة وإبراز التفاصيل المطموسة.",
  },
  {
    id: "edge_enhance",
    category: "edges",
    nameAr: "إبراز الحواف",
    nameEn: "Edge Enhance",
    badge: "تعزيز هيكلي",
    description: "تضخيم متدرج للخطوط الفاصلة في الصورة لزيادة الوضوح البصري والهيكلي.",
  },
  {
    id: "canny",
    category: "edges",
    nameAr: "كاشف كاني",
    nameEn: "Canny Detector",
    badge: "الخوارزمية المثلى",
    description: "كشف حواف فائق الدقة بالتنعيم الغاوسي وقمع غير القمم مع التلاكؤ الثنائي.",
  },
  {
    id: "sobel",
    category: "edges",
    nameAr: "مؤثر سوبل",
    nameEn: "Sobel Operator",
    badge: "تدرج وزني",
    description: "كاشف تدرج ثلاثي الأوزان يركز على تدرجات الحواف الأفقية والعمودية الموزونة.",
  },
  {
    id: "prewitt",
    category: "edges",
    nameAr: "مؤثر بريويت",
    nameEn: "Prewitt Operator",
    badge: "تدرج كلاسيكي",
    description: "كاشف تدرج متعامد متوازن يقدر المشتقة المكانية الأولى لكشف الخطوط.",
  },
  {
    id: "scharr",
    category: "edges",
    nameAr: "مؤثر شار",
    nameEn: "Scharr Operator",
    badge: "تماثل دوراني",
    description: "مصفوفة متطورة بوزن 16/10 لتفادي أخطاء التوجيه الدوراني الموجودة في سوبل.",
  },
  {
    id: "roberts",
    category: "edges",
    nameAr: "تقاطع روبرتس",
    nameEn: "Roberts Cross",
    badge: "تدرج قطري 2×2",
    description: "كاشف سريع وفائق البساطة يعتمد على فروق أقطار المصفوفة 2×2 لكشف الزوايا الحادة.",
  },
  {
    id: "laplacian",
    category: "edges",
    nameAr: "مؤثر لابلاسيان",
    nameEn: "Laplacian",
    badge: "المشتقة الثانية",
    description: "مؤثر تماثلي المشتقة المكانية الثانية (∇²f) لاستخراج أماكن العبور الصفري.",
  },
  {
    id: "log",
    category: "edges",
    nameAr: "لابلاسيان الغاوسي",
    nameEn: "Laplacian of Gaussian",
    badge: "قبعة مكسيكية",
    description: "تنعيم غاوسي متزامن مع مشتقة لابلاسيان لحماية التحليل من تضخيم الضوضاء.",
  },
  {
    id: "robinson",
    category: "edges",
    nameAr: "بوصلة روبنسون",
    nameEn: "Robinson Compass",
    badge: "8 اتجاهات",
    description: "مسح تلافيفي في ثمانية اتجاهات جغرافية واختيار الاستجابة التدرجية القصوى.",
  },
  {
    id: "kirsch",
    category: "edges",
    nameAr: "بوصلة كيرش",
    nameEn: "Kirsch Compass",
    badge: "أوزان اتجاهية",
    description: "أقوى كاشفات البوصلة الثمانية؛ يبرز خطوط الحواف والأجسام بدقة حادة.",
  },
  {
    id: "unsharp",
    category: "edges",
    nameAr: "قناع الشحذ",
    nameEn: "Unsharp Mask",
    badge: "شحذ احترافي",
    description: "يطرح نسخة مموهة من الصورة الأصلية ثم يضخم الفارق لإبراز أدق التفاصيل.",
  },
  {
    id: "highboost",
    category: "edges",
    nameAr: "التعزيز العالي",
    nameEn: "High-Boost",
    badge: "عامل A > 1",
    description: "تكبير ترددات الحواف الدقيقة مع الاحتفاظ بنسبة عالية من الصورة الأصلية.",
  },
  {
    id: "highpass",
    category: "edges",
    nameAr: "التمرير العالي",
    nameEn: "High-Pass Filter",
    badge: "ترددات عليا",
    description: "يعزل الترددات المكانية العالية ويركز على الملامح الميكروسكوبية وشحذ المعالم.",
  },
  {
    id: "emboss",
    category: "edges",
    nameAr: "النقش والبروز",
    nameEn: "Emboss / Relief",
    badge: "تجسيم 3D",
    description: "يمنح عمقاً ونحتاً ثلاثي الأبعاد مستوحى من زاوية سقوط الضوء والظلال المائلة.",
  },

  // 3. Morphology
  {
    id: "dilation",
    category: "morphology",
    nameAr: "التمدد",
    nameEn: "Dilation",
    badge: "توسيع المعالم",
    description: "توسيع المناطق المضيئة وملء الشقوق والثغرات الصغيرة داخل الهياكل البصرية.",
  },
  {
    id: "erosion",
    category: "morphology",
    nameAr: "التآكل",
    nameEn: "Erosion",
    badge: "تقليص الكتل",
    description: "تقليص المناطق المضيئة وإزالة البروزات الدقيقة وفصل الأجسام المتصلة بخيوط رفيعة.",
  },
  {
    id: "opening",
    category: "morphology",
    nameAr: "الفتح المورفولوجي",
    nameEn: "Opening",
    badge: "تآكل ← تمدد",
    description: "يزيل البروزات الدقيقة والضوضاء المعزولة دون التأثير على الحجم العام للكتل.",
  },
  {
    id: "closing",
    category: "morphology",
    nameAr: "الإغلاق المورفولوجي",
    nameEn: "Closing",
    badge: "تمدد ← تآكل",
    description: "يسد الفجوات والثقوب الدقيقة ويوصل الخطوط المتقطعة دون زيادة الحجم الإجمالي.",
  },
  {
    id: "morph_gradient",
    category: "morphology",
    nameAr: "التدرج المورفولوجي",
    nameEn: "Morph Gradient",
    badge: "تمدد - تآكل",
    description: "طرح التآكل من التمدد لاستخراج الحدود والمحيط الهيكلي للأشكال بدقة عالية.",
  },
  {
    id: "tophat",
    category: "morphology",
    nameAr: "القبعة العليا",
    nameEn: "Top-Hat",
    badge: "الأصل - الفتح",
    description: "عزل واستخراج العناصر والتفاصيل الساطعة الأصغر حجماً من عنصر البنية.",
  },
  {
    id: "blackhat",
    category: "morphology",
    nameAr: "القبعة السفلية",
    nameEn: "Black-Hat",
    badge: "الإغلاق - الأصل",
    description: "عزل واستخراج الفجوات والتفاصيل الداكنة الغائرة في الصورة الأصلية.",
  },

  // 4. Artistic & Photographic
  {
    id: "sepia",
    category: "artistic",
    nameAr: "سيبيا كلاسيكي",
    nameEn: "Vintage Sepia",
    badge: "تراثي دافئ",
    description: "إكساب الصورة طابع الصور الفوتوغرافية التراثية الدافئة بلون الحبر البني العتيق.",
  },
  {
    id: "vignette",
    category: "artistic",
    nameAr: "تظليل الأطراف",
    nameEn: "Vignette",
    badge: "تركيز سينمائي",
    description: "إعتام تدريجي لأطراف وأركان المشهد مع الحفاظ على سطوع المركز لتركيز الانتباه.",
  },
  {
    id: "film_noir",
    category: "artistic",
    nameAr: "فيلم نوار درامي",
    nameEn: "Film Noir Contrast",
    badge: "أبيض وأسود حاد",
    description: "تباين أحادي سينمائي عالي الدراما مستوحى من سينما الأفلام الكلاسيكية.",
  },
  {
    id: "thermal",
    category: "artistic",
    nameAr: "رؤية حرارية",
    nameEn: "Thermal / False Color",
    badge: "طيف إشعاعي",
    description: "تحويل قيم السطوع إلى خريطة ألوان حرارية زاهية تحاكي كاميرات الأشعة تحت الحمراء.",
  },
  {
    id: "cyberpunk",
    category: "artistic",
    nameAr: "سايبربانك نيون",
    nameEn: "Cyberpunk Glow",
    badge: "توهج نيوني",
    description: "تعزيز درجات الفيروزي (Cyan) في المناطق المضيئة والوردي والأرجواني في الظلال.",
  },
  {
    id: "sketch",
    category: "artistic",
    nameAr: "رسم بالرصاص",
    nameEn: "Pencil Sketch",
    badge: "رسم يدوي",
    description: "تحويل الصورة بالكامل إلى لوحة رسم يدوي بقلم الرصاص باستخدام تقنية دمج التراكب.",
  },
  {
    id: "glitch",
    category: "artistic",
    nameAr: "خلل لوني RGB",
    nameEn: "Chromatic Glitch",
    badge: "تشويه رقمي",
    description: "إزاحة بصرية لقنوات اللون الأحمر والأزرق لمحاكاة أخطاء البث والشاشات القديمة.",
  },
  {
    id: "duotone",
    category: "artistic",
    nameAr: "نغمة ثنائية",
    nameEn: "Duotone Filter",
    badge: "لونين مخصصين",
    description: "صبغ تدرج الإضاءة والظلال بدرجتين لونيتين مختارتين بدقة للتصميم الحديث.",
  },
  {
    id: "cartoon",
    category: "artistic",
    nameAr: "كرتون وبوستر",
    nameEn: "Cartoon Poster",
    badge: "رسوم متحركة",
    description: "تسطيح المستويات اللونية وتحديد الخطوط العريضة لإنشاء طابع الرسوم والملصقات.",
  },
];

export interface SegmentationMethodCatalogItem {
  id: SegmentationMethod;
  nameAr: string;
  nameEn: string;
  badge: string;
  description: string;
}

export const SEGMENTATION_METHODS_CATALOG: SegmentationMethodCatalogItem[] = [
  {
    id: "kmeans",
    nameAr: "عناقيد الألوان",
    nameEn: "K-Means Clustering",
    badge: "تكتل لوني",
    description: "فصل الصورة إلى مجموعات لونية متجانسة ومتقاربة طيفياً.",
  },
  {
    id: "watershed",
    nameAr: "حدود الأحواض",
    nameEn: "Watershed Boundaries",
    badge: "طوبوغرافيا الحواف",
    description: "فصل العناصر المتلامسة وتحديد الحواف الدقيقة وسدود الفواصل.",
  },
  {
    id: "foreground_cut",
    nameAr: "عزل الكائن الرئيسي",
    nameEn: "Foreground Cut",
    badge: "قص الموضوع",
    description: "فصل المنتج ومقدمة الصورة بذكاء عن الخلفية بشفافية ألفا.",
  },
  {
    id: "otsu",
    nameAr: "عتبة أوتسو الذكية",
    nameEn: "Otsu's Thresholding",
    badge: "عتبة مثلى",
    description: "تحديد تلقائي للعتبة المثلى بفصل تباين المستويات ثنائي النسق.",
  },
  {
    id: "adaptive",
    nameAr: "العتبة التكيفية",
    nameEn: "Adaptive Thresholding",
    badge: "جوار محلي",
    description: "تجزئة ديناميكية وفق الإضاءة والجوار المكاني للتغلب على الظلال.",
  },
  {
    id: "color_slicing",
    nameAr: "تجزئة النطاق اللوني",
    nameEn: "Color Slicing",
    badge: "عزل أطياف",
    description: "عزل مجالات لونية محددة وعزل مناطق الاهتمام المستهدفة.",
  },
];

import { AVAILABLE_FONTS, TextRenderConfig } from "../lib/textEngine";
import { AVAILABLE_SHAPES, SHAPE_COLOR_PRESETS } from "../lib/shapeEngine";
import { ShapeConfig, ShapeType, GradientConfig } from "../types";
import { GradientEditor } from "./GradientEditor";
import { DEFAULT_GRADIENT_CONFIG, GRADIENT_PRESETS } from "../lib/gradientEngine";

import {
  Sliders,
  Sparkles,
  Scissors,
  Brush,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Activity,
  Maximize2,
  Copy,
  Scan,
  Type,
  Download,
  Eye,
  CheckCircle2,
  Cpu,
  Layers,
  Palette,
  Sun,
  Contrast,
  Zap,
  SlidersHorizontal,
  Moon,
  Droplets,
  Layers as LayersIcon,
  Link,
  Unlink,
  Move,
  Maximize,
  AlignCenter,
  Maximize2 as ExpandIcon,
  AlertTriangle,
  Info,
  LassoSelect,
  Crop,
  Eraser,
  Check,
  X,
  FileText,
  ChevronLeft,
  Plus,
  Square,
  Circle,
  Triangle,
  Star,
  Minus,
  ArrowRight,
  Hexagon,
  RectangleHorizontal,
  Shapes,
  Trash2,
  Loader2,
  Wand2,
} from "lucide-react";

interface PropertiesPanelProps {
  onToggleCollapse?: () => void;
  activeTool: ToolType;
  activeLayer: Layer | null;
  canvasWidth?: number;
  canvasHeight?: number;
  onOpenMetadata?: () => void;
  onUpdateLayerTransform: (transform: {
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    flipX?: boolean;
    flipY?: boolean;
    x?: number;
    y?: number;
  }) => void;
  pointConfig: PointProcessConfig;
  onUpdatePointConfig: (config: Partial<PointProcessConfig>, autoPreview?: boolean) => void;
  onApplyPointProcessing: () => void;
  onResetPointProcessing: () => void;
  toneAdjustments?: ToneAdjustments;
  onUpdateToneAdjustments?: (adj: Partial<ToneAdjustments>, isPreview?: boolean) => void;
  onResetToneAdjustments?: () => void;
  toneScope?: "layer" | "project";
  onSetToneScope?: (scope: "layer" | "project") => void;
  spatialConfig: SpatialFilterConfig;
  onUpdateSpatialConfig: (config: Partial<SpatialFilterConfig>) => void;
  onApplySpatialFilter: (asNewLayer?: boolean) => void;
  bgConfig: BgRemovalConfig;
  onUpdateBgConfig: (config: Partial<BgRemovalConfig>) => void;
  onApplyBgRemoval: () => void;
  onRevertBgRemoval?: () => void;
  brushConfig: BrushConfig;
  onUpdateBrushConfig: (config: Partial<BrushConfig>) => void;
  onApplyInpaint?: (maskCanvas?: HTMLCanvasElement) => void;
  onUndo?: () => void;
  onApplyProductBackdrop: (backdropId: string) => void;
  isProcessing?: boolean;
  // AI Vision & Segmentation states & triggers
  isAiProcessing: boolean;
  onRunAiVision: (mode: "ocr" | "object_detection" | "segmentation") => void;
  detectedObjects: DetectedObject[];
  yoloModel?: "yolo11s.pt" | "yolo11n.pt";
  onSelectYoloModel?: (model: "yolo11s.pt" | "yolo11n.pt") => void;
  yoloConfidence?: number;
  onSelectYoloConfidence?: (conf: number) => void;
  onExtractObjectAsLayer?: (obj: DetectedObject, cutoutBg?: boolean) => void;
  onExtractAllObjectsAsLayers?: (cutoutBg?: boolean) => void;
  ocrBlocks: OCRBlock[];
  ocrLanguage?: "ar+en" | "ar" | "en";
  onSelectOcrLanguage?: (lang: "ar+en" | "ar" | "en") => void;
  ocrEnhance?: boolean;
  onToggleOcrEnhance?: () => void;
  segments: SegmentItem[];
  segmentConfig?: SegmentationConfig;
  onUpdateSegmentConfig?: (config: Partial<SegmentationConfig>) => void;
  onApplySegmentation?: (asNewLayer?: boolean, isPreview?: boolean, config?: Partial<SegmentationConfig>) => void;
  onRevertSegmentation?: () => void;
  activeAiSubTab?: "segmentation" | "ocr" | "object_detection";
  onSelectAiSubTab?: (tab: "segmentation" | "ocr" | "object_detection") => void;
  selectionRegion?: SelectionRegion;
  onUpdateSelectionRegion?: (update: Partial<SelectionRegion>) => void;
  onExtractSelectionAsLayer?: () => void;
  onClearSelection?: () => void;
  showBoundingBoxes: boolean;
  onToggleBoundingBoxes: () => void;
  onAddOcrTextLayer: (block: OCRBlock) => void;
  onIsolateSegment: (segment: SegmentItem) => void;
  onCropApply?: (aspect?: number) => void;
  cropBox?: CropRegion | null;
  onUpdateCropBox?: (box: CropRegion | null) => void;
  cropAspect?: number | null;
  onSetCropAspect?: (aspect?: number | null) => void;
  cropTarget?: "document" | "layer";
  onSetCropTarget?: (target: "document" | "layer") => void;
  onConfirmCrop?: () => void;
  onCancelCrop?: () => void;
  onResetCropBox?: () => void;
  onAddTextLayer: (text: string, fontSize: number, color: string) => void;
  onUpdateTextLayer?: (layerId: string, updates: Partial<TextRenderConfig>) => void;
  onStartInlineTextEdit?: (layerId: string) => void;
  shapeConfig?: ShapeConfig;
  onUpdateShapeConfig?: (config: Partial<ShapeConfig>) => void;
  onAddShapeLayer?: (config?: Partial<ShapeConfig>, width?: number, height?: number) => void;
  onUpdateActiveShapeLayer?: (layerId: string, updates: Partial<ShapeConfig>) => void;
  onUpdateActiveGradientLayer?: (layerId: string, gradientConfig: GradientConfig) => void;
  onAddGradientLayer?: (config?: GradientConfig) => void;
  isComparingOriginal?: boolean;
  onToggleCompareOriginal?: () => void;
  onSetCompareOriginal?: (val: boolean) => void;
  aiNotice?: { message: string; isLeakedKey?: boolean } | null;
  onDismissAiNotice?: () => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  onToggleCollapse,
  activeTool,
  activeLayer,
  canvasWidth = 800,
  canvasHeight = 800,
  onOpenMetadata,
  onUpdateLayerTransform,
  pointConfig,
  onUpdatePointConfig,
  onApplyPointProcessing,
  onResetPointProcessing,
  toneAdjustments = {
    brightness: 0,
    contrast: 0,
    exposure: 0,
    lightBalance: 0,
    highlights: 0,
    shadows: 0,
    saturation: 0,
  },
  onUpdateToneAdjustments,
  onResetToneAdjustments,
  toneScope = "layer",
  onSetToneScope,
  spatialConfig,
  onUpdateSpatialConfig,
  onApplySpatialFilter,
  bgConfig,
  onUpdateBgConfig,
  onApplyBgRemoval,
  onRevertBgRemoval,
  brushConfig,
  onUpdateBrushConfig,
  onApplyInpaint,
  onUndo,
  onApplyProductBackdrop,
  isProcessing = false,
  isAiProcessing,
  onRunAiVision,
  detectedObjects,
  yoloModel = "yolo11s.pt",
  onSelectYoloModel,
  yoloConfidence = 0.25,
  onSelectYoloConfidence,
  onExtractObjectAsLayer,
  onExtractAllObjectsAsLayers,
  ocrBlocks,
  ocrLanguage = "ar+en",
  onSelectOcrLanguage,
  ocrEnhance = true,
  onToggleOcrEnhance,
  segments,
  segmentConfig = {
    method: "kmeans",
    kClusters: 4,
    watershedSensitivity: 5,
    watershedShowBorders: true,
    otsuInvert: false,
    otsuAsMask: false,
    adaptiveBlockSize: 15,
    adaptiveC: 5,
    adaptiveMethod: "mean",
    adaptiveInvert: false,
    foregroundSensitivity: 45,
    colorTolerance: 35,
  },
  onUpdateSegmentConfig,
  onApplySegmentation,
  onRevertSegmentation,
  activeAiSubTab = "segmentation",
  onSelectAiSubTab,
  selectionRegion = {
    mode: "polygon",
    points: [],
    isClosed: false,
    feather: 0,
  },
  onUpdateSelectionRegion,
  onExtractSelectionAsLayer,
  onClearSelection,
  showBoundingBoxes,
  onToggleBoundingBoxes,
  onAddOcrTextLayer,
  onIsolateSegment,
  onCropApply,
  cropBox,
  onUpdateCropBox,
  cropAspect,
  onSetCropAspect,
  cropTarget = "document",
  onSetCropTarget,
  onConfirmCrop,
  onCancelCrop,
  onResetCropBox,
  onAddTextLayer,
  onUpdateTextLayer,
  onStartInlineTextEdit,
  shapeConfig = {
    type: "rectangle",
    fillColor: "#8b5cf6",
    strokeColor: "#ffffff",
    strokeWidth: 2,
    strokeDash: "solid",
    cornerRadius: 16,
    starPoints: 5,
  },
  onUpdateShapeConfig,
  onAddShapeLayer,
  onUpdateActiveShapeLayer,
  onUpdateActiveGradientLayer,
  onAddGradientLayer,
  isComparingOriginal = false,
  onToggleCompareOriginal,
  onSetCompareOriginal,
  aiNotice,
  onDismissAiNotice,
}) => {
  // Lock aspect ratio state for transform & stretching
  const [aspectLocked, setAspectLocked] = useState<boolean>(true);

  // Sub-tabs for tone & point tool
  const [toneSubTab, setToneSubTab] = useState<"sliders" | "advanced">("sliders");

  // Spatial filters category tab
  const [filterCategory, setFilterCategory] = useState<FilterCategory>(
    () => SPATIAL_FILTERS_CATALOG.find((f) => f.id === spatialConfig.type)?.category ?? "smoothing"
  );

  // Sync category when spatialConfig.type changes externally
  useEffect(() => {
    const item = SPATIAL_FILTERS_CATALOG.find((f) => f.id === spatialConfig.type);
    if (item && item.category !== filterCategory) {
      setFilterCategory(item.category);
    }
  }, [spatialConfig.type]);

  // Histogram Canvas Ref
  const histCanvasRef = useRef<HTMLCanvasElement>(null);
  const [histChannel, setHistChannel] = useState<"all" | "r" | "g" | "b" | "lum">("all");
  const [histStats, setHistStats] = useState<{ min: number; max: number; mean: number; stdDev: number } | null>(null);

  // Custom text tool state
  const [newTextString, setNewTextString] = useState("استوديو الرؤية الفائقة");
  const [newTextSize, setNewTextSize] = useState(36);
  const [newTextColor, setNewTextColor] = useState("#a855f7");

  // Keep text state in sync with currently selected text layer
  useEffect(() => {
    if (activeLayer && activeLayer.type === "text" && activeLayer.textConfig) {
      setNewTextString(activeLayer.textConfig.text);
      setNewTextSize(activeLayer.textConfig.fontSize);
      setNewTextColor(activeLayer.textConfig.color);
    }
  }, [activeLayer?.id, activeLayer?.textConfig?.text, activeLayer?.textConfig?.fontSize, activeLayer?.textConfig?.color]);

  // SVG Vectorize settings
  const [vectorColors, setVectorColors] = useState(6);
  const [svgPreview, setSvgPreview] = useState<string>("");

  // Draw real-time histogram whenever active layer updates
  useEffect(() => {
    if (!activeLayer || !histCanvasRef.current) return;
    try {
      const ctx = activeLayer.canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const imgData = ctx.getImageData(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
      const hist = calculateHistogram(imgData);
      setHistStats({ min: hist.min, max: hist.max, mean: hist.mean, stdDev: hist.stdDev });

      const c = histCanvasRef.current;
      const hCtx = c.getContext("2d");
      if (!hCtx) return;

      hCtx.clearRect(0, 0, c.width, c.height);

      // Find maximum count for scaling
      let maxVal = 1;
      for (let i = 0; i < 256; i++) {
        maxVal = Math.max(maxVal, hist.luminance[i], hist.r[i], hist.g[i], hist.b[i]);
      }

      const drawChannel = (arr: number[], color: string) => {
        hCtx.beginPath();
        hCtx.strokeStyle = color;
        hCtx.lineWidth = 1.2;
        for (let i = 0; i < 256; i++) {
          const x = (i / 255) * c.width;
          const y = c.height - (arr[i] / maxVal) * (c.height - 4);
          if (i === 0) hCtx.moveTo(x, y);
          else hCtx.lineTo(x, y);
        }
        hCtx.stroke();
      };

      if (histChannel === "all" || histChannel === "r") drawChannel(hist.r, "rgba(239, 68, 68, 0.7)");
      if (histChannel === "all" || histChannel === "g") drawChannel(hist.g, "rgba(34, 197, 94, 0.7)");
      if (histChannel === "all" || histChannel === "b") drawChannel(hist.b, "rgba(59, 130, 246, 0.7)");
      if (histChannel === "all" || histChannel === "lum") drawChannel(hist.luminance, "rgba(248, 250, 252, 0.85)");
    } catch {
      // safely handle uninitialized canvas
    }
  }, [activeLayer, histChannel, pointConfig]);

  // Update SVG Vector preview when vectorize tool is active
  useEffect(() => {
    if (activeTool === "vectorize" && activeLayer) {
      traceImageToSVG(activeLayer.canvas, vectorColors).then(setSvgPreview).catch(console.error);
    }
  }, [activeTool, activeLayer, vectorColors]);

  return (
    <aside
      id="vision-studio-properties-panel"
      className="w-80 border-r rtl:border-r ltr:border-l border-purple-500/20 bg-[#0c0d16]/95 backdrop-blur-xl flex flex-col z-20 select-none text-slate-200 overflow-hidden shrink-0"
    >
      {/* Header */}
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {activeTool === "point" ? (
            <SlidersHorizontal className="w-4 h-4 text-purple-400" />
          ) : (
            <Sliders className="w-4 h-4 text-purple-400" />
          )}
          <h2 className="text-xs font-bold tracking-wide text-slate-200">
            {activeTool === "select" && "تحديد ونقل وتحجيم الطبقة"}
            {activeTool === "lasso" && "أدوات التحديد المتقدم (Lasso)"}
            {activeTool === "crop" && "أداة القص والتأطير (Crop & Frame)"}
            {activeTool === "transform" && "التحويلات الهندسية والتدوير"}
            {activeTool === "bg_remove" && "أداة إزالة الخلفية الذكية"}
            {activeTool === "segmentation" && "القص الذكي والتجزئة (Segmentation)"}
            {activeTool === "ocr" && "استخراج النصوص من الصورة (OCR / Word)"}
            {activeTool === "object_detection" && "كشف الكائنات وتحديدها (Object Detection)"}
            {activeTool === "enhance" && "توضيح وتحسين الدقة والشحذ (HD)"}
            {activeTool === "spatial" && "المرشحات المكانية وكشف الحواف"}
            {activeTool === "point" && "تعديل النغمة والضوء (Tone & Light)"}
            {activeTool === "backdrop" && "استوديو خلفيات وتدرجات المنتجات"}
            {activeTool === "text" && "استوديو طبقات النصوص"}
            {activeTool === "shape" && "استوديو الأشكال الهندسية"}
            {activeTool === "draw" && "استوديو الرسم الحر بالفرشاة"}
            {activeTool === "eraser" && "أداة الممحاة الذكية"}
            {activeTool === "vectorize" && "تتبع مسارات فكتور SVG"}
            {activeTool === "ai" && "الرؤية الحاسوبية والذكاء الاصطناعي"}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          {activeTool === "point" ? (
            <PanelButton
              type="button"
              onClick={() => {
                onResetToneAdjustments?.();
                onResetPointProcessing();
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 text-[11px] text-slate-300 hover:text-white transition-colors"
              title="إعادة ضبط كافة القيم إلى الصفر"
            >
              <RotateCcw className="w-3 h-3 text-purple-400" />
              <span>إعادة ضبط</span>
            </PanelButton>
          ) : (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-purple-300">
              PRO
            </span>
          )}
          {onToggleCollapse && (
            <Tooltip content="إخفاء / طي لوحة الخصائص" shortcut="F8" position="bottom">
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="طي لوحة الخصائص"
              >
                <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* INSTANT COMPARISON TOGGLE: ORIGINAL VS CURRENT EDITED     */}
      {/* (Visible strictly on tone/point, spatial, enhance, and ai) */}
      {/* ========================================================= */}
      {["point", "spatial", "enhance", "ai"].includes(activeTool) && (
        <div
          id="properties-instant-comparison-panel"
          className={`p-3 border-b transition-all ${
            isComparingOriginal
              ? "bg-amber-950/40 border-amber-500/40 shadow-inner"
              : "bg-[#0e101c]/90 border-slate-800/80"
          }`}
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <PanelButton
                type="button"
                id="btn-quick-eye-toggle"
                onClick={() => onToggleCompareOriginal && onToggleCompareOriginal()}
                title={
                  isComparingOriginal
                    ? "انقر للعودة إلى الحالة المعدّلة الحالية"
                    : "انقر لمعاينة الصورة الأصلية"
                }
                className={`p-1.5 rounded-lg border transition-all ${
                  isComparingOriginal
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30 scale-105"
                    : "bg-slate-900/80 text-purple-400 border-purple-500/30 hover:bg-purple-950/50 hover:border-purple-400"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
              </PanelButton>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-200">
                    مقارنة فورية
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold border transition-colors ${
                      isComparingOriginal
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-purple-500/20 text-purple-300 border-purple-500/40"
                    }`}
                  >
                    {isComparingOriginal ? "الحالة الأصلية" : "الحالة المعدّلة"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">
                  {isComparingOriginal
                    ? "يتم عرض الأصل • تعديلاتك محفوظة"
                    : "تظهر النسخة مع كافة التعديلات"}
                </p>
              </div>
            </div>

            {/* Toggle Switch Component */}
            <div className="flex items-center gap-2 shrink-0">
              <PanelButton
                id="properties-compare-toggle-switch"
                type="button"
                role="switch"
                aria-checked={isComparingOriginal}
                aria-label="تبديل بين الصورة الأصلية والمعدلة"
                title={
                  isComparingOriginal
                    ? "التبديل إلى النسخة المعدّلة"
                    : "التبديل إلى النسخة الأصلية"
                }
                onClick={() => onToggleCompareOriginal && onToggleCompareOriginal()}
                className={`w-12 h-6.5 rounded-full p-0.5 cursor-pointer transition-all duration-200 border flex items-center ${
                  isComparingOriginal
                    ? "bg-gradient-to-r from-amber-500 to-amber-400 border-amber-300 shadow-md shadow-amber-500/40 justify-start"
                    : "bg-slate-800 border-slate-700 hover:border-purple-500/50 justify-end"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-all duration-200 flex items-center justify-center ${
                    isComparingOriginal ? "text-amber-700" : "text-slate-400"
                  }`}
                >
                  <Eye className="w-3 h-3" />
                </span>
              </PanelButton>
            </div>
          </div>

          {/* Hold to Compare Quick Button */}
          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-1.5">
            <PanelButton
              type="button"
              id="btn-hold-to-compare"
              onMouseDown={() => onSetCompareOriginal && onSetCompareOriginal(true)}
              onMouseUp={() => onSetCompareOriginal && onSetCompareOriginal(false)}
              onMouseLeave={() => onSetCompareOriginal && onSetCompareOriginal(false)}
              onTouchStart={() => onSetCompareOriginal && onSetCompareOriginal(true)}
              onTouchEnd={() => onSetCompareOriginal && onSetCompareOriginal(false)}
              title="اضغط مع الاستمرار لمعاينة الصورة الأصلية مؤقتًا، وافلت للعودة للتعديلات"
              className="flex-1 py-1 px-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 active:bg-amber-950/60 active:border-amber-500/60 active:text-amber-200 transition-all text-[11px] font-medium text-center select-none"
            >
              اضغط باستمرار للمعاينة السريعة
            </PanelButton>
            <span
              className="text-slate-500 text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono hidden sm:inline"
              title="اختصار لوحة المفاتيح: اضغط مفتاح \\ للمقارنة الفورية"
            >
              مفتاح \
            </span>
          </div>
        </div>
      )}

      {/* Dynamic Content Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs custom-scrollbar">
        {/* ========================================================= */}
        {/* 1. LAYER PROPERTIES & SELECT TOOL */}
        {/* ========================================================= */}
        {activeTool === "select" && activeLayer && (
          <div className="space-y-4">
            {/* Dimensions & Position Info Card */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">أبعاد الصورة المعروضة:</span>
                <span className="font-mono text-purple-300 font-bold">
                  {Math.round(activeLayer.width * activeLayer.scaleX)} × {Math.round(activeLayer.height * activeLayer.scaleY)} px
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                <span className="text-slate-400 text-[11px]">الموضع في اللوحة:</span>
                {(activeLayer.x !== 0 || activeLayer.y !== 0) && (
                  <button
                    type="button"
                    onClick={() => onUpdateLayerTransform({ x: 0, y: 0 })}
                    className="text-[10px] text-purple-400 hover:text-purple-300 font-medium hover:underline flex items-center gap-1"
                    title="إعادة موضع الصورة للمركز الأصلي (0, 0)"
                  >
                    <span>توسيط (0,0)</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono">X:</span>
                  <input
                    type="number"
                    value={Math.round(activeLayer.x)}
                    onChange={(e) => onUpdateLayerTransform({ x: Number(e.target.value) })}
                    className="w-16 bg-transparent text-right font-mono text-slate-200 text-[11px] focus:outline-none focus:text-purple-400"
                  />
                  <span className="text-[9px] text-slate-600 font-mono">px</span>
                </div>
                <div className="flex items-center justify-between bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono">Y:</span>
                  <input
                    type="number"
                    value={Math.round(activeLayer.y)}
                    onChange={(e) => onUpdateLayerTransform({ y: Number(e.target.value) })}
                    className="w-16 bg-transparent text-right font-mono text-slate-200 text-[11px] focus:outline-none focus:text-purple-400"
                  />
                  <span className="text-[9px] text-slate-600 font-mono">px</span>
                </div>
              </div>

              {/* Quick Image Metadata Button */}
              {onOpenMetadata && (
                <PanelButton
                  type="button"
                  id="btn-open-layer-metadata"
                  onClick={onOpenMetadata}
                  className="w-full mt-2 py-1.5 px-2.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-200 text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5"
                  title="عرض تفاصيل الملف الأساسية (Metadata) مثل الأبعاد الأصلية، حجم الملف، ومعلومات الألوان"
                >
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                  <span>تفاصيل وميتاداتا الصورة (Metadata)</span>
                </PanelButton>
              )}
            </div>

            {/* Stretch & Scale Section (تمديد أفقي ورأسي) */}
            <div className="space-y-3 p-3 rounded-xl bg-[#0f111f] border border-purple-500/20 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ExpandIcon className="w-3.5 h-3.5 text-purple-400" />
                  <span>التحجيم والتمديد (Stretch & Scale)</span>
                </span>
                <PanelButton
                  type="button"
                  onClick={() => setAspectLocked(!aspectLocked)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                    aspectLocked
                      ? "bg-purple-600/20 text-purple-300 border-purple-500/40 hover:bg-purple-600/30"
                      : "bg-slate-800 text-amber-300 border-amber-500/40 hover:bg-slate-700"
                  }`}
                  title={
                    aspectLocked
                      ? "نسبة الأبعاد مقفلة (تكبير متناسق). انقر لفك القفل وتمديد العرض أو الارتفاع بشكل منفصل"
                      : "نسبة الأبعاد حرة (تمديد حر). انقر لقفل النسبة والتكبير المتناسق"
                  }
                >
                  {aspectLocked ? (
                    <>
                      <Link className="w-3 h-3 text-purple-400" />
                      <span>تناسب مقفل</span>
                    </>
                  ) : (
                    <>
                      <Unlink className="w-3 h-3 text-amber-400" />
                      <span>تمديد حر</span>
                    </>
                  )}
                </PanelButton>
              </div>

              {/* Scale X (تمديد العرض أفقياً) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <span>تمديد العرض (أفقي):</span>
                    {!aspectLocked && (
                      <span className="text-[9px] px-1 rounded bg-amber-950/60 text-amber-400 border border-amber-500/30">
                        حر
                      </span>
                    )}
                  </span>
                  <span className="text-purple-300 font-mono font-bold">
                    {Math.round(activeLayer.scaleX * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="3.0"
                  step="0.01"
                  value={activeLayer.scaleX}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (aspectLocked) {
                      onUpdateLayerTransform({ scaleX: val, scaleY: val });
                    } else {
                      onUpdateLayerTransform({ scaleX: val });
                    }
                  }}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Scale Y (تمديد الارتفاع رأسياً) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <span>تمديد الارتفاع (رأسي):</span>
                    {!aspectLocked && (
                      <span className="text-[9px] px-1 rounded bg-amber-950/60 text-amber-400 border border-amber-500/30">
                        حر
                      </span>
                    )}
                  </span>
                  <span className="text-purple-300 font-mono font-bold">
                    {Math.round(activeLayer.scaleY * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="3.0"
                  step="0.01"
                  value={activeLayer.scaleY}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (aspectLocked) {
                      onUpdateLayerTransform({ scaleX: val, scaleY: val });
                    } else {
                      onUpdateLayerTransform({ scaleY: val });
                    }
                  }}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Quick Fitting & Stretching Presets */}
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <span className="text-[10px] text-slate-400 font-medium">أوامر التمديد والملاءمة السريعة:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <PanelButton
                    type="button"
                    onClick={() => {
                      // Stretch to completely fill canvas (ignores aspect ratio)
                      onUpdateLayerTransform({
                        scaleX: Number((canvasWidth / activeLayer.width).toFixed(3)),
                        scaleY: Number((canvasHeight / activeLayer.height).toFixed(3)),
                        x: 0,
                        y: 0,
                      });
                    }}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-purple-950/50 text-slate-300 hover:text-purple-200 border border-slate-800 hover:border-purple-500/40 text-[10px] font-medium transition-colors"
                    title="تمديد أبعاد الصورة بالكامل لتطابق مقاسات اللوحة (0,0)"
                  >
                    <Maximize className="w-3 h-3 text-purple-400" />
                    <span>تمديد لملء اللوحة</span>
                  </PanelButton>

                  <PanelButton
                    type="button"
                    onClick={() => {
                      // Fit inside canvas preserving aspect ratio
                      const ratio = Math.min(canvasWidth / activeLayer.width, canvasHeight / activeLayer.height);
                      onUpdateLayerTransform({
                        scaleX: Number(ratio.toFixed(3)),
                        scaleY: Number(ratio.toFixed(3)),
                        x: Math.round((canvasWidth - activeLayer.width * ratio) / 2),
                        y: Math.round((canvasHeight - activeLayer.height * ratio) / 2),
                      });
                    }}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-purple-950/50 text-slate-300 hover:text-purple-200 border border-slate-800 hover:border-purple-500/40 text-[10px] font-medium transition-colors"
                    title="ملاءمة الصورة داخل اللوحة مع الحفاظ على التناسب"
                  >
                    <Maximize2 className="w-3 h-3 text-cyan-400" />
                    <span>ملاءمة متناسقة</span>
                  </PanelButton>

                  <PanelButton
                    type="button"
                    onClick={() => {
                      // Center image on canvas
                      onUpdateLayerTransform({
                        x: Math.round((canvasWidth - activeLayer.width * activeLayer.scaleX) / 2),
                        y: Math.round((canvasHeight - activeLayer.height * activeLayer.scaleY) / 2),
                      });
                    }}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-purple-950/50 text-slate-300 hover:text-purple-200 border border-slate-800 hover:border-purple-500/40 text-[10px] font-medium transition-colors"
                    title="وضع الصورة في المنتصف تماماً"
                  >
                    <AlignCenter className="w-3 h-3 text-emerald-400" />
                    <span>توسيط في اللوحة</span>
                  </PanelButton>

                  <PanelButton
                    type="button"
                    onClick={() => {
                      // Reset to 100% original scale
                      onUpdateLayerTransform({ scaleX: 1, scaleY: 1 });
                    }}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-purple-950/50 text-slate-300 hover:text-purple-200 border border-slate-800 hover:border-purple-500/40 text-[10px] font-medium transition-colors"
                    title="إعادة مقياس الصورة إلى 100% الأصلي"
                  >
                    <RotateCcw className="w-3 h-3 text-amber-400" />
                    <span>100% الحجم الأصلي</span>
                  </PanelButton>
                </div>
              </div>

              {/* Dedicated Gradient Layer Controls if this is a Gradient Layer */}
              {activeLayer.type === "gradient" && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <GradientEditor
                    config={activeLayer.gradientConfig || DEFAULT_GRADIENT_CONFIG}
                    onChange={(newConfig) => {
                      onUpdateActiveGradientLayer?.(activeLayer.id, newConfig);
                    }}
                    title="تعديل تدرج الطبقة الحالية"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 1.1 GEOMETRIC TRANSFORM & ROTATION TOOL */}
        {/* ========================================================= */}
        {activeTool === "transform" && activeLayer && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-xs text-purple-200">التحويلات الهندسية والتدوير</span>
              </div>
              <span className="text-[10px] font-mono text-purple-300 bg-purple-900/40 px-2 py-0.5 rounded-full border border-purple-500/30">
                {Math.round(activeLayer.rotation)}°
              </span>
            </div>

            {/* Rotation Controls */}
            <div className="space-y-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>زاوية التدوير الحر:</span>
                <span className="text-purple-300 font-bold font-mono">{Math.round(activeLayer.rotation)}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                value={activeLayer.rotation}
                onChange={(e) => onUpdateLayerTransform({ rotation: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex items-center justify-between gap-1.5 pt-1">
                <PanelButton
                  type="button"
                  onClick={() => onUpdateLayerTransform({ rotation: (activeLayer.rotation - 90) % 360 })}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors"
                >
                  <RotateCw className="w-3 h-3 -scale-x-100 text-purple-400" />
                  <span>-90°</span>
                </PanelButton>
                <PanelButton
                  type="button"
                  onClick={() => onUpdateLayerTransform({ rotation: 0 })}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[11px] font-mono font-semibold transition-colors"
                >
                  0°
                </PanelButton>
                <PanelButton
                  type="button"
                  onClick={() => onUpdateLayerTransform({ rotation: (activeLayer.rotation + 90) % 360 })}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors"
                >
                  <RotateCw className="w-3 h-3 text-purple-400" />
                  <span>+90°</span>
                </PanelButton>
              </div>
            </div>

            {/* Flip / Symmetry Controls */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">تناظر الانعكاس (Flip):</span>
              <div className="grid grid-cols-2 gap-2">
                <PanelButton
                  type="button"
                  onClick={() => onUpdateLayerTransform({ flipX: !activeLayer.flipX })}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    activeLayer.flipX
                      ? "bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm"
                      : "bg-slate-800/60 border-slate-700 hover:bg-slate-800 text-slate-300"
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>انعكاس أفقي</span>
                </PanelButton>
                <PanelButton
                  type="button"
                  onClick={() => onUpdateLayerTransform({ flipY: !activeLayer.flipY })}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    activeLayer.flipY
                      ? "bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm"
                      : "bg-slate-800/60 border-slate-700 hover:bg-slate-800 text-slate-300"
                  }`}
                >
                  <FlipVertical className="w-3.5 h-3.5 text-purple-400" />
                  <span>انعكاس رأسي</span>
                </PanelButton>
              </div>
            </div>

            {/* Reset Transform */}
            <PanelButton
              type="button"
              onClick={() => onUpdateLayerTransform({ rotation: 0, flipX: false, flipY: false })}
              className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>إعادة ضبط التدوير والانعكاس</span>
            </PanelButton>
          </div>
        )}

        {/* ========================================================= */}
        {/* 1.2 DEDICATED CROP & FRAME TOOL */}
        {/* ========================================================= */}
        {activeTool === "crop" && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crop className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-xs text-indigo-200">أداة القص وتأطير المشهد</span>
              </div>
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-900/50 px-2 py-0.5 rounded-full border border-indigo-500/30 font-bold">
                {cropBox
                  ? `${Math.round(cropBox.width)} × ${Math.round(cropBox.height)} px`
                  : activeLayer
                  ? `${Math.round(activeLayer.width)} × ${Math.round(activeLayer.height)} px`
                  : `${canvasWidth} × ${canvasHeight} px`}
              </span>
            </div>

            {/* Crop Scope / Target: Full Document vs Active Layer */}
            <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[11px] font-medium text-slate-400">
                نطاق تطبيق القص:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <PanelButton
                  type="button"
                  onClick={() => onSetCropTarget?.("document")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                    cropTarget === "document"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  كامل مساحة العمل
                </PanelButton>
                <PanelButton
                  type="button"
                  disabled={!activeLayer}
                  onClick={() => onSetCropTarget?.("layer")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                    cropTarget === "layer"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                  }`}
                  title={!activeLayer ? "يرجى تحديد طبقة أولاً لتطبيق القص عليها" : ""}
                >
                  الطبقة المحددة فقط
                </PanelButton>
              </div>
            </div>

            {/* Aspect Ratio Presets */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300 font-medium">نسب أبعاد القص المسبقة:</span>
                {cropAspect && (
                  <button
                    type="button"
                    onClick={() => onSetCropAspect?.(null)}
                    className="text-[10px] text-purple-400 hover:text-purple-300 underline cursor-pointer"
                  >
                    إلغاء التقييد
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "قص حر", aspect: null },
                  { label: "1:1 مربع", aspect: 1 },
                  { label: "4:3 كلاسيكي", aspect: 4 / 3 },
                  { label: "16:9 سينمائي", aspect: 16 / 9 },
                  { label: "9:16 ريلز", aspect: 9 / 16 },
                  { label: "3:2 صورة", aspect: 3 / 2 },
                ].map((preset) => {
                  const isActive =
                    preset.aspect === null
                      ? cropAspect === null
                      : cropAspect !== null && Math.abs(cropAspect - preset.aspect) < 0.01;
                  return (
                    <PanelButton
                      key={preset.label}
                      type="button"
                      onClick={() => onSetCropAspect?.(preset.aspect)}
                      className={`py-2 px-1 rounded-lg text-[11px] font-medium text-center transition-all shadow-sm ${
                        isActive
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400"
                          : "bg-slate-800/90 hover:bg-purple-950/50 hover:text-purple-300 border border-slate-700 text-slate-300"
                      }`}
                    >
                      {preset.label}
                    </PanelButton>
                  );
                })}
              </div>
            </div>

            {/* Primary Crop Actions */}
            <div className="space-y-2">
              <PanelButton
                type="button"
                onClick={() => onConfirmCrop?.()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Check className="w-4 h-4" />
                <span>تطبيق القص وتأكيد الكادر (Enter)</span>
              </PanelButton>

              <div className="grid grid-cols-2 gap-2">
                <PanelButton
                  type="button"
                  onClick={() => onResetCropBox?.()}
                  className="py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>إعادة تعيين الكادر</span>
                </PanelButton>

                <PanelButton
                  type="button"
                  onClick={() => onCancelCrop?.()}
                  className="py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>إلغاء (Esc)</span>
                </PanelButton>
              </div>
            </div>

            {/* Helpful Guide Card */}
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-slate-300 text-[11px] leading-relaxed flex items-start gap-2">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                اسحب مقابض وأركان كادر القص في مساحة العمل لتحديد المساحة المطلوبة بدقة، أو انقر واسحب وسط الكادر لنقله. اضغط <kbd className="px-1 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[10px]">Enter</kbd> لتأكيد الاقتطاع النظيف دون أي تشويه لمحتوى الصورة.
              </span>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. POINT PROCESSING & TONE / LIGHT ADJUSTMENTS */}
        {/* ========================================================= */}
        {activeTool === "point" && (
          <div className="space-y-3.5">
            {/* 1. Scope Selector matching reference: "نطاق تطبيق التعديلات: الطبقة فقط | كامل المشروع" */}
            <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[11px] font-medium text-slate-400">
                نطاق تطبيق التعديلات:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <PanelButton
                  type="button"
                  onClick={() => onSetToneScope?.("layer")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold text-center transition-all ${
                    toneScope === "layer"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 border border-purple-400/40"
                      : "bg-slate-900/80 hover:bg-slate-800 text-slate-400 border border-slate-800"
                  }`}
                >
                  الطبقة فقط
                </PanelButton>
                <PanelButton
                  type="button"
                  onClick={() => onSetToneScope?.("project")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold text-center transition-all ${
                    toneScope === "project"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 border border-purple-400/40"
                      : "bg-slate-900/80 hover:bg-slate-800 text-slate-400 border border-slate-800"
                  }`}
                >
                  كامل المشروع
                </PanelButton>
              </div>
            </div>

            {/* 2. Active Layer Target Indicator matching reference */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-950/25 border border-purple-800/30 text-xs text-purple-200">
              <LayersIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <div className="truncate">
                <span className="text-slate-400">يتم التعديل على: </span>
                <span className="font-bold text-slate-200">
                  {activeLayer ? activeLayer.name : "لم يتم تحديد طبقة"}
                </span>
              </div>
            </div>

            {/* Sub-Tabs: Direct Sliders vs Advanced Histogram/Math */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
              <PanelButton
                type="button"
                onClick={() => setToneSubTab("sliders")}
                className={`flex-1 py-1.5 rounded-lg font-semibold text-center transition-all ${
                  toneSubTab === "sliders"
                    ? "bg-purple-600/40 text-purple-200 border border-purple-500/50"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                تعديل النغمة والضوء
              </PanelButton>
              <PanelButton
                type="button"
                onClick={() => setToneSubTab("advanced")}
                className={`flex-1 py-1.5 rounded-lg font-semibold text-center transition-all ${
                  toneSubTab === "advanced"
                    ? "bg-purple-600/40 text-purple-200 border border-purple-500/50"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                المخطط والتحويلات
              </PanelButton>
            </div>

            {/* TAB 1: 7 DIRECT SLIDERS matching reference screenshot */}
            {toneSubTab === "sliders" && (
              <div className="space-y-2.5">
                {[
                  {
                    key: "brightness" as keyof ToneAdjustments,
                    title: "السطوع (Brightness)",
                    desc: "رفع أو خفض الإضاءة الكلية للصورة",
                    icon: Sun,
                    val: toneAdjustments.brightness,
                    min: -100,
                    max: 100,
                  },
                  {
                    key: "contrast" as keyof ToneAdjustments,
                    title: "التباين (Contrast)",
                    desc: "الفارق بين المناطق الساطعة والداكنة",
                    icon: Contrast,
                    val: toneAdjustments.contrast,
                    min: -100,
                    max: 100,
                  },
                  {
                    key: "exposure" as keyof ToneAdjustments,
                    title: "التعرض للضوء (Exposure)",
                    desc: "مضاعفة كمية الضوء الساقط على الصورة",
                    icon: Zap,
                    val: toneAdjustments.exposure,
                    min: -100,
                    max: 100,
                  },
                  {
                    key: "lightBalance" as keyof ToneAdjustments,
                    title: "توازن الضوء والنغمة (Light Balance)",
                    desc: "موازنة الضوء الكلي وتوزيع الدرجات",
                    icon: SlidersHorizontal,
                    val: toneAdjustments.lightBalance,
                    min: -100,
                    max: 100,
                  },
                  {
                    key: "highlights" as keyof ToneAdjustments,
                    title: "تسليط الضوء (Highlights)",
                    desc: "التحكم في بريق المناطق الفاتحة فقط",
                    icon: Sparkles,
                    val: toneAdjustments.highlights,
                    min: -100,
                    max: 100,
                  },
                  {
                    key: "shadows" as keyof ToneAdjustments,
                    title: "الظلال (Shadows)",
                    desc: "تفتيح أو تعتيم المناطق المظلمة",
                    icon: Moon,
                    val: toneAdjustments.shadows,
                    min: -100,
                    max: 100,
                  },
                  {
                    key: "saturation" as keyof ToneAdjustments,
                    title: "التشبع اللوني (Saturation)",
                    desc: "كثافة ونقاء درجات الألوان",
                    icon: Droplets,
                    val: toneAdjustments.saturation,
                    min: -100,
                    max: 100,
                  },
                ].map((slider) => {
                  const Icon = slider.icon;
                  return (
                    <div
                      key={slider.key}
                      className="p-2.5 rounded-xl bg-[#101220]/80 border border-slate-800/80 hover:border-slate-700/80 space-y-1.5 transition-all"
                    >
                      {/* Top Label & Value */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-xs font-semibold text-slate-200">
                            {slider.title}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-purple-300">
                          {slider.val > 0 ? `+${slider.val}` : slider.val}
                        </span>
                      </div>

                      {/* Range Input Slider */}
                      <input
                        type="range"
                        min={slider.min}
                        max={slider.max}
                        value={slider.val}
                        onChange={(e) =>
                          onUpdateToneAdjustments?.({
                            [slider.key]: parseInt(e.target.value),
                          }, true)
                        }
                        onPointerUp={(e) =>
                          onUpdateToneAdjustments?.({
                            [slider.key]: parseInt((e.target as HTMLInputElement).value),
                          }, false)
                        }
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />

                      {/* Arabic Subtitle Description matching screenshot */}
                      <p className="text-[10px] text-slate-400 leading-tight">
                        {slider.desc}
                      </p>
                    </div>
                  );
                })}

                {/* Reset Action Button */}
                <PanelButton
                  type="button"
                  onClick={onResetToneAdjustments}
                  className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                  <span>إعادة تعيين كافة منزلقات الضوء إلى الصفر</span>
                </PanelButton>
              </div>
            )}

            {/* TAB 2: ADVANCED HISTOGRAM & MATH POINT PROCESSING */}
            {toneSubTab === "advanced" && (
              <div className="space-y-4">
            {/* Real-time Interactive Histogram */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-slate-300">
                  المخطط التكراري اللوني المباشر
                </span>
                <div className="flex items-center gap-1 text-[9px] font-mono">
                  {[
                    { id: "all", label: "الكل" },
                    { id: "r", label: "R" },
                    { id: "g", label: "G" },
                    { id: "b", label: "B" },
                    { id: "lum", label: "إضاءة" },
                  ].map((ch) => (
                    <PanelButton
                      key={ch.id}
                      onClick={() => setHistChannel(ch.id as any)}
                      className={`px-1.5 py-0.5 rounded ${
                        histChannel === ch.id ? "bg-purple-600 text-white font-bold" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {ch.label}
                    </PanelButton>
                  ))}
                </div>
              </div>

              <div className="h-24 w-full bg-[#07080f] rounded-lg border border-slate-800/80 p-1 flex items-center justify-center">
                <canvas ref={histCanvasRef} width={256} height={80} className="w-full h-full rounded" />
              </div>

              {/* Histogram Stats */}
              {histStats && (
                <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-center text-slate-400 pt-1 border-t border-slate-800/60">
                  <div>أدنى: <span className="text-slate-200">{histStats.min}</span></div>
                  <div>أقصى: <span className="text-slate-200">{histStats.max}</span></div>
                  <div>المتوسط: <span className="text-slate-200">{Math.round(histStats.mean)}</span></div>
                  <div>σ: <span className="text-slate-200">{Math.round(histStats.stdDev)}</span></div>
                </div>
              )}
            </div>

            {/* Point Modes Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">
                  نمط المعالجة النقطية (معاينة حية فورية):
                </span>
                {pointConfig.mode && pointConfig.mode !== "none" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-950/80 text-purple-300 border border-purple-500/40 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    معاينة نشطة
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">الأصل بدون تأثير</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {[
                  { id: "none", label: "الصورة الأصلية (بدون تأثير)" },
                  { id: "negative", label: "معكوس الصورة (سالب)" },
                  { id: "gamma", label: "تحويل القوة والأس (γ)" },
                  { id: "log", label: "التحويل اللوغاريتمي" },
                  { id: "threshold", label: "التقطيع بالعتبة" },
                  { id: "otsu", label: "عتبة أوتسو التلقائية" },
                  { id: "hist_eq", label: "موازنة التوزيع التكراري" },
                  { id: "bit_plane", label: "تقطيع المستويات الثنائية" },
                  { id: "sampling", label: "أخذ العينات (بكسلة)" },
                  { id: "quantization", label: "التكميم اللوني" },
                ].map((item) => {
                  const isModeActive = pointConfig.mode === item.id;
                  return (
                    <PanelButton
                      key={item.id}
                      onClick={() => onUpdatePointConfig({ mode: item.id as any })}
                      className={`py-2 px-2 rounded-lg border text-right transition-all flex items-center justify-between ${
                        isModeActive
                          ? "bg-purple-600/35 border-purple-400 text-white font-bold shadow-md shadow-purple-600/30 scale-[1.01]"
                          : "bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 text-slate-300"
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {isModeActive && (
                        <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0 ml-1" />
                      )}
                    </PanelButton>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Controls based on selected mode */}
            {pointConfig.mode === "gamma" && (
              <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>قيمة غاما (γ):</span>
                  <span className="text-purple-300 font-bold">{pointConfig.gamma.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="4.0"
                  step="0.05"
                  value={pointConfig.gamma}
                  onChange={(e) => onUpdatePointConfig({ gamma: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>γ &lt; 1 (تفتيح الظلال)</span>
                  <span>γ &gt; 1 (تعزيز التباين)</span>
                </div>
              </div>
            )}

            {pointConfig.mode === "log" && (
              <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>معامل المقياس اللوغاريتمي (c):</span>
                  <span className="text-purple-300 font-bold">{pointConfig.logC}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={pointConfig.logC}
                  onChange={(e) => onUpdatePointConfig({ logC: parseInt(e.target.value) })}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            )}

            {pointConfig.mode === "threshold" && (
              <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>قيمة العتبة (T):</span>
                  <span className="text-purple-300 font-bold">{pointConfig.thresholdValue}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={pointConfig.thresholdValue}
                  onChange={(e) => onUpdatePointConfig({ thresholdValue: parseInt(e.target.value) })}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <PanelButton
                  onClick={() => onUpdatePointConfig({ mode: "otsu" })}
                  className="w-full py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-900/70 border border-purple-500/40 text-purple-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  <span>التحويل إلى عتبة أوتسو التلقائية (Auto Otsu)</span>
                </PanelButton>
              </div>
            )}

            {pointConfig.mode === "otsu" && (
              <div className="space-y-1.5 p-2.5 rounded-lg bg-purple-950/25 border border-purple-800/40 text-xs text-purple-200">
                <div className="flex items-center gap-1.5 font-semibold text-purple-300">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  <span>عتبة أوتسو التلقائية الذكية (Otsu Threshold)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  تقوم بحساب قيمة العتبة الفاصلة المثلى تلقائياً عبر موازنة التباين البيني لخلفية الصورة ومحتواها دون الحاجة لتحديد قيمة يدوية.
                </p>
              </div>
            )}

            {pointConfig.mode === "bit_plane" && (
              <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[11px] text-slate-400">اختر المستوى الثنائي (0-7):</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((b) => (
                    <PanelButton
                      key={b}
                      onClick={() => onUpdatePointConfig({ bitPlaneIndex: b })}
                      className={`py-1.5 rounded text-xs font-mono font-bold border transition-colors ${
                        pointConfig.bitPlaneIndex === b
                          ? "bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-600/40 scale-[1.03]"
                          : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      بت {b} {b === 7 ? "(الأعلى)" : b === 0 ? "(الأدنى)" : ""}
                    </PanelButton>
                  ))}
                </div>
              </div>
            )}

            {pointConfig.mode === "sampling" && (
              <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>حجم كتلة التخفيض المكاني (Pixelation):</span>
                  <span className="text-purple-300 font-bold">{pointConfig.sampleFactor}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="48"
                  step="2"
                  value={pointConfig.sampleFactor}
                  onChange={(e) => onUpdatePointConfig({ sampleFactor: parseInt(e.target.value) })}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            )}

            {pointConfig.mode === "quantization" && (
              <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>مستويات التكميم اللوني:</span>
                  <span className="text-purple-300 font-bold">{pointConfig.quantLevels}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="32"
                  step="1"
                  value={pointConfig.quantLevels}
                  onChange={(e) => onUpdatePointConfig({ quantLevels: parseInt(e.target.value) })}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            )}

            {/* Channels Buttons */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">فصل القنوات اللونية:</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { mode: "channel_r", label: "أحمر (R)", col: "text-rose-400", activeStyle: "bg-rose-950/70 border-rose-500 text-rose-200 shadow-rose-950/50" },
                  { mode: "channel_g", label: "أخضر (G)", col: "text-emerald-400", activeStyle: "bg-emerald-950/70 border-emerald-500 text-emerald-200 shadow-emerald-950/50" },
                  { mode: "channel_b", label: "أزرق (B)", col: "text-blue-400", activeStyle: "bg-blue-950/70 border-blue-500 text-blue-200 shadow-blue-950/50" },
                  { mode: "channel_gray", label: "رمادي", col: "text-slate-300", activeStyle: "bg-slate-700/70 border-slate-400 text-white shadow-slate-950/50" },
                ].map((item) => {
                  const isChannelActive = pointConfig.mode === item.mode;
                  return (
                    <PanelButton
                      key={item.mode}
                      onClick={() => onUpdatePointConfig({ mode: item.mode as any })}
                      className={`py-1.5 rounded-lg border text-[11px] font-semibold text-center transition-all ${
                        isChannelActive
                          ? `${item.activeStyle} shadow-md scale-[1.02] font-bold`
                          : `bg-slate-900 border-slate-800 hover:bg-slate-800 ${item.col}`
                      }`}
                    >
                      {item.label}
                    </PanelButton>
                  );
                })}
              </div>
            </div>

            {/* Apply & Reset Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <PanelButton
                onClick={onResetPointProcessing}
                className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                إلغاء وإعادة ضبط
              </PanelButton>
              <PanelButton
                onClick={onApplyPointProcessing}
                className="flex-2 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-purple-600/30 transition-all active:scale-95"
              >
                تثبيت وحفظ على الطبقة
              </PanelButton>
            </div>
            </div>
          )}
        </div>
      )}

        {/* ========================================================= */}
        {/* 3. SPATIAL FILTERS & EDGE DETECTION */}
        {/* ========================================================= */}
        {activeTool === "spatial" && (() => {
          const activeFilterMeta =
            SPATIAL_FILTERS_CATALOG.find((f) => f.id === spatialConfig.type) || SPATIAL_FILTERS_CATALOG[0];
          const categoryFilters = SPATIAL_FILTERS_CATALOG.filter((f) => f.category === filterCategory);

          const handleCategoryChange = (cat: FilterCategory) => {
            setFilterCategory(cat);
            const currentMeta = SPATIAL_FILTERS_CATALOG.find((f) => f.id === spatialConfig.type);
            if (!currentMeta || currentMeta.category !== cat) {
              const firstInCat = SPATIAL_FILTERS_CATALOG.find((f) => f.category === cat);
              if (firstInCat) {
                onUpdateSpatialConfig({ type: firstInCat.id });
              }
            }
          };

          const CATEGORY_TABS: { id: FilterCategory; label: string; count: number }[] = [
            { id: "smoothing", label: "تنعيم وضوضاء", count: SPATIAL_FILTERS_CATALOG.filter(f => f.category === "smoothing").length },
            { id: "edges", label: "حواف وشحذ", count: SPATIAL_FILTERS_CATALOG.filter(f => f.category === "edges").length },
            { id: "morphology", label: "مورفولوجيا", count: SPATIAL_FILTERS_CATALOG.filter(f => f.category === "morphology").length },
            { id: "artistic", label: "فنية وتصويرية", count: SPATIAL_FILTERS_CATALOG.filter(f => f.category === "artistic").length },
          ];

          return (
            <div className="space-y-4">
              {/* Category Navigation Pills */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-medium text-slate-300">مجموعات المرشحات المكانية ({SPATIAL_FILTERS_CATALOG.length} مرشحاً):</span>
                  <span className="text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/50">
                    {CATEGORY_TABS.find((c) => c.id === filterCategory)?.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {CATEGORY_TABS.map((tab) => (
                    <PanelButton
                      key={tab.id}
                      onClick={() => handleCategoryChange(tab.id)}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-medium text-center transition-all flex items-center justify-between ${
                        filterCategory === tab.id
                          ? "bg-purple-600/30 border-purple-500 text-purple-200 font-bold shadow-sm shadow-purple-500/20"
                          : "bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 text-slate-300"
                      }`}
                    >
                      <span className="truncate">{tab.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          filterCategory === tab.id
                            ? "bg-purple-500/30 text-purple-200"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </PanelButton>
                  ))}
                </div>
              </div>

              {/* Filters in Current Category */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400">اختر المرشح المطلوب:</span>
                <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-0.5 custom-scrollbar">
                  {categoryFilters.map((item) => {
                    const isSelected = spatialConfig.type === item.id;
                    return (
                      <PanelButton
                        key={item.id}
                        onClick={() => onUpdateSpatialConfig({ type: item.id })}
                        className={`p-2 rounded-lg border text-right transition-all flex flex-col justify-between relative group ${
                          isSelected
                            ? "bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border-purple-500 text-purple-100 shadow-md shadow-purple-900/30"
                            : "bg-slate-900/60 border-slate-800/90 hover:bg-slate-800/80 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded ${
                              isSelected
                                ? "bg-purple-500/40 text-purple-200 font-semibold"
                                : "bg-slate-800/80 text-slate-400"
                            }`}
                          >
                            {item.badge}
                          </span>
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                          )}
                        </div>
                        <div className="font-semibold text-xs leading-tight">{item.nameAr}</div>
                        <div className="text-[10px] text-slate-400 font-sans truncate mt-0.5">
                          {item.nameEn}
                        </div>
                      </PanelButton>
                    );
                  })}
                </div>
              </div>

              {/* Active Filter Description Card */}
              {activeFilterMeta && (
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-purple-500/30 text-right space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-purple-300">
                      ID: {activeFilterMeta.id}
                    </span>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>{activeFilterMeta.nameAr}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({activeFilterMeta.nameEn})
                      </span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {activeFilterMeta.description}
                  </p>
                </div>
              )}

              {/* Dynamic Parameter Controls */}
              {/* 1. Kernel Size Slider for Blur / Smoothing & Morphology */}
              {[
                "mean",
                "gaussian",
                "median",
                "bilateral",
                "kuwahara",
                "min_filter",
                "max_filter",
                "midpoint",
                "harmonic",
                "alpha_trimmed",
                "dilation",
                "erosion",
                "opening",
                "closing",
                "morph_gradient",
                "tophat",
                "blackhat",
              ].includes(spatialConfig.type) && (
                <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>حجم مصفوفة النواة (النافذة):</span>
                    <span className="text-purple-300 font-bold">
                      {spatialConfig.kernelSize} × {spatialConfig.kernelSize}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="35"
                    step="2"
                    value={spatialConfig.kernelSize}
                    onChange={(e) => onUpdateSpatialConfig({ kernelSize: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>3×3</span>
                    <span>11×11</span>
                    <span>21×21</span>
                    <span>35×35</span>
                  </div>
                </div>
              )}

              {/* 2. Alpha Trim Count for Alpha-Trimmed filter */}
              {spatialConfig.type === "alpha_trimmed" && (
                <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>عدد النقاط الشاذة المستبعدة (Trim d):</span>
                    <span className="text-purple-300 font-bold">
                      {spatialConfig.trimAlpha ?? 2} بكسل من كل طرف
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={spatialConfig.trimAlpha ?? 2}
                    onChange={(e) => onUpdateSpatialConfig({ trimAlpha: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              )}

              {/* 3. Sigma Slider for Gaussian, LoG, Canny, Bilateral */}
              {["gaussian", "canny", "log", "bilateral"].includes(spatialConfig.type) && (
                <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>الانحراف المعياري المكاني لغاوس (σ_space):</span>
                    <span className="text-purple-300 font-bold">{spatialConfig.sigma.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="6.0"
                    step="0.1"
                    value={spatialConfig.sigma}
                    onChange={(e) => onUpdateSpatialConfig({ sigma: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              )}

              {/* 4. Sigma Color for Bilateral Filter */}
              {spatialConfig.type === "bilateral" && (
                <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>حساسية تباين الألوان (σ_color):</span>
                    <span className="text-purple-300 font-bold">
                      {(spatialConfig.sigmaColor ?? 40).toFixed(0)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="2"
                    value={spatialConfig.sigmaColor ?? 40}
                    onChange={(e) => onUpdateSpatialConfig({ sigmaColor: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="text-[10px] text-slate-400">
                    قيمة أعلى تعني تنعيماً أوسع عبر الفروقات اللونية، وقيمة أقل تحافظ بصرامة على الحواف.
                  </div>
                </div>
              )}

              {/* 5. Canny Dual Thresholds */}
              {spatialConfig.type === "canny" && (
                <div className="space-y-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>العتبة الدنيا (T_low):</span>
                      <span className="text-purple-300 font-bold">{spatialConfig.cannyLow}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="150"
                      value={spatialConfig.cannyLow}
                      onChange={(e) => onUpdateSpatialConfig({ cannyLow: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>العتبة العليا (T_high):</span>
                      <span className="text-indigo-300 font-bold">{spatialConfig.cannyHigh}</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="255"
                      value={spatialConfig.cannyHigh}
                      onChange={(e) => onUpdateSpatialConfig({ cannyHigh: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <div className="text-[10px] text-slate-400">
                    خاصية التلاكؤ (Hysteresis) تربط الحواف الضعيفة بالحواف القوية المتصلة وتستبعد الضوضاء المنفصلة.
                  </div>
                </div>
              )}

              {/* 6. Edge Cutoff Threshold for Sobel, Prewitt, Scharr, Roberts, LoG, Robinson, Kirsch */}
              {["sobel", "prewitt", "scharr", "roberts", "log", "robinson", "kirsch"].includes(
                spatialConfig.type
              ) && (
                <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>عتبة قص الحواف الضعيفة (Threshold):</span>
                    <span className="text-purple-300 font-bold">{spatialConfig.edgeThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="220"
                    value={spatialConfig.edgeThreshold}
                    onChange={(e) => onUpdateSpatialConfig({ edgeThreshold: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="text-[10px] text-slate-400">
                    {spatialConfig.edgeThreshold === 0
                      ? "إظهار خريطة التدرج المستمرة (Continuous Gradient Map)"
                      : `قص التدرجات الأقل من ${spatialConfig.edgeThreshold} إلى الصفر لتصفية الحواف`}
                  </div>
                </div>
              )}

              {/* 7. Unsharp Mask Amount & Radius */}
              {spatialConfig.type === "unsharp" && (
                <div className="space-y-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>مقدار الشحذ والتوضيح:</span>
                      <span className="text-purple-300 font-bold">{spatialConfig.unsharpAmount.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="4.0"
                      step="0.1"
                      value={spatialConfig.unsharpAmount}
                      onChange={(e) => onUpdateSpatialConfig({ unsharpAmount: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>نصف قطر القناع:</span>
                      <span className="text-purple-300 font-bold">{spatialConfig.unsharpRadius}px</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="8"
                      value={spatialConfig.unsharpRadius}
                      onChange={(e) => onUpdateSpatialConfig({ unsharpRadius: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* 8. High-Boost Factor */}
              {spatialConfig.type === "highboost" && (
                <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>عامل التعزيز (A ≥ 1.0):</span>
                    <span className="text-purple-300 font-bold">{spatialConfig.boostFactor.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="3.0"
                    step="0.05"
                    value={spatialConfig.boostFactor}
                    onChange={(e) => onUpdateSpatialConfig({ boostFactor: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="text-[10px] text-slate-400">
                    معادلة التعزيز: f_hb = (A - 1)·f_original + f_highpass
                  </div>
                </div>
              )}

              {/* 9. Laplacian 8-neighbor diagonal toggle */}
              {spatialConfig.type === "laplacian" && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-[11px] text-slate-300">نواة قطرية ثمانية الاتجاهات (8-neighbors):</span>
                  <input
                    type="checkbox"
                    checked={spatialConfig.laplacianDiagonal}
                    onChange={(e) => onUpdateSpatialConfig({ laplacianDiagonal: e.target.checked })}
                    className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                  />
                </div>
              )}

              {/* 10. Emboss Angle Selection */}
              {spatialConfig.type === "emboss" && (
                <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>زاوية سقوط الضوء للنقش (Emboss Angle):</span>
                    <span className="text-purple-300 font-bold">{spatialConfig.embossAngle ?? 45}°</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { angle: 0, label: "0° أفقي" },
                      { angle: 45, label: "45° مائل" },
                      { angle: 90, label: "90° عمودي" },
                      { angle: 135, label: "135° عكسي" },
                    ].map((btn) => (
                      <PanelButton
                        key={btn.angle}
                        onClick={() => onUpdateSpatialConfig({ embossAngle: btn.angle as any })}
                        className={`py-1 rounded text-[10px] font-medium border transition-colors ${
                          (spatialConfig.embossAngle ?? 45) === btn.angle
                            ? "bg-purple-600/40 border-purple-500 text-purple-200 font-bold"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        {btn.label}
                      </PanelButton>
                    ))}
                  </div>
                </div>
              )}

              {/* 11. Vignette Radius & Strength */}
              {spatialConfig.type === "vignette" && (
                <div className="space-y-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>نطاق التركيز الداخلي (Radius):</span>
                      <span className="text-purple-300 font-bold">
                        {((spatialConfig.vignetteRadius ?? 0.6) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="1.0"
                      step="0.05"
                      value={spatialConfig.vignetteRadius ?? 0.6}
                      onChange={(e) => onUpdateSpatialConfig({ vignetteRadius: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>شدة الإعتام الخارجي (Strength):</span>
                      <span className="text-purple-300 font-bold">
                        {((spatialConfig.vignetteStrength ?? 0.8) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={spatialConfig.vignetteStrength ?? 0.8}
                      onChange={(e) => onUpdateSpatialConfig({ vignetteStrength: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* 12. Glitch Offset Slider */}
              {spatialConfig.type === "glitch" && (
                <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>مقدار إزاحة القنوات اللونية (Offset):</span>
                    <span className="text-purple-300 font-bold">{spatialConfig.glitchOffset ?? 8}px</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="30"
                    step="1"
                    value={spatialConfig.glitchOffset ?? 8}
                    onChange={(e) => onUpdateSpatialConfig({ glitchOffset: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              )}

              {/* 13. Duotone Color Pickers */}
              {spatialConfig.type === "duotone" && (
                <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-[11px] text-slate-400">ألوان النغمة الثنائية (Duotone Palette):</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 p-1.5 rounded bg-slate-800/80 border border-slate-700">
                      <input
                        type="color"
                        value={spatialConfig.duotoneDarkColor ?? "#1e1b4b"}
                        onChange={(e) => onUpdateSpatialConfig({ duotoneDarkColor: e.target.value })}
                        className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                      />
                      <div className="text-[10px] text-right">
                        <div className="text-slate-300 font-medium">لون الظلال</div>
                        <div className="text-slate-500 font-mono text-[9px]">
                          {spatialConfig.duotoneDarkColor ?? "#1e1b4b"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 rounded bg-slate-800/80 border border-slate-700">
                      <input
                        type="color"
                        value={spatialConfig.duotoneLightColor ?? "#fbbf24"}
                        onChange={(e) => onUpdateSpatialConfig({ duotoneLightColor: e.target.value })}
                        className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                      />
                      <div className="text-[10px] text-right">
                        <div className="text-slate-300 font-medium">لون الإضاءة</div>
                        <div className="text-slate-500 font-mono text-[9px]">
                          {spatialConfig.duotoneLightColor ?? "#fbbf24"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Apply Filter Action Buttons */}
              <div className="space-y-2 pt-2">
                <PanelButton
                  onClick={() => onApplySpatialFilter(false)}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-purple-600/30 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تطبيق {activeFilterMeta.nameAr} على الطبقة الحالية</span>
                </PanelButton>
                <PanelButton
                  onClick={() => onApplySpatialFilter(true)}
                  className="w-full py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-purple-300 border border-purple-500/30 font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>تطبيق كطبقة جديدة منفصلة</span>
                </PanelButton>
              </div>
            </div>
          );
        })()}

        {/* ========================================================= */}
        {/* 3.1 DEDICATED HD ENHANCE & SHARPEN TOOL */}
        {/* ========================================================= */}
        {activeTool === "enhance" && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-xs text-purple-200">توضيح وتحسين الدقة والشحذ (HD)</span>
              </div>
              <span className="text-[10px] font-mono text-purple-300 bg-purple-900/40 px-2 py-0.5 rounded-full border border-purple-500/30">
                Sharpening Engine
              </span>
            </div>

            {/* Presets */}
            <div className="space-y-2">
              <span className="text-[11px] text-slate-400">خوارزمية الشحذ والوضوح:</span>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    id: "unsharp_mask",
                    title: "قناع الشحذ الفائق (Unsharp Mask)",
                    desc: "أقوى خوارزمية لإبراز تفاصيل الملامح والأقمشة والمعالم الدقيقة",
                    badge: "الأكثر شيوعاً",
                  },
                  {
                    id: "laplacian",
                    title: "مرشح لابلاسيان عالي التفاصيل (Laplacian High-Pass)",
                    desc: "يعزز الترددات المكانية العالية ويعيد إبراز الحواف الباهتة",
                    badge: "دقة بصرية",
                  },
                  {
                    id: "canny",
                    title: "شحذ الحواف الموجه (Canny Edge Detail)",
                    desc: "كشف حواف دقيق وحفظ التدرجات اللونية الناعمة من التشويش",
                    badge: "تحليل ذكي",
                  },
                  {
                    id: "high_boost",
                    title: "التعزيز عالي التردد (High-Boost Filter)",
                    desc: "مضاعفة شدة التباين الموضعي لرفع حدة الصورة الإجمالية",
                    badge: "تباين فائق",
                  },
                ].map((item) => {
                  const isSelected = spatialConfig.type === item.id;
                  return (
                    <PanelButton
                      key={item.id}
                      type="button"
                      onClick={() => onUpdateSpatialConfig({ type: item.id as any })}
                      className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${
                        isSelected
                          ? "bg-purple-900/40 border-purple-500 text-purple-100 shadow-md shadow-purple-900/30 ring-1 ring-purple-400"
                          : "bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{item.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 border border-slate-700 font-mono">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{item.desc}</p>
                    </PanelButton>
                  );
                })}
              </div>
            </div>

            {/* Strength slider */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>شدة وقوة الشحذ (Strength):</span>
                <span className="text-purple-300 font-bold font-mono">
                  {spatialConfig.strength ?? 1.5}x
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={spatialConfig.strength ?? 1.5}
                onChange={(e) => onUpdateSpatialConfig({ strength: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            {/* Apply Actions */}
            <div className="space-y-2 pt-1">
              <PanelButton
                type="button"
                onClick={() => onApplySpatialFilter(false)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>تطبيق التوضيح والشحذ على الطبقة الحالية</span>
              </PanelButton>
              <PanelButton
                type="button"
                onClick={() => onApplySpatialFilter(true)}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>تطبيق كطبقة جديدة منفصلة</span>
              </PanelButton>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. AI COMPUTER VISION & ADVANCED SEGMENTATION */}
        {/* ========================================================= */}
        {(activeTool === "ai" ||
          activeTool === "segmentation" ||
          activeTool === "ocr" ||
          activeTool === "object_detection") && (
          <div className="space-y-4">
            {/* AI Mode Subtabs (Visible when in AI Hub tool) */}
            {activeTool === "ai" && (
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
                <PanelButton
                  type="button"
                  onClick={() => onSelectAiSubTab && onSelectAiSubTab("segmentation")}
                  className={`py-2 px-1 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    activeAiSubTab === "segmentation"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>التجزئة</span>
                </PanelButton>
                <PanelButton
                  type="button"
                  onClick={() => onSelectAiSubTab && onSelectAiSubTab("ocr")}
                  className={`py-2 px-1 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    activeAiSubTab === "ocr"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Scan className="w-3.5 h-3.5" />
                  <span>استخراج النص</span>
                </PanelButton>
                <PanelButton
                  type="button"
                  onClick={() => onSelectAiSubTab && onSelectAiSubTab("object_detection")}
                  className={`py-2 px-1 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    activeAiSubTab === "object_detection"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>كشف الكائنات</span>
                </PanelButton>
              </div>
            )}

            {isAiProcessing && (
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/40 flex items-center gap-2.5 text-xs text-purple-300 animate-pulse font-mono">
                <Cpu className="w-4 h-4 animate-spin text-cyan-400" />
                <span>محرك المعالجة يحلل بكسلات الصورة بدقة...</span>
              </div>
            )}

            {aiNotice && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex flex-col gap-1.5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>تنبيه محرك الذكاء الاصطناعي</span>
                  </div>
                  {onDismissAiNotice && (
                    <PanelButton
                      onClick={onDismissAiNotice}
                      className="text-amber-400/70 hover:text-amber-200 text-xs font-mono px-1"
                      title="إغلاق التنبيه"
                    >
                      ✕
                    </PanelButton>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-amber-200/90 font-sans">
                  {aiNotice.message}
                </p>
              </div>
            )}

            {/* TAB 1: SEGMENTATION METHODS */}
            {(activeTool === "segmentation" || (activeTool === "ai" && activeAiSubTab === "segmentation")) && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>طريقة التجزئة (Segmentation Method)</span>
                  </span>
                  <span className="text-[10px] font-mono text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-500/30">
                    {SEGMENTATION_METHODS_CATALOG.find((m) => m.id === segmentConfig.method)?.badge}
                  </span>
                </div>

                {/* Segmentation Method Cards (Matching User Reference Image) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SEGMENTATION_METHODS_CATALOG.map((method) => {
                    const isSelected = segmentConfig.method === method.id;
                    return (
                      <PanelButton
                        key={method.id}
                        type="button"
                        onClick={() => {
                          if (onUpdateSegmentConfig) onUpdateSegmentConfig({ method: method.id });
                          if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, method: method.id });
                        }}
                        className={`p-2.5 rounded-xl text-right transition-all border flex flex-col justify-between gap-1.5 relative ${
                          isSelected
                            ? "bg-gradient-to-br from-purple-950/90 via-purple-900/50 to-slate-900/90 border-purple-500 shadow-md shadow-purple-900/30 ring-1 ring-purple-400"
                            : "bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                              isSelected
                                ? "bg-purple-400 shadow-[0_0_8px_#a855f7]"
                                : "bg-slate-600"
                            }`}
                          />
                          <div className="flex-1">
                            <div
                              className={`text-xs font-bold ${
                                isSelected ? "text-purple-200" : "text-slate-200"
                              }`}
                            >
                              {method.nameAr}
                            </div>
                            <div className="text-[9px] font-mono text-slate-400">
                              {method.nameEn}
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-slate-400">
                          {method.description}
                        </p>
                      </PanelButton>
                    );
                  })}
                </div>

                {/* Method Specific Parameter Settings */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-purple-500/20 space-y-3">
                  <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>إعدادات خوارزمية التجزئة:</span>
                    <span className="font-mono text-purple-400 text-[10px]">
                      {segmentConfig.method.toUpperCase()}
                    </span>
                  </div>

                  {/* K-Means Settings */}
                  {segmentConfig.method === "kmeans" && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">عدد العناقيد اللونية (K):</span>
                        <span className="font-mono text-purple-400 font-bold">
                          {segmentConfig.kClusters} مجموعات
                        </span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="8"
                        step="1"
                        value={segmentConfig.kClusters}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (onUpdateSegmentConfig) onUpdateSegmentConfig({ kClusters: val });
                          if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, kClusters: val });
                        }}
                        onPointerUp={(e) => {
                          const val = Number((e.target as HTMLInputElement).value);
                          if (onUpdateSegmentConfig) onUpdateSegmentConfig({ kClusters: val });
                          if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, kClusters: val });
                        }}
                        className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] font-mono text-slate-500">
                        <span>2 (أساسي)</span>
                        <span>4 (متوازن)</span>
                        <span>8 (دقيق)</span>
                      </div>
                    </div>
                  )}

                  {/* Watershed Boundaries Settings */}
                  {segmentConfig.method === "watershed" && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">حساسية الكشف الطبوغرافي:</span>
                          <span className="font-mono text-purple-400 font-bold">
                            مستوى {segmentConfig.watershedSensitivity}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          step="1"
                          value={segmentConfig.watershedSensitivity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (onUpdateSegmentConfig) onUpdateSegmentConfig({ watershedSensitivity: val });
                            if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, watershedSensitivity: val });
                          }}
                          onPointerUp={(e) => {
                            const val = Number((e.target as HTMLInputElement).value);
                            if (onUpdateSegmentConfig) onUpdateSegmentConfig({ watershedSensitivity: val });
                            if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, watershedSensitivity: val });
                          }}
                          className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>
                      <label className="flex items-center justify-between text-[11px] text-slate-300 cursor-pointer">
                        <span>إبراز سدود الفواصل (Watershed Dams):</span>
                        <input
                          type="checkbox"
                          checked={segmentConfig.watershedShowBorders}
                          onChange={(e) => {
                            const val = e.target.checked;
                            if (onUpdateSegmentConfig) onUpdateSegmentConfig({ watershedShowBorders: val });
                            if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, watershedShowBorders: val });
                          }}
                          className="rounded accent-purple-600 w-4 h-4 cursor-pointer"
                        />
                      </label>
                    </div>
                  )}

                  {/* Foreground Cut Settings */}
                  {segmentConfig.method === "foreground_cut" && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">حساسية عزل الموضوع:</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {segmentConfig.foregroundSensitivity}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="90"
                        step="5"
                        value={segmentConfig.foregroundSensitivity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (onUpdateSegmentConfig) onUpdateSegmentConfig({ foregroundSensitivity: val });
                          if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, foregroundSensitivity: val });
                        }}
                        onPointerUp={(e) => {
                          const val = Number((e.target as HTMLInputElement).value);
                          if (onUpdateSegmentConfig) onUpdateSegmentConfig({ foregroundSensitivity: val });
                          if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, foregroundSensitivity: val });
                        }}
                        className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Otsu's Thresholding Settings */}
                  {segmentConfig.method === "otsu" && (
                    <div className="space-y-2.5">
                      <label className="flex items-center justify-between text-[11px] text-slate-300 cursor-pointer">
                        <span>عكس التجزئة (Invert Foreground):</span>
                        <input
                          type="checkbox"
                          checked={segmentConfig.otsuInvert}
                          onChange={(e) => {
                            const val = e.target.checked;
                            if (onUpdateSegmentConfig) onUpdateSegmentConfig({ otsuInvert: val });
                            if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, otsuInvert: val });
                          }}
                          className="rounded accent-purple-600 w-4 h-4 cursor-pointer"
                        />
                      </label>
                      <label className="flex items-center justify-between text-[11px] text-slate-300 cursor-pointer">
                        <span>تطبيق كقناع شفافية ألفا (Alpha Cutout):</span>
                        <input
                          type="checkbox"
                          checked={segmentConfig.otsuAsMask}
                          onChange={(e) => {
                            const val = e.target.checked;
                            if (onUpdateSegmentConfig) onUpdateSegmentConfig({ otsuAsMask: val });
                            if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, otsuAsMask: val });
                          }}
                          className="rounded accent-purple-600 w-4 h-4 cursor-pointer"
                        />
                      </label>
                    </div>
                  )}

                  {/* Adaptive Thresholding Settings */}
                  {segmentConfig.method === "adaptive" && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <span className="text-[11px] text-slate-400 block">
                          حجم نافذة الجوار المكاني (Block Size):
                        </span>
                        <div className="grid grid-cols-4 gap-1">
                          {[7, 15, 25, 35].map((bs) => (
                            <PanelButton
                              key={bs}
                              type="button"
                              onClick={() => {
                                if (onUpdateSegmentConfig) onUpdateSegmentConfig({ adaptiveBlockSize: bs });
                                if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, adaptiveBlockSize: bs });
                              }}
                              className={`py-1 rounded text-[11px] font-mono border ${
                                segmentConfig.adaptiveBlockSize === bs
                                  ? "bg-sky-600 border-sky-400 text-white font-bold"
                                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                              }`}
                            >
                              {bs}×{bs}
                            </PanelButton>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">ثابت تعويض الإضاءة (C):</span>
                          <span className="font-mono text-sky-400 font-bold">
                            {segmentConfig.adaptiveC}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-20"
                          max="20"
                          step="1"
                          value={segmentConfig.adaptiveC}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (onUpdateSegmentConfig) onUpdateSegmentConfig({ adaptiveC: val });
                            if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, adaptiveC: val });
                          }}
                          onPointerUp={(e) => {
                            const val = Number((e.target as HTMLInputElement).value);
                            if (onUpdateSegmentConfig) onUpdateSegmentConfig({ adaptiveC: val });
                            if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, adaptiveC: val });
                          }}
                          className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      <label className="flex items-center justify-between text-[11px] text-slate-300 cursor-pointer">
                        <span>عكس التجزئة التكيفية (Invert):</span>
                        <input
                          type="checkbox"
                          checked={segmentConfig.adaptiveInvert}
                          onChange={(e) => {
                            const val = e.target.checked;
                            if (onUpdateSegmentConfig) onUpdateSegmentConfig({ adaptiveInvert: val });
                            if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, adaptiveInvert: val });
                          }}
                          className="rounded accent-sky-600 w-4 h-4 cursor-pointer"
                        />
                      </label>
                    </div>
                  )}

                  {/* Color Slicing Settings */}
                  {segmentConfig.method === "color_slicing" && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">مدى التسامح اللوني:</span>
                        <span className="font-mono text-purple-400 font-bold">
                          ±{segmentConfig.colorTolerance}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="80"
                        step="2"
                        value={segmentConfig.colorTolerance}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (onUpdateSegmentConfig) onUpdateSegmentConfig({ colorTolerance: val });
                          if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, colorTolerance: val });
                        }}
                        onPointerUp={(e) => {
                          const val = Number((e.target as HTMLInputElement).value);
                          if (onUpdateSegmentConfig) onUpdateSegmentConfig({ colorTolerance: val });
                          if (onApplySegmentation) onApplySegmentation(false, true, { ...segmentConfig, colorTolerance: val });
                        }}
                        className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* Primary Apply Action Buttons */}
                <div className="space-y-2 pt-1">
                  <PanelButton
                    type="button"
                    onClick={() =>
                      onApplySegmentation && onApplySegmentation(false)
                    }
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Scissors className="w-4 h-4" />
                    <span>تطبيق التجزئة على الطبقة الحالية</span>
                  </PanelButton>

                  <PanelButton
                    type="button"
                    onClick={() =>
                      onApplySegmentation && onApplySegmentation(true)
                    }
                    className="w-full py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-purple-300 border border-purple-500/30 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>تطبيق كطبقة جديدة منفصلة</span>
                  </PanelButton>

                  {onRevertSegmentation && (
                    <PanelButton
                      type="button"
                      onClick={onRevertSegmentation}
                      className="w-full py-2 rounded-xl bg-slate-900/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-200 border border-slate-700/80 hover:border-rose-500/50 text-xs font-semibold shadow transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4 text-rose-400" />
                      <span>إلغاء المعاينة واستعادة الأصل</span>
                    </PanelButton>
                  )}

                  <PanelButton
                    type="button"
                    disabled={isAiProcessing}
                    onClick={() => onRunAiVision("segmentation")}
                    className="w-full py-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border border-purple-500/30 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    <span>تحليل دلالي متقدم بالذكاء الاصطناعي (AI Semantic Segments)</span>
                  </PanelButton>

                  {/* Extracted Segments List (Only inside Segmentation Tab) */}
                  {segments.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-purple-500/20">
                      <span className="text-[11px] text-slate-300 font-bold flex items-center justify-between">
                        <span>المناطق والقطع المقسمة ({segments.length}):</span>
                        <span className="text-[10px] text-purple-400 font-normal">جاهزة للعزل كطبقات</span>
                      </span>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                        {segments.map((seg) => (
                          <div
                            key={seg.segmentId}
                            className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0 text-right">
                              <span
                                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                                style={{ backgroundColor: seg.colorHex || "#a855f7" }}
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-slate-200 truncate">
                                  {seg.name}
                                </div>
                                <div className="text-[10px] font-mono text-purple-400/80">
                                  {seg.pixelCount ? `${seg.pixelCount.toLocaleString()} بكسل` : seg.type}
                                </div>
                              </div>
                            </div>
                            <PanelButton
                              onClick={() => onIsolateSegment(seg)}
                              className="px-2 py-1 rounded bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-[10px] font-semibold whitespace-nowrap"
                              title="عزل هذه المنطقة كطبقة مستقلة"
                            >
                              عزل كطبقة
                            </PanelButton>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: OCR EXTRACT TEXT */}
            {(activeTool === "ocr" || (activeTool === "ai" && activeAiSubTab === "ocr")) && (
              <div className="space-y-3">
                {/* Local Deep Learning Engine Banner */}
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-slate-900 border border-emerald-500/30 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-300 text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                      <span>محرك التعلم العميق المحلي (EasyOCR)</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-mono font-medium border border-emerald-500/30">
                      CRAFT + CRNN
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 leading-tight">
                    يعمل محلياً بالكامل 100% بدون إنترنت وبدون نموذج جيمناي (Gemini).
                  </div>
                </div>

                {/* Language Selection Pills */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-300">
                    لغة التعرف (Recognition Language):
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900/80 border border-slate-800 rounded-lg">
                    {[
                      { id: "ar+en", label: "عربي + إنجليزي" },
                      { id: "ar", label: "عربي فقط" },
                      { id: "en", label: "English" },
                    ].map((lang) => (
                      <PanelButton
                        key={lang.id}
                        onClick={() => onSelectOcrLanguage && onSelectOcrLanguage(lang.id as any)}
                        className={`py-1.5 text-[10px] font-semibold rounded-md transition-all text-center ${
                          ocrLanguage === lang.id
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/30"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        }`}
                      >
                        {lang.label}
                      </PanelButton>
                    ))}
                  </div>
                </div>

                {/* CLAHE Enhancement Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-right">
                    <span className="text-[11px] font-medium text-slate-300 block">
                      تحسين التباين والمعالجة المسبقة:
                    </span>
                    <span className="text-[9px] text-slate-500 block">
                      (CLAHE) لمعالجة النصوص الخافتة أو منخفضة التباين
                    </span>
                  </div>
                  <PanelButton
                    onClick={() => onToggleOcrEnhance && onToggleOcrEnhance()}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                      ocrEnhance ? "bg-blue-600 justify-end" : "bg-slate-700 justify-start"
                    } flex items-center`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </PanelButton>
                </div>

                {/* Action Run Button */}
                <PanelButton
                  type="button"
                  disabled={isAiProcessing}
                  onClick={() => onRunAiVision("ocr")}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isAiProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>جارٍ قراءة النصوص محلياً عبر الشبكة العصبية...</span>
                    </>
                  ) : (
                    <>
                      <Scan className="w-4 h-4" />
                      <span>بدء استخراج النصوص (EasyOCR محلي)</span>
                    </>
                  )}
                </PanelButton>

                {/* Results Section */}
                {ocrBlocks.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-300 font-medium">
                        الكتل النصية المستخرجة ({ocrBlocks.length}):
                      </span>
                      <PanelButton
                        onClick={() => {
                          const all = ocrBlocks.map((b) => b.text).join("\n");
                          navigator.clipboard.writeText(all);
                        }}
                        className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-950/30 hover:bg-purple-900/40 px-2 py-1 rounded border border-purple-500/20"
                      >
                        <Copy className="w-2.5 h-2.5" />
                        <span>نسخ الكل</span>
                      </PanelButton>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                      {ocrBlocks.map((block, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 flex flex-col gap-2 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0 text-right">
                              <div className="text-xs font-semibold text-slate-100 select-text leading-snug">
                                {block.text}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[10px]">
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-medium ${
                                  block.language === "العربية" || block.langCode === "ar"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                }`}>
                                  {block.language || (block.langCode === "ar" ? "عربي" : "إنجليزي")}
                                </span>
                                <span className="font-mono text-slate-400">
                                  دقة: {Math.round((block.confidence || 0.95) * 100)}%
                                </span>
                              </div>
                            </div>
                            <PanelButton
                              onClick={() => {
                                navigator.clipboard.writeText(block.text);
                              }}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                              title="نسخ هذا النص"
                            >
                              <Copy className="w-3 h-3" />
                            </PanelButton>
                          </div>
                          <div className="flex items-center justify-end">
                            <PanelButton
                              onClick={() => onAddOcrTextLayer(block)}
                              className="px-2.5 py-1 rounded-md bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-[10px] font-semibold flex items-center gap-1.5 shadow-sm border border-purple-500/30"
                              title="إدراج كطبقة نص قابلة للتحرير في نفس موضعها على الصورة"
                            >
                              <Plus className="w-3 h-3" />
                              <span>إدراج كطبقة نص في موضعها</span>
                            </PanelButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* OCR Guidance Tip */}
                <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 text-slate-300 text-[11px] leading-relaxed flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    محرك EasyOCR المحلي يعتمد على شبكة عصبية عميقة (CRAFT لكشف المواضع و CRNN للتعرف اللغوي) ويقوم بتحويل الكلمات المكتوبة في الصورة إلى نصوص فورية مع إمكانية تحويلها إلى طبقات تصميمية قابلة للتحرير دون أي اعتماد على خدمات سحابية.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 3: OBJECT DETECTION (YOLO11s Local) */}
            {(activeTool === "object_detection" || (activeTool === "ai" && activeAiSubTab === "object_detection")) && (
              <div className="space-y-3.5">
                {/* Offline Local AI Engine Banner */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-cyan-950/40 border border-emerald-500/30 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="font-semibold text-emerald-300">محرك YOLO11s محلي (Offline)</span>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-700/50 font-bold">
                    الأعلى دقة (Small)
                  </span>
                </div>

                {/* Dedicated Model Info */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs">
                  <span className="text-slate-400 text-[11px]">قاعدة البيانات المدربة:</span>
                  <span className="text-slate-200 font-mono text-[11px] font-semibold">MS COCO (80 فئة)</span>
                </div>

                {/* Confidence Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">عتبة الثقة (Confidence):</span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {Math.round(yoloConfidence * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="85"
                    step="5"
                    value={Math.round(yoloConfidence * 100)}
                    onChange={(e) =>
                      onSelectYoloConfidence &&
                      onSelectYoloConfidence(Number(e.target.value) / 100)
                    }
                    className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>15% (كشف كل شيء)</span>
                    <span>85% (أعلى يقين)</span>
                  </div>
                </div>

                {/* Run Detection Button */}
                <PanelButton
                  type="button"
                  disabled={isAiProcessing}
                  onClick={() => onRunAiVision("object_detection")}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isAiProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-200" />
                      <span>جاري الفحص بـ YOLO11...</span>
                    </>
                  ) : (
                    <>
                      <Cpu className="w-4 h-4 text-cyan-200" />
                      <span>بدء كشف الكائنات بـ YOLO11</span>
                    </>
                  )}
                </PanelButton>

                {/* Bounding Boxes Visibility Switch */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-[11px] text-slate-300">
                    إظهار إطارات التحديد والتعرف:
                  </span>
                  <PanelButton
                    onClick={onToggleBoundingBoxes}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-mono border transition-all ${
                      showBoundingBoxes
                        ? "bg-purple-600 border-purple-400 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}
                  >
                    {showBoundingBoxes ? "ظاهر" : "مخفي"}
                  </PanelButton>
                </div>

                {/* Detected Objects List */}
                {detectedObjects.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">
                        الكائنات المكتشفة ({detectedObjects.length}):
                      </span>
                      {onExtractAllObjectsAsLayers && detectedObjects.length > 1 && (
                        <div className="flex items-center gap-1">
                          <PanelButton
                            type="button"
                            onClick={() => onExtractAllObjectsAsLayers(true)}
                            className="px-2 py-1 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-[10px] font-semibold flex items-center gap-1 border border-purple-700/60"
                            title="عزل وتفريغ جميع الكائنات كطبقات شفافة"
                          >
                            <Sparkles className="w-3 h-3 text-purple-300" />
                            <span>تفريغ الكل</span>
                          </PanelButton>
                          <PanelButton
                            type="button"
                            onClick={() => onExtractAllObjectsAsLayers(false)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 text-[10px] font-semibold flex items-center gap-1 border border-slate-700"
                            title="استخراج مستطيلات الكائنات كطبقات"
                          >
                            <Scissors className="w-3 h-3" />
                            <span>قص الكل</span>
                          </PanelButton>
                        </div>
                      )}
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                      {detectedObjects.map((obj, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 flex items-center justify-between gap-2 group transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                              style={{
                                backgroundColor: obj.colorHex || "#a855f7",
                              }}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-200 truncate">
                                {obj.labelAr || obj.label}
                              </div>
                              {obj.labelAr && obj.labelAr !== obj.label && (
                                <div className="text-[10px] text-slate-400 font-mono capitalize">
                                  {obj.label}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] font-mono font-semibold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
                              {Math.round(obj.confidence * 100)}%
                            </span>

                            {onExtractObjectAsLayer && (
                              <div className="flex items-center gap-1">
                                <Tooltip content="عزل هذا الكائن وتفريغ خلفيته بالذكاء الاصطناعي كطبقة شفافة">
                                  <PanelButton
                                    type="button"
                                    onClick={() => onExtractObjectAsLayer(obj, true)}
                                    className="p-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 transition-all flex items-center justify-center"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </PanelButton>
                                </Tooltip>
                                <Tooltip content="استخراج مستطيل هذا الكائن كطبقة جديدة في الكانفاس">
                                  <PanelButton
                                    type="button"
                                    onClick={() => onExtractObjectAsLayer(obj, false)}
                                    className="p-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 transition-all flex items-center justify-center"
                                  >
                                    <Scissors className="w-3.5 h-3.5" />
                                  </PanelButton>
                                </Tooltip>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* 4.5 LASSO SELECTION TOOL PROPERTIES */}
        {/* ========================================================= */}
        {activeTool === "lasso" && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center gap-2.5">
              <LassoSelect className="w-5 h-5 text-purple-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-purple-200">
                  أدوات التحديد المتقدم (Lasso Selection)
                </div>
                <div className="text-[10px] text-purple-300/80">
                  حدد مناطق معينة من الصورة قبل تطبيق الفلاتر أو عزلها كطبقات مستقلة
                </div>
              </div>
            </div>

            {/* Lasso Selection Mode */}
            <div className="space-y-2">
              <span className="text-[11px] text-slate-400 font-semibold">
                نمط التحديد:
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "polygon", label: "مضلع بالنقاط", sub: "Polygon Lasso" },
                  { id: "magnetic", label: "مغناطيسي", sub: "Magnetic Lasso" },
                  { id: "freehand", label: "رسم حر", sub: "Freehand Lasso" },
                ].map((m) => (
                  <PanelButton
                    key={m.id}
                    onClick={() =>
                      onUpdateSelectionRegion &&
                      onUpdateSelectionRegion({ mode: m.id as any })
                    }
                    className={`py-2 px-1 rounded-xl border text-center transition-all ${
                      selectionRegion.mode === m.id
                        ? "bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-600/30 font-bold"
                        : "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="text-xs">{m.label}</div>
                    <div className="text-[9px] opacity-75 font-mono">{m.sub}</div>
                  </PanelButton>
                ))}
              </div>
            </div>

            {/* Selection Status & Points */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">حالة التحديد:</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-purple-300">
                  {selectionRegion.points.length} نقاط
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] ${
                    selectionRegion.isClosed
                      ? "bg-emerald-950 border border-emerald-500 text-emerald-300 font-bold"
                      : selectionRegion.points.length > 0
                      ? "bg-amber-950 border border-amber-500 text-amber-300"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {selectionRegion.isClosed
                    ? "مغلق وجاهز"
                    : selectionRegion.points.length > 0
                    ? "قيد التحديد..."
                    : "فارغ"}
                </span>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[10px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">طريقة الاستخدام:</div>
              {selectionRegion.mode === "polygon" && (
                <div>• انقر على مساحة العمل لإضافة نقاط التحديد. اضغط نقراً مزدوجاً أو انقر بالقرب من نقطة البداية للإغلاق.</div>
              )}
              {selectionRegion.mode === "magnetic" && (
                <div>• حرك المؤشر وسينجذب المسار تلقائياً للحواف وحبيبات التباين في الصورة. انقر لتثبيت النقاط.</div>
              )}
              {selectionRegion.mode === "freehand" && (
                <div>• اسحب بالماوس للرسم الحر حول العنصر المطلوب تحديده. أفلت الماوس لإغلاق المسار.</div>
              )}
            </div>

            {/* Actions on Selection */}
            {selectionRegion.points.length > 0 && (
              <div className="space-y-2 pt-1">
                {selectionRegion.isClosed && (
                  <PanelButton
                    onClick={onExtractSelectionAsLayer}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2"
                  >
                    <Scissors className="w-4 h-4" />
                    <span>قص وعزل التحديد كطبقة جديدة</span>
                  </PanelButton>
                )}
                <PanelButton
                  onClick={onClearSelection}
                  className="w-full py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium"
                >
                  إلغاء التحديد (Deselect / Esc)
                </PanelButton>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. BACKGROUND REMOVER */}
        {/* ========================================================= */}
        {activeTool === "bg_remove" && (
          <div className="space-y-4">
            {/* Header banner */}
            <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-purple-200">
                    استوديو تفريغ وإزالة الخلفيات
                  </div>
                  <div className="text-[10px] text-purple-300/70">
                    عزل ذكي بالذكاء الاصطناعي والكروما والممحاة
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-purple-300 bg-purple-900/60 px-2 py-0.5 rounded-full border border-purple-500/40 font-mono">
                Studio AI
              </span>
            </div>

            {/* Mode selection: 6 distinct removal types */}
            <div className="space-y-2">
              <span className="text-[11px] text-slate-400 font-semibold">
                طريقة إزالة الخلفية:
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  {
                    id: "ai_click",
                    label: "ذكاء اصطناعي",
                    badge: "تلقائي",
                    icon: Sparkles,
                    color: "text-purple-400",
                  },
                  {
                    id: "magic_wand",
                    label: "عصا سحرية",
                    badge: "لون مخصص",
                    icon: Wand2,
                    color: "text-pink-400",
                  },
                  {
                    id: "preset_white",
                    label: "خلفية بيضاء",
                    badge: "استوديو",
                    icon: Circle,
                    color: "text-slate-100",
                  },
                  {
                    id: "preset_green",
                    label: "كروما خضراء",
                    badge: "+Despill",
                    icon: Circle,
                    color: "text-emerald-400",
                  },
                  {
                    id: "preset_black",
                    label: "خلفية سوداء",
                    badge: "داكنة",
                    icon: Circle,
                    color: "text-slate-400",
                  },
                  {
                    id: "eraser",
                    label: "ممحاة يدوية",
                    badge: "مسح حر",
                    icon: Eraser,
                    color: "text-amber-400",
                  },
                ].map((m) => {
                  const IconComp = m.icon;
                  const isSelected = bgConfig.mode === m.id;
                  return (
                    <PanelButton
                      key={m.id}
                      onClick={() => onUpdateBgConfig({ mode: m.id as any })}
                      className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? "bg-purple-600/30 border-purple-500 text-purple-200 shadow-md shadow-purple-900/20"
                          : "bg-slate-900/70 border-slate-800 hover:bg-slate-800 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <IconComp className={`w-3.5 h-3.5 ${isSelected ? "text-purple-300" : m.color}`} />
                        <span className="text-xs font-bold leading-tight">{m.label}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {m.badge}
                      </span>
                    </PanelButton>
                  );
                })}
              </div>
            </div>

            {/* 1. Mode: AI Click / Smart Cutout */}
            {bgConfig.mode === "ai_click" && (
              <div className="p-3 rounded-xl bg-purple-950/25 border border-purple-500/20 text-[11px] text-purple-200 leading-relaxed space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-purple-300">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>عزل تلقائي فائق الدقة (U2-Net Neural AI)</span>
                </div>
                <p className="text-slate-300 text-[10px]">
                  يتعرف الذكاء الاصطناعي تلقائياً على العناصر البارزة (منتجات، عطور، ملابس، أشخاص، سيارات) ويفصلها عن أي خلفية معقدة بدقة متناهية.
                </p>
                <div className="p-2 rounded-lg bg-purple-900/30 border border-purple-500/20 text-[10px] text-purple-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                  <span>تلميح: انقر على الكائن المطلوب بالماوس مباشرة على الكانفاس لتفريغه، أو اضغط زر التنفيذ بالأسفل.</span>
                </div>
              </div>
            )}

            {/* 2. Mode: Magic Wand & Custom Chroma Key */}
            {bgConfig.mode === "magic_wand" && (
              <div className="space-y-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-pink-400" />
                    <span>اللون المستهدف للتفريغ:</span>
                  </span>
                  {/* Native Color Picker & Swatch */}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 cursor-pointer transition-colors">
                      <input
                        type="color"
                        value={(() => {
                          const c = bgConfig.wandColor || { r: 255, g: 255, b: 255 };
                          const hx = (v: number) =>
                            Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
                          return `#${hx(c.r)}${hx(c.g)}${hx(c.b)}`;
                        })()}
                        onChange={(e) => {
                          const hex = e.target.value.replace("#", "");
                          const r = parseInt(hex.substring(0, 2), 16) || 0;
                          const g = parseInt(hex.substring(2, 4), 16) || 0;
                          const b = parseInt(hex.substring(4, 6), 16) || 0;
                          onUpdateBgConfig({ wandColor: { r, g, b } });
                        }}
                        className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                      />
                      <span className="font-mono text-[10px] text-slate-300 uppercase">
                        {(() => {
                          const c = bgConfig.wandColor || { r: 255, g: 255, b: 255 };
                          const hx = (v: number) =>
                            Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
                          return `#${hx(c.r)}${hx(c.g)}${hx(c.b)}`;
                        })()}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Quick Color Swatches */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400">ألوان سريعة شائعة:</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { name: "أبيض", r: 255, g: 255, b: 255, hex: "#ffffff" },
                      { name: "كروما خضراء", r: 0, g: 255, b: 0, hex: "#00ff00" },
                      { name: "كروما زرقاء", r: 0, g: 71, b: 171, hex: "#0047ab" },
                      { name: "أسود", r: 0, g: 0, b: 0, hex: "#000000" },
                      { name: "رمادي", r: 128, g: 128, b: 128, hex: "#808080" },
                    ].map((sw) => (
                      <button
                        key={sw.name}
                        type="button"
                        title={sw.name}
                        onClick={() =>
                          onUpdateBgConfig({ wandColor: { r: sw.r, g: sw.g, b: sw.b } })
                        }
                        className="w-6 h-6 rounded-full border border-slate-700 hover:scale-110 active:scale-95 transition-transform flex items-center justify-center shadow"
                        style={{ backgroundColor: sw.hex }}
                      />
                    ))}
                  </div>
                </div>

                {/* Tolerance */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>التفاوت اللوني (Tolerance):</span>
                    <span className="text-pink-300 font-bold font-mono">±{bgConfig.tolerance}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="140"
                    value={bgConfig.tolerance}
                    onChange={(e) => onUpdateBgConfig({ tolerance: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                </div>

                {/* Contiguous checkbox */}
                <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer pt-1 hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={bgConfig.contiguous ?? true}
                    onChange={(e) => onUpdateBgConfig({ contiguous: e.target.checked })}
                    className="rounded accent-pink-500 w-4 h-4 cursor-pointer"
                  />
                  <span>حذف المساحات المتصلة فقط (Flood-Fill)</span>
                </label>
                <div className="text-[10px] text-slate-400">
                  تلميح: انقر على أي منطقة لونية على الكانفاس لحذفها فوراً!
                </div>
              </div>
            )}

            {/* 3. Mode: Preset White Studio */}
            {bgConfig.mode === "preset_white" && (
              <div className="space-y-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-300 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-white">
                    <Circle className="w-3.5 h-3.5 text-white fill-white" />
                    <span>تفريغ استوديو الخلفية البيضاء (White Seamless)</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    مثالي لصور التجارة الإلكترونية، الكتالوجات، وصناديق التصوير الضوئية ذات الخلفيات البيضاء أو قريبة البياض.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>حساسية عزل الأبيض:</span>
                    <span className="text-white font-bold font-mono">±{bgConfig.tolerance}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={bgConfig.tolerance}
                    onChange={(e) => onUpdateBgConfig({ tolerance: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-300"
                  />
                </div>
              </div>
            )}

            {/* 4. Mode: Preset Green Screen Chroma */}
            {bgConfig.mode === "preset_green" && (
              <div className="space-y-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-200 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                    <Circle className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                    <span>كروما خضراء سينمائية + كبح التوهج (Despill)</span>
                  </div>
                  <p className="text-[10px] text-slate-300">
                    يزيل خلفية الكروما الخضراء مع قمع الانعكاسات الخضراء على خصلات الشعر والملابس تلقائياً للحصول على حواف نقية وطبيعية.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>حساسية الكروما الخضراء:</span>
                    <span className="text-emerald-400 font-bold font-mono">±{bgConfig.tolerance}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    value={bgConfig.tolerance}
                    onChange={(e) => onUpdateBgConfig({ tolerance: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* 5. Mode: Preset Black Studio */}
            {bgConfig.mode === "preset_black" && (
              <div className="space-y-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-300 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-slate-200">
                    <Circle className="w-3.5 h-3.5 text-slate-500 fill-slate-900" />
                    <span>تفريغ استوديو الخلفية السوداء (Black Seamless)</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    مخصص للقطات البورتريه والاستوديو المظلم أو خلفيات الإضاءة الدرامية المعتمة.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>حساسية عزل الأسود:</span>
                    <span className="text-slate-200 font-bold font-mono">±{bgConfig.tolerance}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={bgConfig.tolerance}
                    onChange={(e) => onUpdateBgConfig({ tolerance: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-400"
                  />
                </div>
              </div>
            )}

            {/* 6. Mode: Manual Eraser Brush */}
            {bgConfig.mode === "eraser" && (
              <div className="space-y-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>حجم الممحاة:</span>
                    <span className="text-amber-300 font-bold font-mono">{bgConfig.eraserRadius ?? 25}px</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="140"
                    value={bgConfig.eraserRadius ?? 25}
                    onChange={(e) => onUpdateBgConfig({ eraserRadius: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>صلابة الحواف (Hardness):</span>
                    <span className="text-amber-300 font-bold font-mono">{bgConfig.eraserHardness ?? 80}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={bgConfig.eraserHardness ?? 80}
                    onChange={(e) => onUpdateBgConfig({ eraserHardness: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>شفافية المسح (Opacity):</span>
                    <span className="text-amber-300 font-bold font-mono">{bgConfig.eraserOpacity ?? 100}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={bgConfig.eraserOpacity ?? 100}
                    onChange={(e) => onUpdateBgConfig({ eraserOpacity: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div className="p-2 rounded-lg bg-amber-950/20 border border-amber-500/20 text-[10px] text-amber-300">
                  تلميح: اسحب بالماوس مباشرة فوق الكانفاس لتفريغ ومسح أي جزء يدوياً بدقة فائقة.
                </div>
              </div>
            )}

            {/* Universal Studio Refinements (تعديلات الحواف والطبقات المتقدمة) */}
            <div className="space-y-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[11px] text-slate-300 font-semibold block">
                خيارات الصقل والطبقات (Refinements):
              </span>

              {/* Edge Feathering Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>تنعيم وصقل الحواف (Edge Feather):</span>
                  <span className="text-cyan-300 font-bold font-mono">{bgConfig.feather ?? 3}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={bgConfig.feather ?? 3}
                  onChange={(e) => onUpdateBgConfig({ feather: parseInt(e.target.value) })}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <span className="text-[9px] text-slate-500 block">
                  يعطي دمجاً احترافياً للحواف ويمنع التسنن والخشونة في حدود الكائن المفرغ.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                {/* Invert Mask Checkbox */}
                <label className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={bgConfig.invert ?? false}
                    onChange={(e) => onUpdateBgConfig({ invert: e.target.checked })}
                    className="rounded accent-purple-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>عكس القناع (Invert)</span>
                </label>

                {/* As New Layer Checkbox */}
                <label className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={bgConfig.asNewLayer ?? false}
                    onChange={(e) => onUpdateBgConfig({ asNewLayer: e.target.checked })}
                    className="rounded accent-purple-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>عزل كطبقة جديدة</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <PanelButton
                onClick={onApplyBgRemoval}
                disabled={isProcessing || isAiProcessing}
                className={`w-full py-2.5 rounded-xl font-semibold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                  isProcessing || isAiProcessing
                    ? "bg-purple-900/50 text-purple-300 border border-purple-500/40 cursor-wait"
                    : "bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-600/30"
                }`}
              >
                {isProcessing || isAiProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جارِ المعالجة والتفريغ بالذكاء الاصطناعي...</span>
                  </>
                ) : (
                  <>
                    {bgConfig.mode === "ai_click" && <Sparkles className="w-3.5 h-3.5" />}
                    {bgConfig.mode === "magic_wand" && <Wand2 className="w-3.5 h-3.5" />}
                    {bgConfig.mode === "eraser" && <Eraser className="w-3.5 h-3.5" />}
                    {(bgConfig.mode === "preset_white" ||
                      bgConfig.mode === "preset_green" ||
                      bgConfig.mode === "preset_black") && <Scissors className="w-3.5 h-3.5" />}
                    <span>
                      {bgConfig.mode === "ai_click" && "تفريغ الخلفية بالذكاء الاصطناعي"}
                      {bgConfig.mode === "magic_wand" && "حذف وتفريغ اللون المستهدف"}
                      {bgConfig.mode === "preset_white" && "تفريغ الخلفية البيضاء"}
                      {bgConfig.mode === "preset_green" && "إزالة الكروما الخضراء (مع Despill)"}
                      {bgConfig.mode === "preset_black" && "تفريغ الخلفية السوداء"}
                      {bgConfig.mode === "eraser" && "وضع الممحاة نشط (امسح على الكانفاس)"}
                    </span>
                  </>
                )}
              </PanelButton>

              {onRevertBgRemoval && (
                <PanelButton
                  type="button"
                  onClick={onRevertBgRemoval}
                  className="w-full py-2 rounded-xl bg-slate-900/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-200 border border-slate-700/80 hover:border-rose-500/50 text-xs font-semibold shadow transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  <span>إلغاء واستعادة الصورة الأصلية</span>
                </PanelButton>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 6. FREEHAND BRUSH STUDIO */}
        {/* ========================================================= */}
        {activeTool === "draw" && (
          <div className="space-y-4">
            {/* Header banner */}
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brush className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="font-bold text-xs text-purple-200">استوديو الرسم والأشكال</div>
                  <div className="text-[10px] text-purple-300/70">صناديق ومربعات، أسهم، دوائر ورسم حر</div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-purple-300 bg-purple-900/40 px-2 py-0.5 rounded-full border border-purple-500/30 font-bold">
                {brushConfig.size}px
              </span>
            </div>

            {/* Mode selection: 7 tools */}
            <div className="space-y-2">
              <span className="text-[11px] text-slate-400 font-semibold">أداة الرسم والتأشير:</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: "rectangle", label: "صندوق / مربع", icon: Square, badge: "صندوق" },
                  { id: "circle", label: "دائرة / بيضاوي", icon: Circle, badge: "دائرة" },
                  { id: "arrow", label: "سهم تأشير", icon: ArrowRight, badge: "سهم" },
                  { id: "line", label: "خط مستقيم", icon: Minus, badge: "خط" },
                  { id: "brush", label: "فرشاة حرة", icon: Brush, badge: "حر" },
                  { id: "neon", label: "توهج نيون", icon: Sparkles, badge: "نيون" },
                  { id: "highlighter", label: "قلم تمييز", icon: FileText, badge: "تظليل" },
                ].map((item) => {
                  const IconComp = item.icon;
                  const isSelected = brushConfig.mode === item.id;
                  return (
                    <PanelButton
                      key={item.id}
                      onClick={() => onUpdateBrushConfig({ mode: item.id as any })}
                      className={`py-2 px-1 rounded-xl border text-[11px] font-medium text-center transition-all flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? "bg-purple-600 border-purple-400 text-white font-bold shadow-md shadow-purple-600/30 scale-[1.02]"
                          : "bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white"
                      }`}
                      title={item.label}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                      <span className="leading-tight">{item.badge}</span>
                    </PanelButton>
                  );
                })}
              </div>
            </div>

            {/* Quick Presets for Drawing Boxes & Shapes */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400">قوالب تأشير سريعة جاهزة:</span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBrushConfig({
                      mode: "rectangle",
                      size: 3,
                      color: "#eab308",
                      fillShape: false,
                      strokeDash: "solid",
                    })
                  }
                  className="p-1.5 rounded-lg bg-amber-950/40 border border-amber-500/40 hover:bg-amber-900/50 text-amber-200 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors"
                >
                  <Square className="w-3.5 h-3.5 text-amber-400" />
                  <span>صندوق أصفر مفرغ</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBrushConfig({
                      mode: "rectangle",
                      size: 3,
                      color: "#ef4444",
                      fillShape: false,
                      strokeDash: "solid",
                    })
                  }
                  className="p-1.5 rounded-lg bg-rose-950/40 border border-rose-500/40 hover:bg-rose-900/50 text-rose-200 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors"
                >
                  <Square className="w-3.5 h-3.5 text-rose-400" />
                  <span>صندوق تمييز أحمر</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBrushConfig({
                      mode: "arrow",
                      size: 4,
                      color: "#ef4444",
                      strokeDash: "solid",
                    })
                  }
                  className="p-1.5 rounded-lg bg-red-950/40 border border-red-500/40 hover:bg-red-900/50 text-red-200 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-red-400" />
                  <span>سهم تأشير أحمر</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBrushConfig({
                      mode: "circle",
                      size: 3,
                      color: "#10b981",
                      fillShape: false,
                      strokeDash: "solid",
                    })
                  }
                  className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 hover:bg-emerald-900/50 text-emerald-200 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors"
                >
                  <Circle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>دائرة تركيز خضراء</span>
                </button>
              </div>
            </div>

            {/* Shape-specific styling (Fill, Dash Style) */}
            {(brushConfig.mode === "rectangle" || brushConfig.mode === "circle") && (
              <div className="space-y-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">تعبئة الصندوق:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={brushConfig.fillShape ?? false}
                      onChange={(e) => onUpdateBrushConfig({ fillShape: e.target.checked })}
                      className="rounded accent-purple-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>تعبئة ملونة داخلية</span>
                  </label>
                </div>

                {brushConfig.fillShape && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <span className="text-slate-400 text-[10px]">لون التعبئة:</span>
                    <input
                      type="color"
                      value={brushConfig.fillColor?.startsWith("#") ? brushConfig.fillColor.substring(0, 7) : "#eab308"}
                      onChange={(e) => onUpdateBrushConfig({ fillColor: e.target.value + "44" })}
                      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Border / Stroke Style (Solid, Dashed, Dotted) */}
            {(brushConfig.mode === "rectangle" ||
              brushConfig.mode === "circle" ||
              brushConfig.mode === "line" ||
              brushConfig.mode === "arrow") && (
              <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-300 font-semibold">نمط خط الإطار:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "solid", label: "متصل ــــ" },
                    { id: "dashed", label: "متقطع ---" },
                    { id: "dotted", label: "منقط ···" },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => onUpdateBrushConfig({ strokeDash: st.id as any })}
                      className={`py-1 rounded-lg text-[10px] font-mono border transition-all ${
                        (brushConfig.strokeDash || "solid") === st.id
                          ? "bg-purple-600/30 border-purple-500 text-purple-200 font-bold"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Brush / Border Size Slider */}
            <div className="space-y-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>
                  {brushConfig.mode === "rectangle" || brushConfig.mode === "circle"
                    ? "سماكة إطار الصندوق:"
                    : "سماكة الخط:"}
                </span>
                <span className="text-purple-300 font-bold font-mono">{brushConfig.size}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                value={brushConfig.size}
                onChange={(e) => onUpdateBrushConfig({ size: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            {/* Color Palette */}
            <div className="space-y-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex justify-between items-center text-[11px] text-slate-300 font-medium">
                <span>لون الرسم / الإطار:</span>
                <span className="font-mono text-[10px] uppercase text-slate-400">{brushConfig.color}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brushConfig.color}
                  onChange={(e) => onUpdateBrushConfig({ color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 shrink-0"
                />
                <div className="flex-1 grid grid-cols-7 gap-1">
                  {["#eab308", "#ef4444", "#10b981", "#38bdf8", "#ffffff", "#a855f7", "#f97316"].map((c) => (
                    <PanelButton
                      key={c}
                      onClick={() => onUpdateBrushConfig({ color: c })}
                      style={{ backgroundColor: c }}
                      className="w-6 h-6 rounded-md border border-slate-700 hover:scale-110 active:scale-95 transition-transform shadow-sm"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Destination Layer (Direct on Image vs New Layer) */}
            <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px]">
              <span className="text-slate-300 font-semibold block">مكان حفظ الرسم / الصندوق:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdateBrushConfig({ targetLayer: "active" })}
                  className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                    (brushConfig.targetLayer || "active") === "active"
                      ? "bg-purple-600/30 border-purple-500 text-purple-200 font-bold"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  🎯 على الصورة مباشرة
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateBrushConfig({ targetLayer: "new" })}
                  className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                    brushConfig.targetLayer === "new"
                      ? "bg-purple-600/30 border-purple-500 text-purple-200 font-bold"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  📑 كطبقة رسم جديدة
                </button>
              </div>
              <span className="text-[9px] text-slate-500 block">
                تلميح: اسحب بالفأرة مباشرة فوق الصورة لرسم الصندوق أو السهم بالحجم الذي تريده فوراً!
              </span>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 6.1 DEDICATED SMART ERASER STUDIO (استوديو الممحاة الذكية) */}
        {/* ========================================================= */}
        {/* ========================================================= */}
        {/* 6.1 DEDICATED SMART ERASER STUDIO (استوديو الممحاة الذكية) */}
        {/* ========================================================= */}
        {activeTool === "eraser" && (
          <div className="space-y-4">
            {/* Header Status Card */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-rose-950/40 via-pink-950/20 to-purple-950/30 border border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-950/50">
                  {brushConfig.eraserSubMode === "alpha" ? (
                    <Eraser className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Wand2 className="w-4 h-4 text-rose-400" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-xs text-rose-200">استوديو الممحاة الذكية</div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                    {activeLayer ? `الطبقة: ${activeLayer.name}` : "جاهز للعمل على مساحة العمل"}
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-mono text-rose-300 font-bold bg-rose-900/40 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                {brushConfig.size}px
              </span>
            </div>

            {/* Mode Switcher Tabs: AI Object Inpaint vs Pixel Alpha Eraser */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
              <PanelButton
                type="button"
                onClick={() =>
                  onUpdateBrushConfig({
                    mode: "eraser",
                    eraserSubMode: "ai_object",
                  })
                }
                className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  (brushConfig.eraserSubMode || "ai_object") === "ai_object"
                    ? "bg-rose-950/90 border border-rose-500/50 text-rose-200 font-bold shadow-sm shadow-rose-950/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Wand2 className="w-3.5 h-3.5 text-rose-400" />
                <span>إزالة الكائنات (AI)</span>
              </PanelButton>
              <PanelButton
                type="button"
                onClick={() =>
                  onUpdateBrushConfig({
                    mode: "eraser",
                    eraserSubMode: "alpha",
                  })
                }
                className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  brushConfig.eraserSubMode === "alpha"
                    ? "bg-rose-950/90 border border-rose-500/50 text-rose-200 font-bold shadow-sm shadow-rose-950/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Eraser className="w-3.5 h-3.5 text-rose-400" />
                <span>مسح بكسلات شفاف</span>
              </PanelButton>
            </div>

            {/* SUBMODE 1: AI OBJECT REMOVAL / INPAINTING */}
            {(brushConfig.eraserSubMode || "ai_object") === "ai_object" && (
              <div className="space-y-3.5">
                {/* Information Card */}
                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/25 text-slate-300 text-[11px] leading-relaxed flex items-start gap-2.5">
                  <Wand2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-rose-200">الممحاة السحرية لإزالة العناصر (Magic Eraser):</p>
                    <p className="text-[10.5px] text-slate-300">
                      حدد أو لون بالماوس فوق أي شخص، عنصر، كتابة، أو بقعة غير مرغوبة على الصورة. يقوم الذكاء الاصطناعي بإخفائها وإعادة تعويض وترميم نسيج الخلفية مكانه تلقائياً وبدقة عالية.
                    </p>
                  </div>
                </div>

                {/* Brush Size */}
                <div className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span className="font-medium">سماكة فرشاة التظليل:</span>
                    <span className="text-rose-300 font-bold font-mono">{brushConfig.size}px</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="160"
                    value={brushConfig.size}
                    onChange={(e) => {
                      onUpdateBrushConfig({ mode: "eraser", size: parseInt(e.target.value) });
                    }}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <div className="grid grid-cols-5 gap-1 pt-1">
                    {[10, 25, 50, 80, 120].map((sz) => (
                      <PanelButton
                        key={sz}
                        type="button"
                        onClick={() => onUpdateBrushConfig({ mode: "eraser", size: sz })}
                        className={`py-1 rounded-lg text-[10px] font-mono border transition-all ${
                          brushConfig.size === sz
                            ? "bg-rose-950/90 border-rose-400 text-rose-200 font-bold shadow-sm"
                            : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {sz}px
                      </PanelButton>
                    ))}
                  </div>
                </div>

                {/* Inpaint Algorithm Selector */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-300">خوارزمية الترميم والذكاء الاصطناعي:</span>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {[
                      { id: "telea", label: "Telea (سريع ودقيق)", desc: "طريقة Fast Marching الدقيقة" },
                      { id: "ns", label: "Navier-Stokes (ناعم)", desc: "معادلات ديناميكا الموائع للأسطح" },
                    ].map((m) => {
                      const isSelected = (brushConfig.inpaintMethod || "telea") === m.id;
                      return (
                        <PanelButton
                          key={m.id}
                          type="button"
                          onClick={() => onUpdateBrushConfig({ mode: "eraser", inpaintMethod: m.id as any })}
                          className={`p-2 rounded-xl border text-right transition-all flex flex-col gap-0.5 ${
                            isSelected
                              ? "bg-rose-950/80 border-rose-400 text-rose-200 font-bold shadow-md shadow-rose-950/40"
                              : "bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <span className="text-[11px] font-bold">{m.label}</span>
                          <span className="text-[9.5px] text-slate-400 font-normal">{m.desc}</span>
                        </PanelButton>
                      );
                    })}
                  </div>
                </div>

                {/* Inpaint Radius Slider */}
                <div className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>نطاق أخذ عينات الخلفية (Inpaint Radius):</span>
                    <span className="text-rose-300 font-bold font-mono">{brushConfig.inpaintRadius || 5}px</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    value={brushConfig.inpaintRadius || 5}
                    onChange={(e) =>
                      onUpdateBrushConfig({
                        mode: "eraser",
                        inpaintRadius: parseInt(e.target.value),
                      })
                    }
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>تفاصيل دقيقة (3px)</span>
                    <span>تدرج أوسع (20px)</span>
                  </div>
                </div>

                {/* Mask Margin Dilation Slider */}
                <div className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>توسيع قناع التحديد لمنع الهالات (Dilation):</span>
                    <span className="text-rose-300 font-bold font-mono">{brushConfig.inpaintDilate ?? 3}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={brushConfig.inpaintDilate ?? 3}
                    onChange={(e) =>
                      onUpdateBrushConfig({
                        mode: "eraser",
                        inpaintDilate: parseInt(e.target.value),
                      })
                    }
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>بدون توسيع (0px)</span>
                    <span>تغطية كاملة للحواف (10px)</span>
                  </div>
                </div>

                {/* Auto Inpaint on Release Toggle */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-200">إزالة فورية عند رفع الماوس</div>
                    <div className="text-[10px] text-slate-400">تنفيذ الترميم تلقائياً بعد كل خطوة تظليل</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateBrushConfig({
                        mode: "eraser",
                        autoInpaintOnRelease: !(brushConfig.autoInpaintOnRelease ?? true),
                      })
                    }
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                      (brushConfig.autoInpaintOnRelease ?? true) ? "bg-rose-600" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        (brushConfig.autoInpaintOnRelease ?? true) ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Manual Inpaint Trigger & Undo */}
                <div className="space-y-2 pt-1">
                  <PanelButton
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      if (onApplyInpaint) {
                        onApplyInpaint();
                      }
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري ترميم الصورة بالذكاء الاصطناعي...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        <span>مسح وترميم العنصر المحدد الآن</span>
                      </>
                    )}
                  </PanelButton>

                  {onUndo && (
                    <PanelButton
                      type="button"
                      onClick={onUndo}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-400 scale-x-[-1]" />
                      <span>تراجع عن آخر خطوة (Ctrl + Z)</span>
                    </PanelButton>
                  )}
                </div>
              </div>
            )}

            {/* SUBMODE 2: REAL PIXEL ALPHA ERASER */}
            {brushConfig.eraserSubMode === "alpha" && (
              <div className="space-y-3.5">
                {/* Information Card */}
                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/25 text-slate-300 text-[11px] leading-relaxed flex items-start gap-2.5">
                  <Eraser className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-rose-200">ممحاة البكسلات والشفافية الحقيقية (Alpha Eraser):</p>
                    <p className="text-[10.5px] text-slate-300">
                      تمسح بكسلات الطبقة الحالية بدقة تامة لتجعلها شفافة بالكامل دون أي شخبطة أو كتابة لونية. المؤشر الدائري يوضح بدقة حدود المسح الحقيقية.
                    </p>
                  </div>
                </div>

                {/* Eraser Target Mode Selector */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-300">نطاق وهدف المسح:</span>
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    {[
                      { id: "both", label: "شامل (الكل)" },
                      { id: "layer", label: "بكسلات الطبقة" },
                      { id: "overlay", label: "رسومات الفرشاة" },
                    ].map((item) => {
                      const target = brushConfig.eraserTarget || "both";
                      const isSelected = target === item.id;
                      return (
                        <PanelButton
                          key={item.id}
                          type="button"
                          onClick={() =>
                            onUpdateBrushConfig({
                              mode: "eraser",
                              eraserTarget: item.id as any,
                            })
                          }
                          className={`py-2 px-1 rounded-xl border text-[11px] font-medium text-center transition-all ${
                            isSelected
                              ? "bg-rose-950/80 border-rose-400 text-rose-200 font-bold shadow-md shadow-rose-950/40 scale-[1.02]"
                              : "bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {item.label}
                        </PanelButton>
                      );
                    })}
                  </div>
                </div>

                {/* Eraser Size Slider & Presets */}
                <div className="space-y-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span className="font-medium">قطر وحجم الممحاة:</span>
                    <span className="text-rose-300 font-bold font-mono">{brushConfig.size}px</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="150"
                    value={brushConfig.size}
                    onChange={(e) => {
                      onUpdateBrushConfig({ mode: "eraser", size: parseInt(e.target.value) });
                    }}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />

                  {/* Quick Size Pills */}
                  <div className="grid grid-cols-5 gap-1 pt-1">
                    {[5, 15, 30, 60, 100].map((sz) => (
                      <PanelButton
                        key={sz}
                        type="button"
                        onClick={() => onUpdateBrushConfig({ mode: "eraser", size: sz })}
                        className={`py-1 rounded-lg text-[10px] font-mono border transition-all ${
                          brushConfig.size === sz
                            ? "bg-rose-950/90 border-rose-400 text-rose-200 font-bold shadow-sm"
                            : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {sz}px
                      </PanelButton>
                    ))}
                  </div>
                </div>

                {/* Eraser Hardness / Softness (Feather) */}
                <div className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>صلابة ونعومة الحافة (Hardness):</span>
                    <span className="text-rose-300 font-bold font-mono">
                      {brushConfig.eraserHardness ?? 80}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={brushConfig.eraserHardness ?? 80}
                    onChange={(e) =>
                      onUpdateBrushConfig({
                        mode: "eraser",
                        eraserHardness: parseInt(e.target.value),
                      })
                    }
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>حافة ضبابية ناعمة (0%)</span>
                    <span>حافة حادة دقيقة (100%)</span>
                  </div>
                </div>

                {/* Eraser Opacity / Flow */}
                <div className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>قوة وعتامة المسح (Opacity):</span>
                    <span className="text-rose-300 font-bold font-mono">
                      {brushConfig.eraserOpacity ?? 100}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={brushConfig.eraserOpacity ?? 100}
                    onChange={(e) =>
                      onUpdateBrushConfig({
                        mode: "eraser",
                        eraserOpacity: parseInt(e.target.value),
                      })
                    }
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>مسح تدريجي خفيف (10%)</span>
                    <span>مسح كامل 100%</span>
                  </div>
                </div>

                {/* Eraser Quick Actions */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-300">إجراءات سريعة:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <PanelButton
                      type="button"
                      onClick={() => {
                        onUpdateBrushConfig({
                          mode: "eraser",
                          size: 25,
                          eraserHardness: 80,
                          eraserOpacity: 100,
                          eraserTarget: "both",
                        });
                      }}
                      className="py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                      <span>إعادة ضبط الممحاة</span>
                    </PanelButton>
                    {onUndo && (
                      <PanelButton
                        type="button"
                        onClick={onUndo}
                        className="py-2 px-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-400 scale-x-[-1]" />
                        <span>تراجع عن آخر مسح</span>
                      </PanelButton>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Guide Info */}
            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/25 text-slate-300 text-[11px] leading-relaxed flex items-start gap-2.5">
              <Info className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p>
                  اسحب بالممحاة فوق مساحة العمل لمسح الرتوش أو إزالة الكائنات بدقة تامة. يمكنك التراجع عن أي خطوة بالضغط على <kbd className="px-1 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-purple-300">Ctrl + Z</kbd>.
                </p>
                <p className="text-[10px] text-slate-400">
                  اختصارات سريعة: <kbd className="px-1 rounded bg-slate-900 border border-slate-800 font-mono text-[10px]">E</kbd> للممحاة • <kbd className="px-1 rounded bg-slate-900 border border-slate-800 font-mono text-[10px]">[</kbd> تصغير • <kbd className="px-1 rounded bg-slate-900 border border-slate-800 font-mono text-[10px]">]</kbd> تكبير.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 7. TEXT LAYER STUDIO */}
        {/* ========================================================= */}
        {activeTool === "text" && (
          <div className="space-y-4">
            {/* If a text layer is selected, edit its live properties */}
            {activeLayer && activeLayer.type === "text" ? (
              <div className="space-y-3.5">
                <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-slate-200 truncate max-w-[140px]">
                      {activeLayer.textConfig?.text || activeLayer.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300">
                    طبقة نص محددة
                  </span>
                </div>

                {/* Direct On-Canvas Edit Trigger Button */}
                <PanelButton
                  onClick={() => onStartInlineTextEdit?.(activeLayer.id)}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                  <span>كتابة وتحرير على اللوحة مباشرة</span>
                </PanelButton>

                {/* Live Text Content Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>محتوى النص:</span>
                    <span className="text-[10px] text-purple-400">أو انقر مرتين على النص</span>
                  </div>
                  <textarea
                    rows={2}
                    value={activeLayer.textConfig?.text ?? newTextString}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewTextString(val);
                      onUpdateTextLayer?.(activeLayer.id, { text: val });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500 font-medium resize-none"
                    placeholder="اكتب النص هنا..."
                  />
                </div>

                {/* Font Size Slider & Value */}
                <div className="space-y-1.5 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>حجم الخط:</span>
                    <span className="text-purple-300 font-bold">
                      {activeLayer.textConfig?.fontSize || newTextSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="140"
                    value={activeLayer.textConfig?.fontSize || newTextSize}
                    onChange={(e) => {
                      const sz = parseInt(e.target.value);
                      setNewTextSize(sz);
                      onUpdateTextLayer?.(activeLayer.id, { fontSize: sz });
                    }}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Font Color & Gradient Fill */}
                <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-medium">تلوين النص:</span>
                    <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateTextLayer?.(activeLayer.id, { gradient: undefined });
                        }}
                        className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                          !activeLayer.textConfig?.gradient?.enabled
                            ? "bg-purple-600 text-white font-bold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        لون موحد
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateTextLayer?.(activeLayer.id, {
                            gradient: activeLayer.textConfig?.gradient || DEFAULT_GRADIENT_CONFIG,
                          });
                        }}
                        className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                          activeLayer.textConfig?.gradient?.enabled
                            ? "bg-purple-600 text-white font-bold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        تدرج لوني ✦
                      </button>
                    </div>
                  </div>

                  {!activeLayer.textConfig?.gradient?.enabled ? (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">اللون المصمت:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={activeLayer.textConfig?.color || newTextColor}
                          onChange={(e) => {
                            const clr = e.target.value;
                            setNewTextColor(clr);
                            onUpdateTextLayer?.(activeLayer.id, { color: clr });
                          }}
                          className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="font-mono text-xs text-purple-300 uppercase">
                          {activeLayer.textConfig?.color || newTextColor}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-1">
                      <GradientEditor
                        config={activeLayer.textConfig.gradient}
                        onChange={(g) => onUpdateTextLayer?.(activeLayer.id, { gradient: g })}
                        title="تدرج ألوان النص"
                      />
                    </div>
                  )}
                </div>

                {/* Font Family Selector */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-400">نوع الخط:</span>
                  <select
                    value={activeLayer.textConfig?.fontFamily || "'Cairo', sans-serif"}
                    onChange={(e) => {
                      onUpdateTextLayer?.(activeLayer.id, { fontFamily: e.target.value });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500 font-medium"
                  >
                    {AVAILABLE_FONTS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Font Weight & Alignment */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">سُمك الخط:</span>
                    <select
                      value={activeLayer.textConfig?.fontWeight || "bold"}
                      onChange={(e) => {
                        onUpdateTextLayer?.(activeLayer.id, { fontWeight: e.target.value });
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                    >
                      <option value="normal">عادي (Normal)</option>
                      <option value="bold">عريض (Bold)</option>
                      <option value="900">عريض جداً (Black)</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">المحاذاة:</span>
                    <select
                      value={activeLayer.textConfig?.textAlign || "center"}
                      onChange={(e) => {
                        onUpdateTextLayer?.(activeLayer.id, { textAlign: e.target.value as any });
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                    >
                      <option value="right">يمين (Right)</option>
                      <option value="center">وسط (Center)</option>
                      <option value="left">يسار (Left)</option>
                    </select>
                  </div>
                </div>

                {/* Add Another Text Layer Button */}
                <button
                  type="button"
                  onClick={() => onAddTextLayer("نص جديد", 36, "#ffffff")}
                  className="w-full mt-2 py-2 rounded-lg border border-purple-500/40 hover:bg-purple-950/50 text-purple-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة طبقة نص جديدة</span>
                </button>
              </div>
            ) : (
              /* No text layer selected: show add new text instructions & form */
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <span>
                    انقر مباشرة على أي موضع في الصورة للبدء بالكتابة فوراً على صندوق النص، أو اضغط الزر أدناه لإدراج نص جديد.
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] text-slate-400">النص المبدئي:</span>
                  <input
                    type="text"
                    value={newTextString}
                    onChange={(e) => setNewTextString(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500 font-medium"
                    placeholder="نص جديد"
                  />
                </div>

                <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>حجم الخط:</span>
                    <span className="text-purple-300 font-bold">{newTextSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="140"
                    value={newTextSize}
                    onChange={(e) => setNewTextSize(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-[11px] text-slate-400">لون النص:</span>
                  <input
                    type="color"
                    value={newTextColor}
                    onChange={(e) => setNewTextColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-xs text-purple-300 uppercase">{newTextColor}</span>
                </div>

                <PanelButton
                  onClick={() => onAddTextLayer(newTextString || "نص جديد", newTextSize, newTextColor)}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-purple-600/30 transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>إدراج نص والبدء بالكتابة المباشرة</span>
                </PanelButton>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* 7.5 GEOMETRIC SHAPES STUDIO (استوديو الأشكال الهندسية)   */}
        {/* ========================================================= */}
        {activeTool === "shape" && (() => {
          const effectiveConfig: ShapeConfig = activeLayer?.shapeConfig || shapeConfig;
          const currentFill = effectiveConfig.fillColor || "#8b5cf6";
          const currentStroke = effectiveConfig.strokeColor || "#ffffff";
          const currentStrokeWidth = effectiveConfig.strokeWidth ?? 2;
          const currentStrokeDash = effectiveConfig.strokeDash || "solid";
          const currentRadius = effectiveConfig.cornerRadius ?? 16;
          const currentStarPoints = effectiveConfig.starPoints ?? 5;
          const currentType = effectiveConfig.type || "rectangle";

          const updateConfig = (updates: Partial<ShapeConfig>) => {
            onUpdateShapeConfig?.(updates);
            if (activeLayer && activeLayer.type === "shape") {
              onUpdateActiveShapeLayer?.(activeLayer.id, updates);
            }
          };

          return (
            <div className="space-y-4">
              {/* Active shape status or guide banner */}
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-slate-200 text-xs flex items-start gap-2.5">
                <Shapes className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-300">
                      {activeLayer && activeLayer.type === "shape" ? "تعديل الشكل المحدد" : "استوديو الأشكال الهندسية"}
                    </span>
                    {activeLayer && activeLayer.type === "shape" && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                        نشط
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    اسحب بالماوس فوق الصورة لرسم الشكل بالحجم الذي تريده، أو اضغط زر "إدراج في المركز" لوضعه مباشرة.
                  </p>
                </div>
              </div>

              {/* Quick Box & Frame Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400">قوالب صناديق وتأطير سريعة:</span>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig({
                        type: "rectangle",
                        fillColor: "transparent",
                        strokeColor: "#eab308",
                        strokeWidth: 3,
                        strokeDash: "solid",
                      })
                    }
                    className="p-1.5 rounded-lg bg-amber-950/40 border border-amber-500/40 hover:bg-amber-900/50 text-amber-200 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors"
                  >
                    <Square className="w-3.5 h-3.5 text-amber-400" />
                    <span>صندوق إحاطة أصفر</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig({
                        type: "rectangle",
                        fillColor: "transparent",
                        strokeColor: "#ef4444",
                        strokeWidth: 3,
                        strokeDash: "solid",
                      })
                    }
                    className="p-1.5 rounded-lg bg-rose-950/40 border border-rose-500/40 hover:bg-rose-900/50 text-rose-200 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors"
                  >
                    <Square className="w-3.5 h-3.5 text-rose-400" />
                    <span>صندوق تمييز أحمر</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig({
                        type: "rounded_rect",
                        fillColor: "rgba(15, 23, 42, 0.75)",
                        strokeColor: "rgba(255, 255, 255, 0.25)",
                        strokeWidth: 1.5,
                        cornerRadius: 12,
                      })
                    }
                    className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-700 hover:bg-slate-800 text-slate-200 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors"
                  >
                    <RectangleHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>بطاقة زجاجية نصف شفافة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig({
                        type: "arrow",
                        fillColor: "#ef4444",
                        strokeColor: "#ef4444",
                        strokeWidth: 4,
                      })
                    }
                    className="p-1.5 rounded-lg bg-red-950/40 border border-red-500/40 hover:bg-red-900/50 text-red-200 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-red-400" />
                    <span>سهم توجيهي</span>
                  </button>
                </div>
              </div>

              {/* Shape Type Selector Grid */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-slate-300">اختر نوع الشكل:</span>
                  <span className="text-[10px] text-amber-400 font-medium">
                    {AVAILABLE_SHAPES.find((s) => s.id === currentType)?.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {AVAILABLE_SHAPES.map((sh) => {
                    const isSelected = currentType === sh.id;
                    return (
                      <button
                        key={sh.id}
                        type="button"
                        onClick={() => updateConfig({ type: sh.id })}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? "bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/20 font-bold scale-[1.02]"
                            : "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-700"
                        }`}
                        title={sh.label}
                      >
                        {sh.id === "rectangle" && <Square className="w-4 h-4 mb-1 text-amber-400" />}
                        {sh.id === "rounded_rect" && <RectangleHorizontal className="w-4 h-4 mb-1 text-amber-400" />}
                        {sh.id === "circle" && <Circle className="w-4 h-4 mb-1 text-amber-400" />}
                        {sh.id === "ellipse" && <Circle className="w-4 h-4 mb-1 text-amber-400 scale-x-125" />}
                        {sh.id === "triangle" && <Triangle className="w-4 h-4 mb-1 text-amber-400" />}
                        {sh.id === "star" && <Star className="w-4 h-4 mb-1 text-amber-400" />}
                        {sh.id === "polygon" && <Hexagon className="w-4 h-4 mb-1 text-amber-400" />}
                        {sh.id === "arrow" && <ArrowRight className="w-4 h-4 mb-1 text-amber-400" />}
                        {sh.id === "line" && <Minus className="w-4 h-4 mb-1 text-amber-400" />}
                        <span className="text-[10px]">{sh.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Insert Button */}
              <PanelButton
                type="button"
                onClick={() => onAddShapeLayer?.()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>إدراج الشكل في مركز اللوحة</span>
              </PanelButton>

              {/* Fill Color & Gradient Section */}
              <div className="space-y-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-300">تعبئة الشكل (Fill):</span>
                  <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        updateConfig({
                          gradient: undefined,
                          fillColor: currentFill === "transparent" ? "#8b5cf6" : currentFill,
                        });
                      }}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        currentFill !== "transparent" && !effectiveConfig.gradient?.enabled
                          ? "bg-amber-600 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      لون موحد
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateConfig({
                          gradient: effectiveConfig.gradient || DEFAULT_GRADIENT_CONFIG,
                          fillColor: "#8b5cf6",
                        });
                      }}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        effectiveConfig.gradient?.enabled
                          ? "bg-amber-600 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      تدرج لوني ✦
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateConfig({
                          gradient: undefined,
                          fillColor: "transparent",
                        });
                      }}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        currentFill === "transparent" && !effectiveConfig.gradient?.enabled
                          ? "bg-amber-600 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      شفاف
                    </button>
                  </div>
                </div>

                {effectiveConfig.gradient?.enabled ? (
                  <GradientEditor
                    config={effectiveConfig.gradient}
                    onChange={(newGrad) => updateConfig({ gradient: newGrad })}
                    title="تدرج ألوان الشكل"
                  />
                ) : currentFill !== "transparent" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentFill}
                        onChange={(e) => updateConfig({ fillColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={currentFill}
                        onChange={(e) => updateConfig({ fillColor: e.target.value })}
                        className="flex-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-amber-300 uppercase"
                      />
                    </div>
                    {/* Color Palette */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {SHAPE_COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => updateConfig({ fillColor: c })}
                          style={{ backgroundColor: c }}
                          className={`w-5 h-5 rounded-md border transition-transform cursor-pointer ${
                            currentFill.toLowerCase() === c.toLowerCase()
                              ? "scale-125 border-white shadow"
                              : "border-slate-700 hover:scale-110"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded bg-slate-950/80 border border-dashed border-slate-800 text-center text-slate-500 text-[11px]">
                    التعبئة شفافة (سيظهر إطار الشكل فقط)
                  </div>
                )}
              </div>

              {/* Stroke Color & Width Section */}
              <div className="space-y-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-300">الإطار الخارجي (Stroke):</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = currentStroke === "transparent" ? "#ffffff" : "transparent";
                      updateConfig({ strokeColor: next });
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      currentStroke === "transparent"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                    }`}
                  >
                    {currentStroke === "transparent" ? "بدون إطار ✓" : "إطار شفاف"}
                  </button>
                </div>

                {currentStroke !== "transparent" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentStroke}
                        onChange={(e) => updateConfig({ strokeColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={currentStroke}
                        onChange={(e) => updateConfig({ strokeColor: e.target.value })}
                        className="flex-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-amber-300 uppercase"
                      />
                    </div>

                    {/* Stroke Width Slider */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>سُمك الإطار:</span>
                        <span className="font-mono text-amber-300 font-bold">{currentStrokeWidth}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={currentStrokeWidth}
                        onChange={(e) => updateConfig({ strokeWidth: parseInt(e.target.value) })}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    {/* Stroke Style (solid, dashed, dotted) */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-slate-400">نمط الخط:</span>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { id: "solid", label: "متصل" },
                          { id: "dashed", label: "متقطع" },
                          { id: "dotted", label: "منقط" },
                        ].map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => updateConfig({ strokeDash: st.id as any })}
                            className={`py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                              currentStrokeDash === st.id
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Corner Radius (for rounded_rect or rectangle) */}
              {(currentType === "rounded_rect" || currentType === "rectangle") && (
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>استدارة الحواف (Corner Radius):</span>
                    <span className="font-mono text-amber-300 font-bold">{currentRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={currentRadius}
                    onChange={(e) => updateConfig({ cornerRadius: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              )}

              {/* Star Points (for star or polygon) */}
              {(currentType === "star" || currentType === "polygon") && (
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>عدد الأطراف / الأضلاع:</span>
                    <span className="font-mono text-amber-300 font-bold">{currentStarPoints}</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="12"
                    value={currentStarPoints}
                    onChange={(e) => updateConfig({ starPoints: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              )}
            </div>
          );
        })()}

        {/* ========================================================= */}
        {/* 8. PRODUCT BACKDROPS LIBRARY */}
        {/* ========================================================= */}
        {activeTool === "backdrop" && (
          <div className="space-y-3">
            <div className="text-[11px] text-slate-400">
              دمج منصة تصوير احترافية جاهزة خلف العنصر:
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {PRODUCT_BACKDROPS.map((bd) => (
                <PanelButton
                  key={bd.id}
                  onClick={() => onApplyProductBackdrop(bd.id)}
                  className="group relative rounded-xl border border-slate-800 hover:border-purple-500/70 p-2.5 bg-slate-900/80 hover:bg-[#151726] transition-all text-right flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-lg bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-800 shrink-0">
                    <Sparkles className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200 group-hover:text-purple-300">
                      {bd.name}
                    </div>
                    <div className="text-[10px] font-mono text-purple-400/80">{bd.category}</div>
                  </div>
                </PanelButton>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 9. SVG VECTORIZER TRACE */}
        {/* ========================================================= */}
        {activeTool === "vectorize" && (
          <div className="space-y-4">
            <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>مستويات لوحة الألوان:</span>
                <span className="text-purple-300 font-bold">{vectorColors} ألوان</span>
              </div>
              <input
                type="range"
                min="2"
                max="12"
                value={vectorColors}
                onChange={(e) => setVectorColors(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            {svgPreview && (
              <div className="space-y-2">
                <span className="text-[11px] text-slate-400">معاينة مسارات الفكتور (SVG):</span>
                <div
                  className="w-full h-40 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden p-2 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: svgPreview }}
                />
              </div>
            )}

            <PanelButton
              onClick={() => {
                if (!svgPreview) return;
                const blob = new Blob([svgPreview], { type: "image/svg+xml" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `vision_studio_vector_${Date.now()}.svg`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-purple-600/30 transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تنزيل ملف فكتور SVG</span>
            </PanelButton>
          </div>
        )}
      </div>
    </aside>
  );
};
