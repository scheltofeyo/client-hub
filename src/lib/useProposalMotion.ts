"use client";

/**
 * Motion hooks for the public proposal surface.
 *
 * All of them are no-ops under `prefers-reduced-motion` or where
 * IntersectionObserver is unavailable, and they only ever *enhance* an
 * already-visible default (the reveal classes are visible until JS arms them).
 * That keeps SSR, no-JS, and headless renders fully readable — content is
 * never gated behind a transition that might not fire.
 */

import { useEffect, useRef, useState } from "react";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function motionEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    "IntersectionObserver" in window &&
    !prefersReducedMotion()
  );
}

/**
 * Reveal a single element when it scrolls into view, once.
 * The element must carry the `proposal-reveal` (or `proposal-bar`) class.
 */
export function useReveal<T extends HTMLElement>(rootMargin = "0px 0px -10% 0px") {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !motionEnabled()) return;
    el.classList.add("reveal-armed");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin, threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return ref;
}

/**
 * Reveal a group of children together (with their per-item `--reveal-i`
 * stagger) when the container scrolls into view. Used for the timeline bars.
 */
export function useRevealGroup<T extends HTMLElement>(
  childSelector: string,
  rootMargin = "0px 0px -15% 0px"
) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !motionEnabled()) return;
    const children = Array.from(root.querySelectorAll<HTMLElement>(childSelector));
    if (children.length === 0) return;
    children.forEach((c) => c.classList.add("reveal-armed"));
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          children.forEach((c) => c.classList.add("is-visible"));
          io.disconnect();
        }
      },
      { rootMargin, threshold: 0.1 }
    );
    io.observe(root);
    return () => io.disconnect();
  }, [childSelector, rootMargin]);
  return ref;
}

/**
 * Count a number up from 0 to `target` (ease-out-quart) the first time it
 * scrolls into view. Returns the value to render plus a ref for the trigger
 * element. Reduced motion / no-IO → renders the final value immediately.
 */
export function useCountUp<T extends HTMLElement = HTMLElement>(target: number, durationMs = 1100) {
  const ref = useRef<T | null>(null);
  const [value, setValue] = useState(target);
  useEffect(() => {
    const el = ref.current;
    // No motion: leave the value at its initial `target` (set via useState).
    if (!el || !motionEnabled()) return;
    let raf = 0;
    let started = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!started && entries.some((e) => e.isIntersecting)) {
          started = true;
          io.disconnect();
          setValue(0);
          let start: number | null = null;
          const tick = (ts: number) => {
            if (start === null) start = ts;
            const p = Math.min((ts - start) / durationMs, 1);
            const eased = 1 - Math.pow(1 - p, 4);
            setValue(Math.round(target * eased));
            if (p < 1) raf = requestAnimationFrame(tick);
            else setValue(target);
          };
          raf = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, durationMs]);
  return { ref, value };
}
