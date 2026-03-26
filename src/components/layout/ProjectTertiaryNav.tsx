"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { label: "Overview", href: "" },
  { label: "Tasks", href: "/tasks" },
  { label: "Files", href: "/files" },
];

export default function ProjectTertiaryNav({
  basePath,
}: {
  basePath: string;
}) {
  const pathname = usePathname();

  return (
    <div
      className="flex gap-0 border-b shrink-0 px-7"
      style={{ borderColor: "var(--border)" }}
    >
      {sections.map(({ label, href }) => {
        const fullPath = `${basePath}${href}`;
        const active = href === ""
          ? pathname === basePath
          : pathname.startsWith(fullPath);

        return (
          <Link
            key={label}
            href={fullPath}
            className="px-1 py-3 mr-5 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: active ? "var(--primary)" : "transparent",
              color: active ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
