import React from "react";
import { motion } from "motion/react";
import {
  MousePointer,
  Crop,
  LassoSelect,
  Scissors,
  Wand2,
  Eraser,
  FileText,
  Sparkles,
  RotateCw,
  SlidersHorizontal,
  Activity,
  Palette,
  Type,
  Shapes,
  Brush,
  FileCode,
  Scan,
} from "lucide-react";
import { ToolType } from "../types";
import { Tooltip } from "./Tooltip";

interface ToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeTool, onSelectTool }) => {
  const tools: Array<{
    id: ToolType;
    label: string;
    icon: React.ElementType;
    shortcut: string;
    description: string;
    badge?: string;
    badgeColor?: string;
  }> = [
    {
      id: "select",
      label: "تحديد ونقل",
      icon: MousePointer,
      shortcut: "V",
      description: "تحديد الطبقات ونقلها في مساحة العمل",
    },
    {
      id: "lasso",
      label: "تحديد لاسو",
      icon: LassoSelect,
      shortcut: "L",
      description: "تحديد مناطق بمضلع حر أو مغناطيسي",
      badge: "جديد",
      badgeColor: "bg-emerald-900/90 text-emerald-300 border-emerald-500/50",
    },
    {
      id: "crop",
      label: "قص وتأطير",
      icon: Crop,
      shortcut: "C",
      description: "قص اللوحة وتغيير أبعاد التصميم",
    },
    {
      id: "transform",
      label: "تدوير وتحويل",
      icon: RotateCw,
      shortcut: "T",
      description: "تدوير وقلب وتحجيم الطبقة النشطة",
    },
    {
      id: "bg_remove",
      label: "إزالة الخلفية",
      icon: Scissors,
      shortcut: "B",
      description: "عزل وتفريغ الخلفية بالذكاء الاصطناعي",
      badge: "عزل",
      badgeColor: "bg-purple-900/90 text-purple-300 border-purple-500/50",
    },
    {
      id: "segmentation",
      label: "القص الذكي",
      icon: Wand2,
      shortcut: "A",
      description: "تجزئة الصورة لكتل بصرية (K-Means/Watershed)",
      badge: "تجزئة",
      badgeColor: "bg-indigo-900/90 text-indigo-300 border-indigo-500/50",
    },
    {
      id: "ocr",
      label: "استخراج نصوص",
      icon: FileText,
      shortcut: "W",
      description: "مسح واستخراج النصوص كطبقات قابلة للتحرير",
      badge: "Word",
      badgeColor: "bg-blue-900/90 text-blue-300 border-blue-500/50",
    },
    {
      id: "object_detection",
      label: "كشف كائنات",
      icon: Scan,
      shortcut: "O",
      description: "كشف العناصر وتحديد مربعات الإحاطة",
      badge: "AI",
      badgeColor: "bg-cyan-900/90 text-cyan-300 border-cyan-500/50",
    },
    {
      id: "enhance",
      label: "توضيح وشحذ",
      icon: Sparkles,
      shortcut: "H",
      description: "شحذ التفاصيل الدقيقة وقناع Unsharp Mask الفائق",
      badge: "HD",
      badgeColor: "bg-amber-900/90 text-amber-300 border-amber-500/50",
    },
    {
      id: "spatial",
      label: "مرشحات وفلاتر",
      icon: Activity,
      shortcut: "F",
      description: "كشف الحواف ومصفوفات الالتفاف المكانية",
    },
    {
      id: "point",
      label: "إضاءة وألوان",
      icon: SlidersHorizontal,
      shortcut: "P",
      description: "السطوع والتباين وتحليل الهيستوغرام وتصحيح الألوان",
    },
    {
      id: "backdrop",
      label: "استوديو خلفيات",
      icon: Palette,
      shortcut: "S",
      description: "منصات عرض واستوديو إضاءة وخلفيات سينمائية",
    },
    {
      id: "text",
      label: "استوديو نصوص",
      icon: Type,
      shortcut: "X",
      description: "إدراج وتنسيق نصوص بخطوط عربية مميزة",
    },
    {
      id: "shape",
      label: "أشكال هندسية",
      icon: Shapes,
      shortcut: "U",
      description: "رسم وتصميم مستطيل، دائرة، مثلث، نجوم وأسهم",
      badge: "جديد",
      badgeColor: "bg-amber-900/90 text-amber-300 border-amber-500/50",
    },
    {
      id: "draw",
      label: "فرشاة ورسم",
      icon: Brush,
      shortcut: "D",
      description: "الرسم الحر بالفرشاة والتأثيرات النيونية",
    },
    {
      id: "eraser",
      label: "ممحاة ذكية",
      icon: Eraser,
      shortcut: "E",
      description: "مسح رتوش الرسم الفوقية بدقة",
    },
    {
      id: "vectorize",
      label: "فكتور SVG",
      icon: FileCode,
      shortcut: "K",
      description: "تحويل المسارات إلى رسومات متجهة قابلة للتكبير",
    },
  ];

  return (
    <aside
      id="vision-studio-toolbar"
      className="w-20 border-r rtl:border-r ltr:border-l border-purple-500/20 bg-[#0c0d16]/98 backdrop-blur-xl flex flex-col items-center py-2.5 z-20 select-none overflow-y-auto custom-scrollbar"
    >
      <div className="flex flex-col gap-1 w-full px-1.5">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;

          return (
            <Tooltip
              key={tool.id}
              content={tool.label}
              shortcut={tool.shortcut}
              description={tool.description}
              position="left"
            >
              <motion.button
                id={`tool-btn-${tool.id}`}
                onClick={() => onSelectTool(tool.id)}
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={`relative group w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-colors duration-150 ${
                  isActive
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/40 ring-1 ring-purple-400"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                }`}
              >
                {/* Badge (e.g. عزل, تجزئة, Word, HD, AI) */}
                {tool.badge && !isActive && (
                  <span
                    className={`absolute -top-1 right-1 text-[8px] font-bold px-1 py-0.2 rounded-full border shadow-sm ${tool.badgeColor}`}
                  >
                    {tool.badge}
                  </span>
                )}

                <Icon
                  className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                    isActive ? "text-white" : "text-slate-300 group-hover:text-purple-300"
                  }`}
                />

                {/* Label directly under the icon */}
                <span
                  className={`text-[10px] font-medium tracking-tight mt-1 truncate max-w-[66px] ${
                    isActive ? "text-white font-bold" : "text-slate-400 group-hover:text-slate-200"
                  }`}
                >
                  {tool.label}
                </span>
              </motion.button>
            </Tooltip>
          );
        })}
      </div>
    </aside>
  );
};
