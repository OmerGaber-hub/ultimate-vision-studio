import React from "react";
import { motion, HTMLMotionProps } from "motion/react";

export interface PanelButtonProps extends HTMLMotionProps<"button"> {}

export const PanelButton = React.forwardRef<HTMLButtonElement, PanelButtonProps>(
  (
    {
      children,
      whileTap = { scale: 0.95 },
      transition = { type: "spring", stiffness: 500, damping: 30 },
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileTap={whileTap}
        transition={transition}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

PanelButton.displayName = "PanelButton";
