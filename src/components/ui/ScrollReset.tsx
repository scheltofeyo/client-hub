"use client";
import { useEffect, useRef } from "react";

export default function ScrollReset({ activeTab }: { activeTab: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeTab === "Events") return;
    let el: HTMLElement | null = ref.current;
    while (el) {
      const style = getComputedStyle(el);
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        el.scrollTop = 0;
        break;
      }
      el = el.parentElement;
    }
  }, [activeTab]);
  return <div ref={ref} style={{ display: "none" }} />;
}
