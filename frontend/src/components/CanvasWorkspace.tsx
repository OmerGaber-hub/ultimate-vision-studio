import { PanelButton } from "./PanelButton";
import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Eye,
  Upload,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Move,
  Scissors,
  Sparkles,
  X,
  Magnet,
  Check,
  Type,
  Wand2,
  Eraser,
} from "lucide-react";
import {
  Layer,
  ToolType,
  BrushConfig,
  DetectedObject,
  OCRBlock,
  BgRemovalConfig,
  SelectionRegion,
  CropRegion,
  ShapeConfig,
} from "../types";
import { findMagneticEdgePoint } from "../lib/cvEngine";
import { TextRenderConfig } from "../lib/textEngine";
import { renderShapeToCanvas } from "../lib/shapeEngine";

interface CanvasWorkspaceProps {
  layers: Layer[];
  activeLayerId: string;
  activeTool: ToolType;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  docWidth?: number;
  docHeight?: number;
  splitView: boolean;
  originalCanvas: HTMLCanvasElement | null;
  brushConfig: BrushConfig;
  bgConfig: BgRemovalConfig;
  onCanvasClickChroma?: (color: { r: number; g: number; b: number }, x: number, y: number) => void;
  onCanvasClickAiSmart?: (x: number, y: number) => void;
  onApplyBgRemoval?: () => void;
  onUpdateLayerTransform: (transform: {
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    flipX?: boolean;
    flipY?: boolean;
    x?: number;
    y?: number;
  }) => void;
  detectedObjects: DetectedObject[];
  ocrBlocks: OCRBlock[];
  showBoundingBoxes: boolean;
  onDrawingStrokeComplete?: (drawnCanvas: HTMLCanvasElement) => void;
  isComparingOriginal?: boolean;
  onToggleCompareOriginal?: (val?: boolean) => void;
  onUploadImage?: (file: File) => void;
  onUploadFiles?: (files: File[]) => void;
  selectionRegion?: SelectionRegion;
  onUpdateSelectionRegion?: (update: Partial<SelectionRegion>) => void;
  onExtractSelectionAsLayer?: () => void;
  onClearSelection?: () => void;
  onSelectLayer?: (id: string) => void;
  onDeselectLayer?: () => void;
  cropBox?: CropRegion | null;
  onUpdateCropBox?: (box: CropRegion | null) => void;
  onConfirmCrop?: () => void;
  onCancelCrop?: () => void;
  cropAspect?: number | null;
  editingTextLayerId?: string | null;
  onSetEditingTextLayerId?: (id: string | null) => void;
  onAddTextLayer?: (text: string, fontSize: number, color: string, x?: number, y?: number) => void;
  onUpdateTextLayer?: (layerId: string, updates: Partial<TextRenderConfig>) => void;
  shapeConfig?: ShapeConfig;
  onAddShapeLayer?: (config?: Partial<ShapeConfig>, width?: number, height?: number, x?: number, y?: number) => void;
  onSaveHistorySnapshot?: () => void;
  onApplyInpaint?: (maskCanvas?: HTMLCanvasElement) => void;
  onRegisterInpaintController?: (controller: {
    getMaskCanvas: () => HTMLCanvasElement | null;
    clearMask: () => void;
  }) => void;
  isProcessing?: boolean;
}

