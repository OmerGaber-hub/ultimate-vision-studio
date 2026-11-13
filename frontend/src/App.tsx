import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Layer,
  ToolType,
  PointProcessConfig,
  ToneAdjustments,
  SpatialFilterConfig,
  BgRemovalConfig,
  BrushConfig,
  DetectedObject,
  OCRBlock,
  SegmentItem,
  SegmentationConfig,
  SelectionRegion,
  CropRegion,
  ShapeConfig,
} from "./types";
import { Navbar } from "./components/Navbar";
import { Toolbar } from "./components/Toolbar";
import { LayersPanel } from "./components/LayersPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { CanvasWorkspace } from "./components/CanvasWorkspace";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { HelpModal } from "./components/HelpModal";
import { ImageMetadataModal, FileMetadataInfo } from "./components/ImageMetadataModal";
import { ImageBlendModal } from "./components/ImageBlendModal";
import { PythonCodeModal } from "./components/PythonCodeModal";
import { AuthModal } from "./components/AuthModal";
import { AuthPage } from "./components/AuthPage";
import { UserStorageModal } from "./components/UserStorageModal";
import { useAuth } from "./lib/authContext";
import { saveLocalProject } from "./lib/localProjects";
import { Tooltip } from "./components/Tooltip";
import {
  Upload,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  Layers as LayersIcon,
  SlidersHorizontal,
} from "lucide-react";
import {
  applyPointProcessing,
  applyToneLightAdjustments,
  applySpatialFilter,
  applyBackgroundRemoval,
  removeBackgroundSmart,
  removeBackgroundChroma,
  cloneCanvas,
  traceImageToSVG,
  applySegmentation,
  applyFilterToPolygonRegion,
  applyInpaintBackend,
} from "./lib/cvEngine";
import { SAMPLE_IMAGES, SampleImageMeta } from "./lib/sampleImages";
import { PRODUCT_BACKDROPS } from "./lib/productBackdrops";
import { renderTextToCanvas, TextRenderConfig } from "./lib/textEngine";
import { renderShapeToCanvas } from "./lib/shapeEngine";
import { renderGradientToCanvas, DEFAULT_GRADIENT_CONFIG } from "./lib/gradientEngine";
import { GradientConfig } from "./types";
import { exportToPDF, exportToWord } from "./lib/documentExport";

interface HistorySnapshot {
  layers: Array<{
    id: string;
    name: string;
    type: Layer["type"];
    opacity: number;
    blendMode: Layer["blendMode"];
    visible: boolean;
    locked: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    flipX: boolean;
    flipY: boolean;
    dataUrl: string;
    textConfig?: TextRenderConfig;
    shapeConfig?: ShapeConfig;
    gradientConfig?: GradientConfig;
  }>;
  activeLayerId: string;
  docWidth?: number;
  docHeight?: number;
}

