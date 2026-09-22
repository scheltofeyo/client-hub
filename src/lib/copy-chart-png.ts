"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { toBlob } from "html-to-image";

export type CopyChartStatus = "idle" | "copying" | "copied" | "error" | "unsupported";

function isScrollContainer(el: HTMLElement) {
  const { overflowX, overflowY } = window.getComputedStyle(el);
  return /^(auto|scroll)$/.test(overflowX) || /^(auto|scroll)$/.test(overflowY);
}

/**
 * Take the scroll out of every scroll container inside `node` for the duration
 * of one capture, and report the size the canvas needs once they are laid open.
 *
 * html-to-image copies computed styles onto a clone and renders that in a
 * foreignObject, so a chart wrapped in `overflow-x-auto` clones as a real
 * scroll container: the renderer paints its scrollbars straight into the PNG
 * and crops whatever they cover. The clone only has to overflow by a fraction
 * of a pixel for that to happen, which is why charts that sit comfortably
 * inside their card on screen still copied with a bar down the side.
 *
 * `hidden` rather than `visible` or `clip`: all three drop the scrollbars, but
 * only `hidden` keeps the block formatting context the container already had,
 * so margins it was containing stay contained and nothing shifts. A container
 * that really is scrolled is then grown to its content instead, because a copy
 * with no scrollbar in it should be the whole chart — not the slice that
 * happened to be in view, silently cropped now that the bar is gone.
 */
function unscrollForCapture(node: HTMLElement) {
  const containers = [node, ...Array.from(node.querySelectorAll<HTMLElement>("*"))].filter(
    isScrollContainer,
  );
  // Read every overflow first: hiding the bars reclaims their gutter, which
  // changes the very measurements this decides on.
  const scrolled = containers.map((el) => ({
    el,
    x: el.scrollWidth > el.clientWidth,
    y: el.scrollHeight > el.clientHeight,
    inline: el.getAttribute("style"),
    left: el.scrollLeft,
    top: el.scrollTop,
  }));

  for (const { el, x, y } of scrolled) {
    el.style.setProperty("overflow", "hidden", "important");
    if (x) {
      el.style.setProperty("width", "max-content", "important");
      el.style.setProperty("max-width", "none", "important");
    }
    if (y) {
      el.style.setProperty("height", "max-content", "important");
      el.style.setProperty("max-height", "none", "important");
    }
  }

  // A grown container reaches past the node, which is a plain block and does
  // not stretch to follow it. Left to itself html-to-image would size the
  // canvas off the node alone and crop the growth straight back off.
  const box = node.getBoundingClientRect();
  const reach = scrolled.reduce(
    (acc, { el }) => {
      const rect = el.getBoundingClientRect();
      return { right: Math.max(acc.right, rect.right), bottom: Math.max(acc.bottom, rect.bottom) };
    },
    { right: box.right, bottom: box.bottom },
  );
  const width = Math.ceil(reach.right - box.left);
  const height = Math.ceil(reach.bottom - box.top);
  const grown = width > node.offsetWidth || height > node.offsetHeight;

  return {
    // Sizing the canvas by hand also pins the clone's own width and height, so
    // it is left to measure itself unless something did grow.
    size: grown ? { width, height } : {},
    restore: () => {
      for (const { el, inline, left, top } of scrolled) {
        if (inline === null) el.removeAttribute("style");
        else el.setAttribute("style", inline);
        el.scrollLeft = left;
        el.scrollTop = top;
      }
    },
  };
}

export function useCopyChartPng(ref: RefObject<HTMLElement | null>) {
  const [status, setStatus] = useState<CopyChartStatus>("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    };
  }, []);

  const scheduleReset = useCallback((delay: number) => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setStatus("idle"), delay);
  }, []);

  const copy = useCallback(async () => {
    const node = ref.current;
    if (!node) return;

    const canClipboard =
      typeof window !== "undefined" &&
      typeof window.ClipboardItem !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.clipboard?.write === "function";

    if (!canClipboard) {
      setStatus("unsupported");
      scheduleReset(2000);
      return;
    }

    setStatus("copying");
    try {
      const capture = unscrollForCapture(node);
      let blob: Blob | null;
      try {
        blob = await toBlob(node, {
          backgroundColor: undefined,
          pixelRatio: 2,
          cacheBust: true,
          ...capture.size,
        });
      } finally {
        capture.restore();
      }
      if (!blob) throw new Error("Empty blob");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("copied");
      scheduleReset(1500);
    } catch {
      setStatus("error");
      scheduleReset(2000);
    }
  }, [ref, scheduleReset]);

  return { copy, status };
}
