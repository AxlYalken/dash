"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MotionSurface({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHover(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return <motion.div className={cn("surface-card", className)} whileHover={hover && !reduced ? { scale: 1.008, boxShadow: "var(--shadow-hover)" } : undefined} transition={{ duration: .22, ease: "easeOut" }}>{children}</motion.div>;
}

export function StateTransition({ children, stateKey }: { children: ReactNode; stateKey: string }) {
  const reduced = useReducedMotion();
  return <motion.div key={stateKey} initial={reduced ? false : { opacity: .35, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .22 }} className="min-w-0">{children}</motion.div>;
}
