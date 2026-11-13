import React, { useState, useRef } from "react";
import { motion } from "motion/react";
import { Tooltip } from "./Tooltip";
import {
  Layers as LayersIcon,
  Image as ImageIcon,
  Type,
  Square,
  Palette,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  UploadCloud,
  Blend,
} from "lucide-react";
import { Layer, BlendMode } from "../types";

interface LayersPanelProps {
  layers: Layer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onChangeOpacity: (id: string, opacity: number) => void;
  onChangeBlendMode: (id: string, blendMode: BlendMode) => void;
  onMoveLayer: (id: string, direction: "up" | "down") => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onAddLayer: () => void;
  onUploadImage?: (file: File) => void;
  onAddTextQuick?: () => void;
  onAddShapeQuick?: () => void;
  onAddGradientQuick?: () => void;
  onOpenBlendModal?: () => void;
  onToggleCollapse?: () => void;
}

const BLEND_MODES: { label: string; value: BlendMode }[] = [
  { label: "عادي (Normal)", value: "normal" },
  { label: "ضرب (Multiply)", value: "multiply" },
  { label: "شاشة (Screen)", value: "screen" },
  { label: "تراكب (Overlay)", value: "overlay" },
  { label: "تعتيم (Darken)", value: "darken" },
  { label: "تفتيح (Lighten)", value: "lighten" },
  { label: "تفادي لوني (Color Dodge)", value: "color-dodge" },
  { label: "فرق (Difference)", value: "difference" },
  { label: "استبعاد (Exclusion)", value: "exclusion" },
];

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  activeLayerId,
  onSelectLayer,
  onToggleVisibility,
  onToggleLock,
  onChangeOpacity,
  onChangeBlendMode,
  onMoveLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onAddLayer,
  onUploadImage,
  onAddTextQuick,
  onAddShapeQuick,
  onAddGradientQuick,
  onOpenBlendModal,
  onToggleCollapse,
}) => {
  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const activeIndex = layers.findIndex((l) => l.id === activeLayerId);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onUploadImage) {
      onUploadImage(e.target.files[0]);
      e.target.value = "";
    }
  };

  return (
    <aside
      id="vision-studio-layers-panel"
      className="w-72 border-r rtl:border-l ltr:border-r border-purple-500/20 bg-[#0c0d16]/98 backdrop-blur-xl flex flex-col z-20 select-none text-slate-200 shrink-0"
    >
      {/* Hidden File Input for Quick Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* 1. Panel Header: "لوحة الطبقات (Layers)" + Count Badge + Collapse Button */}
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayersIcon className="w-4 h-4 text-purple-400" />
          <h2 className="text-xs font-bold tracking-wider text-slate-100">
            لوحة الطبقات (Layers)
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/40">
            {layers.length}
          </span>
          {onToggleCollapse && (
            <Tooltip content="إخفاء / طي لوحة الطبقات" shortcut="F7" position="left">
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="طي لوحة الطبقات"
              >
                <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* 2. Quick Add Bar matching reference: 4 buttons in a row (صورة, نص, شكل, تدرج) */}
      <div className="p-2 border-b border-slate-800/80 bg-slate-900/30 grid grid-cols-4 gap-1.5">
        <Tooltip content="إضافة صورة كطبقة" shortcut="رفع صورة" position="bottom">
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/80 hover:bg-purple-950/50 hover:border-purple-500/50 border border-slate-800 text-slate-300 hover:text-white transition-colors group"
          >
            <ImageIcon className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform mb-1" />
            <span className="text-[10px] font-medium">صورة</span>
          </motion.button>
        </Tooltip>

        <Tooltip content="إضافة طبقة نص" shortcut="X" position="bottom">
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            onClick={() => onAddTextQuick ? onAddTextQuick() : onAddLayer()}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/80 hover:bg-purple-950/50 hover:border-purple-500/50 border border-slate-800 text-slate-300 hover:text-white transition-colors group"
          >
            <Type className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform mb-1" />
            <span className="text-[10px] font-medium">نص</span>
          </motion.button>
        </Tooltip>

        <Tooltip content="إضافة شكل هندسي" position="bottom">
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            onClick={() => onAddShapeQuick ? onAddShapeQuick() : onAddLayer()}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/80 hover:bg-purple-950/50 hover:border-purple-500/50 border border-slate-800 text-slate-300 hover:text-white transition-colors group"
          >
            <Square className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform mb-1" />
            <span className="text-[10px] font-medium">شكل</span>
          </motion.button>
        </Tooltip>

        <Tooltip content="إضافة طبقة تدرج لوني" position="bottom">
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            onClick={() => onAddGradientQuick ? onAddGradientQuick() : onAddLayer()}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/80 hover:bg-purple-950/50 hover:border-purple-500/50 border border-slate-800 text-slate-300 hover:text-white transition-colors group"
          >
            <Palette className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform mb-1" />
            <span className="text-[10px] font-medium">تدرج</span>
          </motion.button>
        </Tooltip>
      </div>

      {/* Quick Blend Feature Banner */}
      {onOpenBlendModal && (
        <div className="px-2.5 py-1.5 border-b border-purple-500/20 bg-gradient-to-r from-purple-950/40 to-slate-900/40 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Blend className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] font-medium text-purple-200">أداة دمج صورتين سريعة:</span>
          </div>
          <button
            type="button"
            onClick={onOpenBlendModal}
            className="px-2 py-0.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-[10px] font-bold text-purple-200 hover:text-white transition-colors cursor-pointer"
          >
            فتح أداة الدمج ⚡
          </button>
        </div>
      )}

      {/* 3. Global Opacity & Blend Mode matching reference screenshot */}
      {activeLayer && (
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/40 space-y-2.5 text-xs">
          {/* Opacity Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-300">
              <span className="font-medium">الشفافية (Opacity)</span>
              <span className="text-purple-300 font-mono font-bold">
                {Math.round(activeLayer.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={activeLayer.opacity}
              onChange={(e) => onChangeOpacity(activeLayer.id, parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          {/* Blend Mode Dropdown */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-slate-300">نمط الدمج (Blend):</span>
            <select
              value={activeLayer.blendMode}
              onChange={(e) => onChangeBlendMode(activeLayer.id, e.target.value as BlendMode)}
              className="bg-[#141524] border border-slate-700/80 text-purple-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-purple-500 cursor-pointer max-w-[140px]"
            >
              {BLEND_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* 4. Layers List matching reference */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {layers
          .slice()
          .reverse()
          .map((layer, reverseIndex) => {
            const index = layers.length - 1 - reverseIndex;
            const isActive = layer.id === activeLayerId;

            return (
              <div
                key={layer.id}
                id={`layer-item-${layer.id}`}
                onClick={() => onSelectLayer(layer.id)}
                draggable
                onDragStart={() => setDraggedId(layer.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedId && draggedId !== layer.id) {
                    onMoveLayer(draggedId, index > layers.findIndex((l) => l.id === draggedId) ? "up" : "down");
                    setDraggedId(null);
                  }
                }}
                className={`group relative flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? "bg-purple-950/40 border-purple-500/70 shadow-md shadow-purple-900/20 ring-1 ring-purple-500/30"
                    : "bg-[#11121e]/80 border-slate-800/80 hover:border-slate-700 hover:bg-[#151726]"
                } ${!layer.visible ? "opacity-40" : ""}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Layer Thumbnail */}
                  <div className="w-10 h-10 rounded-lg bg-[#07080d] border border-slate-700/60 overflow-hidden flex items-center justify-center relative shrink-0">
                    <div
                      className="w-full h-full bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${layer.canvas.toDataURL()})`,
                      }}
                    />
                  </div>

                  {/* Layer Info matching reference screenshot */}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate max-w-[100px] flex items-center gap-1">
                      {layer.type === "gradient" && <Palette className="w-3 h-3 text-pink-400 shrink-0" />}
                      {layer.type === "shape" && <Square className="w-3 h-3 text-amber-400 shrink-0" />}
                      {layer.type === "text" && <Type className="w-3 h-3 text-cyan-400 shrink-0" />}
                      <span className="truncate">{layer.name}</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      {layer.width}px×{layer.height}
                    </div>
                  </div>
                </div>

                {/* Layer Inline Action Buttons: Delete, Copy, Lock, Eye */}
                <div className="flex items-center gap-1">
                  <Tooltip content="حذف الطبقة" shortcut="Delete" position="top">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLayer(layer.id);
                      }}
                      disabled={layers.length <= 1}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 disabled:opacity-20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </motion.button>
                  </Tooltip>

                  <Tooltip content="تكرار الطبقة" shortcut="Ctrl+D" position="top">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateLayer(layer.id);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-purple-300 hover:bg-slate-800/80 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </motion.button>
                  </Tooltip>

                  <Tooltip content={layer.locked ? "إلغاء قفل الطبقة" : "قفل الطبقة"} position="top">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLock(layer.id);
                      }}
                      className={`p-1 rounded hover:bg-slate-800/80 transition-colors ${
                        layer.locked ? "text-amber-400" : "text-slate-400 hover:text-amber-300"
                      }`}
                    >
                      {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </motion.button>
                  </Tooltip>

                  <Tooltip content={layer.visible ? "إخفاء الطبقة" : "إظهار الطبقة"} position="top">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVisibility(layer.id);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-purple-300 hover:bg-slate-800/80 transition-colors"
                    >
                      {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                    </motion.button>
                  </Tooltip>
                </div>
              </div>
            );
          })}

        {/* 5. Dropzone Box matching reference screenshot: "اسحب وأفلت صورة هنا أو انقر للإضافة" */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 p-3.5 border-2 border-dashed border-slate-800 hover:border-purple-500/50 bg-slate-900/20 hover:bg-purple-950/20 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all group"
        >
          <UploadCloud className="w-4 h-4 text-slate-400 group-hover:text-purple-400 transition-colors" />
          <span className="text-[11px] text-slate-400 group-hover:text-slate-200">
            اسحب وأفلت صورة هنا أو انقر للإضافة
          </span>
        </div>
      </div>

      {/* 6. Footer matching reference screenshot: "ترتيب الطبقة: للأعلى / للأسفل" */}
      <div className="p-2.5 px-3 border-t border-slate-800/80 flex items-center justify-between text-xs bg-slate-900/60">
        <span className="text-[11px] text-slate-400 font-medium">ترتيب الطبقة:</span>
        <div className="flex items-center gap-1.5">
          <Tooltip content="نقل الطبقة للأعلى" position="top">
            <motion.button
              type="button"
              whileTap={{ scale: 0.93 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              onClick={() => onMoveLayer(activeLayerId, "up")}
              disabled={activeIndex === layers.length - 1}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-25 transition-colors text-[11px]"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>للأعلى</span>
            </motion.button>
          </Tooltip>
          <Tooltip content="نقل الطبقة للأسفل" position="top">
            <motion.button
              type="button"
              whileTap={{ scale: 0.93 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              onClick={() => onMoveLayer(activeLayerId, "down")}
              disabled={activeIndex === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-25 transition-colors text-[11px]"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>للأسفل</span>
            </motion.button>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
};
