"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, type ReactNode } from "react";

export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.12 });
  const reduced = useReducedMotion();
  return <motion.div ref={ref} initial={false} animate={{ opacity: inView || reduced ? 1 : 0, y: inView || reduced ? 0 : 16 }} transition={{ duration: reduced ? 0 : .45, delay: reduced ? 0 : delay, ease: "easeOut" }} className="min-w-0">{children}</motion.div>;
}