const DEFAULT_SHAPE_CONFIG: ShapeConfig = {
  type: "rectangle",
  fillColor: "#8b5cf6",
  strokeColor: "#ffffff",
  strokeWidth: 2,
  strokeDash: "solid",
  cornerRadius: 16,
  starPoints: 5,
};

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  layers,
  activeLayerId,
  activeTool,
  zoom,
  onZoomChange,
  docWidth: propDocWidth,
  docHeight: propDocHeight,
  splitView,
  originalCanvas,
  brushConfig,
  bgConfig,
  onCanvasClickChroma,
  onCanvasClickAiSmart,
  onApplyBgRemoval,
  onUpdateLayerTransform,
  detectedObjects,
  ocrBlocks,
  showBoundingBoxes,
  onDrawingStrokeComplete,
  isComparingOriginal = false,
  onToggleCompareOriginal,
  onUploadImage,
  onUploadFiles,
  selectionRegion = {
    mode: "polygon",
    points: [],
    isClosed: false,
    feather: 0,
  },
  onUpdateSelectionRegion,
  onExtractSelectionAsLayer,
  onClearSelection,
  onSelectLayer,
  onDeselectLayer,
  cropBox,
  onUpdateCropBox,
  onConfirmCrop,
  onCancelCrop,
  cropAspect,
  editingTextLayerId,
  onSetEditingTextLayerId,
  onAddTextLayer,
  onUpdateTextLayer,
  shapeConfig = DEFAULT_SHAPE_CONFIG,
  onAddShapeLayer,
  onSaveHistorySnapshot,
  onApplyInpaint,
  onRegisterInpaintController,
  isProcessing,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const inlineTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Drag & drop file upload state
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragCounterRef = useRef<number>(0);

  // Pan offset state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Viewport tracking for interactive scrollbars
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });
  const verticalTrackRef = useRef<HTMLDivElement>(null);
  const horizontalTrackRef = useRef<HTMLDivElement>(null);

  // Split view slider (0 to 1)
  const [splitPos, setSplitPos] = useState<number>(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);

  // Pixel probe readout
  const [pixelProbe, setPixelProbe] = useState<{
    x: number;
    y: number;
    r: number;
    g: number;
    b: number;
    a: number;
    hex: string;
  } | null>(null);

  // Free Transform dragging handles
  const [isTransforming, setIsTransforming] = useState<
    "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | "rotate" | null
  >(null);

  // Dedicated Crop Tool Dragging State
  const [cropHandle, setCropHandle] = useState<
    "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | "new" | null
  >(null);
  const cropStartRef = useRef<{
    clientX: number;
    clientY: number;
    canvasX: number;
    canvasY: number;
    startBox: CropRegion;
  }>({
    clientX: 0,
    clientY: 0,
    canvasX: 0,
    canvasY: 0,
    startBox: { x: 0, y: 0, width: 100, height: 100 },
  });
  const transformStartRef = useRef<{
    clientX: number;
    clientY: number;
    startX: number;
    startY: number;
    startScaleX: number;
    startScaleY: number;
    startRotation: number;
  }>({
    clientX: 0,
    clientY: 0,
    startX: 0,
    startY: 0,
    startScaleX: 1,
    startScaleY: 1,
    startRotation: 0,
  });

  // Brush drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const shapeBrushStartRef = useRef<{ startX: number; startY: number } | null>(null);

  // Geometric shape drag-to-draw state
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const shapeDragStartRef = useRef<{ startX: number; startY: number; clientX: number; clientY: number } | null>(null);
  const shapeDragCurrentRef = useRef<{ x: number; y: number; shiftKey: boolean } | null>(null);

  // Lasso selection interactive state
  const [lassoHoverPoint, setLassoHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [isHoveringFirstPoint, setIsHoveringFirstPoint] = useState(false);
  const [isDrawingFreehandSelection, setIsDrawingFreehandSelection] = useState(false);

  // Eraser cursor tracking (client coordinates for the floating circle)
  const [eraserCursorPos, setEraserCursorPos] = useState<{ clientX: number; clientY: number } | null>(null);
  // AI Object Eraser mask canvas (paints highlight mask for inpainting)
  const eraserMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasInpaintMask, setHasInpaintMask] = useState<boolean>(false);

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  // Compute composite dimensions based on document settings or layer bounds
  const docWidth = propDocWidth ?? (layers.length > 0 ? Math.max(...layers.map((l) => l.width)) : 800);
  const docHeight = propDocHeight ?? (layers.length > 0 ? Math.max(...layers.map((l) => l.height)) : 800);

  // Register inpaint controller for parent App and PropertiesPanel
  useEffect(() => {
    if (onRegisterInpaintController) {
      onRegisterInpaintController({
        getMaskCanvas: () => eraserMaskCanvasRef.current,
        clearMask: () => {
          if (overlayCanvasRef.current) {
            const oCtx = overlayCanvasRef.current.getContext("2d");
            oCtx?.clearRect(0, 0, docWidth, docHeight);
          }
          if (eraserMaskCanvasRef.current) {
            const mCtx = eraserMaskCanvasRef.current.getContext("2d");
            mCtx?.clearRect(0, 0, docWidth, docHeight);
          }
          setHasInpaintMask(false);
        },
      });
    }
  }, [docWidth, docHeight, onRegisterInpaintController]);

  // Render composite layers onto main canvas
  const renderComposite = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = docWidth;
    canvas.height = docHeight;
    ctx.clearRect(0, 0, docWidth, docHeight);

    // If instant compare original is active, render originalCanvas directly!
    if (isComparingOriginal && originalCanvas) {
      ctx.drawImage(originalCanvas, 0, 0, docWidth, docHeight);
      return;
    }

    // If split view is enabled, handle split rendering
    if (splitView && originalCanvas) {
      // 1. Draw original on left side
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, docWidth * splitPos, docHeight);
      ctx.clip();
      ctx.drawImage(originalCanvas, 0, 0, docWidth, docHeight);
      ctx.restore();

      // 2. Draw composite on right side
      ctx.save();
      ctx.beginPath();
      ctx.rect(docWidth * splitPos, 0, docWidth * (1 - splitPos), docHeight);
      ctx.clip();
    }

    // Render layers in stack order (index 0 bottom)
    for (const layer of layers) {
      if (!layer.visible) continue;
      // When actively editing text directly on canvas, hide canvas layer to prevent ghosting
      if (layer.id === editingTextLayerId) continue;
      // Apply layer geometric transformation exactly matching CSS overlay
      const renderedW = Math.round(layer.width * Math.abs(layer.scaleX || 1));
      const renderedH = Math.round(layer.height * Math.abs(layer.scaleY || 1));
      const centerX = Math.round(layer.x + renderedW / 2);
      const centerY = Math.round(layer.y + renderedH / 2);

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation =
        layer.blendMode === "normal" ? "source-over" : (layer.blendMode as GlobalCompositeOperation);
      ctx.imageSmoothingQuality = "high";

      ctx.translate(centerX, centerY);
      ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);
      ctx.scale(
        (layer.scaleX >= 0 ? 1 : -1) * (layer.flipX ? -1 : 1),
        (layer.scaleY >= 0 ? 1 : -1) * (layer.flipY ? -1 : 1)
      );
      ctx.drawImage(layer.canvas, Math.round(-renderedW / 2), Math.round(-renderedH / 2), renderedW, renderedH);
      ctx.restore();
    }

    if (splitView && originalCanvas) {
      ctx.restore(); // restore split clipping

      // Draw split divider line
      ctx.save();
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.moveTo(docWidth * splitPos, 0);
      ctx.lineTo(docWidth * splitPos, docHeight);
      ctx.stroke();

      // Divider Handle Circle
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#a855f7";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(docWidth * splitPos, docHeight / 2, 8 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, [layers, docWidth, docHeight, splitView, splitPos, originalCanvas, isComparingOriginal, zoom]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  // ResizeObserver for tracking container viewport size
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setViewportSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute scrollbar travel ranges and thumbs
  const renderedW = docWidth * zoom;
  const renderedH = docHeight * zoom;
  const viewportW = Math.max(100, viewportSize.width);
  const viewportH = Math.max(100, viewportSize.height);

  const centerPanX = (viewportW - renderedW) / 2;
  const centerPanY = (viewportH - renderedH) / 2;

  const travelY = Math.max(renderedH, viewportH) * 0.75 + 150;
  const minPanY = centerPanY - travelY;
  const maxPanY = centerPanY + travelY;
  const rangeY = Math.max(1, maxPanY - minPanY);

  const travelX = Math.max(renderedW, viewportW) * 0.75 + 150;
  const minPanX = centerPanX - travelX;
  const maxPanX = centerPanX + travelX;
  const rangeX = Math.max(1, maxPanX - minPanX);

  const scrollYRatio = Math.max(0, Math.min(1, (maxPanY - pan.y) / rangeY));
  const scrollXRatio = Math.max(0, Math.min(1, (maxPanX - pan.x) / rangeX));

  const thumbHPercent = Math.max(12, Math.min(75, (viewportH / (renderedH + viewportH)) * 100));
  const thumbTopPercent = scrollYRatio * (100 - thumbHPercent);

  const thumbWPercent = Math.max(12, Math.min(75, (viewportW / (renderedW + viewportW)) * 100));
  const thumbLeftPercent = scrollXRatio * (100 - thumbWPercent);

  // Vertical scrollbar thumb drag
  const handleVerticalThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startClientY = e.clientY;
    const startPanY = pan.y;
    const trackHeight = verticalTrackRef.current?.clientHeight || 400;

    const onMouseMove = (ev: MouseEvent) => {
      const deltaY = ev.clientY - startClientY;
      const deltaPan = (deltaY / trackHeight) * rangeY;
      setPan((prev) => ({
        ...prev,
        y: Math.max(minPanY, Math.min(maxPanY, startPanY - deltaPan)),
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Vertical track click
  const handleVerticalTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== verticalTrackRef.current) return;
    const rect = verticalTrackRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clickRatio = clickY / rect.height;
    const targetPanY = maxPanY - clickRatio * rangeY;
    setPan((prev) => ({ ...prev, y: Math.max(minPanY, Math.min(maxPanY, targetPanY)) }));
  };

  // Horizontal scrollbar thumb drag
  const handleHorizontalThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startClientX = e.clientX;
    const startPanX = pan.x;
    const trackWidth = horizontalTrackRef.current?.clientWidth || 400;

    const onMouseMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - startClientX;
      const deltaPan = (deltaX / trackWidth) * rangeX;
      setPan((prev) => ({
        ...prev,
        x: Math.max(minPanX, Math.min(maxPanX, startPanX - deltaPan)),
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Horizontal track click
  const handleHorizontalTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== horizontalTrackRef.current) return;
    const rect = horizontalTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = clickX / rect.width;
    const targetPanX = maxPanX - clickRatio * rangeX;
    setPan((prev) => ({ ...prev, x: Math.max(minPanX, Math.min(maxPanX, targetPanX)) }));
  };

  // Stepper arrows
  const handleScrollStep = (dir: "up" | "down" | "left" | "right") => {
    const step = 90;
    if (dir === "up") setPan((p) => ({ ...p, y: Math.min(maxPanY, p.y + step) }));
    if (dir === "down") setPan((p) => ({ ...p, y: Math.max(minPanY, p.y - step) }));
    if (dir === "left") setPan((p) => ({ ...p, x: Math.min(maxPanX, p.x + step) }));
    if (dir === "right") setPan((p) => ({ ...p, x: Math.max(minPanX, p.x - step) }));
  };

  // Center canvas
  const handleCenterCanvas = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPan({
        x: (rect.width - docWidth * zoom) / 2,
        y: (rect.height - docHeight * zoom) / 2,
      });
    }
  };

  // Center pan initially
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPan({
        x: (rect.width - docWidth * zoom) / 2,
        y: (rect.height - docHeight * zoom) / 2,
      });
    }
  }, [docWidth, docHeight]);

  // Handle Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(4.0, Math.max(0.15, zoom * zoomFactor));

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Zoom centered on cursor
      setPan((prev) => ({
        x: mouseX - (mouseX - prev.x) * (newZoom / zoom),
        y: mouseY - (mouseY - prev.y) * (newZoom / zoom),
      }));
    }
    onZoomChange(newZoom);
  };

  // Convert client viewport coordinates to Canvas document coordinates accurately
  const clientToCanvasCoords = (clientX: number, clientY: number) => {
    if (mainCanvasRef.current) {
      const rect = mainCanvasRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const x = ((clientX - rect.left) / rect.width) * docWidth;
        const y = ((clientY - rect.top) / rect.height) * docHeight;
        return { x, y };
      }
    }
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;
    return { x, y };
  };

  // Mouse Move - Pixel probe & dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = clientToCanvasCoords(e.clientX, e.clientY);

    // Pixel probe
    if (x >= 0 && x < docWidth && y >= 0 && y < docHeight && mainCanvasRef.current) {
      try {
        const ctx = mainCanvasRef.current.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
          const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2])
            .toString(16)
            .slice(1)}`;
          setPixelProbe({
            x: Math.floor(x),
            y: Math.floor(y),
            r: pixel[0],
            g: pixel[1],
            b: pixel[2],
            a: pixel[3],
            hex,
          });
        }
      } catch {
        // ignore out of bounds
      }
    } else {
      setPixelProbe(null);
    }

    // Track real-time eraser cursor screen position for the circular ring indicator
    const isEraserTool = activeTool === "eraser" || (activeTool === "bg_remove" && bgConfig.mode === "eraser");
    if (isEraserTool) {
      setEraserCursorPos({ clientX: e.clientX, clientY: e.clientY });
    } else if (eraserCursorPos !== null) {
      setEraserCursorPos(null);
    }

    // Pan dragging
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    // Dedicated Crop Box Handle Resizing & Panning
    if (cropHandle && cropBox && onUpdateCropBox) {
      const dx = (e.clientX - cropStartRef.current.clientX) / zoom;
      const dy = (e.clientY - cropStartRef.current.clientY) / zoom;
      const start = cropStartRef.current.startBox;

      if (cropHandle === "move") {
        const newX = Math.max(0, Math.min(docWidth - start.width, start.x + dx));
        const newY = Math.max(0, Math.min(docHeight - start.height, start.y + dy));
        onUpdateCropBox({ ...start, x: Math.round(newX), y: Math.round(newY) });
      } else if (cropHandle === "new") {
        const mouseDx = e.clientX - cropStartRef.current.clientX;
        const mouseDy = e.clientY - cropStartRef.current.clientY;
        if (Math.hypot(mouseDx, mouseDy) < 8) {
          return;
        }
        const curX = Math.max(0, Math.min(docWidth, x));
        const curY = Math.max(0, Math.min(docHeight, y));
        const startX = cropStartRef.current.canvasX;
        const startY = cropStartRef.current.canvasY;

        let left = Math.min(startX, curX);
        let top = Math.min(startY, curY);
        let width = Math.max(20, Math.abs(curX - startX));
        let height = Math.max(20, Math.abs(curY - startY));

        if (cropAspect) {
          height = width / cropAspect;
        }

        onUpdateCropBox({
          x: Math.round(left),
          y: Math.round(top),
          width: Math.round(width),
          height: Math.round(height),
        });
      } else {
        let newX = start.x;
        let newY = start.y;
        let newW = start.width;
        let newH = start.height;

        if (cropHandle.includes("e")) {
          newW = Math.max(20, start.width + dx);
        }
        if (cropHandle.includes("w")) {
          const maxLeft = start.x + start.width - 20;
          newX = Math.min(maxLeft, Math.max(0, start.x + dx));
          newW = start.width - (newX - start.x);
        }
        if (cropHandle.includes("s")) {
          newH = Math.max(20, start.height + dy);
        }
        if (cropHandle.includes("n")) {
          const maxTop = start.y + start.height - 20;
          newY = Math.min(maxTop, Math.max(0, start.y + dy));
          newH = start.height - (newY - start.y);
        }

        if (cropAspect) {
          if (cropHandle === "n" || cropHandle === "s") {
            newW = Math.round(newH * cropAspect);
          } else {
            newH = Math.round(newW / cropAspect);
          }
        }

        onUpdateCropBox({
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newW),
          height: Math.round(newH),
        });
      }
      return;
    }



    // Geometric Shape interactive drag preview on overlay canvas
    if (isDrawingShape && activeTool === "shape" && shapeDragStartRef.current && overlayCanvasRef.current) {
      shapeDragCurrentRef.current = { x, y, shiftKey: e.shiftKey };
      const oCtx = overlayCanvasRef.current.getContext("2d");
      if (oCtx) {
        oCtx.clearRect(0, 0, docWidth, docHeight);

        const startX = shapeDragStartRef.current.startX;
        const startY = shapeDragStartRef.current.startY;
        let curW = Math.abs(x - startX);
        let curH = Math.abs(y - startY);

        // Constrain to square / circle when Shift key is pressed
        if (e.shiftKey) {
          const side = Math.max(curW, curH);
          curW = side;
          curH = side;
        }

        const left = x >= startX ? startX : startX - curW;
        const top = y >= startY ? startY : startY - curH;

        if (curW > 4 && curH > 4) {
          const effectiveConfig = shapeConfig || DEFAULT_SHAPE_CONFIG;
          const rendered = renderShapeToCanvas(effectiveConfig, curW, curH);
          const strokeW = effectiveConfig.strokeWidth || 0;
          const padding = Math.ceil(strokeW / 2) + 4;

          oCtx.save();
          oCtx.globalAlpha = 0.9;
          oCtx.drawImage(rendered.canvas, left - padding, top - padding, rendered.width, rendered.height);

          // Dimension badge indicator
          oCtx.fillStyle = "rgba(12, 13, 22, 0.9)";
          oCtx.fillRect(left, top - 24 / zoom, 90 / zoom, 20 / zoom);
          oCtx.strokeStyle = "#f59e0b";
          oCtx.lineWidth = 1 / zoom;
          oCtx.strokeRect(left, top - 24 / zoom, 90 / zoom, 20 / zoom);
          oCtx.fillStyle = "#ffffff";
          oCtx.font = `bold ${11 / zoom}px sans-serif`;
          oCtx.textAlign = "center";
          oCtx.textBaseline = "middle";
          oCtx.fillText(`${Math.round(curW)} × ${Math.round(curH)}`, left + 45 / zoom, top - 14 / zoom);
          oCtx.restore();
        }
      }
    }

    // Brush Drawing & Eraser
    const isEraserActive = activeTool === "eraser" || (activeTool === "bg_remove" && bgConfig.mode === "eraser");
    if (isDrawing && (activeTool === "draw" || isEraserActive) && lastPointRef.current) {
      if (isEraserActive) {
        const isAiObject = activeTool === "eraser" && brushConfig.eraserSubMode === "ai_object";
        if (isAiObject) {
          // 1. AI Object Smart Eraser: draw visible highlight on overlay + white mask on mask canvas
          if (overlayCanvasRef.current && eraserMaskCanvasRef.current) {
            const oCtx = overlayCanvasRef.current.getContext("2d");
            const mCtx = eraserMaskCanvasRef.current.getContext("2d");
            if (oCtx && mCtx) {
              oCtx.save();
              oCtx.strokeStyle = "rgba(244, 63, 94, 0.45)";
              oCtx.lineWidth = brushConfig.size;
              oCtx.lineCap = "round";
              oCtx.lineJoin = "round";
              oCtx.beginPath();
              oCtx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
              oCtx.lineTo(x, y);
              oCtx.stroke();
              oCtx.restore();

              mCtx.save();
              mCtx.strokeStyle = "#ffffff";
              mCtx.lineWidth = brushConfig.size;
              mCtx.lineCap = "round";
              mCtx.lineJoin = "round";
              mCtx.beginPath();
              mCtx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
              mCtx.lineTo(x, y);
              mCtx.stroke();
              mCtx.restore();

              setHasInpaintMask(true);
            }
          }
          lastPointRef.current = { x, y };
          return;
        }

        // 2. Real Pixel Alpha Eraser (Transparency directly on image layer)
        const isBgEraser = activeTool === "bg_remove" && bgConfig.mode === "eraser";
        const target = isBgEraser ? "layer" : (brushConfig.eraserTarget || "both");
        const eraserRadius = isBgEraser ? bgConfig.eraserRadius : (brushConfig.size || 20) / 2;
        const eraserHardness = isBgEraser ? (bgConfig.eraserHardness ?? 80) : (brushConfig.eraserHardness ?? 80);
        const eraserOpacity = (isBgEraser ? (bgConfig.eraserOpacity ?? 100) : (brushConfig.eraserOpacity ?? 100)) / 100;

        let targetLayer = activeLayer;
        if (!targetLayer || !targetLayer.canvas || targetLayer.locked) {
          targetLayer = [...layers].reverse().find(
            (l) => l.visible && !l.locked && l.canvas && l.type !== "text" && l.type !== "adjustment"
          );
        }

        // Erase directly on Layer Canvas (Layer Pixel Erase to transparent alpha)
        if ((target === "layer" || target === "both") && targetLayer && targetLayer.canvas && !targetLayer.locked) {
          const aCtx = targetLayer.canvas.getContext("2d", { willReadFrequently: true });
          if (aCtx) {
            const scaleX = Math.abs(targetLayer.scaleX || 1);
            const scaleY = Math.abs(targetLayer.scaleY || 1);
            const rad = -((targetLayer.rotation || 0) * Math.PI) / 180;

            const w = targetLayer.width * scaleX;
            const h = targetLayer.height * scaleY;
            const cx = targetLayer.x + w / 2;
            const cy = targetLayer.y + h / 2;

            const dx1 = x - cx;
            const dy1 = y - cy;
            const rx1 = dx1 * Math.cos(rad) - dy1 * Math.sin(rad);
            const ry1 = dx1 * Math.sin(rad) + dy1 * Math.cos(rad);
            const layerX1 = (rx1 + w / 2) / scaleX;
            const layerY1 = (ry1 + h / 2) / scaleY;

            const dx0 = lastPointRef.current.x - cx;
            const dy0 = lastPointRef.current.y - cy;
            const rx0 = dx0 * Math.cos(rad) - dy0 * Math.sin(rad);
            const ry0 = dx0 * Math.sin(rad) + dy0 * Math.cos(rad);
            const layerX0 = (rx0 + w / 2) / scaleX;
            const layerY0 = (ry0 + h / 2) / scaleY;

            aCtx.save();
            aCtx.globalCompositeOperation = "destination-out";
            aCtx.globalAlpha = eraserOpacity;
            aCtx.lineWidth = Math.max(1, (eraserRadius * 2) / Math.min(scaleX, scaleY));
            aCtx.lineCap = "round";
            aCtx.lineJoin = "round";

            if (eraserHardness < 100) {
              const blur = ((100 - eraserHardness) / 100) * eraserRadius;
              aCtx.shadowBlur = blur;
              aCtx.shadowColor = "rgba(0,0,0,1)";
            }

            aCtx.beginPath();
            aCtx.moveTo(layerX0, layerY0);
            aCtx.lineTo(layerX1, layerY1);
            aCtx.stroke();
            aCtx.restore();

            renderComposite();
          }
        }

        // Erase on Overlay Canvas (Brush Strokes)
        if ((target === "overlay" || target === "both") && overlayCanvasRef.current) {
          const oCtx = overlayCanvasRef.current.getContext("2d");
          if (oCtx) {
            oCtx.save();
            oCtx.globalCompositeOperation = "destination-out";
            const opacity = (brushConfig.eraserOpacity ?? 100) / 100;
            oCtx.globalAlpha = opacity;
            oCtx.lineWidth = brushConfig.size;
            oCtx.lineCap = "round";
            oCtx.lineJoin = "round";
            oCtx.beginPath();
            oCtx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
            oCtx.lineTo(x, y);
            oCtx.stroke();
            oCtx.restore();
          }
        }

        lastPointRef.current = { x, y };
      } else if (overlayCanvasRef.current) {
        // Geometric Shape Modes in Draw Tool (Rectangle, Circle, Arrow, Line)
        const isShapeBrushMode =
          brushConfig.mode === "rectangle" ||
          brushConfig.mode === "circle" ||
          brushConfig.mode === "arrow" ||
          brushConfig.mode === "line";

        if (isShapeBrushMode && shapeBrushStartRef.current) {
          const oCtx = overlayCanvasRef.current.getContext("2d");
          if (oCtx) {
            oCtx.clearRect(0, 0, docWidth, docHeight);

            const startX = shapeBrushStartRef.current.startX;
            const startY = shapeBrushStartRef.current.startY;
            let curX = x;
            let curY = y;

            if (e.shiftKey) {
              const dx = curX - startX;
              const dy = curY - startY;
              if (brushConfig.mode === "rectangle" || brushConfig.mode === "circle") {
                const side = Math.max(Math.abs(dx), Math.abs(dy));
                curX = startX + (dx >= 0 ? side : -side);
                curY = startY + (dy >= 0 ? side : -side);
              } else if (brushConfig.mode === "line" || brushConfig.mode === "arrow") {
                const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
                const dist = Math.hypot(dx, dy);
                curX = startX + Math.cos(angle) * dist;
                curY = startY + Math.sin(angle) * dist;
              }
            }

            oCtx.save();
            oCtx.lineWidth = Math.max(1, brushConfig.size);
            oCtx.strokeStyle = brushConfig.color;
            oCtx.lineCap = "round";
            oCtx.lineJoin = "round";

            if (brushConfig.strokeDash === "dashed") {
              oCtx.setLineDash([Math.max(6, brushConfig.size * 3), Math.max(4, brushConfig.size * 2)]);
            } else if (brushConfig.strokeDash === "dotted") {
              oCtx.setLineDash([Math.max(2, brushConfig.size), Math.max(4, brushConfig.size * 1.5)]);
            } else {
              oCtx.setLineDash([]);
            }

            if (brushConfig.fillShape) {
              oCtx.fillStyle = brushConfig.fillColor || brushConfig.color + "33";
            }

            if (brushConfig.mode === "rectangle") {
              const left = Math.min(startX, curX);
              const top = Math.min(startY, curY);
              const w = Math.abs(curX - startX);
              const h = Math.abs(curY - startY);
              if (brushConfig.fillShape) oCtx.fillRect(left, top, w, h);
              oCtx.strokeRect(left, top, w, h);

              // Live dimension tooltip
              if (w > 12 && h > 12) {
                oCtx.fillStyle = "rgba(15, 23, 42, 0.85)";
                oCtx.fillRect(left, top - 20 / zoom, 70 / zoom, 16 / zoom);
                oCtx.fillStyle = "#ffffff";
                oCtx.font = `bold ${10 / zoom}px sans-serif`;
                oCtx.fillText(`${Math.round(w)}×${Math.round(h)}`, left + 4 / zoom, top - 8 / zoom);
              }
            } else if (brushConfig.mode === "circle") {
              const rx = Math.abs(curX - startX) / 2;
              const ry = Math.abs(curY - startY) / 2;
              const cx = Math.min(startX, curX) + rx;
              const cy = Math.min(startY, curY) + ry;
              oCtx.beginPath();
              oCtx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
              if (brushConfig.fillShape) oCtx.fill();
              oCtx.stroke();
            } else if (brushConfig.mode === "line") {
              oCtx.beginPath();
              oCtx.moveTo(startX, startY);
              oCtx.lineTo(curX, curY);
              oCtx.stroke();
            } else if (brushConfig.mode === "arrow") {
              oCtx.beginPath();
              oCtx.moveTo(startX, startY);
              oCtx.lineTo(curX, curY);
              oCtx.stroke();

              // Arrowhead
              const angle = Math.atan2(curY - startY, curX - startX);
              const headLen = Math.max(12, brushConfig.size * 3.5);
              oCtx.setLineDash([]);
              oCtx.beginPath();
              oCtx.moveTo(curX, curY);
              oCtx.lineTo(
                curX - headLen * Math.cos(angle - Math.PI / 6),
                curY - headLen * Math.sin(angle - Math.PI / 6)
              );
              oCtx.lineTo(
                curX - headLen * Math.cos(angle + Math.PI / 6),
                curY - headLen * Math.sin(angle + Math.PI / 6)
              );
              oCtx.closePath();
              oCtx.fillStyle = brushConfig.color;
              oCtx.fill();
            }

            oCtx.restore();
          }
        } else {
          // Freehand Brush Drawing (brush, neon, highlighter)
          const oCtx = overlayCanvasRef.current.getContext("2d");
          if (oCtx) {
            oCtx.lineWidth = brushConfig.size;
            oCtx.lineCap = "round";
            oCtx.lineJoin = "round";
            oCtx.globalCompositeOperation = "source-over";
            oCtx.strokeStyle = brushConfig.color;
            if (brushConfig.mode === "neon") {
              oCtx.shadowColor = brushConfig.color;
              oCtx.shadowBlur = brushConfig.size * 1.5;
            } else if (brushConfig.mode === "highlighter") {
              oCtx.globalAlpha = 0.4;
              oCtx.shadowBlur = 0;
            } else {
              oCtx.globalAlpha = brushConfig.opacity ?? 1;
              oCtx.shadowBlur = 0;
            }

            oCtx.beginPath();
            oCtx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
            oCtx.lineTo(x, y);
            oCtx.stroke();

            lastPointRef.current = { x, y };
          }
        }
      }
    }

    // Lasso Selection Hover / Draw tracking
    if (activeTool === "lasso") {
      let targetX = Math.round(x);
      let targetY = Math.round(y);

      // In magnetic mode, snap to the nearest strong image edge!
      if (selectionRegion.mode === "magnetic" && activeLayer) {
        const relX = (x - activeLayer.x) / (activeLayer.scaleX || 1);
        const relY = (y - activeLayer.y) / (activeLayer.scaleY || 1);
        const snapped = findMagneticEdgePoint(activeLayer.canvas, relX, relY, 15);
        targetX = Math.round(activeLayer.x + snapped.x * (activeLayer.scaleX || 1));
        targetY = Math.round(activeLayer.y + snapped.y * (activeLayer.scaleY || 1));
      }

      setLassoHoverPoint({ x: targetX, y: targetY });

      // Check if hovering near first point to close polygon
      if (!selectionRegion.isClosed && selectionRegion.points.length >= 3) {
        const first = selectionRegion.points[0];
        const distToFirst = Math.hypot(x - first.x, y - first.y);
        setIsHoveringFirstPoint(distToFirst < 16 / zoom);
      } else {
        setIsHoveringFirstPoint(false);
      }

      // If freehand lasso drawing is active, collect continuous stream of points
      if (isDrawingFreehandSelection && selectionRegion.mode === "freehand" && !selectionRegion.isClosed) {
        const pts = selectionRegion.points;
        const last = pts[pts.length - 1];
        if (!last || Math.hypot(x - last.x, y - last.y) >= 4) {
          if (onUpdateSelectionRegion) {
            onUpdateSelectionRegion({
              points: [...pts, { x: Math.round(x), y: Math.round(y) }],
            });
          }
        }
      }
    }
  };

  // Focus and select text when entering inline editing mode
  useEffect(() => {
    if (editingTextLayerId && inlineTextareaRef.current) {
      inlineTextareaRef.current.focus();
      if (inlineTextareaRef.current.value === "نص جديد") {
        inlineTextareaRef.current.select();
      }
    }
  }, [editingTextLayerId]);

  // Global Window listeners while transforming (moving, scaling, rotating) or panning to ensure silky smooth dragging anywhere on screen
  useEffect(() => {
    if (!isTransforming && !isPanning) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
        return;
      }

      if (!activeLayer) return;
      const dx = (e.clientX - transformStartRef.current.clientX) / zoom;
      const dy = (e.clientY - transformStartRef.current.clientY) / zoom;

      if (isTransforming === "move") {
        onUpdateLayerTransform({
          x: Math.round(transformStartRef.current.startX + dx),
          y: Math.round(transformStartRef.current.startY + dy),
        });
      } else if (isTransforming === "e") {
        const origW = activeLayer.width * transformStartRef.current.startScaleX;
        const newW = Math.max(10, origW + dx);
        const newScaleX = Math.max(0.05, newW / activeLayer.width);
        onUpdateLayerTransform({ scaleX: Number(newScaleX.toFixed(3)) });
      } else if (isTransforming === "w") {
        const origW = activeLayer.width * transformStartRef.current.startScaleX;
        const newW = Math.max(10, origW - dx);
        const newScaleX = Math.max(0.05, newW / activeLayer.width);
        const newX = Math.round(transformStartRef.current.startX + (origW - newW));
        onUpdateLayerTransform({
          scaleX: Number(newScaleX.toFixed(3)),
          x: newX,
        });
      } else if (isTransforming === "s") {
        const origH = activeLayer.height * transformStartRef.current.startScaleY;
        const newH = Math.max(10, origH + dy);
        const newScaleY = Math.max(0.05, newH / activeLayer.height);
        onUpdateLayerTransform({ scaleY: Number(newScaleY.toFixed(3)) });
      } else if (isTransforming === "n") {
        const origH = activeLayer.height * transformStartRef.current.startScaleY;
        const newH = Math.max(10, origH - dy);
        const newScaleY = Math.max(0.05, newH / activeLayer.height);
        const newY = Math.round(transformStartRef.current.startY + (origH - newH));
        onUpdateLayerTransform({
          scaleY: Number(newScaleY.toFixed(3)),
          y: newY,
        });
      } else if (
        isTransforming === "se" ||
        isTransforming === "sw" ||
        isTransforming === "ne" ||
        isTransforming === "nw"
      ) {
        const signX = isTransforming === "se" || isTransforming === "ne" ? 1 : -1;
        const scaleChange = 1 + (dx * signX) / (activeLayer.width / 2);
        const newScale = Math.max(
          0.05,
          Number((transformStartRef.current.startScaleX * scaleChange).toFixed(3))
        );
        onUpdateLayerTransform({ scaleX: newScale, scaleY: newScale });
      } else if (isTransforming === "rotate") {
        const { x, y } = clientToCanvasCoords(e.clientX, e.clientY);
        const centerX = activeLayer.x + (activeLayer.width * activeLayer.scaleX) / 2;
        const centerY = activeLayer.y + (activeLayer.height * activeLayer.scaleY) / 2;
        const currentAngle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
        onUpdateLayerTransform({ rotation: Math.round(currentAngle) });
      }
    };

    const handleWindowMouseUp = () => {
      setIsTransforming(null);
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isTransforming, isPanning, activeLayer, zoom, onUpdateLayerTransform]);

  // Double Click Handler (e.g. to quickly close polygon or confirm crop, or double-click to edit text)
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (activeTool === "crop" && onConfirmCrop) {
      onConfirmCrop();
      return;
    }
    if (activeTool === "lasso" && !selectionRegion.isClosed && selectionRegion.points.length >= 3) {
      if (onUpdateSelectionRegion) {
        onUpdateSelectionRegion({ isClosed: true });
        setIsHoveringFirstPoint(false);
      }
      return;
    }

    // Double-click on any text layer to activate inline on-canvas text editing
    const { x, y } = clientToCanvasCoords(e.clientX, e.clientY);
    const clickedTextLayer = [...layers].reverse().find((l) => {
      if (!l.visible || l.type !== "text") return false;
      const w = l.width * Math.abs(l.scaleX || 1);
      const h = l.height * Math.abs(l.scaleY || 1);
      return x >= l.x && x <= l.x + w && y >= l.y && y <= l.y + h;
    });

    if (clickedTextLayer) {
      if (onSelectLayer) onSelectLayer(clickedTextLayer.id);
      if (onSetEditingTextLayerId) onSetEditingTextLayerId(clickedTextLayer.id);
      return;
    }
  };

  // Mouse Down handler
  const handleMouseDown = (e: React.MouseEvent) => {
    // Spacebar or middle click -> Pan
    if (e.button === 1 || e.spaceKey || e.altKey) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    const { x, y } = clientToCanvasCoords(e.clientX, e.clientY);

    // Click outside document canvas bounds (in the workspace viewport background) -> deselect
    const isOutsideDoc = x < 0 || x > docWidth || y < 0 || y > docHeight;
    if (isOutsideDoc) {
      if (editingTextLayerId && onSetEditingTextLayerId) {
        onSetEditingTextLayerId(null);
      }
      if (onDeselectLayer) {
        onDeselectLayer();
      }
      return;
    }

    // Text Tool: Click handling
    if (activeTool === "text") {
      // 1. Check if clicked an existing text layer
      const clickedTextLayer = [...layers].reverse().find((l) => {
        if (!l.visible) return false;
        const w = l.width * Math.abs(l.scaleX || 1);
        const h = l.height * Math.abs(l.scaleY || 1);
        return x >= l.x && x <= l.x + w && y >= l.y && y <= l.y + h;
      });

      if (clickedTextLayer && clickedTextLayer.type === "text") {
        if (onSelectLayer) onSelectLayer(clickedTextLayer.id);
        setIsTransforming("move");
        transformStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          startX: clickedTextLayer.x,
          startY: clickedTextLayer.y,
          startScaleX: clickedTextLayer.scaleX || 1,
          startScaleY: clickedTextLayer.scaleY || 1,
          startRotation: clickedTextLayer.rotation || 0,
        };
        return;
      }

      // If clicked outside the text layer or on empty space while a text layer was active/editing:
      // Instantly remove the selection frame and close inline editing!
      if (activeLayerId || editingTextLayerId) {
        if (onSetEditingTextLayerId) onSetEditingTextLayerId(null);
        if (onDeselectLayer) onDeselectLayer();
        return;
      }

      // Only if NO text layer is currently selected, clicking empty space creates a new text layer
      if (onAddTextLayer) {
        onAddTextLayer("نص جديد", 36, "#ffffff", Math.round(x), Math.round(y));
      }
      return;
    }

    // Geometric Shape Tool: Drag to draw interactive shape
    if (activeTool === "shape") {
      // 1. Check if clicked an existing shape layer to select and move it
      const clickedShape = [...layers].reverse().find((l) => {
        if (!l.visible || l.type !== "shape" || l.locked) return false;
        const w = l.width * Math.abs(l.scaleX || 1);
        const h = l.height * Math.abs(l.scaleY || 1);
        const cx = l.x + w / 2;
        const cy = l.y + h / 2;
        const dx = x - cx;
        const dy = y - cy;
        const rad = -((l.rotation || 0) * Math.PI) / 180;
        const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad);
        return Math.abs(rotatedX) <= w / 2 && Math.abs(rotatedY) <= h / 2;
      });

      if (clickedShape) {
        if (onSelectLayer) onSelectLayer(clickedShape.id);
        setIsTransforming("move");
        transformStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          startX: clickedShape.x,
          startY: clickedShape.y,
          startScaleX: clickedShape.scaleX || 1,
          startScaleY: clickedShape.scaleY || 1,
          startRotation: clickedShape.rotation || 0,
        };
        return;
      }

      // If clicked on empty space, start drawing a new shape via mouse drag!
      setIsDrawingShape(true);
      shapeDragStartRef.current = {
        startX: Math.round(x),
        startY: Math.round(y),
        clientX: e.clientX,
        clientY: e.clientY,
      };
      shapeDragCurrentRef.current = {
        x: Math.round(x),
        y: Math.round(y),
        shiftKey: e.shiftKey,
      };
      return;
    }

    // Crop Tool Handle or Canvas Click: Start new crop box if dragging outside existing box
    if (activeTool === "crop") {
      if (cropBox) {
        if (
          x >= cropBox.x &&
          x <= cropBox.x + cropBox.width &&
          y >= cropBox.y &&
          y <= cropBox.y + cropBox.height
        ) {
          setCropHandle("move");
          cropStartRef.current = {
            clientX: e.clientX,
            clientY: e.clientY,
            canvasX: cropBox.x,
            canvasY: cropBox.y,
            startBox: { ...cropBox },
          };
          return;
        }
      }

      setCropHandle("new");
      cropStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        canvasX: Math.round(x),
        canvasY: Math.round(y),
        startBox: cropBox ? { ...cropBox } : { x: Math.round(x), y: Math.round(y), width: 0, height: 0 },
      };
      return;
    }

    // Lasso Selection Click handling
    if (activeTool === "lasso") {
      let targetPoint = { x: Math.round(x), y: Math.round(y) };
      if (selectionRegion.mode === "magnetic" && activeLayer) {
        const relX = (x - activeLayer.x) / (activeLayer.scaleX || 1);
        const relY = (y - activeLayer.y) / (activeLayer.scaleY || 1);
        const snapped = findMagneticEdgePoint(activeLayer.canvas, relX, relY, 15);
        targetPoint = {
          x: Math.round(activeLayer.x + snapped.x * (activeLayer.scaleX || 1)),
          y: Math.round(activeLayer.y + snapped.y * (activeLayer.scaleY || 1)),
        };
      }

      if (selectionRegion.isClosed) {
        // Clicking starts a new selection when already closed
        if (selectionRegion.mode === "freehand") {
          setIsDrawingFreehandSelection(true);
        }
        if (onUpdateSelectionRegion) {
          onUpdateSelectionRegion({
            points: [targetPoint],
            isClosed: false,
          });
        }
        return;
      }

      // If clicking near first point, close polygon!
      if (selectionRegion.points.length >= 3) {
        const first = selectionRegion.points[0];
        const dist = Math.hypot(x - first.x, y - first.y);
        if (dist < 16 / zoom) {
          if (onUpdateSelectionRegion) {
            onUpdateSelectionRegion({ isClosed: true });
            setIsHoveringFirstPoint(false);
          }
          return;
        }
      }

      if (selectionRegion.mode === "freehand") {
        setIsDrawingFreehandSelection(true);
        if (onUpdateSelectionRegion) {
          onUpdateSelectionRegion({
            points: [targetPoint],
            isClosed: false,
          });
        }
      } else {
        // polygon or magnetic
        if (onUpdateSelectionRegion) {
          onUpdateSelectionRegion({
            points: [...selectionRegion.points, targetPoint],
          });
        }
      }
      return;
    }

    // Split view handle check
    if (splitView && Math.abs(x - docWidth * splitPos) < 15 / zoom) {
      setIsDraggingSplit(true);
      return;
    }

    // Magic Wand / Chroma click
    if (activeTool === "bg_remove" && bgConfig.mode === "magic_wand" && onCanvasClickChroma) {
      let r = 255, g = 255, b = 255;
      if (mainCanvasRef.current) {
        try {
          const ctx = mainCanvasRef.current.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            const px = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
            r = px[0];
            g = px[1];
            b = px[2];
          }
        } catch {
          if (pixelProbe) {
            r = pixelProbe.r;
            g = pixelProbe.g;
            b = pixelProbe.b;
          }
        }
      } else if (pixelProbe) {
        r = pixelProbe.r;
        g = pixelProbe.g;
        b = pixelProbe.b;
      }
      onCanvasClickChroma(
        { r, g, b },
        Math.floor(x),
        Math.floor(y)
      );
      return;
    }

    // AI Click Smart background removal directly by clicking on canvas
    if (activeTool === "bg_remove" && bgConfig.mode === "ai_click" && onCanvasClickAiSmart) {
      onCanvasClickAiSmart(Math.floor(x), Math.floor(y));
      return;
    }

    // Studio Preset Background Removal (White, Green, Black) directly on click
    if (
      activeTool === "bg_remove" &&
      (bgConfig.mode === "preset_white" || bgConfig.mode === "preset_green" || bgConfig.mode === "preset_black") &&
      onApplyBgRemoval
    ) {
      onApplyBgRemoval();
      return;
    }

    const isEraserTool = activeTool === "eraser" || (activeTool === "bg_remove" && bgConfig.mode === "eraser");

    // Drawing start (Brush or Eraser)
    if ((activeTool === "draw" || isEraserTool) && overlayCanvasRef.current) {
      if (isEraserTool && onSaveHistorySnapshot) {
        onSaveHistorySnapshot();
      }
      setIsDrawing(true);
      lastPointRef.current = { x, y };
      shapeBrushStartRef.current = { startX: x, startY: y };

      // Immediate single-click dot erase for eraser
      if (isEraserTool) {
        if (activeTool === "eraser" && brushConfig.eraserSubMode === "ai_object") {
          // Initialize AI mask canvas
          if (!eraserMaskCanvasRef.current) {
            eraserMaskCanvasRef.current = document.createElement("canvas");
            eraserMaskCanvasRef.current.width = docWidth;
            eraserMaskCanvasRef.current.height = docHeight;
          } else if (
            eraserMaskCanvasRef.current.width !== docWidth ||
            eraserMaskCanvasRef.current.height !== docHeight
          ) {
            eraserMaskCanvasRef.current.width = docWidth;
            eraserMaskCanvasRef.current.height = docHeight;
          }

          // If starting a brand-new mask stroke (no active inpaint mask pending), reset cleanly
          if (!hasInpaintMask) {
            const mCtx = eraserMaskCanvasRef.current.getContext("2d");
            mCtx?.clearRect(0, 0, docWidth, docHeight);
          }

          // Draw single dab on overlay and mask
          const oCtx = overlayCanvasRef.current.getContext("2d");
          const mCtx = eraserMaskCanvasRef.current.getContext("2d");
          if (oCtx && mCtx) {
            oCtx.save();
            oCtx.fillStyle = "rgba(244, 63, 94, 0.45)";
            oCtx.beginPath();
            oCtx.arc(x, y, brushConfig.size / 2, 0, Math.PI * 2);
            oCtx.fill();
            oCtx.restore();

            mCtx.save();
            mCtx.fillStyle = "#ffffff";
            mCtx.beginPath();
            mCtx.arc(x, y, brushConfig.size / 2, 0, Math.PI * 2);
            mCtx.fill();
            mCtx.restore();

            setHasInpaintMask(true);
          }
          return;
        }

        // Real Pixel Alpha Eraser
        const isBgEraser = activeTool === "bg_remove" && bgConfig.mode === "eraser";
        const target = isBgEraser ? "layer" : (brushConfig.eraserTarget || "both");
        const eraserRadius = isBgEraser ? bgConfig.eraserRadius : (brushConfig.size || 20) / 2;
        const eraserHardness = isBgEraser ? (bgConfig.eraserHardness ?? 80) : (brushConfig.eraserHardness ?? 80);
        const eraserOpacity = (isBgEraser ? (bgConfig.eraserOpacity ?? 100) : (brushConfig.eraserOpacity ?? 100)) / 100;

        let targetLayer = activeLayer;
        if (!targetLayer || !targetLayer.canvas || targetLayer.locked) {
          targetLayer = [...layers].reverse().find(
            (l) => l.visible && !l.locked && l.canvas && l.type !== "text" && l.type !== "adjustment"
          );
          if (targetLayer && onSelectLayer) {
            onSelectLayer(targetLayer.id);
          }
        }

        if ((target === "layer" || target === "both") && targetLayer && targetLayer.canvas && !targetLayer.locked) {
          const aCtx = targetLayer.canvas.getContext("2d", { willReadFrequently: true });
          if (aCtx) {
            const scaleX = Math.abs(targetLayer.scaleX || 1);
            const scaleY = Math.abs(targetLayer.scaleY || 1);
            const rad = -((targetLayer.rotation || 0) * Math.PI) / 180;
            const w = targetLayer.width * scaleX;
            const h = targetLayer.height * scaleY;
            const cx = targetLayer.x + w / 2;
            const cy = targetLayer.y + h / 2;

            const dx = x - cx;
            const dy = y - cy;
            const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
            const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
            const layerX = (rx + w / 2) / scaleX;
            const layerY = (ry + h / 2) / scaleY;

            aCtx.save();
            aCtx.globalCompositeOperation = "destination-out";
            aCtx.globalAlpha = eraserOpacity;
            const radius = Math.max(0.5, eraserRadius / Math.min(scaleX, scaleY));
            if (eraserHardness < 100) {
              const blur = ((100 - eraserHardness) / 100) * radius;
              aCtx.shadowBlur = blur;
              aCtx.shadowColor = "rgba(0,0,0,1)";
            }
            aCtx.beginPath();
            aCtx.arc(layerX, layerY, radius, 0, Math.PI * 2);
            aCtx.fill();
            aCtx.restore();
            renderComposite();
          }
        }
        if (!isBgEraser && (target === "overlay" || target === "both") && overlayCanvasRef.current) {
          const oCtx = overlayCanvasRef.current.getContext("2d");
          if (oCtx) {
            oCtx.save();
            oCtx.globalCompositeOperation = "destination-out";
            const opacity = (brushConfig.eraserOpacity ?? 100) / 100;
            oCtx.globalAlpha = opacity;
            oCtx.beginPath();
            oCtx.arc(x, y, (brushConfig.size || 20) / 2, 0, Math.PI * 2);
            oCtx.fill();
            oCtx.restore();
          }
        }
      }
      return;
    }

    // Layer Selection & Deselection (Universal behavior across all tools except draw/eraser/crop/lasso)
    const activeCanvasDrawingTools: ToolType[] = ["draw", "eraser", "crop", "lasso"];
    const isDrawingOrErasingTool = activeCanvasDrawingTools.includes(activeTool) || (activeTool === "bg_remove" && bgConfig.mode === "eraser");
    if (!isDrawingOrErasingTool && activeTool !== "text") {
      const hitLayer = [...layers].reverse().find((l) => {
        if (!l.visible || l.locked) return false;
        const w = l.width * Math.abs(l.scaleX || 1);
        const h = l.height * Math.abs(l.scaleY || 1);
        const cx = l.x + w / 2;
        const cy = l.y + h / 2;
        const dx = x - cx;
        const dy = y - cy;
        const rad = -((l.rotation || 0) * Math.PI) / 180;
        const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad);
        return Math.abs(rotatedX) <= w / 2 && Math.abs(rotatedY) <= h / 2;
      });

      if (hitLayer) {
        if (hitLayer.id !== activeLayerId && onSelectLayer) {
          onSelectLayer(hitLayer.id);
        }
        if (onSaveHistorySnapshot) {
          onSaveHistorySnapshot();
        }
        setIsTransforming("move");
        transformStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          startX: hitLayer.x,
          startY: hitLayer.y,
          startScaleX: hitLayer.scaleX || 1,
          startScaleY: hitLayer.scaleY || 1,
          startRotation: hitLayer.rotation || 0,
        };
        return;
      } else {
        // Clicked on empty canvas space -> deselect layer and dismiss text editing
        if (editingTextLayerId && onSetEditingTextLayerId) {
          onSetEditingTextLayerId(null);
        }
        if (onDeselectLayer) {
          onDeselectLayer();
        }
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setIsDraggingSplit(false);
    setIsTransforming(null);
    setCropHandle(null);

    // If finished drawing freehand selection
    if (isDrawingFreehandSelection) {
      setIsDrawingFreehandSelection(false);
      if (selectionRegion.points.length >= 3 && onUpdateSelectionRegion) {
        onUpdateSelectionRegion({ isClosed: true });
      }
    }

    // If committed a drawn shape
    if (isDrawingShape && activeTool === "shape" && shapeDragStartRef.current) {
      setIsDrawingShape(false);
      if (overlayCanvasRef.current) {
        const oCtx = overlayCanvasRef.current.getContext("2d");
        oCtx?.clearRect(0, 0, docWidth, docHeight);
      }

      const startX = shapeDragStartRef.current.startX;
      const startY = shapeDragStartRef.current.startY;
      const current = shapeDragCurrentRef.current || { x: startX, y: startY, shiftKey: false };
      let curW = Math.abs(current.x - startX);
      let curH = Math.abs(current.y - startY);

      if (current.shiftKey) {
        const side = Math.max(curW, curH);
        curW = side;
        curH = side;
      }

      shapeDragStartRef.current = null;
      shapeDragCurrentRef.current = null;

      if (curW < 10 && curH < 10) {
        // User clicked without dragging -> insert standard default shape at click center
        if (onAddShapeLayer) {
          onAddShapeLayer(shapeConfig, 200, 140, Math.round(startX - 100), Math.round(startY - 70));
        }
      } else {
        const left = current.x >= startX ? startX : startX - curW;
        const top = current.y >= startY ? startY : startY - curH;
        if (onAddShapeLayer) {
          onAddShapeLayer(shapeConfig, Math.round(curW), Math.round(curH), Math.round(left), Math.round(top));
        }
      }
    }

    if (isDrawing) {
      setIsDrawing(false);
      lastPointRef.current = null;
      shapeBrushStartRef.current = null;

      if (activeTool === "eraser" && brushConfig.eraserSubMode === "ai_object") {
        const autoInpaint = brushConfig.autoInpaintOnRelease ?? true;
        if (autoInpaint && eraserMaskCanvasRef.current && onApplyInpaint) {
          onApplyInpaint(eraserMaskCanvasRef.current);
        }
        return;
      }

      if (overlayCanvasRef.current && onDrawingStrokeComplete) {
        onDrawingStrokeComplete(overlayCanvasRef.current);
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const hasFiles = e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
    if (hasFiles) {
      dragCounterRef.current += 1;
      setIsDraggingFile(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
    const hasFiles = e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
    if (hasFiles && !isDraggingFile) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDraggingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const allFiles = Array.from(e.dataTransfer.files) as File[];
      const files = allFiles.filter(
        (f) =>
          f.type.startsWith("image/") ||
          /\.(png|jpe?g|webp|bmp|svg|gif|avif|ico|tiff|heic)$/i.test(f.name)
      );
      if (files.length > 0) {
        if (onUploadFiles) {
          onUploadFiles(files);
        } else if (onUploadImage) {
          onUploadImage(files[0]);
        }
      }
    }
  };

  return (
    <div
      id="vision-studio-workspace-wrapper"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 h-full flex flex-col relative overflow-hidden bg-[#080910] transition-colors ${
        isDraggingFile ? "ring-2 ring-inset ring-purple-500/80" : ""
      }`}
    >
      {/* Upper Area: Canvas Viewport + Vertical Scrollbar */}
      <div className="flex-1 flex flex-row relative overflow-hidden w-full h-full">
        {/* The Central Canvas Viewport */}
        <main
          id="vision-studio-canvas-workspace"
          ref={containerRef}
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            handleMouseUp();
            setEraserCursorPos(null);
          }}
          onMouseEnter={(e) => {
            const isEraser = activeTool === "eraser" || (activeTool === "bg_remove" && bgConfig.mode === "eraser");
            if (isEraser) {
              setEraserCursorPos({ clientX: e.clientX, clientY: e.clientY });
            }
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 h-full bg-[#080910] relative overflow-hidden flex items-center justify-center ${
            activeTool === "eraser" || (activeTool === "bg_remove" && bgConfig.mode === "eraser")
              ? "cursor-none"
              : activeTool === "text"
              ? "cursor-text"
              : "cursor-crosshair"
          } select-none`}
          style={{
            backgroundImage: `
              linear-gradient(45deg, #11121d 25%, transparent 25%), 
              linear-gradient(-45deg, #11121d 25%, transparent 25%), 
              linear-gradient(45deg, transparent 75%, #11121d 75%), 
              linear-gradient(-45deg, transparent 75%, #11121d 75%)
            `,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
        >
      {/* Canvas Viewport Stage */}
      <div
        className={`absolute top-0 left-0 origin-top-left shadow-2xl ${isPanning ? "cursor-grabbing transition-none" : "transition-transform duration-75 ease-out"}`}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: `${docWidth}px`,
          height: `${docHeight}px`,
        }}
      >
        {/* Main Composite Canvas */}
        <canvas
          id="main-vision-canvas"
          ref={mainCanvasRef}
          width={docWidth}
          height={docHeight}
          className="absolute inset-0 block rounded shadow-2xl border border-purple-500/20"
        />

        {/* Freehand Drawing Overlay Canvas */}
        <canvas
          id="drawing-overlay-canvas"
          ref={overlayCanvasRef}
          width={docWidth}
          height={docHeight}
          className="absolute inset-0 pointer-events-none"
        />

        {/* ========================================================= */}
        {/* Live On-Canvas Direct Text Box Editing Overlay             */}
        {/* ========================================================= */}
        {editingTextLayerId && (() => {
          const editLayer = layers.find((l) => l.id === editingTextLayerId);
          if (!editLayer || editLayer.type !== "text") return null;

          const renderedW = Math.max(180, editLayer.width * Math.abs(editLayer.scaleX || 1));
          const renderedH = Math.max(48, editLayer.height * Math.abs(editLayer.scaleY || 1));

          // Drag handler for moving the text box live while typing
          const handleDragStart = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (onSelectLayer && activeLayerId !== editLayer.id) {
              onSelectLayer(editLayer.id);
            }
            setIsTransforming("move");
            transformStartRef.current = {
              clientX: e.clientX,
              clientY: e.clientY,
              startX: editLayer.x,
              startY: editLayer.y,
              startScaleX: editLayer.scaleX || 1,
              startScaleY: editLayer.scaleY || 1,
              startRotation: editLayer.rotation || 0,
            };
          };

          return (
            <div
              key={editLayer.id}
              className="absolute z-50 pointer-events-auto select-auto"
              style={{
                left: `${editLayer.x}px`,
                top: `${editLayer.y}px`,
                width: `${renderedW}px`,
                minHeight: `${renderedH}px`,
                transform: `rotate(${editLayer.rotation || 0}deg)`,
                transformOrigin: "center center",
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Floating quick typography bar above text box */}
              <div
                className="absolute -top-11 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 bg-[#0c0e1a]/95 border border-purple-500/60 shadow-2xl rounded-xl text-xs text-white backdrop-blur-xl whitespace-nowrap z-50 pointer-events-auto select-none ring-1 ring-black/40"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <span className="text-[10px] text-purple-300 font-bold">الحجم:</span>
                <button
                  type="button"
                  onClick={() => {
                    const currentSize = editLayer.textConfig?.fontSize || 36;
                    onUpdateTextLayer?.(editLayer.id, { fontSize: Math.max(12, currentSize - 4) });
                  }}
                  className="w-5 h-5 rounded bg-slate-800 hover:bg-purple-700 flex items-center justify-center font-bold text-xs active:scale-95 transition-all text-slate-200"
                  title="تصغير الخط"
                >
                  -
                </button>
                <span className="font-mono text-purple-300 font-bold min-w-[28px] text-center text-xs">
                  {editLayer.textConfig?.fontSize || 36}px
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const currentSize = editLayer.textConfig?.fontSize || 36;
                    onUpdateTextLayer?.(editLayer.id, { fontSize: Math.min(160, currentSize + 4) });
                  }}
                  className="w-5 h-5 rounded bg-slate-800 hover:bg-purple-700 flex items-center justify-center font-bold text-xs active:scale-95 transition-all text-slate-200"
                  title="تكبير الخط"
                >
                  +
                </button>
                <div className="w-[1px] h-3.5 bg-slate-700 mx-1" />
                <input
                  type="color"
                  value={editLayer.textConfig?.color || "#ffffff"}
                  onChange={(e) => {
                    onUpdateTextLayer?.(editLayer.id, { color: e.target.value });
                  }}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                  title="لون النص"
                />
                <div className="w-[1px] h-3.5 bg-slate-700 mx-1" />
                <button
                  type="button"
                  onClick={() => {
                    onSetEditingTextLayerId?.(null);
                  }}
                  className="px-2.5 py-0.5 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-[11px] flex items-center gap-1 shadow active:scale-95 transition-all cursor-pointer"
                  title="إنهاء التحرير (Escape)"
                >
                  <Check className="w-3 h-3" />
                  <span>تم</span>
                </button>
              </div>

              {/* Clean, distraction-free text frame (Draggable from the frame border) */}
              <div
                onMouseDown={handleDragStart}
                className="relative w-full h-full p-1 rounded-lg border-2 border-dashed border-purple-400 bg-transparent hover:border-purple-300 cursor-move transition-colors"
                title="انقر واسحب من إطار الصندوق لتحريك موضع النص"
              >
                {/* Directly editable on-canvas textarea with zero clutter */}
                <textarea
                  ref={inlineTextareaRef}
                  value={editLayer.textConfig?.text ?? editLayer.name.replace(/^نص:\s*"/, "").replace(/"$/, "")}
                  onChange={(e) => {
                    onUpdateTextLayer?.(editLayer.id, { text: e.target.value });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      onSetEditingTextLayerId?.(null);
                    }
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  autoFocus
                  dir="auto"
                  rows={Math.max(1, (editLayer.textConfig?.text || "").split("\n").length)}
                  style={{
                    fontSize: `${(editLayer.textConfig?.fontSize || 36) * Math.abs(editLayer.scaleX || 1)}px`,
                    color: editLayer.textConfig?.color || "#ffffff",
                    fontFamily: editLayer.textConfig?.fontFamily || "'Cairo', 'Tajawal', 'Outfit', sans-serif",
                    fontWeight: editLayer.textConfig?.fontWeight || "bold",
                    textAlign: editLayer.textConfig?.textAlign || "center",
                    lineHeight: 1.35,
                  }}
                  className="w-full h-full bg-transparent p-1 focus:outline-none focus:ring-0 resize-none overflow-hidden cursor-text select-text"
                />
              </div>
            </div>
          );
        })()}

        {/* ========================================================= */}
        {/* Selection & Free Transform Bounding Box, Handles          */}
        {/* ========================================================= */}
        {activeLayer &&
          editingTextLayerId !== activeLayer.id &&
          activeTool !== "crop" &&
          activeTool !== "draw" &&
          activeTool !== "eraser" &&
          activeTool !== "lasso" && (
          <div
            className="absolute border-2 border-dashed border-purple-500 select-none z-20 pointer-events-none shadow-[0_0_15px_rgba(168,85,247,0.35)]"
            style={{
              left: `${activeLayer.x}px`,
              top: `${activeLayer.y}px`,
              width: `${activeLayer.width * Math.abs(activeLayer.scaleX || 1)}px`,
              height: `${activeLayer.height * Math.abs(activeLayer.scaleY || 1)}px`,
              transform: `rotate(${activeLayer.rotation || 0}deg)`,
              transformOrigin: "center center",
            }}
          >
            {/* Top Selection Info Badge */}
            <div
              className="absolute -top-7 right-0 px-2 py-0.5 rounded bg-purple-950/95 border border-purple-500/50 text-[10px] font-bold text-purple-200 flex items-center gap-1.5 shadow-lg pointer-events-none backdrop-blur-md whitespace-nowrap"
              dir="rtl"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="max-w-[130px] truncate">{activeLayer.name}</span>
              <span className="font-mono text-purple-300 text-[9px]">
                ({Math.round(activeLayer.width * Math.abs(activeLayer.scaleX || 1))} × {Math.round(activeLayer.height * Math.abs(activeLayer.scaleY || 1))} px)
              </span>
            </div>

            {/* Draggable Interior Move Area (Completely transparent to never alter text color!) */}
            <div
              onDoubleClick={(e) => {
                if (activeLayer.type === "text") {
                  e.stopPropagation();
                  onSetEditingTextLayerId?.(activeLayer.id);
                }
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                if (onSaveHistorySnapshot) {
                  onSaveHistorySnapshot();
                }
                setIsTransforming("move");
                transformStartRef.current = {
                  clientX: e.clientX,
                  clientY: e.clientY,
                  startX: activeLayer.x,
                  startY: activeLayer.y,
                  startScaleX: activeLayer.scaleX,
                  startScaleY: activeLayer.scaleY,
                  startRotation: activeLayer.rotation,
                };
              }}
              className="absolute inset-0 cursor-move pointer-events-auto bg-transparent"
              title={activeLayer.type === "text" ? "انقر مرتين للتحرير والكتابة مباشرة أو اسحب للتحريك" : "انقر واسحب لتحريك موضع الصورة بحرية داخل اللوحة"}
            />

            {/* Corner Handles (Proportional / Corner Scaling) */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                if (onSaveHistorySnapshot) onSaveHistorySnapshot();
                setIsTransforming("nw");
                transformStartRef.current = {
                  clientX: e.clientX,
                  clientY: e.clientY,
                  startX: activeLayer.x,
                  startY: activeLayer.y,
                  startScaleX: activeLayer.scaleX,
                  startScaleY: activeLayer.scaleY,
                  startRotation: activeLayer.rotation,
                };
              }}
              className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-purple-600 rounded-sm cursor-nwse-resize pointer-events-auto shadow-md hover:scale-125 transition-transform"
              title="سحب الزاوية لتكبير/تصغير متناسق"
            />
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                if (onSaveHistorySnapshot) onSaveHistorySnapshot();
                setIsTransforming("ne");
                transformStartRef.current = {
                  clientX: e.clientX,
                  clientY: e.clientY,
                  startX: activeLayer.x,
                  startY: activeLayer.y,
                  startScaleX: activeLayer.scaleX,
                  startScaleY: activeLayer.scaleY,
                  startRotation: activeLayer.rotation,
                };
              }}
              className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-purple-600 rounded-sm cursor-nesw-resize pointer-events-auto shadow-md hover:scale-125 transition-transform"
              title="سحب الزاوية لتكبير/تصغير متناسق"
            />
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                if (onSaveHistorySnapshot) onSaveHistorySnapshot();
                setIsTransforming("sw");
                transformStartRef.current = {
                  clientX: e.clientX,
                  clientY: e.clientY,
                  startX: activeLayer.x,
                  startY: activeLayer.y,
                  startScaleX: activeLayer.scaleX,
                  startScaleY: activeLayer.scaleY,
                  startRotation: activeLayer.rotation,
                };
              }}
              className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-purple-600 rounded-sm cursor-nesw-resize pointer-events-auto shadow-md hover:scale-125 transition-transform"
              title="سحب الزاوية لتكبير/تصغير متناسق"
            />
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                if (onSaveHistorySnapshot) onSaveHistorySnapshot();
                setIsTransforming("se");
                transformStartRef.current = {
                  clientX: e.clientX,
                  clientY: e.clientY,
                  startX: activeLayer.x,
                  startY: activeLayer.y,
                  startScaleX: activeLayer.scaleX,
                  startScaleY: activeLayer.scaleY,
                  startRotation: activeLayer.rotation,
                };
              }}
              className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-purple-600 rounded-sm cursor-nwse-resize pointer-events-auto shadow-md hover:scale-125 transition-transform"
              title="سحب الزاوية لتكبير/تصغير متناسق"
            />

            {/* Edge Handles for Horizontal & Vertical Stretching (تمديد أفقي ورأسي) */}
            {/* Top Edge Handle: Stretch Height */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                if (onSaveHistorySnapshot) onSaveHistorySnapshot();
                setIsTransforming("n");
                transformStartRef.current = {
                  clientX: e.clientX,
                  clientY: e.clientY,
                  startX: activeLayer.x,
                  startY: activeLayer.y,
                  startScaleX: activeLayer.scaleX,
                  startScaleY: activeLayer.scaleY,
                  startRotation: activeLayer.rotation,
                };
              }}
              className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border-2 border-purple-600 rounded-sm cursor-ns-resize pointer-events-auto shadow-md hover:bg-purple-100 hover:scale-110 transition-all flex items-center justify-center"
              title="اسحب لتمديد الارتفاع رأسياً من الأعلى"
            >
              <div className="w-2.5 h-0.5 bg-purple-600 rounded-full" />
            </div>

            {/* Bottom Edge Handle: Stretch Height */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                if (onSaveHistorySnapshot) onSaveHistorySnapshot();
                setIsTransforming("s");
                transformStartRef.current = {
                  clientX: e.clientX,
                  clientY: e.clientY,
                  startX: activeLayer.x,
                  startY: activeLayer.y,
                  startScaleX: activeLayer.scaleX,
                  startScaleY: activeLayer.scaleY,
                  startRotation: activeLayer.rotation,
                };
              }}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border-2 border-purple-600 rounded-sm cursor-ns-resize pointer-events-auto shadow-md hover:bg-purple-100 hover:scale-110 transition-all flex items-center justify-center"
              title="اسحب لتمديد الارتفاع رأسياً من الأسفل"
            >
              <div className="w-2.5 h-0.5 bg-purple-600 rounded-full" />
            </div>

            {/* Left Edge Handle: Stretch Width */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                if (onSaveHistorySnapshot) onSaveHistorySnapshot();
                setIsTransforming("w");
                transformStartRef.current = {
                  clientX: e.clientX,
                  clientY: e.clientY,
                  startX: activeLayer.x,
                  startY: activeLayer.y,
                  startScaleX: activeLayer.scaleX,
                  startScaleY: activeLayer.scaleY,
                  startRotation: activeLayer.rotation,
                };
              }}
              className="absolute top-1/2 -left-2 -translate-y-1/2 w-3 h-6 bg-white border-2 border-purple-600 rounded-sm cursor-ew-resize pointer-events-auto shadow-md hover:bg-purple-100 hover:scale-110 transition-all flex items-center justify-center"
              title="اسحب لتمديد العرض أفقياً من اليسار"
            >
              <div className="h-2.5 w-0.5 bg-purple-600 rounded-full" />
            </div>

            {/* Right Edge Handle: Stretch Width */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                if (onSaveHistorySnapshot) onSaveHistorySnapshot();
                setIsTransforming("e");
                transformStartRef.current = {
                  clientX: e.clientX,
                  clientY: e.clientY,
                  startX: activeLayer.x,
                  startY: activeLayer.y,
                  startScaleX: activeLayer.scaleX,
                  startScaleY: activeLayer.scaleY,
                  startRotation: activeLayer.rotation,
                };
              }}
              className="absolute top-1/2 -right-2 -translate-y-1/2 w-3 h-6 bg-white border-2 border-purple-600 rounded-sm cursor-ew-resize pointer-events-auto shadow-md hover:bg-purple-100 hover:scale-110 transition-all flex items-center justify-center"
              title="اسحب لتمديد العرض أفقياً من اليمين"
            >
              <div className="h-2.5 w-0.5 bg-purple-600 rounded-full" />
            </div>

            {/* Rotation Handle */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (onSaveHistorySnapshot) onSaveHistorySnapshot();
                  setIsTransforming("rotate");
                  transformStartRef.current = {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    startX: activeLayer.x,
                    startY: activeLayer.y,
                    startScaleX: activeLayer.scaleX,
                    startScaleY: activeLayer.scaleY,
                    startRotation: activeLayer.rotation,
                  };
                }}
                className="w-4 h-4 bg-purple-500 border-2 border-white rounded-full cursor-grab active:cursor-grabbing shadow-lg hover:scale-125 transition-transform"
                title="اسحب لتدوير الصورة في أي اتجاه"
              />
              <div className="w-0.5 h-3 bg-purple-400" />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* Dedicated Interactive Crop Tool Overlay (Rule of Thirds, Corner L-Brackets, Floating Bar) */}
        {/* ========================================================= */}
        {activeTool === "crop" && cropBox && (
          <>
            {/* 1. Darkened Scrim with Cutout Window */}
            <svg
              className="absolute inset-0 pointer-events-none z-30 overflow-visible"
              width={docWidth}
              height={docHeight}
              viewBox={`0 0 ${docWidth} ${docHeight}`}
            >
              <path
                d={`M 0 0 L ${docWidth} 0 L ${docWidth} ${docHeight} L 0 ${docHeight} Z M ${cropBox.x} ${cropBox.y} L ${cropBox.x} ${cropBox.y + cropBox.height} L ${cropBox.x + cropBox.width} ${cropBox.y + cropBox.height} L ${cropBox.x + cropBox.width} ${cropBox.y} Z`}
                fill="rgba(0, 0, 0, 0.65)"
                fillRule="evenodd"
              />
            </svg>

            {/* 2. Interactive Crop Rectangle & Handles */}
            <div
              className="absolute z-40 select-none border-2 border-purple-400 shadow-2xl pointer-events-auto"
              onDoubleClick={(e) => {
                e.stopPropagation();
                onConfirmCrop?.();
              }}
              style={{
                left: `${cropBox.x}px`,
                top: `${cropBox.y}px`,
                width: `${cropBox.width}px`,
                height: `${cropBox.height}px`,
              }}
            >
              {/* Rule of Thirds (3x3 Grid) */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                <div className="border-r border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div className="border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div className="border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div />
              </div>

              {/* Draggable Center Area (Pan crop region) */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setCropHandle("move");
                  cropStartRef.current = {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    canvasX: cropBox.x,
                    canvasY: cropBox.y,
                    startBox: { ...cropBox },
                  };
                }}
                className="absolute inset-0 cursor-move bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                title="انقر واسحب لتحريك كادر القص"
              />

              {/* Classic Corner L-Brackets */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setCropHandle("nw");
                  cropStartRef.current = {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    canvasX: cropBox.x,
                    canvasY: cropBox.y,
                    startBox: { ...cropBox },
                  };
                }}
                className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-white cursor-nwse-resize shadow-md hover:scale-110 transition-transform pointer-events-auto"
              />
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setCropHandle("ne");
                  cropStartRef.current = {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    canvasX: cropBox.x,
                    canvasY: cropBox.y,
                    startBox: { ...cropBox },
                  };
                }}
                className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-white cursor-nesw-resize shadow-md hover:scale-110 transition-transform pointer-events-auto"
              />
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setCropHandle("sw");
                  cropStartRef.current = {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    canvasX: cropBox.x,
                    canvasY: cropBox.y,
                    startBox: { ...cropBox },
                  };
                }}
                className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-white cursor-nesw-resize shadow-md hover:scale-110 transition-transform pointer-events-auto"
              />
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setCropHandle("se");
                  cropStartRef.current = {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    canvasX: cropBox.x,
                    canvasY: cropBox.y,
                    startBox: { ...cropBox },
                  };
                }}
                className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-white cursor-nwse-resize shadow-md hover:scale-110 transition-transform pointer-events-auto"
              />

              {/* Edge Handles */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setCropHandle("n");
                  cropStartRef.current = {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    canvasX: cropBox.x,
                    canvasY: cropBox.y,
                    startBox: { ...cropBox },
                  };
                }}
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-2 bg-white rounded-full border border-slate-900 cursor-ns-resize shadow-sm hover:scale-110 transition-transform pointer-events-auto"
              />
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setCropHandle("s");
                  cropStartRef.current = {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    canvasX: cropBox.x,
                    canvasY: cropBox.y,
                    startBox: { ...cropBox },
                  };
                }}
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-2 bg-white rounded-full border border-slate-900 cursor-ns-resize shadow-sm hover:scale-110 transition-transform pointer-events-auto"
              />
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setCropHandle("w");
                  cropStartRef.current = {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    canvasX: cropBox.x,
                    canvasY: cropBox.y,
                    startBox: { ...cropBox },
                  };
                }}
                className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-8 w-2 bg-white rounded-full border border-slate-900 cursor-ew-resize shadow-sm hover:scale-110 transition-transform pointer-events-auto"
              />
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setCropHandle("e");
                  cropStartRef.current = {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    canvasX: cropBox.x,
                    canvasY: cropBox.y,
                    startBox: { ...cropBox },
                  };
                }}
                className="absolute -right-1.5 top-1/2 -translate-y-1/2 h-8 w-2 bg-white rounded-full border border-slate-900 cursor-ew-resize shadow-sm hover:scale-110 transition-transform pointer-events-auto"
              />

              {/* Floating Action Pill */}
              <div
                className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/95 border border-purple-500/50 shadow-2xl backdrop-blur-md z-50 text-xs select-none pointer-events-auto whitespace-nowrap"
                style={{
                  top: cropBox.y + cropBox.height + 48 > docHeight ? "auto" : "calc(100% + 12px)",
                  bottom: cropBox.y + cropBox.height + 48 > docHeight ? "12px" : "auto",
                }}
              >
                <span className="font-mono text-[11px] text-purple-300 font-bold px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-800/40">
                  {Math.round(cropBox.width)} × {Math.round(cropBox.height)} px
                </span>
                {onConfirmCrop && (
                  <PanelButton
                    type="button"
                    onClick={onConfirmCrop}
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-md shadow-emerald-900/40 active:scale-95 transition-all cursor-pointer"
                    title="تأكيد وتطبيق القص (Enter)"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>تطبيق القص</span>
                  </PanelButton>
                )}
                {onCancelCrop && (
                  <PanelButton
                    type="button"
                    onClick={onCancelCrop}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="إلغاء القص (Esc)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </PanelButton>
                )}
              </div>
            </div>
          </>
        )}

        {/* Split View Labels on Canvas */}
        {splitView && originalCanvas && (
          <div className="absolute inset-0 pointer-events-none flex justify-between p-3 z-10 text-[11px] font-bold">
            <span className="px-2 py-1 rounded bg-black/60 backdrop-blur-md text-purple-300 border border-purple-500/30">
              الأصلية (قبل)
            </span>
            <span className="px-2 py-1 rounded bg-black/60 backdrop-blur-md text-emerald-300 border border-emerald-500/30">
              المعالجة (بعد)
            </span>
          </div>
        )}

        {/* ========================================================= */}
        {/* AI Computer Vision Bounding Boxes Overlay */}
        {/* ========================================================= */}
        {showBoundingBoxes && detectedObjects.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {detectedObjects.map((obj, i) => {
              const [ymin, xmin, ymax, xmax] = obj.box2d;
              const top = (ymin / 1000) * docHeight;
              const left = (xmin / 1000) * docWidth;
              const width = ((xmax - xmin) / 1000) * docWidth;
              const height = ((ymax - ymin) / 1000) * docHeight;

              return (
                <div
                  key={i}
                  className="absolute border-2 rounded"
                  style={{
                    top: `${top}px`,
                    left: `${left}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                    borderColor: obj.colorHex || "#a855f7",
                    backgroundColor: `${obj.colorHex || "#a855f7"}15`,
                  }}
                >
                  <span
                    className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white shadow-md flex items-center gap-1.5"
                    style={{ backgroundColor: obj.colorHex || "#a855f7" }}
                  >
                    <span className="font-sans font-semibold">{obj.labelAr || obj.label}</span>
                    {obj.labelAr && obj.labelAr !== obj.label && (
                      <span className="text-[9px] opacity-75 uppercase font-mono">({obj.label})</span>
                    )}
                    <span className="opacity-90 font-mono text-[9px] bg-black/30 px-1 rounded">{Math.round(obj.confidence * 100)}%</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* OCR Text Blocks Overlay */}
        {showBoundingBoxes && ocrBlocks.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {ocrBlocks.map((block, i) => {
              const [ymin, xmin, ymax, xmax] = block.box2d;
              const top = (ymin / 1000) * docHeight;
              const left = (xmin / 1000) * docWidth;
              const width = ((xmax - xmin) / 1000) * docWidth;
              const height = ((ymax - ymin) / 1000) * docHeight;

              return (
                <div
                  key={`ocr-${i}`}
                  className="absolute border border-cyan-400 bg-cyan-500/10 rounded"
                  style={{
                    top: `${top}px`,
                    left: `${left}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                  }}
                >
                  <span className="absolute -top-4 left-0 px-1 py-0.2 rounded bg-cyan-600 text-white font-mono text-[9px] truncate max-w-[140px]">
                    {block.text}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================= */}
        {/* Lasso Selection Interactive Overlay (Polygon, Magnetic, Freehand) */}
        {/* ========================================================= */}
        {(activeTool === "lasso" || selectionRegion.points.length > 0) && (
          <>
            <svg
              id="lasso-selection-svg-overlay"
              className="absolute inset-0 pointer-events-none z-30 overflow-visible"
              width={docWidth}
              height={docHeight}
              viewBox={`0 0 ${docWidth} ${docHeight}`}
            >
              {/* Closed Polygon Outline & Fill */}
              {selectionRegion.isClosed && selectionRegion.points.length >= 3 && (
                <polygon
                  points={selectionRegion.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="rgba(168, 85, 247, 0.2)"
                  stroke="#a855f7"
                  strokeWidth={2 / zoom}
                  strokeDasharray="6,4"
                  className="transition-colors"
                />
              )}

              {/* Open Polygon In-Progress Polyline */}
              {!selectionRegion.isClosed && selectionRegion.points.length > 0 && (
                <>
                  <polyline
                    points={selectionRegion.points.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth={2 / zoom}
                  />

                  {/* Rubber-band dynamic guide line to hover/magnet position */}
                  {lassoHoverPoint && selectionRegion.points.length > 0 && (
                    <line
                      x1={selectionRegion.points[selectionRegion.points.length - 1].x}
                      y1={selectionRegion.points[selectionRegion.points.length - 1].y}
                      x2={lassoHoverPoint.x}
                      y2={lassoHoverPoint.y}
                      stroke={selectionRegion.mode === "magnetic" ? "#38bdf8" : "#c084fc"}
                      strokeWidth={1.5 / zoom}
                      strokeDasharray="4,4"
                    />
                  )}
                </>
              )}

              {/* Selection Vertex Handles */}
              {selectionRegion.points.map((p, idx) => {
                const isFirst = idx === 0;
                return (
                  <g key={idx}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isFirst && isHoveringFirstPoint ? 7 / zoom : 4 / zoom}
                      fill={isFirst && isHoveringFirstPoint ? "#10b981" : "#ffffff"}
                      stroke={isFirst ? (isHoveringFirstPoint ? "#059669" : "#a855f7") : "#6b21a8"}
                      strokeWidth={1.5 / zoom}
                      className={isFirst && isHoveringFirstPoint ? "animate-pulse" : ""}
                    />
                    {isFirst && isHoveringFirstPoint && (
                      <text
                        x={p.x + 10 / zoom}
                        y={p.y - 10 / zoom}
                        fill="#10b981"
                        fontSize={11 / zoom}
                        fontWeight="bold"
                        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.8))"
                      >
                        انقر للإغلاق
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Magnetic Snap Reticle Indicator */}
              {activeTool === "lasso" &&
                selectionRegion.mode === "magnetic" &&
                lassoHoverPoint &&
                !selectionRegion.isClosed && (
                  <g transform={`translate(${lassoHoverPoint.x}, ${lassoHoverPoint.y})`}>
                    <circle
                      r={7 / zoom}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={2 / zoom}
                    />
                    <circle
                      r={2 / zoom}
                      fill="#38bdf8"
                    />
                  </g>
                )}
            </svg>

            {/* Floating Selection Action Pill when closed */}
            {selectionRegion.isClosed && selectionRegion.points.length >= 3 && (
              <div
                className="absolute z-40 flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/95 border border-purple-500/50 shadow-2xl backdrop-blur-md pointer-events-auto select-none"
                style={{
                  left: `${Math.min(...selectionRegion.points.map((p) => p.x))}px`,
                  top: `${Math.max(10, Math.min(...selectionRegion.points.map((p) => p.y)) - 42)}px`,
                }}
              >
                {onExtractSelectionAsLayer && (
                  <PanelButton
                    onClick={onExtractSelectionAsLayer}
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-md shadow-emerald-900/40 active:scale-95 transition-all"
                    title="قص المنطقة المحددة كطبقة مستقلة جديدة"
                  >
                    <Scissors className="w-3 h-3" />
                    <span>قص كطبقة</span>
                  </PanelButton>
                )}
                {onClearSelection && (
                  <PanelButton
                    onClick={onClearSelection}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition-colors"
                    title="إلغاء التحديد"
                  >
                    <X className="w-3.5 h-3.5" />
                  </PanelButton>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Instant Comparison Active Indicator */}
      {isComparingOriginal && (
        <div
          id="canvas-compare-indicator"
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 rounded-full bg-amber-500 text-slate-950 font-bold text-xs shadow-2xl shadow-amber-500/30 border border-amber-300 backdrop-blur-md animate-in fade-in slide-in-from-top-2 select-none"
        >
          <Eye className="w-4 h-4 text-slate-950" />
          <span>معاينة الصورة الأصلية (قبل التعديل)</span>
          <span className="text-[11px] font-normal opacity-90 hidden sm:inline">• كافة التعديلات محفوظة</span>
          {onToggleCompareOriginal && (
            <PanelButton
              onClick={() => onToggleCompareOriginal(false)}
              className="px-2.5 py-0.5 rounded-full bg-slate-950 text-amber-300 hover:bg-slate-900 text-[11px] font-bold transition-all mr-1 shadow-sm"
            >
              الرجوع للتعديلات
            </PanelButton>
          )}
        </div>
      )}

      {/* Floating Bottom Info Pill (Resolution, Zoom, Pixel probe) */}
      <div className="absolute bottom-3 rtl:right-3 ltr:left-3 bg-[#0c0d16]/90 backdrop-blur-md border border-slate-800/80 rounded-xl px-3 py-1.5 flex items-center gap-3 text-xs font-mono text-slate-300 shadow-xl z-20 select-none">
        <div>
          <span className="text-slate-500">المساحة: </span>
          <span className="text-purple-300 font-semibold">{docWidth} × {docHeight} بكسل</span>
        </div>
        <div className="h-3 w-px bg-slate-800" />
        <div>
          <span className="text-slate-500">التقريب: </span>
          <span className="text-indigo-300 font-semibold">{Math.round(zoom * 100)}%</span>
        </div>
        {pixelProbe && (
          <>
            <div className="h-3 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full border border-slate-700"
                style={{ backgroundColor: pixelProbe.hex }}
              />
              <span className="text-slate-400">
                س:{pixelProbe.x} ص:{pixelProbe.y}
              </span>
              <span className="text-cyan-300 font-bold">{pixelProbe.hex}</span>
            </div>
          </>
        )}
      </div>
    </main>

    {/* 2. VERTICAL SCROLLBAR (شريط سحاب رأسي بجانب مساحة العمل) */}
    <aside
      id="canvas-vertical-scrollbar"
      aria-label="شريط سحاب رأسي لمساحة العمل"
      className="w-3.5 sm:w-4 h-full bg-[#0a0b14] border-l border-slate-800/80 flex flex-col items-center select-none z-20 shrink-0"
    >
      {/* Scroll Up Button */}
      <PanelButton
        onClick={() => handleScrollStep("up")}
        title="تمرير لأعلى"
        className="w-full h-4 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
      >
        <ChevronUp className="w-3 h-3" />
      </PanelButton>

      {/* Vertical Track */}
      <div
        ref={verticalTrackRef}
        onClick={handleVerticalTrackClick}
        className="relative flex-1 w-full bg-[#0d0e19] hover:bg-[#111322] transition-colors cursor-pointer"
        title="انقر أو اسحب شريط السحاب للتمرير الرأسي"
      >
        <div
          onMouseDown={handleVerticalThumbMouseDown}
          className="absolute left-0.5 right-0.5 rounded-full bg-slate-600/80 hover:bg-slate-400 active:bg-cyan-400 shadow cursor-grab active:cursor-grabbing transition-colors"
          style={{
            top: `${thumbTopPercent}%`,
            height: `${thumbHPercent}%`,
            minHeight: "24px",
          }}
        />
      </div>

      {/* Scroll Down Button */}
      <PanelButton
        onClick={() => handleScrollStep("down")}
        title="تمرير لأسفل"
        className="w-full h-4 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
      >
        <ChevronDown className="w-3 h-3" />
      </PanelButton>
    </aside>
  </div>

  {/* 3. HORIZONTAL SCROLLBAR (شريط سحاب أفقي أسفل مساحة العمل) */}
  <footer
    id="canvas-horizontal-scrollbar"
    aria-label="شريط سحاب أفقي لمساحة العمل"
    className="h-3.5 sm:h-4 w-full bg-[#0a0b14] border-t border-slate-800/80 flex flex-row items-center select-none z-20 shrink-0"
  >
    {/* Scroll Left Button */}
    <PanelButton
      onClick={() => handleScrollStep("left")}
      title="تمرير لليسار"
      className="h-full w-4 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
    >
      <ChevronLeft className="w-3 h-3" />
    </PanelButton>

    {/* Horizontal Track */}
    <div
      ref={horizontalTrackRef}
      onClick={handleHorizontalTrackClick}
      className="relative flex-1 h-full bg-[#0d0e19] hover:bg-[#111322] transition-colors cursor-pointer"
      title="انقر أو اسحب شريط السحاب للتمرير الأفقي"
    >
      <div
        onMouseDown={handleHorizontalThumbMouseDown}
        className="absolute top-0.5 bottom-0.5 rounded-full bg-slate-600/80 hover:bg-slate-400 active:bg-cyan-400 shadow cursor-grab active:cursor-grabbing transition-colors"
        style={{
          left: `${thumbLeftPercent}%`,
          width: `${thumbWPercent}%`,
          minWidth: "24px",
        }}
      />
    </div>

    {/* Scroll Right Button */}
    <PanelButton
      onClick={() => handleScrollStep("right")}
      title="تمرير لليمين"
      className="h-full w-4 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
    >
      <ChevronRight className="w-3 h-3" />
    </PanelButton>

    {/* Corner Junction Button (Resets Pan/Center) */}
    <PanelButton
      onClick={handleCenterCanvas}
      title="توسيط مساحة العمل"
      className="w-3.5 sm:w-4 h-full bg-[#0a0b14] border-l border-slate-800/80 flex items-center justify-center hover:bg-slate-800 text-slate-500 hover:text-cyan-300 transition-colors"
    >
      <Move className="w-2.5 h-2.5" />
    </PanelButton>
  </footer>

  {/* Visual Drag & Drop Overlay across entire workspace */}
  {isDraggingFile && (
    <div
      id="workspace-drag-overlay"
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#080914]/85 backdrop-blur-md border-4 border-dashed border-purple-500 rounded-xl m-3 pointer-events-none animate-in fade-in zoom-in-95 duration-150 shadow-2xl"
    >
      <div className="w-20 h-20 rounded-2xl bg-purple-900/60 border border-purple-400/60 flex items-center justify-center text-purple-300 shadow-2xl shadow-purple-600/50 animate-bounce mb-4">
        <Upload className="w-10 h-10" />
      </div>
      <h3 className="text-xl sm:text-2xl font-bold text-white tracking-wide font-['Cairo',sans-serif]">
        أفلت الصورة هنا لرفعها ومعالجتها فوراً
      </h3>
      <p className="text-sm text-purple-200/90 mt-2 font-medium font-['Cairo',sans-serif]">
        يدعم جميع صيغ الصور: PNG, JPG, WebP, SVG, BMP, GIF, AVIF
      </p>
      <div className="mt-4 px-4 py-1.5 rounded-full bg-purple-950/90 border border-purple-700/70 text-xs font-mono text-purple-300">
        مساحة العمل • سيتم فتح الصورة وتجهيزها في طبقة جديدة مباشرة
      </div>
    </div>
  )}

  {/* Floating Precision Circular Eraser Cursor */}
  {(activeTool === "eraser" || (activeTool === "bg_remove" && bgConfig.mode === "eraser")) && eraserCursorPos && (
    <div
      className="pointer-events-none fixed z-50 transform -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-75 ease-out"
      style={{
        left: eraserCursorPos.clientX,
        top: eraserCursorPos.clientY,
        width: `${Math.max(6, (activeTool === "bg_remove" ? (bgConfig.eraserRadius || 25) * 2 : (brushConfig.size || 20)) * zoom)}px`,
        height: `${Math.max(6, (activeTool === "bg_remove" ? (bgConfig.eraserRadius || 25) * 2 : (brushConfig.size || 20)) * zoom)}px`,
        border:
          activeTool === "eraser" && brushConfig.eraserSubMode === "ai_object"
            ? "2px solid rgba(244, 63, 94, 0.95)"
            : "1.5px solid rgba(255, 255, 255, 0.95)",
        boxShadow:
          activeTool === "eraser" && brushConfig.eraserSubMode === "ai_object"
            ? "0 0 10px rgba(244, 63, 94, 0.7), inset 0 0 6px rgba(244, 63, 94, 0.3)"
            : "0 0 0 1px rgba(0, 0, 0, 0.8), inset 0 0 0 1px rgba(0, 0, 0, 0.5)",
        backgroundColor:
          activeTool === "eraser" && brushConfig.eraserSubMode === "ai_object"
            ? "rgba(244, 63, 94, 0.22)"
            : "rgba(255, 255, 255, 0.08)",
      }}
    >
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${
          activeTool === "eraser" && brushConfig.eraserSubMode === "ai_object"
            ? "bg-rose-400 shadow-[0_0_4px_rgba(244,63,94,1)]"
            : "bg-white shadow-[0_0_2px_black]"
        }`}
      />
    </div>
  )}

  {/* Floating Confirmation Pill for Manual AI Inpainting Mode */}
  {activeTool === "eraser" && brushConfig.eraserSubMode === "ai_object" && hasInpaintMask && !brushConfig.autoInpaintOnRelease && (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/95 border border-rose-500/50 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2">
      <PanelButton
        type="button"
        disabled={isProcessing}
        onClick={() => {
          if (eraserMaskCanvasRef.current && onApplyInpaint) {
            onApplyInpaint(eraserMaskCanvasRef.current);
          }
        }}
        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition-all"
      >
        {isProcessing ? <Sparkles className="w-3.5 h-3.5 animate-spin text-rose-200" /> : <Wand2 className="w-3.5 h-3.5" />}
        <span>{isProcessing ? "جاري الترميم بالذكاء الاصطناعي..." : "إزالة العنصر المحدد بالذكاء الاصطناعي"}</span>
      </PanelButton>
      <PanelButton
        type="button"
        disabled={isProcessing}
        onClick={() => {
          if (overlayCanvasRef.current) {
            const oCtx = overlayCanvasRef.current.getContext("2d");
            oCtx?.clearRect(0, 0, docWidth, docHeight);
          }
          if (eraserMaskCanvasRef.current) {
            const mCtx = eraserMaskCanvasRef.current.getContext("2d");
            mCtx?.clearRect(0, 0, docWidth, docHeight);
          }
          setHasInpaintMask(false);
        }}
        className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-medium transition-colors"
      >
        إلغاء التحديد
      </PanelButton>
    </div>
  )}
</div>
  );
};
