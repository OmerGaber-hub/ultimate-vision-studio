import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export interface TooltipProps {
  children: React.ReactElement;
  content: React.ReactNode;
  shortcut?: string | string[];
  description?: string;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  shortcut,
  description,
  position = "bottom",
  delay = 120,
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (disabled || !content) return;
    const rect = e.currentTarget.getBoundingClientRect();
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setTargetRect(rect);
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    clearTimer();
    setIsVisible(false);
    setTargetRect(null);
  };

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  // Hide tooltip on global scroll or resize
  useEffect(() => {
    if (!isVisible) return;
    const handleScrollOrResize = () => {
      clearTimer();
      setIsVisible(false);
      setTargetRect(null);
    };
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isVisible]);

  if (!React.isValidElement(children)) {
    return children;
  }

  const child = React.Children.only(children) as React.ReactElement<any>;

  const triggerElement = React.cloneElement(child, {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      child.props.onMouseEnter?.(e);
      handleMouseEnter(e);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      child.props.onMouseLeave?.(e);
      handleMouseLeave();
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      child.props.onFocus?.(e);
      handleMouseEnter(e as unknown as React.MouseEvent<HTMLElement>);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      child.props.onBlur?.(e);
      handleMouseLeave();
    },
  });

  const renderShortcutKeys = (sc: string | string[]) => {
    const rawKeys = Array.isArray(sc)
      ? sc
      : sc.includes("+")
      ? sc.split("+").map((k) => k.trim())
      : [sc];

    return (
      <span className="flex items-center gap-1 font-mono text-[10px] rtl:space-x-reverse" dir="ltr">
        {rawKeys.map((key, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <span className="text-[10px] text-purple-400/80 font-bold">+</span>}
            <kbd className="px-1.5 py-0.5 rounded-md bg-[#211a3d] border border-purple-400/40 text-purple-200 font-bold shadow-sm min-w-[18px] text-center leading-none">
              {key}
            </kbd>
          </React.Fragment>
        ))}
      </span>
    );
  };

  const renderTooltipPortal = () => {
    if (!isVisible || !targetRect || disabled) return null;

    let top = 0;
    let left = 0;
    let transform = "";

    switch (position) {
      case "bottom":
        top = targetRect.bottom + 8;
        left = targetRect.left + targetRect.width / 2;
        transform = "translate(-50%, 0)";
        break;
      case "top":
        top = targetRect.top - 8;
        left = targetRect.left + targetRect.width / 2;
        transform = "translate(-50%, -100%)";
        break;
      case "left":
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.left - 8;
        transform = "translate(-100%, -50%)";
        break;
      case "right":
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.right + 8;
        transform = "translate(0, -50%)";
        break;
    }

    // Safety edge clamping for viewport
    const clampedTop = Math.max(8, Math.min(window.innerHeight - 50, top));
    const clampedLeft = Math.max(8, Math.min(window.innerWidth - 8, left));

    return createPortal(
      <div
        className="fixed z-[99999] pointer-events-none transition-all duration-150 ease-out select-none"
        style={{
          top: `${clampedTop}px`,
          left: `${clampedLeft}px`,
          transform,
        }}
      >
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#0f101d]/95 text-white text-xs shadow-2xl border border-purple-500/40 backdrop-blur-xl whitespace-nowrap ring-1 ring-purple-500/20">
          <span className="font-semibold text-slate-100 tracking-wide">{content}</span>
          {shortcut && renderShortcutKeys(shortcut)}
          {description && (
            <span className="text-[11px] text-slate-400 font-normal border-r border-slate-700 pr-2 mr-1">
              {description}
            </span>
          )}
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      {triggerElement}
      {renderTooltipPortal()}
    </>
  );
};
