"use client";

import { usePathname } from "next/navigation";

export default function ToolsPanelNav() {
  const pathname = usePathname();

  // Hide the panel nav when inside a specific tool — breadcrumbs handle navigation.
  // On the landing page (/tools exact) the page itself shows the tool grid.
  if (pathname !== "/tools") return null;

  return null;
}
