"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { toBlob } from "html-to-image";

export type CopyChartStatus = "idle" | "copying" | "copied" | "error" | "unsupported";

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
      const blob = await toBlob(node, {
        backgroundColor: undefined,
        pixelRatio: 2,
        cacheBust: true,
      });
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
