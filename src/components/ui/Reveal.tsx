"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Fade+rise entrance for server-streamed content. Wrap the async child of a
 * <Suspense> boundary: the child suspends inside this wrapper, so the motion
 * fires exactly at the skeleton→content swap, per section, whenever it
 * streams in. `index` staggers sections that resolve in the same flush into
 * a gentle cascade.
 */
export default function Reveal({
  children,
  index = 0,
  className,
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: index * 0.07 }}
    >
      {children}
    </motion.div>
  );
}
