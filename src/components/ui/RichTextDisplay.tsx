"use client";

import { useSyncExternalStore } from "react";
import DOMPurify from "dompurify";

const subscribe = () => () => {};
const isClient = () => typeof window !== "undefined";
const isServer = () => false;

export default function RichTextDisplay({
  html,
  className = "",
  style,
}: {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const mounted = useSyncExternalStore(subscribe, isClient, isServer);

  if (!html?.trim()) return null;
  if (!mounted) {
    return <div className={`behavior-html ${className}`} style={style} />;
  }

  return (
    <div
      className={`behavior-html ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}