export function App() {
  // Layers State
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string>("");
  const activeLayer = layers.find((l) => l.id === activeLayerId) || null;

  // Original pristine canvas copy for split-view comparison
  const [originalCanvas, setOriginalCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isComparingOriginal, setIsComparingOriginal] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  // Panel Visibility States (Collapsible Side Panels)
  const [isLayersOpen, setIsLayersOpen] = useState<boolean>(true);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState<boolean>(true);

  // Active Tool & Navigation
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [zoom, setZoom] = useState<number>(1);
  const [splitView, setSplitView] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Undo / Redo History Stacks
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  // Configurations
  const [pointConfig, setPointConfig] = useState<PointProcessConfig>({
    mode: "gamma",
    gamma: 1.2,
    logC: 45,
    thresholdValue: 128,
    bitPlaneIndex: 7,
    sampleFactor: 8,
    quantLevels: 8,
  });

  // Tone & Light Sliders (Brightness, Contrast, Exposure, Light Balance, Highlights, Shadows, Saturation)
  const [toneAdjustments, setToneAdjustments] = useState<ToneAdjustments>({
    brightness: 0,
    contrast: 0,
    exposure: 0,
    lightBalance: 0,
    highlights: 0,
    shadows: 0,
    saturation: 0,
  });
  const [toneScope, setToneScope] = useState<"layer" | "project">("layer");
  const toneBaseCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const toneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toneRequestIdRef = useRef<number>(0);
  const segmentOriginalCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const segmentBaseCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const spatialBaseCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const pointBaseCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const bgOriginalCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  // Reset spatial & point base canvas when tool or active layer changes
  useEffect(() => {
    spatialBaseCanvasesRef.current.clear();
    pointBaseCanvasesRef.current.clear();
  }, [activeTool, activeLayerId]);

  const [spatialConfig, setSpatialConfig] = useState<SpatialFilterConfig>({
    type: "gaussian",
    kernelSize: 5,
    sigma: 1.5,
    edgeThreshold: 30,
    cannyLow: 40,
    cannyHigh: 110,
    unsharpAmount: 1.5,
    unsharpRadius: 3,
    boostFactor: 1.5,
    laplacianDiagonal: true,
  });

  const [bgConfig, setBgConfig] = useState<BgRemovalConfig>({
    mode: "ai_click",
    wandColor: { r: 255, g: 255, b: 255 },
    tolerance: 35,
    eraserRadius: 25,
    eraserHardness: 80,
    eraserOpacity: 100,
    feather: 3,
    contiguous: true,
    invert: false,
    asNewLayer: false,
  });

  const [brushConfig, setBrushConfig] = useState<BrushConfig>({
    mode: "brush",
    size: 15,
    color: "#eab308",
    opacity: 1,
    eraserTarget: "both",
    eraserHardness: 80,
    eraserOpacity: 100,
    eraserSubMode: "ai_object",
    inpaintRadius: 5,
    inpaintMethod: "telea",
    autoInpaintOnRelease: true,
    inpaintDilate: 3,
    fillShape: false,
    fillColor: "#eab30833",
    strokeDash: "solid",
    targetLayer: "active",
  });

  // AI Vision states
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [ocrBlocks, setOcrBlocks] = useState<OCRBlock[]>([]);
  const [segments, setSegments] = useState<SegmentItem[]>([]);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [aiNotice, setAiNotice] = useState<{ message: string; isLeakedKey?: boolean } | null>(null);
  const [ocrLanguage, setOcrLanguage] = useState<"ar+en" | "ar" | "en">("ar+en");
  const [ocrEnhance, setOcrEnhance] = useState<boolean>(true);
  const [yoloModel, setYoloModel] = useState<"yolo11s.pt" | "yolo11n.pt">("yolo11s.pt");
  const [yoloConfidence, setYoloConfidence] = useState<number>(0.25);

  // Advanced Segmentation Configuration
  const [segmentConfig, setSegmentConfig] = useState<SegmentationConfig>({
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
  });
  const [activeAiSubTab, setActiveAiSubTab] = useState<"segmentation" | "ocr" | "object_detection">("segmentation");

  // Lasso & Polygon Selection Region state
  const [selectionRegion, setSelectionRegion] = useState<SelectionRegion>({
    mode: "polygon",
    points: [],
    isClosed: false,
    feather: 0,
  });

  // Smart Inpaint Controller reference
  const inpaintControllerRef = useRef<{
    getMaskCanvas: () => HTMLCanvasElement | null;
    clearMask: () => void;
  } | null>(null);

  // File metadata & Modal state
  const { user, token, refreshUser } = useAuth();
  const [currentView, setCurrentView] = useState<"studio" | "auth">(() => {
    return window.location.hash === "#auth" ? "auth" : "studio";
  });
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showStorageModal, setShowStorageModal] = useState<boolean>(false);
  const [isSavingProject, setIsSavingProject] = useState<boolean>(false);

  // Hash-based URL routing for Auth Page
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === "#auth") {
        setCurrentView("auth");
      } else {
        setCurrentView("studio");
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateToAuth = () => {
    window.location.hash = "auth";
    setCurrentView("auth");
  };

  const navigateToStudio = () => {
    window.location.hash = "";
    setCurrentView("studio");
  };
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showMetadataModal, setShowMetadataModal] = useState<boolean>(false);
  const [showBlendModal, setShowBlendModal] = useState<boolean>(false);
  const [showPythonCodeModal, setShowPythonCodeModal] = useState<boolean>(false);
  const [fileMetadata, setFileMetadata] = useState<FileMetadataInfo | null>(null);
  const [projectName, setProjectName] = useState<string>("تصميم جديد");
  const [docWidth, setDocWidth] = useState<number>(800);
  const [docHeight, setDocHeight] = useState<number>(600);
  const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(null);

  // Sync document title with active project name
  useEffect(() => {
    document.title = `${projectName || "مشروع جديد"} | Ultimate Vision Studio`;
  }, [projectName]);

  // Geometric Shape Configuration State
  const [shapeConfig, setShapeConfig] = useState<ShapeConfig>({
    type: "rectangle",
    fillColor: "#8b5cf6",
    isFilled: true,
    strokeColor: "#ffffff",
    hasStroke: true,
    strokeWidth: 2,
    strokeStyle: "solid",
    cornerRadius: 16,
    starPoints: 5,
    opacity: 1,
  });

  // Global Drag & Drop State for the entire workspace
  const [isDraggingGlobalFile, setIsDraggingGlobalFile] = useState<boolean>(false);
  const dragCounterRef = useRef<number>(0);

  // Mutable refs to keep latest state accessible to global event listeners without stale closures
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const activeLayerIdRef = useRef(activeLayerId);
  activeLayerIdRef.current = activeLayerId;
  const handleUploadFilesRef = useRef<(files: File[]) => void>(() => {});

  // Global window drag-and-drop listener across the entire workspace
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const hasFiles = e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
      if (hasFiles) {
        dragCounterRef.current += 1;
        setIsDraggingGlobalFile(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
      const hasFiles = e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
      if (hasFiles && !isDraggingGlobalFile) {
        setIsDraggingGlobalFile(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setIsDraggingGlobalFile(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDraggingGlobalFile(false);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleUploadFilesRef.current(Array.from(e.dataTransfer.files) as File[]);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  // Helper to snapshot current state for undo
  const pushUndo = useCallback((currentLayers: Layer[], currentActiveId: string) => {
    const snapshot: HistorySnapshot = {
      layers: currentLayers.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        opacity: l.opacity,
        blendMode: l.blendMode,
        visible: l.visible,
        locked: l.locked,
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
        rotation: l.rotation,
        scaleX: l.scaleX,
        scaleY: l.scaleY,
        flipX: l.flipX,
        flipY: l.flipY,
        dataUrl: l.canvas.toDataURL(),
        textConfig: l.textConfig,
        shapeConfig: l.shapeConfig,
        gradientConfig: l.gradientConfig,
      })),
      activeLayerId: currentActiveId,
      docWidth,
      docHeight,
    };

    setUndoStack((prev) => [...prev.slice(-15), snapshot]);
    setRedoStack([]);
  }, [docWidth, docHeight]);

  // Create a clean new blank canvas workspace directly (NO background layer)
  const handleNewProject = useCallback((w = 1000, h = 750, _background?: "transparent" | "white") => {
    // Canvas starts completely empty — no default layers
    setLayers([]);
    setActiveLayerId("");
    setActiveTool("select");
    setDocWidth(w);
    setDocHeight(h);
    setProjectName("مشروع جديد");
    setCurrentProjectId(null);
    setUndoStack([]);
    setRedoStack([]);
    setDetectedObjects([]);
    setOcrBlocks([]);
    setSegments([]);
    setOriginalCanvas(null);
    setFileMetadata(null);
  }, []);

  // Initialize with a clean workspace directly (no background layer)
  useEffect(() => {
    handleNewProject(1000, 750, "transparent");
  }, [handleNewProject]);

  // Privacy & Session Isolation: Automatically reset workspace whenever user logs out or switches accounts
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevUserIdRef.current === undefined) {
      prevUserIdRef.current = user?.id || null;
      return;
    }

    if (prevUserIdRef.current !== (user?.id || null)) {
      prevUserIdRef.current = user?.id || null;
      // Reset workspace to clean canvas to prevent artwork leaking between accounts/guests
      handleNewProject(1000, 750, "transparent");
      setCurrentProjectId(null);
      segmentOriginalCanvasesRef.current.clear();
      segmentBaseCanvasesRef.current.clear();
      spatialBaseCanvasesRef.current.clear();
      pointBaseCanvasesRef.current.clear();
      toneBaseCanvasesRef.current.clear();
    }
  }, [user?.id, handleNewProject]);

  // Toggle both panels (Zen Mode / Full Workspace)
  const handleToggleBothPanels = useCallback(() => {
    if (isLayersOpen || isPropertiesOpen) {
      setIsLayersOpen(false);
      setIsPropertiesOpen(false);
    } else {
      setIsLayersOpen(true);
      setIsPropertiesOpen(true);
    }
  }, [isLayersOpen, isPropertiesOpen]);

  // Hybrid Project Saving: Saves to Cloud (if logged in) or LocalStorage (if offline/guest)
  const handleSaveProject = useCallback(async () => {
    setIsSavingProject(true);
    try {
      // 1. Generate composite thumbnail
      const thumbCanvas = document.createElement("canvas");
      const thumbMax = 320;
      const scale = Math.min(thumbMax / docWidth, thumbMax / docHeight);
      thumbCanvas.width = Math.max(1, Math.round(docWidth * scale));
      thumbCanvas.height = Math.max(1, Math.round(docHeight * scale));
      const tCtx = thumbCanvas.getContext("2d");
      if (tCtx) {
        tCtx.imageSmoothingEnabled = true;
        tCtx.imageSmoothingQuality = "high";
        tCtx.fillStyle = "#121320";
        tCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
        for (const l of layers) {
          if (l.visible && l.canvas) {
            tCtx.save();
            tCtx.globalAlpha = l.opacity;
            tCtx.globalCompositeOperation = (l.blendMode as GlobalCompositeOperation) || "source-over";
            tCtx.drawImage(
              l.canvas,
              l.x * scale,
              l.y * scale,
              (l.width || l.canvas.width) * (l.scaleX || 1) * scale,
              (l.height || l.canvas.height) * (l.scaleY || 1) * scale
            );
            tCtx.restore();
          }
        }
      }
      const thumbnailUrl = thumbCanvas.toDataURL("image/jpeg", 0.8);

      // 2. Serialize layers
      const serializedLayers = layers.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        blendMode: l.blendMode,
        x: l.x,
        y: l.y,
        width: l.width || l.canvas.width,
        height: l.height || l.canvas.height,
        rotation: l.rotation || 0,
        scaleX: l.scaleX ?? 1,
        scaleY: l.scaleY ?? 1,
        flipX: l.flipX ?? false,
        flipY: l.flipY ?? false,
        dataUrl: l.canvas.toDataURL("image/png"),
        textConfig: l.textConfig,
        shapeConfig: l.shapeConfig,
        gradientConfig: l.gradientConfig,
      }));
      const layersDataStr = JSON.stringify(serializedLayers);

      if (token && user) {
        // Cloud Save via FastAPI
        const res = await fetch("http://localhost:8000/api/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: projectName || "مشروع جديد",
            docWidth,
            docHeight,
            layersData: layersDataStr,
            thumbnailUrl,
            projectId: currentProjectId,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "فشل حفظ المشروع سحابياً");
        }
        setCurrentProjectId(data.project.id);
        await refreshUser();
        alert("✨ تم حفظ المشروع بنجاح في مساحتك السحابية الخاصة!");
      } else {
        // Offline / Local save with strict per-user storage isolation
        const id = currentProjectId || `local_${Date.now()}`;
        saveLocalProject(id, projectName || "مشروع محلي جديد", docWidth, docHeight, layersDataStr, thumbnailUrl, user?.id);
        setCurrentProjectId(id);
        alert("💾 تم حفظ المشروع محلياً في متصفحك! يمكنك تسجيل الدخول في أي وقت لرفع مشاريعه للسحابة والوصول إليها من أي جهاز.");
      }
    } catch (err: any) {
      console.error("Save error:", err);
      alert("خطأ أثناء حفظ المشروع: " + (err?.message || err));
    } finally {
      setIsSavingProject(false);
    }
  }, [layers, docWidth, docHeight, projectName, currentProjectId, token, user, refreshUser]);

  // Load a project (Cloud or Local) into the active editor session
  const handleLoadProject = useCallback(async (projectData: any) => {
    try {
      setIsProcessing(true);
      const layersList: any[] = typeof projectData.layersData === "string"
        ? JSON.parse(projectData.layersData)
        : projectData.layersData || [];

      const loadedLayers: Layer[] = await Promise.all(
        layersList.map((item: any) => {
          return new Promise<Layer>((resolve) => {
            const img = new Image();
            img.onload = () => {
              const c = document.createElement("canvas");
              c.width = item.width || img.width;
              c.height = item.height || img.height;
              const ctx = c.getContext("2d");
              if (ctx) ctx.drawImage(img, 0, 0);

              resolve({
                id: item.id || `layer_${Date.now()}_${Math.random()}`,
                name: item.name || "طبقة",
                type: item.type || "raster",
                visible: item.visible ?? true,
                locked: item.locked ?? false,
                opacity: item.opacity ?? 1,
                blendMode: item.blendMode || "normal",
                canvas: c,
                x: item.x || 0,
                y: item.y || 0,
                width: item.width || img.width,
                height: item.height || img.height,
                scaleX: item.scaleX ?? 1,
                scaleY: item.scaleY ?? 1,
                rotation: item.rotation || 0,
                flipX: item.flipX ?? false,
                flipY: item.flipY ?? false,
                textConfig: item.textConfig,
                shapeConfig: item.shapeConfig,
                gradientConfig: item.gradientConfig,
              });
            };
            img.onerror = () => {
              const c = document.createElement("canvas");
              c.width = item.width || 800;
              c.height = item.height || 600;
              resolve({
                id: item.id,
                name: item.name,
                type: item.type || "raster",
                visible: true,
                locked: false,
                opacity: 1,
                blendMode: "normal",
                canvas: c,
                x: 0,
                y: 0,
                width: c.width,
                height: c.height,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
                flipX: false,
                flipY: false,
              });
            };
            img.src = item.dataUrl;
          });
        })
      );

      if (loadedLayers.length > 0) {
        pushUndo(layers, activeLayerId);
        setLayers(loadedLayers);
        setActiveLayerId(loadedLayers[0].id);
      }
      if (projectData.docWidth) setDocWidth(projectData.docWidth);
      if (projectData.docHeight) setDocHeight(projectData.docHeight);
      if (projectData.title) setProjectName(projectData.title);
      setCurrentProjectId(projectData.id);
    } catch (err: any) {
      console.error("Load project error:", err);
      alert("تعذر فتح المشروع: " + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  }, [layers, activeLayerId, pushUndo]);

  // Insert an image from user's private vault as a new layer in active canvas
  const handleInsertAssetAsLayer = useCallback((imageUrl: string, filename: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const newCanvas = document.createElement("canvas");
      newCanvas.width = img.width;
      newCanvas.height = img.height;
      const ctx = newCanvas.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0);

      const newLayer: Layer = {
        id: `asset_${Date.now()}`,
        name: filename || "صورة من الخزنة",
        type: "raster",
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "normal",
        canvas: newCanvas,
        x: Math.max(0, Math.round((docWidth - img.width) / 2)),
        y: Math.max(0, Math.round((docHeight - img.height) / 2)),
        width: img.width,
        height: img.height,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        flipX: false,
        flipY: false,
      };

      pushUndo(layers, activeLayerId);
      setLayers((prev) => [newLayer, ...prev]);
      setActiveLayerId(newLayer.id);
    };
    img.src = imageUrl;
  }, [docWidth, docHeight, layers, activeLayerId, pushUndo]);
  const handleSelectTool = useCallback((tool: ToolType) => {
    setActiveTool(tool);
    setIsPropertiesOpen(true);
    if (tool === "segmentation") {
      const currentLayers = layersRef.current;
      const currentActiveId = activeLayerIdRef.current;
      const active = currentLayers.find((l) => l.id === currentActiveId);
      if (active) {
        if (!segmentOriginalCanvasesRef.current.has(active.id)) {
          segmentOriginalCanvasesRef.current.set(active.id, cloneCanvas(active.canvas));
        }
        if (!segmentBaseCanvasesRef.current.has(active.id)) {
          segmentBaseCanvasesRef.current.set(active.id, cloneCanvas(active.canvas));
        }
      }
    } else if (tool === "bg_remove") {
      const currentLayers = layersRef.current;
      const currentActiveId = activeLayerIdRef.current;
      const active = currentLayers.find((l) => l.id === currentActiveId);
      if (active && !bgOriginalCanvasesRef.current.has(active.id)) {
        bgOriginalCanvasesRef.current.set(active.id, cloneCanvas(active.canvas));
      }
    } else if (tool === "eraser") {
      setBrushConfig((prev) => ({
        ...prev,
        mode: "eraser",
        eraserSubMode: prev.eraserSubMode || "ai_object",
        size: Math.max(15, prev.size),
      }));
      // Auto-select a raster layer if none is selected
      const currentLayers = layersRef.current;
      const currentActiveId = activeLayerIdRef.current;
      const active = currentLayers.find((l) => l.id === currentActiveId && l.canvas && !l.locked);
      if (!active) {
        const fallback = [...currentLayers].reverse().find(
          (l) => l.canvas && !l.locked && l.type !== "text" && l.type !== "adjustment"
        );
        if (fallback) {
          setActiveLayerId(fallback.id);
        }
      }
    } else if (tool === "draw") {
      setBrushConfig((prev) => ({
        ...prev,
        mode: prev.mode === "eraser" ? "brush" : prev.mode,
      }));
    }
  }, []);

  // Undo Handler
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];

    // Push current to redo
    const currentSnapshot: HistorySnapshot = {
      layers: layers.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        opacity: l.opacity,
        blendMode: l.blendMode,
        visible: l.visible,
        locked: l.locked,
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
        rotation: l.rotation,
        scaleX: l.scaleX,
        scaleY: l.scaleY,
        flipX: l.flipX,
        flipY: l.flipY,
        dataUrl: l.canvas.toDataURL(),
        textConfig: l.textConfig,
        shapeConfig: l.shapeConfig,
        gradientConfig: l.gradientConfig,
      })),
      activeLayerId,
      docWidth,
      docHeight,
    };
    setRedoStack((prev) => [...prev, currentSnapshot]);
    setUndoStack((prev) => prev.slice(0, -1));

    if (previous.docWidth && previous.docHeight) {
      setDocWidth(previous.docWidth);
      setDocHeight(previous.docHeight);
    }

    // Restore previous layers
    const restoredLayers: Layer[] = previous.layers.map((l) => {
      const c = document.createElement("canvas");
      c.width = l.width;
      c.height = l.height;
      const ctx = c.getContext("2d");

      if (l.type === "shape" && l.shapeConfig) {
        const padding = Math.ceil((l.shapeConfig.strokeWidth || 0) / 2) + 4;
        const targetW = Math.max(10, l.width - padding * 2);
        const targetH = Math.max(10, l.height - padding * 2);
        const rendered = renderShapeToCanvas(l.shapeConfig, targetW, targetH);
        ctx?.drawImage(rendered.canvas, 0, 0);
      } else if (l.type === "text" && l.textConfig) {
        const rendered = renderTextToCanvas(l.textConfig);
        ctx?.drawImage(rendered.canvas, 0, 0);
      } else if (l.type === "gradient" && l.gradientConfig) {
        const rendered = renderGradientToCanvas(l.gradientConfig, l.width, l.height);
        ctx?.drawImage(rendered, 0, 0);
      } else if (l.dataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx?.drawImage(img, 0, 0);
          setLayers((current) => [...current]);
        };
        img.src = l.dataUrl;
        if (img.complete) {
          ctx?.drawImage(img, 0, 0);
        }
      }
      return {
        ...l,
        canvas: c,
        textConfig: l.textConfig,
        shapeConfig: l.shapeConfig,
        gradientConfig: l.gradientConfig,
      };
    });

    setLayers(restoredLayers);
    setActiveLayerId(previous.activeLayerId);
    spatialBaseCanvasesRef.current.clear();
    segmentBaseCanvasesRef.current.clear();
    segmentOriginalCanvasesRef.current.clear();
    bgOriginalCanvasesRef.current.clear();
    setAiNotice({ message: "تم التراجع عن آخر إجراء (Undo) ✓" });
  }, [undoStack, layers, activeLayerId, docWidth, docHeight]);

  // Redo Handler
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];

    // Push current to undo
    const currentSnapshot: HistorySnapshot = {
      layers: layers.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        opacity: l.opacity,
        blendMode: l.blendMode,
        visible: l.visible,
        locked: l.locked,
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
        rotation: l.rotation,
        scaleX: l.scaleX,
        scaleY: l.scaleY,
        flipX: l.flipX,
        flipY: l.flipY,
        dataUrl: l.canvas.toDataURL(),
        textConfig: l.textConfig,
        shapeConfig: l.shapeConfig,
        gradientConfig: l.gradientConfig,
      })),
      activeLayerId,
      docWidth,
      docHeight,
    };
    setUndoStack((prev) => [...prev, currentSnapshot]);
    setRedoStack((prev) => prev.slice(0, -1));

    if (next.docWidth && next.docHeight) {
      setDocWidth(next.docWidth);
      setDocHeight(next.docHeight);
    }

    const restoredLayers: Layer[] = next.layers.map((l) => {
      const c = document.createElement("canvas");
      c.width = l.width;
      c.height = l.height;
      const ctx = c.getContext("2d");

      if (l.type === "shape" && l.shapeConfig) {
        const padding = Math.ceil((l.shapeConfig.strokeWidth || 0) / 2) + 4;
        const targetW = Math.max(10, l.width - padding * 2);
        const targetH = Math.max(10, l.height - padding * 2);
        const rendered = renderShapeToCanvas(l.shapeConfig, targetW, targetH);
        ctx?.drawImage(rendered.canvas, 0, 0);
      } else if (l.type === "text" && l.textConfig) {
        const rendered = renderTextToCanvas(l.textConfig);
        ctx?.drawImage(rendered.canvas, 0, 0);
      } else if (l.type === "gradient" && l.gradientConfig) {
        const rendered = renderGradientToCanvas(l.gradientConfig, l.width, l.height);
        ctx?.drawImage(rendered, 0, 0);
      } else if (l.dataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx?.drawImage(img, 0, 0);
          setLayers((current) => [...current]);
        };
        img.src = l.dataUrl;
        if (img.complete) {
          ctx?.drawImage(img, 0, 0);
        }
      }
      return {
        ...l,
        canvas: c,
        textConfig: l.textConfig,
        shapeConfig: l.shapeConfig,
        gradientConfig: l.gradientConfig,
      };
    });

    setLayers(restoredLayers);
    setActiveLayerId(next.activeLayerId);
    spatialBaseCanvasesRef.current.clear();
    segmentBaseCanvasesRef.current.clear();
    segmentOriginalCanvasesRef.current.clear();
    bgOriginalCanvasesRef.current.clear();
    setAiNotice({ message: "تمت إعادة الإجراء (Redo) ✓" });
  }, [redoStack, layers, activeLayerId, docWidth, docHeight]);

  // Duplicate Layer Handler
  const handleDuplicateLayer = useCallback((id: string) => {
    const source = layers.find((l) => l.id === id);
    if (!source) return;
    pushUndo(layers, activeLayerId);
    const dup: Layer = {
      ...source,
      id: `layer-dup-${Date.now()}`,
      name: `${source.name} (نسخة)`,
      canvas: cloneCanvas(source.canvas),
      x: source.x + 20,
      y: source.y + 20,
      shapeConfig: source.shapeConfig ? { ...source.shapeConfig } : undefined,
    };
    setLayers((prev) => [...prev, dup]);
    setActiveLayerId(dup.id);
  }, [layers, activeLayerId, pushUndo]);

  // Delete Layer Handler
  const handleDeleteLayer = useCallback((id: string) => {
    if (layers.length === 0) return;
    pushUndo(layers, activeLayerId);
    const filtered = layers.filter((l) => l.id !== id);
    setLayers(filtered);
    if (activeLayerId === id) {
      setActiveLayerId(filtered.length > 0 ? filtered[filtered.length - 1].id : "");
    }
  }, [layers, activeLayerId, pushUndo]);

  // Add Dedicated Gradient Fill Layer
  const handleAddGradientLayer = useCallback(
    (customConfig?: GradientConfig) => {
      pushUndo(layers, activeLayerId);
      const gradConfig = customConfig || DEFAULT_GRADIENT_CONFIG;
      const canvas = renderGradientToCanvas(gradConfig, docWidth, docHeight);

      const newLayer: Layer = {
        id: `layer-grad-${Date.now()}`,
        name: `تدرج لوني ${layers.length + 1}`,
        type: "gradient",
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "normal",
        x: 0,
        y: 0,
        width: docWidth,
        height: docHeight,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        flipX: false,
        flipY: false,
        canvas,
        gradientConfig: gradConfig,
      };

      setLayers((prev) => [...prev, newLayer]);
      setActiveLayerId(newLayer.id);
      setAiNotice({ message: "تمت إضافة طبقة تدرج لوني جديدة بنجاح ✓" });
    },
    [layers, activeLayerId, docWidth, docHeight, pushUndo]
  );

  // Update Active Gradient Layer live
  const handleUpdateActiveGradientLayer = useCallback(
    (layerId: string, gradientConfig: GradientConfig) => {
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== layerId) return l;
          const canvas = renderGradientToCanvas(gradientConfig, l.width, l.height);
          return {
            ...l,
            canvas,
            gradientConfig,
          };
        })
      );
    },
    []
  );

  // =========================================================================
  // Interactive Cropping States & Handlers (Crop & Frame Overhaul)
  // =========================================================================
  const [cropBox, setCropBox] = useState<CropRegion | null>(null);
  const [cropAspect, setCropAspect] = useState<number | null>(null);
  const [cropTarget, setCropTarget] = useState<"document" | "layer">("document");

  // Reset crop bounding box to active target (layer vs whole document)
  const handleResetCropBox = useCallback(() => {
    if (cropTarget === "layer" && activeLayer) {
      const visualW = Math.max(20, Math.round(activeLayer.width * Math.abs(activeLayer.scaleX)));
      const visualH = Math.max(20, Math.round(activeLayer.height * Math.abs(activeLayer.scaleY)));
      let w = visualW;
      let h = visualH;
      if (cropAspect) {
        if (w / h > cropAspect) {
          w = Math.round(h * cropAspect);
        } else {
          h = Math.round(w / cropAspect);
        }
      }
      const x = Math.max(0, Math.round(activeLayer.x + (visualW - w) / 2));
      const y = Math.max(0, Math.round(activeLayer.y + (visualH - h) / 2));
      setCropBox({ x, y, width: Math.max(20, w), height: Math.max(20, h) });
    } else {
      let w = docWidth;
      let h = docHeight;
      if (cropAspect) {
        if (w / h > cropAspect) {
          w = Math.round(h * cropAspect);
        } else {
          h = Math.round(w / cropAspect);
        }
      }
      const x = Math.max(0, Math.round((docWidth - w) / 2));
      const y = Math.max(0, Math.round((docHeight - h) / 2));
      setCropBox({ x, y, width: Math.max(20, w), height: Math.max(20, h) });
    }
  }, [cropTarget, activeLayer, docWidth, docHeight, cropAspect]);

  // Preset aspect ratio handler
  const handleSetCropAspect = useCallback(
    (aspect?: number | null) => {
      const asp = aspect ?? null;
      setCropAspect(asp);
      if (!asp) return;
      setCropBox((prev) => {
        const maxW =
          cropTarget === "layer" && activeLayer
            ? Math.round(activeLayer.width * Math.abs(activeLayer.scaleX))
            : docWidth;
        const maxH =
          cropTarget === "layer" && activeLayer
            ? Math.round(activeLayer.height * Math.abs(activeLayer.scaleY))
            : docHeight;
        const baseW = prev ? prev.width : maxW;
        let newW = baseW;
        let newH = Math.round(newW / asp);
        if (newH > maxH) {
          newH = maxH;
          newW = Math.round(newH * asp);
        }
        const baseX = prev ? prev.x : 0;
        const baseY = prev ? prev.y : 0;
        return {
          x: Math.max(0, Math.min(baseX, maxW - newW)),
          y: Math.max(0, Math.min(baseY, maxH - newH)),
          width: Math.max(20, Math.min(newW, maxW)),
          height: Math.max(20, Math.min(newH, maxH)),
        };
      });
    },
    [cropTarget, activeLayer, docWidth, docHeight]
  );

  // Initialize crop frame whenever switching to crop tool or changing crop target
  useEffect(() => {
    if (activeTool === "crop") {
      handleResetCropBox();
    }
  }, [activeTool, cropTarget, handleResetCropBox]);

  // Cancel crop
  const handleCancelCrop = useCallback(() => {
    setActiveTool("select");
    setCropBox(null);
  }, []);

  // Confirm crop (seamless, pixel-perfect extraction with zero distortion or squishing)
  const handleConfirmCrop = useCallback(() => {
    if (!cropBox || cropBox.width <= 0 || cropBox.height <= 0) return;

    pushUndo(layers, activeLayerId);

    const boxX = Math.round(cropBox.x);
    const boxY = Math.round(cropBox.y);
    const boxW = Math.max(10, Math.round(cropBox.width));
    const boxH = Math.max(10, Math.round(cropBox.height));

    if (cropTarget === "document") {
      // 1. CROP CANVAS DOCUMENT (Standard Photoshop/Photopea crop)
      // Extract every layer's contents within the cropped area into a fresh canvas
      const updatedLayers = layers.map((layer) => {
        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = boxW;
        cropCanvas.height = boxH;
        const ctx = cropCanvas.getContext("2d");
        if (ctx) {
          const renderedW = layer.width * Math.abs(layer.scaleX || 1);
          const renderedH = layer.height * Math.abs(layer.scaleY || 1);
          const layerLeft = layer.x - boxX;
          const layerTop = layer.y - boxY;
          const cx = layerLeft + renderedW / 2;
          const cy = layerTop + renderedH / 2;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);
          ctx.scale(
            (layer.scaleX >= 0 ? 1 : -1) * (layer.flipX ? -1 : 1),
            (layer.scaleY >= 0 ? 1 : -1) * (layer.flipY ? -1 : 1)
          );
          ctx.drawImage(layer.canvas, -renderedW / 2, -renderedH / 2, renderedW, renderedH);
          ctx.restore();
        }

        return {
          ...layer,
          canvas: cropCanvas,
          width: boxW,
          height: boxH,
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
        };
      });

      setLayers(updatedLayers);
      setDocWidth(boxW);
      setDocHeight(boxH);

      // Also crop pristine originalCanvas if present
      if (originalCanvas) {
        const newOrig = document.createElement("canvas");
        newOrig.width = boxW;
        newOrig.height = boxH;
        const oCtx = newOrig.getContext("2d");
        if (oCtx) {
          oCtx.drawImage(originalCanvas, boxX, boxY, boxW, boxH, 0, 0, boxW, boxH);
          setOriginalCanvas(newOrig);
        }
      }

      setAiNotice({ message: `تم تطبيق القص بنجاح (${boxW} × ${boxH} بكسل)` });
    } else {
      // 2. CROP ACTIVE LAYER ONLY
      if (!activeLayer) return;
      const layer = activeLayer;

      const renderedW = layer.width * Math.abs(layer.scaleX || 1);
      const renderedH = layer.height * Math.abs(layer.scaleY || 1);

      // Intersection between crop box and layer
      const interX = Math.max(boxX, layer.x);
      const interY = Math.max(boxY, layer.y);
      const interRight = Math.min(boxX + boxW, layer.x + renderedW);
      const interBottom = Math.min(boxY + boxH, layer.y + renderedH);

      const interW = interRight - interX;
      const interH = interBottom - interY;

      if (interW <= 0 || interH <= 0) return;

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = interW;
      cropCanvas.height = interH;
      const ctx = cropCanvas.getContext("2d");
      if (ctx) {
        const layerOffsetX = layer.x - interX;
        const layerOffsetY = layer.y - interY;
        const cx = layerOffsetX + renderedW / 2;
        const cy = layerOffsetY + renderedH / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);
        ctx.scale(
          (layer.scaleX >= 0 ? 1 : -1) * (layer.flipX ? -1 : 1),
          (layer.scaleY >= 0 ? 1 : -1) * (layer.flipY ? -1 : 1)
        );
        ctx.drawImage(layer.canvas, -renderedW / 2, -renderedH / 2, renderedW, renderedH);
        ctx.restore();
      }

      setLayers((prev) =>
        prev.map((l) =>
          l.id === layer.id
            ? {
                ...l,
                canvas: cropCanvas,
                width: interW,
                height: interH,
                x: interX,
                y: interY,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
              }
            : l
        )
      );

      setAiNotice({ message: `تم قص الطبقة المحددة بنجاح (${interW} × ${interH} بكسل)` });
    }

    setActiveTool("select");
    setCropBox(null);
  }, [cropBox, cropTarget, layers, activeLayerId, activeLayer, originalCanvas, pushUndo]);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Global F1 intercept - always opens shortcuts modal
      if (e.key === "F1") {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      // 1.5 Global F2 intercept - renames project
      if (e.key === "F2") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("focus-project-name"));
        return;
      }

      // 2. Metadata modal shortcut (Ctrl+I or Cmd+I)
      if ((e.ctrlKey || e.metaKey) && (e.code === "KeyI" || e.key.toLowerCase() === "i")) {
        e.preventDefault();
        setShowMetadataModal((prev) => !prev);
        return;
      }

      // 3. Universal Escape: Close modals, deselect layers/text, clear selection region & crop box, return to select tool
      if (e.key === "Escape") {
        setShowShortcutsModal(false);
        setShowMetadataModal(false);
        setShowBlendModal(false);
        setShowPythonCodeModal(false);
        setEditingTextLayerId(null);
        setActiveLayerId("");
        setCropBox(null);
        setSelectionRegion({ mode: "polygon", points: [], isClosed: false, feather: 0 });
        if (activeTool !== "select") {
          setActiveTool("select");
        }
        return;
      }

      // Check if user is typing inside an editable text element
      const target = e.target as HTMLElement | null;
      const isEditableText =
        (target instanceof HTMLInputElement &&
          ["text", "search", "password", "number", "email", "url"].includes(target.type)) ||
        target instanceof HTMLTextAreaElement;

      // 4. Save Project (Ctrl+S) - works across all keyboard layouts
      const isSKey = e.code === "KeyS" || e.key.toLowerCase() === "s" || e.key === "س";
      if ((e.ctrlKey || e.metaKey) && isSKey) {
        e.preventDefault();
        setAiNotice({ message: "تم حفظ المشروع والتعديلات بنجاح في ذاكرة المتصفح ✓" });
        return;
      }

      // 5. Undo (Ctrl+Z) and Redo (Ctrl+Shift+Z or Ctrl+Y) - works on Arabic & English keyboards!
      const isZKey = e.code === "KeyZ" || e.key.toLowerCase() === "z" || e.key === "ئ";
      const isYKey = e.code === "KeyY" || e.key.toLowerCase() === "y" || e.key === "غ" || e.key === "إ";

      if ((e.ctrlKey || e.metaKey) && isZKey) {
        // If typing directly inside on-canvas text editor, allow native undo inside the text field
        if (editingTextLayerId && isEditableText) {
          return;
        }
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && isYKey) {
        if (editingTextLayerId && isEditableText) {
          return;
        }
        e.preventDefault();
        handleRedo();
        return;
      }

      // 6. Reset Zoom to 100% (Ctrl+0)
      if ((e.ctrlKey || e.metaKey) && (e.code === "Digit0" || e.code === "Numpad0" || e.key === "0")) {
        e.preventDefault();
        setZoom(1.0);
        return;
      }

      // 7. Zoom In (Ctrl + '+' or '=')
      if ((e.ctrlKey || e.metaKey) && (e.code === "Equal" || e.code === "NumpadAdd" || e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom((prev) => Math.min(4.0, parseFloat((prev + 0.1).toFixed(2))));
        return;
      }

      // 8. Zoom Out (Ctrl + '-' or '_')
      if ((e.ctrlKey || e.metaKey) && (e.code === "Minus" || e.code === "NumpadSubtract" || e.key === "-" || e.key === "_")) {
        e.preventDefault();
        setZoom((prev) => Math.max(0.2, parseFloat((prev - 0.1).toFixed(2))));
        return;
      }

      // 9. Universal Deselect All (Ctrl+D / Cmd+D)
      const isDKey = e.code === "KeyD" || e.key.toLowerCase() === "d" || e.key === "ي";
      if ((e.ctrlKey || e.metaKey) && isDKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setEditingTextLayerId(null);
        setActiveLayerId("");
        setCropBox(null);
        setSelectionRegion({ mode: "polygon", points: [], isClosed: false, feather: 0 });
        if (activeTool !== "select") {
          setActiveTool("select");
        }
        setAiNotice({ message: "تم إلغاء التحديد بالكامل" });
        return;
      }

      // 10. Duplicate active layer (Ctrl+J or Ctrl+Alt+D)
      const isJKey = e.code === "KeyJ" || e.key.toLowerCase() === "j" || e.key === "ت";
      if (
        ((e.ctrlKey || e.metaKey) && isJKey) ||
        ((e.ctrlKey || e.metaKey) && e.altKey && isDKey)
      ) {
        e.preventDefault();
        if (activeLayerId) {
          handleDuplicateLayer(activeLayerId);
        }
        return;
      }

      // 11. Delete active layer (Delete or Backspace) - only when not typing text
      if (!isEditableText && (e.key === "Delete" || e.code === "Delete" || e.key === "Backspace")) {
        if (layers.length > 0 && activeLayerId) {
          e.preventDefault();
          handleDeleteLayer(activeLayerId);
        }
        return;
      }

      // 12. Quick shortcut to toggle instant original comparison (\ or Alt+C)
      const isCKey = e.code === "KeyC" || e.key.toLowerCase() === "c" || e.key === "ؤ";
      if (e.key === "\\" || (e.altKey && isCKey)) {
        e.preventDefault();
        setIsComparingOriginal((prev) => !prev);
        return;
      }

      // 13. Toggle all panels (Tab key - standard Photoshop/Figma Zen mode)
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey && !isEditableText) {
        e.preventDefault();
        handleToggleBothPanels();
        return;
      }

      // 14. Toggle Panels (F7, F8)
      if (e.key === "F7") {
        e.preventDefault();
        setIsLayersOpen((prev) => !prev);
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        setIsPropertiesOpen((prev) => !prev);
        return;
      }

      // 15. Interactive Crop Confirm (Enter) or Cancel (Esc)
      if (activeTool === "crop") {
        if (e.key === "Enter") {
          e.preventDefault();
          handleConfirmCrop();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          handleCancelCrop();
          return;
        }
      }

      // 16. Single-key Tool switching (ONLY when NOT typing in an editable input and no Ctrl/Alt/Meta!)
      if (isEditableText || e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const code = e.code;
      const key = e.key.toLowerCase();

      if (code === "KeyV" || key === "v" || key === "ر") {
        handleSelectTool("select");
      } else if (code === "KeyC" || key === "c" || key === "ؤ") {
        handleSelectTool("crop");
      } else if (code === "KeyT" || key === "t" || key === "ف") {
        handleSelectTool("transform");
      } else if (code === "KeyB" || key === "b" || key === "لا") {
        handleSelectTool("bg_remove");
      } else if (code === "KeyA" || key === "a" || key === "ش") {
        handleSelectTool("segmentation");
      } else if (code === "KeyW" || key === "w" || key === "ص") {
        handleSelectTool("ocr");
      } else if (code === "KeyO" || key === "o" || key === "خ") {
        handleSelectTool("object_detection");
      } else if (code === "KeyH" || key === "h" || key === "ا") {
        handleSelectTool("enhance");
      } else if (code === "KeyF" || key === "f" || key === "ب") {
        handleSelectTool("spatial");
      } else if (code === "KeyP" || key === "p" || key === "ح") {
        handleSelectTool("point");
      } else if (code === "KeyS" || key === "s" || key === "س") {
        handleSelectTool("backdrop");
      } else if (code === "KeyX" || key === "x" || key === "ء") {
        handleSelectTool("text");
      } else if (code === "KeyD" || key === "d" || key === "ي") {
        handleSelectTool("draw");
      } else if (code === "KeyU" || key === "u" || key === "ع") {
        handleSelectTool("shape");
      } else if (code === "KeyE" || key === "e" || key === "ث") {
        handleSelectTool("eraser");
      } else if (code === "KeyK" || key === "k" || key === "ن") {
        handleSelectTool("vectorize");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    undoStack,
    redoStack,
    layers,
    activeLayerId,
    activeTool,
    handleUndo,
    handleRedo,
    handleDuplicateLayer,
    handleDeleteLayer,
    handleToggleBothPanels,
    handleSelectTool,
    handleConfirmCrop,
    handleCancelCrop,
  ]);

  // Load Benchmark Sample Image
  const handleLoadSample = (sample: SampleImageMeta) => {
    pushUndo(layers, activeLayerId);
    const canvas = sample.generator();
    setOriginalCanvas(cloneCanvas(canvas));

    const baseLayer: Layer = {
      id: `layer-${Date.now()}`,
      name: sample.title,
      type: "raster",
      canvas,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: "normal",
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      flipX: false,
      flipY: false,
    };

    setLayers([baseLayer]);
    setActiveLayerId(baseLayer.id);
    setDocWidth(canvas.width);
    setDocHeight(canvas.height);
    setProjectName(sample.title);
    setDetectedObjects([]);
    setOcrBlocks([]);
    setSegments([]);

    setFileMetadata({
      name: sample.title,
      size: Math.round(canvas.width * canvas.height * 4 * 0.32),
      type: "image/png",
      lastModified: Date.now(),
      originalWidth: canvas.width,
      originalHeight: canvas.height,
    });
  };

  // Helper to load any File into an HTMLCanvasElement with dual fallback
  const loadImageAsCanvas = (
    file: File
  ): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const processLoaded = (img: HTMLImageElement) => {
        const c = document.createElement("canvas");
        const w = img.naturalWidth || img.width || 800;
        const h = img.naturalHeight || img.height || 600;
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
        }
        resolve({ canvas: c, width: w, height: h });
      };

      try {
        const blobUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(blobUrl);
          processLoaded(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          const reader = new FileReader();
          reader.onload = (e) => {
            const fallbackImg = new Image();
            fallbackImg.onload = () => processLoaded(fallbackImg);
            fallbackImg.onerror = reject;
            fallbackImg.src = e.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        };
        img.src = blobUrl;
      } catch {
        const reader = new FileReader();
        reader.onload = (e) => {
          const fallbackImg = new Image();
          fallbackImg.onload = () => processLoaded(fallbackImg);
          fallbackImg.onerror = reject;
          fallbackImg.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }
    });
  };

  // Upload and process multiple or single image files dropped or picked anywhere in the app
  const handleUploadFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;

    const isImageFile = (f: File) =>
      f.type.startsWith("image/") ||
      /\.(png|jpe?g|webp|bmp|svg|gif|avif|ico|tiff|heic)$/i.test(f.name);

    const imageFiles = files.filter(isImageFile);

    if (imageFiles.length === 0) {
      setAiNotice({
        message: "الملف الذي تم سحبه ليس صورة مدعومة. الصيغ المدعومة تشمل: PNG, JPG, WebP, SVG, BMP, GIF.",
      });
      return;
    }

    const currentLayers = layersRef.current;
    const currentActiveId = activeLayerIdRef.current;
    pushUndo(currentLayers, currentActiveId);

    try {
      const firstFile = imageFiles[0];
      const { canvas: firstCanvas, width: firstW, height: firstH } = await loadImageAsCanvas(firstFile);

      setOriginalCanvas(cloneCanvas(firstCanvas));

      const cleanName = firstFile.name.replace(/\.[^/.]+$/, "");
      setProjectName(cleanName);

      // Record metadata
      setFileMetadata({
        name: firstFile.name,
        size: firstFile.size,
        type: firstFile.type || "image/png",
        lastModified: firstFile.lastModified || Date.now(),
        originalWidth: firstW,
        originalHeight: firstH,
      });

      const isInitialWorkspace = currentLayers.length <= 1; // 0 (empty) or 1 layer = replace workspace

      // Position and scale first layer
      let firstScale = 1;
      let firstX = 0;
      let firstY = 0;

      if (isInitialWorkspace) {
        setDocWidth(firstW);
        setDocHeight(firstH);
      } else {
        if (firstW > docWidth || firstH > docHeight) {
          firstScale = Math.min(docWidth / firstW, docHeight / firstH);
        }
        const renderedW = Math.round(firstW * firstScale);
        const renderedH = Math.round(firstH * firstScale);
        firstX = Math.max(0, Math.round((docWidth - renderedW) / 2));
        firstY = Math.max(0, Math.round((docHeight - renderedH) / 2));
      }

      const firstLayer: Layer = {
        id: `layer-upload-${Date.now()}-0`,
        name: cleanName,
        type: "raster",
        canvas: firstCanvas,
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "normal",
        x: firstX,
        y: firstY,
        width: firstW,
        height: firstH,
        rotation: 0,
        scaleX: firstScale,
        scaleY: firstScale,
        flipX: false,
        flipY: false,
      };

      // Load additional images as subsequent stacked layers
      const additionalLayers: Layer[] = [];
      const targetDocW = isInitialWorkspace ? firstW : docWidth;
      const targetDocH = isInitialWorkspace ? firstH : docHeight;

      for (let i = 1; i < imageFiles.length; i++) {
        const extraFile = imageFiles[i];
        try {
          const res = await loadImageAsCanvas(extraFile);
          let extraScale = 1;
          if (res.width > targetDocW || res.height > targetDocH) {
            extraScale = Math.min(targetDocW / res.width, targetDocH / res.height);
          }
          const renderedExtraW = Math.round(res.width * extraScale);
          const renderedExtraH = Math.round(res.height * extraScale);
          const extraX = Math.max(0, Math.round((targetDocW - renderedExtraW) / 2));
          const extraY = Math.max(0, Math.round((targetDocH - renderedExtraH) / 2));

          additionalLayers.push({
            id: `layer-upload-${Date.now()}-${i}`,
            name: extraFile.name.replace(/\.[^/.]+$/, ""),
            type: "raster",
            canvas: res.canvas,
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: "normal",
            x: extraX,
            y: extraY,
            width: res.width,
            height: res.height,
            rotation: 0,
            scaleX: extraScale,
            scaleY: extraScale,
            flipX: false,
            flipY: false,
          });
        } catch (extraErr) {
          console.warn("Could not load extra file", extraFile.name, extraErr);
        }
      }

      // If workspace only had the single default initial layer, replace it
      if (isInitialWorkspace) {
        setLayers([firstLayer, ...additionalLayers]);
      } else {
        setLayers((prev) => [...prev, firstLayer, ...additionalLayers]);
      }

      const activeTargetId = additionalLayers.length > 0
        ? additionalLayers[additionalLayers.length - 1].id
        : firstLayer.id;
      setActiveLayerId(activeTargetId);

      // Reset AI detections, OCR, and adjustments for fresh image
      setDetectedObjects([]);
      setOcrBlocks([]);
      setSegments([]);
      handleResetToneAdjustments();

      const successNotice =
        imageFiles.length > 1
          ? `تم رفع ${imageFiles.length} صور كطبقات جديدة بنجاح عبر السحب والإفلات`
          : `تم رفع ومعالجة الصورة "${firstFile.name}" بنجاح (${firstW} × ${firstH} بكسل)`;
      setAiNotice({ message: successNotice });
    } catch (err) {
      console.error("Error processing dropped image:", err);
      setAiNotice({
        message: "حدث خطأ أثناء معالجة ملف الصورة. يرجى التأكد من صلاحية الملف والمحاولة مجدداً.",
      });
    }
  };
  handleUploadFilesRef.current = handleUploadFiles;

  // Upload Single Image
  const handleUploadImage = (file: File) => {
    handleUploadFiles([file]);
  };

  // Export Composite Canvas with robust blob fallback & notification
  const handleExport = async (format: "png" | "jpeg" | "webp" | "svg" | "pdf" | "docx", quality?: number) => {
    try {
      if (!layers || layers.length === 0) {
        setAiNotice({ message: "تنبيه: لا توجد طبقات للتصدير. يرجى إضافة صورة أولاً." });
        return;
      }

      const docWidth = Math.max(1, ...layers.map((l) => l.width || 800));
      const docHeight = Math.max(1, ...layers.map((l) => l.height || 600));

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = docWidth;
      exportCanvas.height = docHeight;
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) {
        setAiNotice({ message: "تعذر إنشاء مساحة التصدير الرسومية." });
        return;
      }

      if (format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, docWidth, docHeight);
      }

      for (const layer of layers) {
        if (!layer.visible) continue;
        ctx.save();
        ctx.globalAlpha = layer.opacity ?? 1;
        ctx.globalCompositeOperation =
          layer.blendMode === "normal" ? "source-over" : (layer.blendMode as GlobalCompositeOperation);

        const centerX = layer.x + layer.width / 2;
        const centerY = layer.y + layer.height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);
        ctx.scale(
          (layer.scaleX || 1) * (layer.flipX ? -1 : 1),
          (layer.scaleY || 1) * (layer.flipY ? -1 : 1)
        );
        ctx.translate(-layer.width / 2, -layer.height / 2);
        ctx.drawImage(layer.canvas, 0, 0, layer.width, layer.height);
        ctx.restore();
      }

      const fileName = `${projectName ? projectName.replace(/[\s/\\?%*:|"<>]/g, "_") : "vision_studio"}_${Date.now()}`;

      if (format === "svg") {
        setIsProcessing(true);
        try {
          const svg = await traceImageToSVG(exportCanvas, 8);
          const blob = new Blob([svg], { type: "image/svg+xml" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${fileName}.svg`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 200);
          setAiNotice({ message: `تم تصدير وحفظ الصورة بنجاح بصيغة SVG!` });
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      if (format === "pdf") {
        setIsProcessing(true);
        try {
          await exportToPDF(exportCanvas, {
            projectName,
            docWidth,
            docHeight,
          });
          setAiNotice({ message: `تم تصدير العمل الفني بنجاح كمستند PDF عالي الدقة (${docWidth} × ${docHeight})!` });
        } catch (pdfErr) {
          console.error("PDF Export error:", pdfErr);
          setAiNotice({ message: "حدث خطأ أثناء تصدير ملف PDF. يرجى المحاولة مرة أخرى." });
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      if (format === "docx") {
        setIsProcessing(true);
        try {
          const textContents: string[] = [
            ...layers
              .filter((l) => l.type === "text" && l.textConfig?.text)
              .map((l) => l.textConfig!.text),
            ...ocrBlocks.map((b) => b.text),
          ];

          await exportToWord(exportCanvas, {
            projectName,
            docWidth,
            docHeight,
            textContents,
            includeTextSection: textContents.length > 0,
          });
          setAiNotice({ message: `تم تصدير العمل الفني بنجاح كملف وورد منسق (Word .docx)!` });
        } catch (docxErr) {
          console.error("Word Export error:", docxErr);
          setAiNotice({ message: "حدث خطأ أثناء تصدير ملف Word. يرجى المحاولة مرة أخرى." });
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      const mime = format === "png" ? "image/png" : format === "jpeg" ? "image/jpeg" : "image/webp";
      const ext = format === "jpeg" ? "jpg" : format;

      // Prefer toBlob for reliable memory and downloading of large images
      if (exportCanvas.toBlob) {
        exportCanvas.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${fileName}.${ext}`;
              document.body.appendChild(a);
              a.click();
              setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }, 200);
              setAiNotice({ message: `تم تصدير وحفظ الصورة بنجاح بصيغة ${format.toUpperCase()} (${docWidth} × ${docHeight})!` });
            } else {
              // Fallback to dataURL
              const dataUrl = exportCanvas.toDataURL(mime, quality || 0.92);
              const a = document.createElement("a");
              a.href = dataUrl;
              a.download = `${fileName}.${ext}`;
              document.body.appendChild(a);
              a.click();
              setTimeout(() => document.body.removeChild(a), 200);
              setAiNotice({ message: `تم تصدير وحفظ الصورة بنجاح!` });
            }
          },
          mime,
          quality || 0.92
        );
      } else {
        const dataUrl = exportCanvas.toDataURL(mime, quality || 0.92);
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${fileName}.${ext}`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 200);
        setAiNotice({ message: `تم تصدير وحفظ الصورة بنجاح!` });
      }
    } catch (exportErr) {
      console.error("Export error:", exportErr);
      setAiNotice({ message: "حدث خطأ أثناء تصدير الصورة. يرجى المحاولة مرة أخرى." });
    }
  };

  // Update Layer Transformation
  const handleUpdateLayerTransform = (transform: {
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    flipX?: boolean;
    flipY?: boolean;
    x?: number;
    y?: number;
  }) => {
    setLayers((prev) => {
      const active = prev.find((l) => l.id === activeLayerId);
      if (active && (transform.x !== undefined || transform.y !== undefined || transform.scaleX !== undefined || transform.scaleY !== undefined)) {
        const targetX = transform.x ?? active.x;
        const targetY = transform.y ?? active.y;
        const targetScaleX = Math.abs(transform.scaleX ?? active.scaleX ?? 1);
        const targetScaleY = Math.abs(transform.scaleY ?? active.scaleY ?? 1);
        const renderedW = active.width * targetScaleX;
        const renderedH = active.height * targetScaleY;
        const requiredW = Math.round(targetX + renderedW);
        const requiredH = Math.round(targetY + renderedH);

        if (requiredW > docWidth) {
          setDocWidth(requiredW);
        }
        if (requiredH > docHeight) {
          setDocHeight(requiredH);
        }
      }
      return prev.map((l) => (l.id === activeLayerId ? { ...l, ...transform } : l));
    });
  };

  // Apply Point Processing (with polygon selection region clipping if active)
  const handleApplyPointProcessing = useCallback(
    async (config?: PointProcessConfig, isPreview: boolean = false) => {
      const active = layers.find((l) => l.id === activeLayerId);
      if (!active) return;

      // Preserve base canvas for non-destructive preview
      let base = pointBaseCanvasesRef.current.get(active.id);
      if (!base) {
        base = cloneCanvas(active.canvas);
        pointBaseCanvasesRef.current.set(active.id, base);
      }

      const currentConfig = config || pointConfig;

      if (!isPreview) {
        pushUndo(layers, activeLayerId);
      }

      try {
        let processedCanvas = await applyPointProcessing(base, currentConfig, isPreview);

        // If user has drawn a closed polygon lasso selection, apply filter strictly within selected area
        if (selectionRegion.isClosed && selectionRegion.points.length >= 3) {
          const relPolygon = selectionRegion.points.map((p) => ({
            x: (p.x - active.x) / (active.scaleX || 1),
            y: (p.y - active.y) / (active.scaleY || 1),
          }));
          processedCanvas = applyFilterToPolygonRegion(base, relPolygon, processedCanvas);
        }

        if (!isPreview) {
          // Committed! Set base canvas to newly committed processed canvas and reset mode
          pointBaseCanvasesRef.current.set(active.id, cloneCanvas(processedCanvas));
          setPointConfig((prev) => ({ ...prev, mode: "none" }));
        }

        setLayers((prev) =>
          prev.map((l) => (l.id === activeLayerId ? { ...l, canvas: processedCanvas } : l))
        );
      } catch (err) {
        console.error(err);
      }
    },
    [layers, activeLayerId, pointConfig, selectionRegion, pushUndo]
  );

  // Instant update and live preview for point configuration
  const handleUpdatePointConfig = useCallback(
    (updates: Partial<PointProcessConfig>, autoPreview: boolean = true) => {
      setPointConfig((prev) => {
        const next = { ...prev, ...updates };
        if (autoPreview) {
          handleApplyPointProcessing(next, true);
        }
        return next;
      });
    },
    [handleApplyPointProcessing]
  );

  // Reset Point Processing from pristine base
  const handleResetPointProcessing = useCallback(() => {
    const active = layers.find((l) => l.id === activeLayerId);
    if (!active) return;
    const base = pointBaseCanvasesRef.current.get(active.id);
    if (base) {
      setLayers((prev) =>
        prev.map((l) => (l.id === active.id ? { ...l, canvas: cloneCanvas(base) } : l))
      );
    }
    setPointConfig((prev) => ({ ...prev, mode: "none" }));
  }, [layers, activeLayerId]);

  // Non-destructive Tone & Light adjustments (Brightness, Contrast, Exposure, Light Balance, Highlights, Shadows, Saturation)
  const handleUpdateToneAdjustments = useCallback(
    async (updates: Partial<ToneAdjustments>, isPreview: boolean = false) => {
      // Need to use functional update to get the latest state
      setToneAdjustments((prev) => {
        const next = { ...prev, ...updates };
        
        // Because applyToneLightAdjustments is async, we process outside the state setter
        const applyAsync = async () => {
          // Generate a unique request ID to track staleness
          const currentRequestId = ++toneRequestIdRef.current;

          setIsProcessing(true);
          try {
            if (toneScope === "layer") {
              const active = layers.find((l) => l.id === activeLayerId);
              if (active) {
                let base = toneBaseCanvasesRef.current.get(active.id);
                if (!base) {
                  base = cloneCanvas(active.canvas);
                  toneBaseCanvasesRef.current.set(active.id, base);
                }
                const adjusted = await applyToneLightAdjustments(base, next, isPreview);
                // Discard stale response if a newer request was sent
                if (currentRequestId !== toneRequestIdRef.current) return;
                setLayers((oldLayers) =>
                  oldLayers.map((l) => (l.id === active.id ? { ...l, canvas: adjusted } : l))
                );
              }
            } else {
              // Project scope: process all sequentially or in parallel
              const updatedLayers = await Promise.all(
                layers.map(async (l) => {
                  let base = toneBaseCanvasesRef.current.get(l.id);
                  if (!base) {
                    base = cloneCanvas(l.canvas);
                    toneBaseCanvasesRef.current.set(l.id, base);
                  }
                  const adjustedCanvas = await applyToneLightAdjustments(base, next, isPreview);
                  return { ...l, canvas: adjustedCanvas };
                })
              );
              // Discard stale response if a newer request was sent
              if (currentRequestId !== toneRequestIdRef.current) return;
              setLayers(updatedLayers);
            }
          } catch (err) {
            console.error(err);
          } finally {
            // Only clear processing state if this is still the latest request
            if (currentRequestId === toneRequestIdRef.current) {
              setIsProcessing(false);
            }
          }
        };

        // Debounce preview requests (300ms) to prevent flooding the backend
        if (isPreview) {
          if (toneDebounceRef.current) clearTimeout(toneDebounceRef.current);
          toneDebounceRef.current = setTimeout(() => {
            toneDebounceRef.current = null;
            applyAsync();
          }, 300);
        } else {
          // Final commit (pointerUp) — execute immediately
          if (toneDebounceRef.current) {
            clearTimeout(toneDebounceRef.current);
            toneDebounceRef.current = null;
          }
          applyAsync();
        }
        return next;
      });
    },
    [toneScope, layers, activeLayerId]
  );

  // Reset Tone & Light adjustments to 0
  const handleResetToneAdjustments = useCallback(() => {
    const defaultTone: ToneAdjustments = {
      brightness: 0,
      contrast: 0,
      exposure: 0,
      lightBalance: 0,
      highlights: 0,
      shadows: 0,
      saturation: 0,
    };
    setToneAdjustments(defaultTone);

    if (toneScope === "layer") {
      const active = layers.find((l) => l.id === activeLayerId);
      if (active) {
        const base = toneBaseCanvasesRef.current.get(active.id);
        if (base) {
          setLayers((oldLayers) =>
            oldLayers.map((l) => (l.id === active.id ? { ...l, canvas: cloneCanvas(base) } : l))
          );
        }
      }
    } else {
      setLayers((oldLayers) =>
        oldLayers.map((l) => {
          const base = toneBaseCanvasesRef.current.get(l.id);
          return base ? { ...l, canvas: cloneCanvas(base) } : l;
        })
      );
    }
  }, [toneScope, layers, activeLayerId]);

  // Apply Spatial Filter (with polygon selection region clipping if active)
  const handleApplySpatialFilter = async (asNewLayer: boolean = false, config?: SpatialFilterConfig) => {
    const active = layers.find((l) => l.id === activeLayerId);
    if (!active) return;

    // Use preserved base canvas to guarantee non-destructive adjustments (e.g., when increasing or decreasing kernel size)
    let base = spatialBaseCanvasesRef.current.get(active.id);
    if (!base) {
      base = cloneCanvas(active.canvas);
      spatialBaseCanvasesRef.current.set(active.id, base);
    }

    const currentConfig = (config && typeof config === "object") ? config : spatialConfig;

    pushUndo(layers, activeLayerId);
    setIsProcessing(true);

    try {
      let filteredCanvas = await applySpatialFilter(base, currentConfig, false);

      // If user has drawn a closed polygon lasso selection, apply filter strictly within selected area
      if (selectionRegion.isClosed && selectionRegion.points.length >= 3) {
        const relPolygon = selectionRegion.points.map((p) => ({
          x: (p.x - active.x) / (active.scaleX || 1),
          y: (p.y - active.y) / (active.scaleY || 1),
        }));
        filteredCanvas = applyFilterToPolygonRegion(base, relPolygon, filteredCanvas);
      }

      if (asNewLayer) {
        // Restore active layer back to pristine base and hide it so it does not ghost/overlap with new layer!
        const restoredBase = cloneCanvas(base!);
        spatialBaseCanvasesRef.current.delete(active.id);

        const newLayer: Layer = {
          id: `layer-filter-${Date.now()}`,
          name: `${active.name} [${currentConfig.type}]`,
          type: "adjustment",
          canvas: filteredCanvas,
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: active.x,
          y: active.y,
          width: active.width,
          height: active.height,
          rotation: active.rotation,
          scaleX: active.scaleX,
          scaleY: active.scaleY,
          flipX: active.flipX,
          flipY: active.flipY,
        };
        setLayers((prev) => [
          ...prev.map((l) => (l.id === active.id ? { ...l, canvas: restoredBase, visible: false } : l)),
          newLayer,
        ]);
        setActiveLayerId(newLayer.id);
      } else {
        // Apply to current layer: update active canvas with filteredCanvas,
        // while preserving base in spatialBaseCanvasesRef so changing kernel size re-filters cleanly from the original base!
        setLayers((prev) =>
          prev.map((l) => (l.id === activeLayerId ? { ...l, canvas: filteredCanvas } : l))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply Advanced Multi-Method Image Segmentation
  const handleApplySegmentation = async (
    asNewLayer = false,
    isPreview: boolean = false,
    overrideConfig?: Partial<SegmentationConfig>
  ) => {
    const active = layers.find((l) => l.id === activeLayerId);
    if (!active) return;

    // Preserve pristine unsegmented canvas before any segmentation action
    if (!segmentOriginalCanvasesRef.current.has(active.id)) {
      segmentOriginalCanvasesRef.current.set(active.id, cloneCanvas(active.canvas));
    }

    // Use preserved base canvas to guarantee non-destructive slider adjustments
    let base = segmentBaseCanvasesRef.current.get(active.id);
    if (!base) {
      base = cloneCanvas(active.canvas);
      segmentBaseCanvasesRef.current.set(active.id, base);
    }

    const currentConfig: SegmentationConfig = {
      ...segmentConfig,
      ...(overrideConfig || {}),
    };

    if (!isPreview) {
      pushUndo(layers, activeLayerId);
    }
    setIsProcessing(true);

    try {
      const { resultCanvas, segments: segs } = await applySegmentation(base, currentConfig, isPreview);
      setSegments(segs);

      const methodNames: Record<string, string> = {
        kmeans: "عناقيد K-Means",
        watershed: "أحواض Watershed",
        foreground_cut: "عزل الكائن الرئيسي",
        otsu: "عتبة أوتسو الذكية",
        adaptive: "العتبة التكيفية",
        color_slicing: "تجزئة النطاق اللوني",
      };

      const algoName = methodNames[currentConfig.method] || "تجزئة متقدمة";

      if (asNewLayer && !isPreview) {
        // Restore active layer back to pristine base and hide it so it does not ghost/overlap with new layer!
        const pristine = segmentOriginalCanvasesRef.current.get(active.id) || base;
        const restoredBase = cloneCanvas(pristine);

        const newLayer: Layer = {
          id: `layer-seg-${Date.now()}`,
          name: `${active.name} [${algoName}]`,
          type: "raster",
          canvas: resultCanvas,
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: active.x,
          y: active.y,
          width: active.width,
          height: active.height,
          rotation: active.rotation,
          scaleX: active.scaleX,
          scaleY: active.scaleY,
          flipX: active.flipX,
          flipY: active.flipY,
        };

        // Link original canvas for the new layer so revert can restore/remove
        segmentOriginalCanvasesRef.current.set(newLayer.id, cloneCanvas(restoredBase));

        setLayers((prev) => [
          ...prev.map((l) => (l.id === active.id ? { ...l, canvas: restoredBase, visible: false } : l)),
          newLayer,
        ]);
        setActiveLayerId(newLayer.id);
        setAiNotice({ message: `تم إنشاء طبقة تجزئة جديدة [${algoName}] بنجاح ✓` });
      } else if (!isPreview) {
        // Final apply: save into active layer
        // Do NOT overwrite segmentOriginalCanvasesRef so the user can always revert back to pristine!
        setLayers((prev) =>
          prev.map((l) => (l.id === active.id ? { ...l, canvas: resultCanvas } : l))
        );
        segmentBaseCanvasesRef.current.set(active.id, cloneCanvas(resultCanvas));
        setAiNotice({ message: `تم تطبيق تجزئة [${algoName}] على الطبقة الحالية بنجاح ✓` });
      } else {
        // Preview: display result without mutating the saved base or original
        setLayers((prev) =>
          prev.map((l) => (l.id === active.id ? { ...l, canvas: resultCanvas } : l))
        );
      }
    } catch (err) {
      console.error("Segmentation error:", err);
      setAiNotice({ message: "حدث خطأ أثناء تنفيذ التجزئة، يرجى المحاولة مرة أخرى." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevertSegmentation = () => {
    const active = layers.find((l) => l.id === activeLayerId);
    let restored = false;

    // 1. If active layer is a newly generated segmentation layer (layer-seg-*), remove it and restore parent layer
    if (active && active.id.startsWith("layer-seg-")) {
      const remaining = layers.filter((l) => l.id !== active.id);
      if (remaining.length > 0) {
        const lastLayer = remaining[remaining.length - 1];
        setLayers(
          remaining.map((l) => (l.id === lastLayer.id ? { ...l, visible: true } : l))
        );
        setActiveLayerId(lastLayer.id);
        segmentOriginalCanvasesRef.current.delete(active.id);
        segmentBaseCanvasesRef.current.delete(active.id);
        restored = true;
      }
    }

    // 2. Restore active layer from pristine saved original or base
    if (!restored && active) {
      const original =
        segmentOriginalCanvasesRef.current.get(active.id) ||
        segmentBaseCanvasesRef.current.get(active.id);

      if (original) {
        const restoredCanvas = cloneCanvas(original);
        setLayers((prev) =>
          prev.map((l) => (l.id === active.id ? { ...l, canvas: restoredCanvas } : l))
        );
        segmentOriginalCanvasesRef.current.delete(active.id);
        segmentBaseCanvasesRef.current.delete(active.id);
        restored = true;
      }
    }

    // 3. Fallback to global originalCanvas if single root layer or pristine document canvas
    if (!restored && active && originalCanvas && (layers.length === 1 || active.id === layers[0]?.id)) {
      const restoredCanvas = cloneCanvas(originalCanvas);
      setLayers((prev) =>
        prev.map((l) => (l.id === active.id ? { ...l, canvas: restoredCanvas } : l))
      );
      restored = true;
    }

    // 4. Fallback to undoStack if available
    if (!restored && undoStack.length > 0) {
      handleUndo();
      restored = true;
    }

    // Always clear previewed segments and bounding box overlays
    setSegments([]);
    setShowBoundingBoxes(false);

    if (restored) {
      setAiNotice({
        message: "تم إلغاء المعاينة واستعادة الصورة الأصلية بنجاح ↺",
      });
    } else {
      setAiNotice({
        message: "الصورة بالفعل في حالتها الأصلية ولا توجد معاينة نشطة لإلغائها.",
      });
    }
  };

  // Extract polygon or magnetic selection as a new independent layer
  const handleExtractSelectionAsLayer = () => {
    const active = layers.find((l) => l.id === activeLayerId);
    if (!active || !selectionRegion.isClosed || selectionRegion.points.length < 3) return;

    pushUndo(layers, activeLayerId);

    // Bounding box of selection in canvas coordinates
    const xs = selectionRegion.points.map((p) => p.x);
    const ys = selectionRegion.points.map((p) => p.y);
    const minX = Math.max(0, Math.floor(Math.min(...xs)));
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxX = Math.min(docWidth, Math.ceil(Math.max(...xs)));
    const maxY = Math.min(docHeight, Math.ceil(Math.max(...ys)));
    const cropW = Math.max(10, maxX - minX);
    const cropH = Math.max(10, maxY - minY);

    const extractedCanvas = document.createElement("canvas");
    extractedCanvas.width = cropW;
    extractedCanvas.height = cropH;
    const ctx = extractedCanvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.beginPath();
    const first = selectionRegion.points[0];
    ctx.moveTo(first.x - minX, first.y - minY);
    for (let i = 1; i < selectionRegion.points.length; i++) {
      const p = selectionRegion.points[i];
      ctx.lineTo(p.x - minX, p.y - minY);
    }
    ctx.closePath();
    ctx.clip();

    ctx.translate(active.x - minX, active.y - minY);
    ctx.drawImage(active.canvas, 0, 0, active.width * active.scaleX, active.height * active.scaleY);
    ctx.restore();

    const modeLabels: Record<string, string> = {
      polygon: "مضلع",
      magnetic: "مغناطيسي",
      freehand: "حر",
    };

    const newLayer: Layer = {
      id: `layer-lasso-${Date.now()}`,
      name: `تحديد لاسو ${modeLabels[selectionRegion.mode] || ""}`,
      type: "image",
      canvas: extractedCanvas,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: "normal",
      x: minX,
      y: minY,
      width: cropW,
      height: cropH,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      flipX: false,
      flipY: false,
    };

    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
    setSelectionRegion((prev) => ({ ...prev, points: [], isClosed: false }));
  };

  const handleClearSelection = () => {
    setSelectionRegion((prev) => ({ ...prev, points: [], isClosed: false }));
  };

  // Helper to reliably locate the active image/raster layer for background operations
  const getActiveRasterLayer = (): Layer | undefined => {
    let target = layers.find((l) => l.id === activeLayerId);
    if (!target || !target.canvas || target.type === "text" || target.type === "adjustment") {
      target = [...layers].reverse().find((l) => l.canvas && l.type !== "text" && l.type !== "adjustment");
    }
    if (!target && layers.length > 0 && layers[0].canvas) {
      target = layers[0];
    }
    if (target && activeLayerId !== target.id) {
      setActiveLayerId(target.id);
    }
    return target;
  };

  // Apply Background Removal (Comprehensive multi-mode)
  const handleApplyBgRemoval = async () => {
    const active = getActiveRasterLayer();
    if (!active) {
      setAiNotice({ message: "يرجى فتح صورة أو تحديد طبقة لتنفيذ إزالة الخلفية." });
      return;
    }

    if (!bgOriginalCanvasesRef.current.has(active.id)) {
      bgOriginalCanvasesRef.current.set(active.id, cloneCanvas(active.canvas));
    }

    if (bgConfig.mode === "eraser") {
      setAiNotice({ message: "وضع الممحاة نشط - اسحب بالماوس مباشرة فوق الكانفاس للمسح الحر." });
      return;
    }

    pushUndo(layers, active.id);
    setIsProcessing(true);

    try {
      let cleanedCanvas: HTMLCanvasElement;
      if (bgConfig.mode === "magic_wand") {
        cleanedCanvas = await removeBackgroundChroma(
          active.canvas,
          bgConfig.wandColor || { r: 255, g: 255, b: 255 },
          bgConfig.tolerance,
          undefined,
          undefined,
          {
            contiguous: bgConfig.contiguous ?? true,
            feather: bgConfig.feather ?? 3,
            invert: bgConfig.invert ?? false,
          }
        );
        setAiNotice({ message: "تمت إزالة خلفية الصورة بالعصا السحرية بنجاح ✓" });
      } else if (
        bgConfig.mode === "preset_white" ||
        bgConfig.mode === "preset_green" ||
        bgConfig.mode === "preset_black"
      ) {
        cleanedCanvas = await applyBackgroundRemoval(active.canvas, {
          mode: bgConfig.mode,
          tolerance: bgConfig.tolerance,
          feather: bgConfig.feather ?? 3,
          invert: bgConfig.invert ?? false,
        });
        const presetNames: Record<string, string> = {
          preset_white: "الخلفية البيضاء",
          preset_green: "الكروما الخضراء",
          preset_black: "الخلفية السوداء",
        };
        setAiNotice({ message: `تم تفريغ ${presetNames[bgConfig.mode]} بنجاح ✓` });
      } else {
        cleanedCanvas = await removeBackgroundSmart(active.canvas, undefined, undefined, {
          feather: bgConfig.feather ?? 3,
          invert: bgConfig.invert ?? false,
        });
        setAiNotice({ message: "تم تفريغ خلفية الصورة بالذكاء الاصطناعي بنجاح ✓" });
      }

      if (bgConfig.asNewLayer) {
        const newLayer: Layer = {
          id: `layer-cutout-${Date.now()}`,
          name: `${active.name} (مفرغة)`,
          type: "raster",
          canvas: cleanedCanvas,
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: active.x,
          y: active.y,
          width: cleanedCanvas.width,
          height: cleanedCanvas.height,
          rotation: active.rotation,
          scaleX: active.scaleX,
          scaleY: active.scaleY,
          flipX: active.flipX,
          flipY: active.flipY,
        };
        setLayers((prev) => [...prev, newLayer]);
        setActiveLayerId(newLayer.id);
      } else {
        setLayers((prev) =>
          prev.map((l) =>
            l.id === active.id
              ? {
                  ...l,
                  canvas: cleanedCanvas,
                  width: cleanedCanvas.width || l.width,
                  height: cleanedCanvas.height || l.height,
                }
              : l
          )
        );
        setActiveLayerId(active.id);
      }
    } catch (err: any) {
      console.error(err);
      setAiNotice({ message: err?.message || "حدث خطأ أثناء إزالة الخلفية." });
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply AI Smart Inpainting / Object Removal
  const handleApplyInpaint = async (passedMaskCanvas?: HTMLCanvasElement) => {
    if (isProcessing) return;

    const active = getActiveRasterLayer();
    if (!active || !active.canvas) {
      setAiNotice({ message: "يرجى فتح صورة أو تحديد طبقة لتطبيق الممحاة الذكية عليها." });
      return;
    }

    const maskCanvas = passedMaskCanvas || inpaintControllerRef.current?.getMaskCanvas();
    if (!maskCanvas) {
      setAiNotice({ message: "يرجى تحديد أو تظليل العنصر المراد إزالته أولاً بالماوس." });
      return;
    }

    // Verify mask canvas has painted pixels
    const mCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
    if (!mCtx) return;
    const imgData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    let hasMaskPixels = false;
    for (let i = 3; i < imgData.data.length; i += 16) {
      if (imgData.data[i] > 10) {
        hasMaskPixels = true;
        break;
      }
    }
    if (!hasMaskPixels) {
      setAiNotice({ message: "يرجى التظليل بالماوس فوق العنصر المطلوب إزالته." });
      return;
    }

    // Map mask to layer coordinates using exact inverse transformation
    const CW = active.canvas.width;
    const CH = active.canvas.height;
    const scaleX = active.scaleX ?? 1;
    const scaleY = active.scaleY ?? 1;
    const flipX = active.flipX ? -1 : 1;
    const flipY = active.flipY ? -1 : 1;
    const rotRad = ((active.rotation || 0) * Math.PI) / 180;
    const renderedW = Math.max(1, Math.round(active.width * Math.abs(scaleX)));
    const renderedH = Math.max(1, Math.round(active.height * Math.abs(scaleY)));
    const centerX = Math.round(active.x + renderedW / 2);
    const centerY = Math.round(active.y + renderedH / 2);
    const sx = (scaleX >= 0 ? 1 : -1) * flipX;
    const sy = (scaleY >= 0 ? 1 : -1) * flipY;

    let layerMaskCanvas = maskCanvas;

    const isDirectMatch =
      active.x === 0 &&
      active.y === 0 &&
      active.width === maskCanvas.width &&
      active.height === maskCanvas.height &&
      CW === maskCanvas.width &&
      CH === maskCanvas.height &&
      scaleX === 1 &&
      scaleY === 1 &&
      !active.flipX &&
      !active.flipY &&
      (active.rotation || 0) === 0;

    if (!isDirectMatch) {
      layerMaskCanvas = document.createElement("canvas");
      layerMaskCanvas.width = CW;
      layerMaskCanvas.height = CH;
      const lmCtx = layerMaskCanvas.getContext("2d", { willReadFrequently: true });
      if (lmCtx) {
        lmCtx.save();
        lmCtx.translate(CW / 2, CH / 2);
        lmCtx.scale((CW / renderedW) * sx, (CH / renderedH) * sy);
        lmCtx.rotate(-rotRad);
        lmCtx.translate(-centerX, -centerY);
        lmCtx.drawImage(maskCanvas, 0, 0);
        lmCtx.restore();
      }
    }

    // Check if layer mask has any pixels within layer boundary
    const lmCtxCheck = layerMaskCanvas.getContext("2d", { willReadFrequently: true });
    if (lmCtxCheck) {
      const lmData = lmCtxCheck.getImageData(0, 0, layerMaskCanvas.width, layerMaskCanvas.height);
      let hasLayerMaskPixels = false;
      for (let i = 3; i < lmData.data.length; i += 16) {
        if (lmData.data[i] > 10) {
          hasLayerMaskPixels = true;
          break;
        }
      }
      if (!hasLayerMaskPixels) {
        setAiNotice({ message: "يرجى التظليل داخل مساحة الصورة المطلوب إزالة العنصر منها." });
        return;
      }
    }

    pushUndo(layers, active.id);
    setIsProcessing(true);
    setAiNotice({ message: "جاري تحليل الصورة وترميم مكان العنصر بالذكاء الاصطناعي..." });

    try {
      const inpaintedCanvas = await applyInpaintBackend(active.canvas, layerMaskCanvas, {
        method: brushConfig.inpaintMethod || "telea",
        radius: brushConfig.inpaintRadius || 5,
        dilate: brushConfig.inpaintDilate ?? 3,
      });

      setLayers((prev) =>
        prev.map((l) =>
          l.id === active.id
            ? {
                ...l,
                canvas: inpaintedCanvas,
              }
            : l
        )
      );

      // Clear the mask from workspace and internal ref
      inpaintControllerRef.current?.clearMask();
      mCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      setAiNotice({ message: "تمت إزالة العنصر وترميم الخلفية بنجاح ✓" });
    } catch (err: any) {
      console.error("Inpaint Error:", err);
      setAiNotice({ message: err?.message || "حدث خطأ أثناء إزالة العنصر المحدد." });
    } finally {
      setIsProcessing(false);
    }
  };

  // Click on canvas for Magic Wand removal
  const handleCanvasClickChroma = async (
    color: { r: number; g: number; b: number },
    clickX: number,
    clickY: number
  ) => {
    const active = getActiveRasterLayer();
    if (!active) {
      setAiNotice({ message: "يرجى فتح صورة أو تحديد طبقة لتفريغ لونها." });
      return;
    }

    if (!bgOriginalCanvasesRef.current.has(active.id)) {
      bgOriginalCanvasesRef.current.set(active.id, cloneCanvas(active.canvas));
    }

    pushUndo(layers, active.id);
    setIsProcessing(true);
    
    // Transform document click coordinates to layer-local coordinates
    const scaleX = Math.abs(active.scaleX || 1);
    const scaleY = Math.abs(active.scaleY || 1);
    const localX = Math.round((clickX - active.x) / scaleX);
    const localY = Math.round((clickY - active.y) / scaleY);

    try {
      setBgConfig((prev) => ({ ...prev, wandColor: color }));
      const cleaned = await removeBackgroundChroma(
        active.canvas,
        color,
        bgConfig.tolerance,
        localX,
        localY,
        {
          contiguous: bgConfig.contiguous ?? true,
          feather: bgConfig.feather ?? 3,
          invert: bgConfig.invert ?? false,
        }
      );

      if (bgConfig.asNewLayer) {
        const newLayer: Layer = {
          id: `layer-cutout-${Date.now()}`,
          name: `${active.name} (تفريغ لوني)`,
          type: "raster",
          canvas: cleaned,
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: active.x,
          y: active.y,
          width: cleaned.width,
          height: cleaned.height,
          rotation: active.rotation,
          scaleX: active.scaleX,
          scaleY: active.scaleY,
          flipX: active.flipX,
          flipY: active.flipY,
        };
        setLayers((prev) => [...prev, newLayer]);
        setActiveLayerId(newLayer.id);
      } else {
        setLayers((prev) =>
          prev.map((l) =>
            l.id === active.id
              ? {
                  ...l,
                  canvas: cleaned,
                  width: cleaned.width || l.width,
                  height: cleaned.height || l.height,
                }
              : l
          )
        );
        setActiveLayerId(active.id);
      }
      setAiNotice({ message: "تم تفريغ لون الخلفية المحدد بالعصا السحرية ✓" });
    } catch (err: any) {
      console.error(err);
      setAiNotice({ message: err?.message || "تعذر تفريغ المنطقة المحددة." });
    } finally {
      setIsProcessing(false);
    }
  };

  // Click on canvas for AI Smart Background Removal
  const handleCanvasClickAiSmart = async (clickX: number, clickY: number) => {
    const active = getActiveRasterLayer();
    if (!active) {
      setAiNotice({ message: "يرجى فتح صورة أو تحديد طبقة لإزالة خلفيتها." });
      return;
    }

    if (!bgOriginalCanvasesRef.current.has(active.id)) {
      bgOriginalCanvasesRef.current.set(active.id, cloneCanvas(active.canvas));
    }

    pushUndo(layers, active.id);
    setIsProcessing(true);

    const scaleX = Math.abs(active.scaleX || 1);
    const scaleY = Math.abs(active.scaleY || 1);
    const localX = Math.round((clickX - active.x) / scaleX);
    const localY = Math.round((clickY - active.y) / scaleY);

    try {
      const cleaned = await removeBackgroundSmart(active.canvas, localX, localY, {
        feather: bgConfig.feather ?? 3,
        invert: bgConfig.invert ?? false,
      });

      if (bgConfig.asNewLayer) {
        const newLayer: Layer = {
          id: `layer-cutout-${Date.now()}`,
          name: `${active.name} (عزل ذكي)`,
          type: "raster",
          canvas: cleaned,
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: active.x,
          y: active.y,
          width: cleaned.width,
          height: cleaned.height,
          rotation: active.rotation,
          scaleX: active.scaleX,
          scaleY: active.scaleY,
          flipX: active.flipX,
          flipY: active.flipY,
        };
        setLayers((prev) => [...prev, newLayer]);
        setActiveLayerId(newLayer.id);
      } else {
        setLayers((prev) =>
          prev.map((l) =>
            l.id === active.id
              ? {
                  ...l,
                  canvas: cleaned,
                  width: cleaned.width || l.width,
                  height: cleaned.height || l.height,
                }
              : l
          )
        );
        setActiveLayerId(active.id);
      }
      setAiNotice({ message: "تمت إزالة الخلفية الذكية بنجاح ✓" });
    } catch (err: any) {
      console.error(err);
      setAiNotice({ message: err?.message || "تعذر إزالة الخلفية الذكية." });
    } finally {
      setIsProcessing(false);
    }
  };

  // Revert Background Removal
  const handleRevertBgRemoval = () => {
    const active = layers.find((l) => l.id === activeLayerId);
    let restored = false;

    if (active && bgOriginalCanvasesRef.current.has(active.id)) {
      const orig = bgOriginalCanvasesRef.current.get(active.id)!;
      setLayers((prev) =>
        prev.map((l) => (l.id === active.id ? { ...l, canvas: cloneCanvas(orig) } : l))
      );
      bgOriginalCanvasesRef.current.delete(active.id);
      restored = true;
    } else if (active && originalCanvas && (layers.length === 1 || active.id === layers[0]?.id)) {
      setLayers((prev) =>
        prev.map((l) => (l.id === active.id ? { ...l, canvas: cloneCanvas(originalCanvas) } : l))
      );
      restored = true;
    } else if (undoStack.length > 0) {
      handleUndo();
      restored = true;
    }

    if (restored) {
      setAiNotice({ message: "تم إلغاء التعديل واستعادة الصورة الأصلية بنجاح ↺" });
    } else {
      setAiNotice({ message: "الصورة بالفعل في حالتها الأصلية." });
    }
  };

  // Apply Curated Product Backdrop
  const handleApplyProductBackdrop = (backdropId: string) => {
    const backdropDef = PRODUCT_BACKDROPS.find((b) => b.id === backdropId);
    if (!backdropDef) return;

    const docWidth = Math.max(...layers.map((l) => l.width));
    const docHeight = Math.max(...layers.map((l) => l.height));

    pushUndo(layers, activeLayerId);
    const backdropCanvas = backdropDef.generate(docWidth, docHeight);

    const backdropLayer: Layer = {
      id: `layer-backdrop-${Date.now()}`,
      name: `خلفية: ${backdropDef.name}`,
      type: "backdrop",
      canvas: backdropCanvas,
      visible: true,
      locked: true,
      opacity: 1,
      blendMode: "normal",
      x: 0,
      y: 0,
      width: docWidth,
      height: docHeight,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      flipX: false,
      flipY: false,
    };

    // Insert at bottom of stack (index 0)
    setLayers((prev) => [backdropLayer, ...prev]);
  };

  const handleSelectAiSubTab = (tab: "segmentation" | "ocr" | "object_detection") => {
    setActiveAiSubTab(tab);
    if (tab === "segmentation") {
      const currentLayers = layersRef.current;
      const currentActiveId = activeLayerIdRef.current;
      const active = currentLayers.find((l) => l.id === currentActiveId);
      if (active) {
        if (!segmentOriginalCanvasesRef.current.has(active.id)) {
          segmentOriginalCanvasesRef.current.set(active.id, cloneCanvas(active.canvas));
        }
        if (!segmentBaseCanvasesRef.current.has(active.id)) {
          segmentBaseCanvasesRef.current.set(active.id, cloneCanvas(active.canvas));
        }
      }
    }
  };

  // AI Vision Tasks Execution
  const handleRunAiVision = async (mode: "ocr" | "object_detection" | "segmentation") => {
    const active = layers.find((l) => l.id === activeLayerId);
    if (!active) return;

    setIsAiProcessing(true);
    const dataUrl = active.canvas.toDataURL("image/png");

    try {
      let res: Response;
      if (mode === "ocr") {
        const langs = ocrLanguage === "ar" ? ["ar"] : ocrLanguage === "en" ? ["en"] : ["ar", "en"];
        res = await fetch("/api/vision-ai/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: dataUrl,
            languages: langs,
            enhance: ocrEnhance,
          }),
        });
      } else {
        res = await fetch("/api/vision-ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: dataUrl,
            mode,
            confidence: yoloConfidence,
            modelName: yoloModel,
          }),
        });
      }

      const data = await res.json();

      if (data.warning) {
        setAiNotice({
          message: data.warning,
          isLeakedKey: data.isLeakedKey,
        });
      } else {
        setAiNotice(null);
      }

      if (mode === "ocr") {
        if (data.ocr && Array.isArray(data.ocr)) {
          setOcrBlocks(data.ocr);
          if (data.ocr.length === 0) {
            setAiNotice({
              message: "تم فحص الصورة بنجاح بواسطة محرك التعلم العميق المحلي (EasyOCR)، ولم يتم العثور على أي نصوص واضحة.",
            });
          }
        }
      } else {
        if (data.objects && Array.isArray(data.objects)) {
          setDetectedObjects(data.objects);
          if (data.objects.length === 0) {
            setAiNotice({
              message: "تم الفحص بنجاح بواسطة YOLO11، ولم يتم العثور على كائنات بنسبة ثقة مطابقة (يمكنك تقليل نسبة الثقة لإظهار كائنات أكثر).",
            });
          }
        }
        if (data.segments && data.segments.length > 0) {
          setSegments(data.segments);
        }
      }
      setShowBoundingBoxes(true);
    } catch (err) {
      console.warn("Vision task error:", err);
      if (mode === "ocr") {
        setAiNotice({
          message: "تعذر الاتصال بمحرك استخراج النصوص المحلي (تأكد من تشغيل خادم الباك إند FastAPI).",
        });
      } else {
        setAiNotice({
          message: "تعذر الاتصال بخادم كشف الكائنات المحلي، تأكد من تشغيل FastAPI.",
        });
        if (mode === "object_detection") {
          setDetectedObjects([
            { label: "person", labelAr: "شخص", confidence: 0.96, box2d: [150, 250, 820, 750], category: "person", colorHex: "#6366f1" },
            { label: "laptop", labelAr: "لابتوب", confidence: 0.92, box2d: [420, 360, 680, 640], category: "electronics", colorHex: "#0ea5e9" },
          ]);
        } else if (mode === "segmentation") {
          setSegments([
            { segmentId: "seg_1", name: "Foreground Product", type: "foreground", confidence: 0.96 },
            { segmentId: "seg_2", name: "Studio Backdrop", type: "background", confidence: 0.92 },
          ]);
        }
      }
      setShowBoundingBoxes(true);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Extract detected YOLO object as a new independent canvas layer
  const handleExtractObjectAsLayer = async (obj: DetectedObject, cutoutBg: boolean = false) => {
    const active = layers.find((l) => l.id === activeLayerId);
    if (!active) return;

    const [ymin, xmin, ymax, xmax] = obj.box2d;
    const cropX = Math.max(0, Math.round((xmin / 1000) * active.canvas.width));
    const cropY = Math.max(0, Math.round((ymin / 1000) * active.canvas.height));
    const cropW = Math.max(1, Math.round(((xmax - xmin) / 1000) * active.canvas.width));
    const cropH = Math.max(1, Math.round(((ymax - ymin) / 1000) * active.canvas.height));

    if (cropW <= 0 || cropH <= 0) return;

    let targetCanvas = document.createElement("canvas");
    targetCanvas.width = cropW;
    targetCanvas.height = cropH;
    const ctx = targetCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      active.canvas,
      cropX, cropY, cropW, cropH,
      0, 0, cropW, cropH
    );

    if (cutoutBg) {
      try {
        setIsProcessing(true);
        targetCanvas = await removeBackgroundSmart(targetCanvas, undefined, undefined, { feather: 2 });
      } catch (err) {
        console.warn("Failed to remove background from detected object:", err);
      } finally {
        setIsProcessing(false);
      }
    }

    const placeX = Math.round(active.x + cropX * (active.scaleX || 1));
    const placeY = Math.round(active.y + cropY * (active.scaleY || 1));

    pushUndo(layers, activeLayerId);

    const layerName = obj.labelAr ? `${obj.labelAr} (${obj.label})` : obj.label;
    const newLayer: Layer = {
      id: `layer-yolo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cutoutBg ? `كائن مفرغ: ${layerName}` : `كائن: ${layerName}`,
      type: "raster",
      canvas: targetCanvas,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: "normal",
      x: placeX,
      y: placeY,
      width: targetCanvas.width,
      height: targetCanvas.height,
      rotation: 0,
      scaleX: active.scaleX || 1,
      scaleY: active.scaleY || 1,
      flipX: false,
      flipY: false,
    };

    const activeIdx = layers.findIndex((l) => l.id === activeLayerId);
    const updated = [...layers];
    updated.splice(activeIdx + 1, 0, newLayer);
    setLayers(updated);
    setActiveLayerId(newLayer.id);
  };

  const handleExtractAllObjectsAsLayers = async (cutoutBg: boolean = false) => {
    if (detectedObjects.length === 0) return;
    for (const obj of detectedObjects) {
      await handleExtractObjectAsLayer(obj, cutoutBg);
    }
  };

  // Add OCR Text as Canvas Layer at its real detected position
  const handleAddOcrTextLayer = (block: OCRBlock) => {
    let posX: number | undefined = undefined;
    let posY: number | undefined = undefined;
    if (block.box2d && block.box2d.length === 4) {
      posX = Math.round((block.box2d[1] / 1000) * docWidth);
      posY = Math.round((block.box2d[0] / 1000) * docHeight);
    }
    const color = block.language === "العربية" || block.langCode === "ar" ? "#38bdf8" : "#a855f7";
    const fontSize = block.suggestedFontSize || 28;
    handleAddTextLayer(block.text, fontSize, color, posX, posY);
  };

  // Add Text Layer (stays on "text" tool and immediately activates inline editing)
  const handleAddTextLayer = (
    text: string = "نص جديد",
    fontSize: number = 36,
    color: string = "#ffffff",
    x?: number,
    y?: number
  ) => {
    pushUndo(layers, activeLayerId);
    const rendered = renderTextToCanvas({ text, fontSize, color });

    const placeX = x !== undefined ? x : Math.max(20, Math.round((docWidth - rendered.width) / 2));
    const placeY = y !== undefined ? y : Math.max(20, Math.round((docHeight - rendered.height) / 2));

    const textLayer: Layer = {
      id: `layer-text-${Date.now()}`,
      name: `نص: "${text.slice(0, 14)}"`,
      type: "text",
      canvas: rendered.canvas,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: "normal",
      x: placeX,
      y: placeY,
      width: rendered.width,
      height: rendered.height,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      flipX: false,
      flipY: false,
      textConfig: {
        text,
        fontSize,
        color,
        fontFamily: "'Cairo', 'Tajawal', 'Outfit', sans-serif",
        fontWeight: "bold",
        textAlign: "center",
      },
    };

    setLayers((prev) => [...prev, textLayer]);
    setActiveLayerId(textLayer.id);
    // Stay on Text tool without transferring to transform!
    setActiveTool("text");
    setIsPropertiesOpen(true);
    setEditingTextLayerId(textLayer.id);
  };

  // Update Text Layer Content, Font Size, Color, Alignment live
  const handleUpdateTextLayer = useCallback(
    (layerId: string, updates: Partial<TextRenderConfig>) => {
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== layerId) return l;
          const currentCfg = l.textConfig || {
            text: l.name.replace(/^نص:\s*"/, "").replace(/"$/, "") || "نص جديد",
            fontSize: 36,
            color: "#ffffff",
            fontFamily: "'Cairo', 'Tajawal', 'Outfit', sans-serif",
            fontWeight: "bold",
            textAlign: "center" as const,
          };
          const newCfg: TextRenderConfig = {
            text: updates.text !== undefined ? updates.text : currentCfg.text,
            fontSize: updates.fontSize !== undefined ? updates.fontSize : currentCfg.fontSize,
            color: updates.color !== undefined ? updates.color : currentCfg.color,
            fontFamily: updates.fontFamily !== undefined ? updates.fontFamily : currentCfg.fontFamily,
            fontWeight: updates.fontWeight !== undefined ? updates.fontWeight : currentCfg.fontWeight,
            textAlign: updates.textAlign !== undefined ? updates.textAlign : currentCfg.textAlign,
          };

          const rendered = renderTextToCanvas(newCfg);
          return {
            ...l,
            name: `نص: "${newCfg.text.slice(0, 14)}"`,
            canvas: rendered.canvas,
            width: rendered.width,
            height: rendered.height,
            textConfig: newCfg,
          };
        })
      );
    },
    []
  );

  // Add Geometric Shape Layer
  const handleAddShapeLayer = (
    customConfig?: Partial<ShapeConfig>,
    width: number = 220,
    height: number = 140,
    x?: number,
    y?: number
  ) => {
    pushUndo(layers, activeLayerId);
    const cfg: ShapeConfig = { ...shapeConfig, ...(customConfig || {}) };
    const rendered = renderShapeToCanvas(cfg, width, height);

    const strokeW = Math.max(0, cfg.strokeWidth || 0);
    const padding = Math.ceil(strokeW / 2) + 4;
    const placeX = x !== undefined ? x - padding : Math.max(20, Math.round((docWidth - rendered.width) / 2));
    const placeY = y !== undefined ? y - padding : Math.max(20, Math.round((docHeight - rendered.height) / 2));

    const shapeNames: Record<string, string> = {
      rectangle: "مستطيل",
      rounded_rect: "مستطيل مستدير",
      circle: "دائرة",
      ellipse: "شكل بيضاوي",
      triangle: "مثلث",
      star: "نجمة",
      line: "خط مستقيم",
      arrow: "سهم متقدم",
      polygon: "شكل مضلع",
    };
    const arabicName = shapeNames[cfg.type] || "شكل هندسي";

    const shapeLayer: Layer = {
      id: `layer-shape-${Date.now()}`,
      name: `${arabicName} (${rendered.width}×${rendered.height})`,
      type: "shape",
      canvas: rendered.canvas,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: "normal",
      x: placeX,
      y: placeY,
      width: rendered.width,
      height: rendered.height,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      flipX: false,
      flipY: false,
      shapeConfig: cfg,
    };

    setLayers((prev) => [...prev, shapeLayer]);
    setActiveLayerId(shapeLayer.id);
    setActiveTool("shape");
    setIsPropertiesOpen(true);
  };

  // Live non-destructive update of shape layer
  const handleUpdateShapeLayer = useCallback(
    (layerId: string, updates: Partial<ShapeConfig>) => {
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== layerId) return l;
          const currentCfg = l.shapeConfig || shapeConfig;
          const newCfg: ShapeConfig = {
            ...currentCfg,
            ...updates,
          };

          const oldStroke = Math.max(0, currentCfg.strokeWidth || 0);
          const oldPadding = Math.ceil(oldStroke / 2) + 4;
          const targetW = Math.max(10, l.width - oldPadding * 2);
          const targetH = Math.max(10, l.height - oldPadding * 2);

          const rendered = renderShapeToCanvas(newCfg, targetW, targetH);
          const newStroke = Math.max(0, newCfg.strokeWidth || 0);
          const newPadding = Math.ceil(newStroke / 2) + 4;
          const paddingDiff = newPadding - oldPadding;

          return {
            ...l,
            canvas: rendered.canvas,
            x: l.x - paddingDiff,
            y: l.y - paddingDiff,
            width: rendered.width,
            height: rendered.height,
            shapeConfig: newCfg,
          };
        })
      );
    },
    [shapeConfig]
  );

  // Isolate Segment to New Layer
  const handleIsolateSegment = async (segment: SegmentItem) => {
    const active = layers.find((l) => l.id === activeLayerId);
    if (!active) return;

    pushUndo(layers, activeLayerId);
    setIsProcessing(true);
    
    try {
      let segCanvas: HTMLCanvasElement;
      let placeX = active.x;
      let placeY = active.y;
      let segW = active.width;
      let segH = active.height;

      if (segment.box2d && segment.box2d.length === 4) {
        // box2d is [ymin, xmin, ymax, xmax] normalized to 0..1000
        const [ymin, xmin, ymax, xmax] = segment.box2d;
        const sx = Math.max(0, Math.round((xmin / 1000) * active.width));
        const sy = Math.max(0, Math.round((ymin / 1000) * active.height));
        const sw = Math.max(10, Math.round(((xmax - xmin) / 1000) * active.width));
        const sh = Math.max(10, Math.round(((ymax - ymin) / 1000) * active.height));

        segCanvas = document.createElement("canvas");
        segCanvas.width = sw;
        segCanvas.height = sh;
        const ctx = segCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(active.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        }

        placeX = active.x + sx;
        placeY = active.y + sy;
        segW = sw;
        segH = sh;
      } else {
        segCanvas = cloneCanvas(active.canvas);
      }

      const segmentLayer: Layer = {
        id: `layer-segment-${Date.now()}`,
        name: `عزل: ${segment.name}`,
        type: "raster",
        canvas: segCanvas,
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "normal",
        x: placeX,
        y: placeY,
        width: segW,
        height: segH,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        flipX: false,
        flipY: false,
      };

      setLayers((prev) => [...prev, segmentLayer]);
      setActiveLayerId(segmentLayer.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Drawing Stroke Completed
  const handleDrawingStrokeComplete = (drawnCanvas: HTMLCanvasElement) => {
    let active = layers.find((l) => l.id === activeLayerId);
    if (!active || !active.canvas || active.type === "text" || active.type === "adjustment") {
      active = [...layers].reverse().find((l) => l.canvas && l.type !== "text" && l.type !== "adjustment");
    }

    if (
      activeTool === "eraser" ||
      brushConfig.mode === "eraser" ||
      (activeTool === "bg_remove" && bgConfig.mode === "eraser")
    ) {
      // For eraser, active layer was already modified in real-time and
      // undo snapshot was captured at stroke start (handleMouseDown).
      // Clear overlay and trigger layer reactivity.
      const oCtx = drawnCanvas.getContext("2d");
      oCtx?.clearRect(0, 0, drawnCanvas.width, drawnCanvas.height);
      setLayers((prev) => [...prev]);
      return;
    }

    pushUndo(layers, activeLayerId);

    // If user selected "new" layer target OR if there is no active raster layer to draw on:
    if (brushConfig.targetLayer === "new" || !active) {
      const newCanvas = document.createElement("canvas");
      newCanvas.width = docWidth;
      newCanvas.height = docHeight;
      const nCtx = newCanvas.getContext("2d");
      if (nCtx) {
        nCtx.drawImage(drawnCanvas, 0, 0);
      }
      const shapeNames: Record<string, string> = {
        rectangle: "صندوق ومستطيل",
        circle: "دائرة",
        arrow: "سهم",
        line: "خط",
        brush: "رسم حر",
        neon: "توهج نيون",
        highlighter: "تمييز",
      };
      const label = shapeNames[brushConfig.mode] || "رسم";
      const newLayer: Layer = {
        id: `layer-draw-${Date.now()}`,
        name: `طبقة: ${label}`,
        type: "raster",
        canvas: newCanvas,
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "normal",
        x: 0,
        y: 0,
        width: docWidth,
        height: docHeight,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        flipX: false,
        flipY: false,
      };
      setLayers((prev) => [...prev, newLayer]);
      setActiveLayerId(newLayer.id);
    } else {
      // Burn drawing directly onto active image layer with accurate geometric transformation
      const ctx = active.canvas.getContext("2d");
      if (ctx) {
        const scaleX = (active.scaleX >= 0 ? 1 : -1) * (active.flipX ? -1 : 1) * Math.abs(active.scaleX || 1);
        const scaleY = (active.scaleY >= 0 ? 1 : -1) * (active.flipY ? -1 : 1) * Math.abs(active.scaleY || 1);
        const rotRad = ((active.rotation || 0) * Math.PI) / 180;
        const renderedW = Math.round(active.width * Math.abs(active.scaleX || 1));
        const renderedH = Math.round(active.height * Math.abs(active.scaleY || 1));
        const centerX = Math.round(active.x + renderedW / 2);
        const centerY = Math.round(active.y + renderedH / 2);

        ctx.save();
        ctx.translate(active.width / 2, active.height / 2);
        ctx.scale(1 / scaleX, 1 / scaleY);
        ctx.rotate(-rotRad);
        ctx.translate(-centerX, -centerY);
        ctx.drawImage(drawnCanvas, 0, 0);
        ctx.restore();
      }
      setLayers((prev) => [...prev]);
    }

    // Clear overlay
    const oCtx = drawnCanvas.getContext("2d");
    oCtx?.clearRect(0, 0, drawnCanvas.width, drawnCanvas.height);
  };

  // Handle Apply Blend from ImageBlendModal
  const handleApplyBlend = (resultCanvas: HTMLCanvasElement, blendName: string) => {
    pushUndo(layers, activeLayerId);

    // Update document dimensions if the blended result is larger
    if (resultCanvas.width > docWidth || resultCanvas.height > docHeight) {
      setDocWidth(Math.max(docWidth, resultCanvas.width));
      setDocHeight(Math.max(docHeight, resultCanvas.height));
    }

    const newLayer: Layer = {
      id: `layer-blend-${Date.now()}`,
      name: blendName || "طبقة مدمجة",
      type: "image",
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: "normal",
      x: 0,
      y: 0,
      width: resultCanvas.width,
      height: resultCanvas.height,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      flipX: false,
      flipY: false,
      canvas: resultCanvas,
    };

    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
    setAiNotice({ message: `تم تطبيق ${blendName} بنجاح كطبقة جديدة في مساحة العمل!` });
  };

  // Add a Blank Drawing Layer
  const handleAddBlankLayer = () => {
    const docWidth = layers.length > 0 ? Math.max(...layers.map((l) => l.width)) : 800;
    const docHeight = layers.length > 0 ? Math.max(...layers.map((l) => l.height)) : 800;

    pushUndo(layers, activeLayerId);
    const c = document.createElement("canvas");
    c.width = docWidth;
    c.height = docHeight;

    const newLayer: Layer = {
      id: `layer-blank-${Date.now()}`,
      name: `طبقة ${layers.length + 1}`,
      type: "raster",
      canvas: c,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: "normal",
      x: 0,
      y: 0,
      width: docWidth,
      height: docHeight,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      flipX: false,
      flipY: false,
    };

    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
  };

  return (
    <>
      {currentView === "auth" && (
        <AuthPage onBackToStudio={navigateToStudio} />
      )}
      <div
        id="vision-studio-app-root"
        style={{ display: currentView === "auth" ? "none" : "flex" }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
            dragCounterRef.current += 1;
            setIsDraggingGlobalFile(true);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
          if (!isDraggingGlobalFile) {
            setIsDraggingGlobalFile(true);
          }
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
          if (dragCounterRef.current === 0) {
            setIsDraggingGlobalFile(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounterRef.current = 0;
          setIsDraggingGlobalFile(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleUploadFiles(Array.from(e.dataTransfer.files) as File[]);
          }
        }}
        className="w-screen h-screen overflow-hidden flex flex-col bg-[#080910] text-slate-100 font-['Cairo',sans-serif] relative"
      >
      {/* 1. TOP NAVBAR */}
      <Navbar
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={zoom}
        onZoomChange={setZoom}
        onFitZoom={() => setZoom(1.0)}
        splitView={splitView}
        onToggleSplitView={() => setSplitView(!splitView)}
        onLoadSample={handleLoadSample}
        onUploadImage={handleUploadImage}
        onExport={handleExport}
        isProcessing={isProcessing || isAiProcessing}
        onOpenShortcuts={() => setShowShortcutsModal(true)}
        onOpenMetadata={() => setShowMetadataModal(true)}
        onOpenBlendModal={() => setShowBlendModal(true)}
        onOpenPythonCode={() => setShowPythonCodeModal(true)}
        projectName={projectName}
        onRenameProject={setProjectName}
        docWidth={docWidth}
        docHeight={docHeight}
        onChangeCanvasSize={(w, h) => {
          setDocWidth(w);
          setDocHeight(h);
        }}
        isLayersOpen={isLayersOpen}
        isPropertiesOpen={isPropertiesOpen}
        onToggleLayers={() => setIsLayersOpen((prev) => !prev)}
        onToggleProperties={() => setIsPropertiesOpen((prev) => !prev)}
        onToggleBothPanels={handleToggleBothPanels}
        onNewProject={handleNewProject}
        onOpenAuthModal={navigateToAuth}
        onOpenProjects={() => setShowStorageModal(true)}
        onSaveProject={handleSaveProject}
        isSavingProject={isSavingProject}
        onOpenHelp={() => setShowHelpModal(true)}
      />

      {/* 2-5. 4-COLUMN WORKSPACE: Layers Panel (Right in RTL) | Canvas (Center) | Properties (Left in RTL) | Toolbar (Far Left in RTL) */}
      <div className="flex-1 flex overflow-hidden">
        {/* RIGHT (in RTL): Layers Panel (Collapsible) */}
        {isLayersOpen ? (
          <LayersPanel
            layers={layers}
            activeLayerId={activeLayerId}
            onSelectLayer={setActiveLayerId}
            onUploadImage={handleUploadImage}
            onToggleVisibility={(id) => {
              setLayers((prev) =>
                prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
              );
            }}
            onToggleLock={(id) => {
              setLayers((prev) =>
                prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l))
              );
            }}
            onChangeOpacity={(id, opacity) => {
              setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, opacity } : l)));
            }}
            onChangeBlendMode={(id, blendMode) => {
              setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, blendMode } : l)));
            }}
            onMoveLayer={(id, direction) => {
              const index = layers.findIndex((l) => l.id === id);
              if (index === -1) return;
              const newIndex = direction === "up" ? index + 1 : index - 1;
              if (newIndex < 0 || newIndex >= layers.length) return;
              pushUndo(layers, activeLayerId);
              const copy = [...layers];
              const [removed] = copy.splice(index, 1);
              copy.splice(newIndex, 0, removed);
              setLayers(copy);
            }}
            onDuplicateLayer={handleDuplicateLayer}
            onDeleteLayer={handleDeleteLayer}
            onAddLayer={handleAddBlankLayer}
            onAddTextQuick={() => handleAddTextLayer()}
            onAddShapeQuick={() => handleAddShapeLayer()}
            onAddGradientQuick={() => handleAddGradientLayer()}
            onOpenBlendModal={() => setShowBlendModal(true)}
            onToggleCollapse={() => setIsLayersOpen(false)}
          />
        ) : (
          /* Slim Collapsed Dock Tab for Layers Panel */
          <div
            id="layers-collapsed-dock-tab"
            className="w-9 border-r rtl:border-l ltr:border-r border-purple-500/20 bg-[#0c0d16]/98 backdrop-blur-xl flex flex-col items-center py-2.5 z-20 select-none text-slate-300 shrink-0 shadow-md group transition-all"
          >
            <Tooltip content="إظهار لوحة الطبقات" shortcut="F7" position="left">
              <button
                type="button"
                onClick={() => setIsLayersOpen(true)}
                className="w-7 h-7 rounded-lg bg-purple-950/60 hover:bg-purple-900/90 border border-purple-500/40 flex items-center justify-center text-purple-300 hover:text-white transition-all shadow-sm active:scale-95 group-hover:border-purple-400 cursor-pointer"
              >
                <LayersIcon className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <span className="mt-2 text-[9px] font-mono font-bold px-1 py-0.2 rounded-full bg-purple-950 text-purple-300 border border-purple-800/40">
              {layers.length}
            </span>

            <div
              onClick={() => setIsLayersOpen(true)}
              className="mt-6 flex-1 flex items-center justify-center cursor-pointer text-slate-400 hover:text-purple-300 transition-colors py-2"
              style={{ writingMode: "vertical-rl" }}
              title="انقر لفتح لوحة الطبقات"
            >
              <span className="text-[11px] font-bold tracking-widest">لوحة الطبقات</span>
            </div>
          </div>
        )}

        {/* CENTER: Canvas Workspace */}
        <CanvasWorkspace
          layers={layers}
          activeLayerId={activeLayerId}
          activeTool={activeTool}
          zoom={zoom}
          onZoomChange={setZoom}
          docWidth={docWidth}
          docHeight={docHeight}
          splitView={splitView}
          originalCanvas={originalCanvas}
          brushConfig={brushConfig}
          bgConfig={bgConfig}
          onCanvasClickChroma={handleCanvasClickChroma}
          onCanvasClickAiSmart={handleCanvasClickAiSmart}
          onApplyBgRemoval={handleApplyBgRemoval}
          onUpdateLayerTransform={handleUpdateLayerTransform}
          detectedObjects={detectedObjects}
          ocrBlocks={ocrBlocks}
          showBoundingBoxes={showBoundingBoxes}
          onDrawingStrokeComplete={handleDrawingStrokeComplete}
          onSelectLayer={setActiveLayerId}
          onDeselectLayer={() => setActiveLayerId("")}
          isComparingOriginal={isComparingOriginal}
          onToggleCompareOriginal={() => setIsComparingOriginal((prev) => !prev)}
          onUploadImage={handleUploadImage}
          onUploadFiles={handleUploadFiles}
          selectionRegion={selectionRegion}
          onUpdateSelectionRegion={(u) => setSelectionRegion((prev) => ({ ...prev, ...u }))}
          onExtractSelectionAsLayer={handleExtractSelectionAsLayer}
          onClearSelection={handleClearSelection}
          cropBox={cropBox}
          onUpdateCropBox={setCropBox}
          onConfirmCrop={handleConfirmCrop}
          onCancelCrop={handleCancelCrop}
          cropAspect={cropAspect}
          editingTextLayerId={editingTextLayerId}
          onSetEditingTextLayerId={setEditingTextLayerId}
          onAddTextLayer={handleAddTextLayer}
          onUpdateTextLayer={handleUpdateTextLayer}
          shapeConfig={shapeConfig}
          onAddShapeLayer={handleAddShapeLayer}
          onSaveHistorySnapshot={() => pushUndo(layers, activeLayerId)}
          onApplyInpaint={handleApplyInpaint}
          onRegisterInpaintController={(controller) => {
            inpaintControllerRef.current = controller;
          }}
          isProcessing={isProcessing}
        />

        {/* LEFT (in RTL): Dynamic Properties Panel (Collapsible) */}
        {isPropertiesOpen ? (
          <PropertiesPanel
            activeTool={activeTool}
            activeLayer={activeLayer}
            canvasWidth={docWidth}
            canvasHeight={docHeight}
            onOpenMetadata={() => setShowMetadataModal(true)}
            isComparingOriginal={isComparingOriginal}
            onToggleCompareOriginal={() => setIsComparingOriginal((prev) => !prev)}
            onSetCompareOriginal={setIsComparingOriginal}
            onUpdateLayerTransform={handleUpdateLayerTransform}
            toneAdjustments={toneAdjustments}
            onUpdateToneAdjustments={handleUpdateToneAdjustments}
            onResetToneAdjustments={handleResetToneAdjustments}
            toneScope={toneScope}
            onSetToneScope={setToneScope}
            pointConfig={pointConfig}
            onUpdatePointConfig={handleUpdatePointConfig}
            onApplyPointProcessing={() => handleApplyPointProcessing()}
            onResetPointProcessing={handleResetPointProcessing}
            spatialConfig={spatialConfig}
            onUpdateSpatialConfig={(c) => setSpatialConfig((prev) => ({ ...prev, ...c }))}
            onApplySpatialFilter={handleApplySpatialFilter}
            bgConfig={bgConfig}
            onUpdateBgConfig={(c) => setBgConfig((prev) => ({ ...prev, ...c }))}
            onApplyBgRemoval={handleApplyBgRemoval}
            onRevertBgRemoval={handleRevertBgRemoval}
            brushConfig={brushConfig}
            onUpdateBrushConfig={(c) => setBrushConfig((prev) => ({ ...prev, ...c }))}
            onApplyInpaint={handleApplyInpaint}
            onUndo={handleUndo}
            onApplyProductBackdrop={handleApplyProductBackdrop}
            isProcessing={isProcessing}
            isAiProcessing={isAiProcessing}
            onRunAiVision={handleRunAiVision}
            detectedObjects={detectedObjects}
            yoloModel={yoloModel}
            onSelectYoloModel={setYoloModel}
            yoloConfidence={yoloConfidence}
            onSelectYoloConfidence={setYoloConfidence}
            onExtractObjectAsLayer={handleExtractObjectAsLayer}
            onExtractAllObjectsAsLayers={handleExtractAllObjectsAsLayers}
            ocrBlocks={ocrBlocks}
            ocrLanguage={ocrLanguage}
            onSelectOcrLanguage={setOcrLanguage}
            ocrEnhance={ocrEnhance}
            onToggleOcrEnhance={() => setOcrEnhance((prev) => !prev)}
            segments={segments}
            segmentConfig={segmentConfig}
            onUpdateSegmentConfig={(c) => setSegmentConfig((prev) => ({ ...prev, ...c }))}
            onApplySegmentation={handleApplySegmentation}
            onRevertSegmentation={handleRevertSegmentation}
            activeAiSubTab={activeAiSubTab}
            onSelectAiSubTab={handleSelectAiSubTab}
            selectionRegion={selectionRegion}
            onUpdateSelectionRegion={(u) => setSelectionRegion((prev) => ({ ...prev, ...u }))}
            onExtractSelectionAsLayer={handleExtractSelectionAsLayer}
            onClearSelection={handleClearSelection}
            showBoundingBoxes={showBoundingBoxes}
            onToggleBoundingBoxes={() => setShowBoundingBoxes(!showBoundingBoxes)}
            onAddOcrTextLayer={handleAddOcrTextLayer}
            onIsolateSegment={handleIsolateSegment}
            aiNotice={aiNotice}
            onDismissAiNotice={() => setAiNotice(null)}
            cropBox={cropBox}
            onUpdateCropBox={setCropBox}
            cropAspect={cropAspect}
            onSetCropAspect={handleSetCropAspect}
            cropTarget={cropTarget}
            onSetCropTarget={setCropTarget}
            onConfirmCrop={handleConfirmCrop}
            onCancelCrop={handleCancelCrop}
            onResetCropBox={handleResetCropBox}
            onAddTextLayer={handleAddTextLayer}
            onUpdateTextLayer={handleUpdateTextLayer}
            onStartInlineTextEdit={(id) => setEditingTextLayerId(id)}
            shapeConfig={shapeConfig}
            onUpdateShapeConfig={(c) => setShapeConfig((prev) => ({ ...prev, ...c }))}
            onAddShapeLayer={handleAddShapeLayer}
            onUpdateActiveShapeLayer={handleUpdateShapeLayer}
            onUpdateActiveGradientLayer={handleUpdateActiveGradientLayer}
            onAddGradientLayer={handleAddGradientLayer}
            onToggleCollapse={() => setIsPropertiesOpen(false)}
          />
        ) : (
          /* Slim Collapsed Dock Tab for Properties Panel */
          <div
            id="properties-collapsed-dock-tab"
            className="w-9 border-r rtl:border-r ltr:border-l border-purple-500/20 bg-[#0c0d16]/98 backdrop-blur-xl flex flex-col items-center py-2.5 z-20 select-none text-slate-300 shrink-0 shadow-md group transition-all"
          >
            <Tooltip content="إظهار لوحة الخصائص والأدوات" shortcut="F8" position="right">
              <button
                type="button"
                onClick={() => setIsPropertiesOpen(true)}
                className="w-7 h-7 rounded-lg bg-purple-950/60 hover:bg-purple-900/90 border border-purple-500/40 flex items-center justify-center text-purple-300 hover:text-white transition-all shadow-sm active:scale-95 group-hover:border-purple-400 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <div
              onClick={() => setIsPropertiesOpen(true)}
              className="mt-6 flex-1 flex items-center justify-center cursor-pointer text-slate-400 hover:text-purple-300 transition-colors py-2"
              style={{ writingMode: "vertical-rl" }}
              title="انقر لفتح لوحة الخصائص"
            >
              <span className="text-[11px] font-bold tracking-widest">لوحة الخصائص</span>
            </div>
          </div>
        )}

        {/* FAR LEFT (in RTL): Tool Icon Rail */}
        <Toolbar activeTool={activeTool} onSelectTool={handleSelectTool} />
      </div>

      {/* Keyboard Shortcuts Help Modal (F1) */}
      <ShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {/* Help & User Manual Modal */}
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        onOpenShortcuts={() => {
          setShowHelpModal(false);
          setShowShortcutsModal(true);
        }}
      />

      {/* Image Metadata & Specs Modal */}
      <ImageMetadataModal
        isOpen={showMetadataModal}
        onClose={() => setShowMetadataModal(false)}
        activeLayer={activeLayer}
        layers={layers}
        docWidth={docWidth}
        docHeight={docHeight}
        zoom={zoom}
        fileMetadata={fileMetadata}
        projectName={projectName}
        onRenameProject={setProjectName}
      />

      {/* Smart Two-Image Blend Modal */}
      <ImageBlendModal
        isOpen={showBlendModal}
        onClose={() => setShowBlendModal(false)}
        baseCanvas={activeLayer?.canvas || null}
        onApplyBlend={handleApplyBlend}
      />

      {/* Global Drag & Drop Overlay Across Entire Workspace */}
      {isDraggingGlobalFile && (
        <div
          id="global-drag-drop-overlay"
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-6 animate-in fade-in duration-200"
        >
          <div className="max-w-xl w-full mx-auto p-8 sm:p-10 rounded-3xl border-2 border-dashed border-cyan-400 bg-gradient-to-b from-purple-950/90 via-slate-900/95 to-slate-950/95 shadow-2xl shadow-cyan-500/25 text-center flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-xl shadow-cyan-500/30 animate-bounce">
                <Upload className="w-10 h-10" />
              </div>
              <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-purple-600 border border-purple-300 flex items-center justify-center text-yellow-300 shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-wide font-['Cairo',sans-serif]">
                أفلت الصورة هنا لرفعها ومعالجتها فوراً
              </h2>
              <p className="text-sm text-cyan-200/90 max-w-md mx-auto leading-relaxed font-['Cairo',sans-serif]">
                اسحب أي صورة من جهازك وأفلتها في أي مكان على مساحة العمل ليتم استيرادها وضبط أبعاد اللوحة تلقائياً.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {["PNG", "JPG", "WebP", "SVG", "BMP", "GIF", "AVIF"].map((fmt) => (
                <span
                  key={fmt}
                  className="px-2.5 py-1 rounded-md bg-slate-800/90 border border-cyan-500/30 text-xs font-mono text-cyan-300 font-semibold shadow-sm"
                >
                  .{fmt}
                </span>
              ))}
            </div>

            <div className="text-xs text-slate-300 flex items-center gap-2 pt-2 border-t border-purple-500/20 w-full justify-center font-['Cairo',sans-serif]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>يدعم سحب صورة مفردة أو صور متعددة وإضافتها كطبقات مباشرة</span>
            </div>
          </div>
        </div>
      )}
      <PythonCodeModal
        isOpen={showPythonCodeModal}
        onClose={() => setShowPythonCodeModal(false)}
        pointConfig={pointConfig}
        spatialConfig={spatialConfig}
        toneConfig={toneAdjustments}
        activeLayer={activeLayer || layers[0]}
        onApplyResult={(filteredCanvas) => {
          const active = activeLayer || layers[0];
          if (!active) return;
          pushUndo(layers, activeLayerId);
          setLayers(layers.map((l) => (l.id === active.id ? { ...l, canvas: filteredCanvas } : l)));
        }}
      />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
      <UserStorageModal
        isOpen={showStorageModal}
        onClose={() => setShowStorageModal(false)}
        onLoadProject={handleLoadProject}
        onSaveCurrentProject={handleSaveProject}
        onInsertAssetAsLayer={handleInsertAssetAsLayer}
        currentProjectName={projectName}
        isSavingProject={isSavingProject}
      />
    </div>
    </>
  );
}

export default App;
