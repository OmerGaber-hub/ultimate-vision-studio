import React from "react";
import { GradientConfig, GradientColorStop } from "../types";
import { GRADIENT_PRESETS, getGradientCSS } from "../lib/gradientEngine";
import { RotateCw, ArrowLeftRight, Sparkles } from "lucide-react";

interface GradientEditorProps {
  config: GradientConfig;
  onChange: (config: GradientConfig) => void;
  title?: string;
}

export const GradientEditor: React.FC<GradientEditorProps> = ({
  config,
  onChange,
  title = "إعدادات التدرج اللوني",
}) => {
  const currentType = config.type || "linear";
  const currentAngle = config.angle ?? 135;
  const stops = config.stops && config.stops.length >= 2
    ? config.stops
    : [
        { offset: 0, color: "#8b5cf6" },
        { offset: 1, color: "#ec4899" },
      ];

  const startColor = stops[0]?.color || "#8b5cf6";
  const endColor = stops[stops.length - 1]?.color || "#ec4899";

  const handleUpdateType = (type: "linear" | "radial") => {
    onChange({ ...config, type });
  };

  const handleUpdateAngle = (angle: number) => {
    onChange({ ...config, angle });
  };

  const handleUpdateStopColor = (index: number, color: string) => {
    const updated = stops.map((s, i) => (i === index ? { ...s, color } : s));
    onChange({ ...config, stops: updated });
  };

  const handleReverseStops = () => {
    const reversed = stops
      .slice()
      .reverse()
      .map((s, i) => ({
        color: s.color,
        offset: i === 0 ? 0 : i === stops.length - 1 ? 1 : 1 - s.offset,
      }));
    onChange({ ...config, stops: reversed });
  };

  const handleApplyPreset = (presetConfig: GradientConfig) => {
    onChange({
      ...presetConfig,
      enabled: true,
    });
  };

  const previewCss = getGradientCSS(config);

  return (
    <div className="space-y-3.5 p-3 rounded-xl bg-slate-900/70 border border-purple-500/20 text-xs select-none">
      {/* Header & Live Gradient Swatch Preview */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>{title}</span>
          </span>
          <button
            type="button"
            onClick={handleReverseStops}
            className="flex items-center gap-1 text-[10px] text-purple-300 hover:text-white px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/40 hover:bg-purple-900/60 transition-colors cursor-pointer"
            title="عكس اتجاه الألوان"
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span>عكس</span>
          </button>
        </div>

        {/* Live CSS Preview Bar */}
        <div
          className="w-full h-8 rounded-lg border border-white/20 shadow-inner relative overflow-hidden transition-all duration-300"
          style={{ background: previewCss }}
        >
          <div className="absolute inset-0 bg-black/10 flex items-center justify-between px-2.5 text-[10px] font-mono text-white font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            <span>{currentType === "linear" ? `${currentAngle}°` : "Radial"}</span>
            <span>{stops.length} ألوان</span>
          </div>
        </div>
      </div>

      {/* 1. Gradient Type Toggle (خطي vs دائري) */}
      <div className="grid grid-cols-2 gap-1.5 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
        <button
          type="button"
          onClick={() => handleUpdateType("linear")}
          className={`py-1 rounded-md font-medium text-[11px] transition-all cursor-pointer ${
            currentType === "linear"
              ? "bg-purple-600 text-white shadow-sm font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          خطي (Linear)
        </button>
        <button
          type="button"
          onClick={() => handleUpdateType("radial")}
          className={`py-1 rounded-md font-medium text-[11px] transition-all cursor-pointer ${
            currentType === "radial"
              ? "bg-purple-600 text-white shadow-sm font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          دائري (Radial)
        </button>
      </div>

      {/* 2. Angle Slider (Only for linear) */}
      {currentType === "linear" && (
        <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1">
              <RotateCw className="w-3 h-3 text-purple-400" />
              <span>زاوية التدرج:</span>
            </span>
            <span className="font-mono text-purple-300 font-bold">{currentAngle}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="5"
            value={currentAngle}
            onChange={(e) => handleUpdateAngle(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          {/* Angle quick pills */}
          <div className="flex justify-between gap-1 pt-1">
            {[0, 45, 90, 135, 180, 270].map((deg) => (
              <button
                key={deg}
                type="button"
                onClick={() => handleUpdateAngle(deg)}
                className={`flex-1 py-0.5 rounded text-[9px] font-mono border transition-colors cursor-pointer ${
                  currentAngle === deg
                    ? "bg-purple-600 text-white border-purple-400"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                {deg}°
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Color Stops Controls */}
      <div className="space-y-2">
        <span className="text-[11px] font-medium text-slate-400 block">ألوان التدرج:</span>
        <div className="grid grid-cols-2 gap-2">
          {/* Start Color */}
          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 block">لون البداية:</span>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={startColor}
                onChange={(e) => handleUpdateStopColor(0, e.target.value)}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 shrink-0"
              />
              <input
                type="text"
                value={startColor}
                onChange={(e) => handleUpdateStopColor(0, e.target.value)}
                className="w-full px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-purple-300 uppercase"
              />
            </div>
          </div>

          {/* End Color */}
          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 block">لون النهاية:</span>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={endColor}
                onChange={(e) => handleUpdateStopColor(stops.length - 1, e.target.value)}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 shrink-0"
              />
              <input
                type="text"
                value={endColor}
                onChange={(e) => handleUpdateStopColor(stops.length - 1, e.target.value)}
                className="w-full px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-purple-300 uppercase"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Curated Presets Grid */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[11px] font-medium text-slate-400 block">قوالب تدرجات جاهزة:</span>
        <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {GRADIENT_PRESETS.map((preset) => {
            const pCss = getGradientCSS(preset.config);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset.config)}
                className="group flex flex-col items-center p-1 rounded-lg border border-slate-800 hover:border-purple-400 bg-slate-950/80 hover:bg-slate-900 transition-all cursor-pointer text-center"
                title={preset.nameEn}
              >
                <div
                  className="w-full h-5 rounded-md border border-white/20 shadow-xs mb-1 group-hover:scale-105 transition-transform"
                  style={{ background: pCss }}
                />
                <span className="text-[9px] text-slate-300 group-hover:text-purple-300 truncate w-full font-medium">
                  {preset.nameAr}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
