import Link from "next/link";
import { ReactNode } from "react";

type Crumb = { label: string; href?: string };

export default function PageHeader({
  breadcrumbs,
  title,
  actions,
  tertiaryNav,
  sticky,
}: {
  breadcrumbs: Crumb[];
  title: string;
  actions?: ReactNode;
  tertiaryNav?: ReactNode;
  sticky?: boolean;
}) {
  return (
    <div
      className={`px-7 pt-6 shrink-0${tertiaryNav ? " pb-0" : " pb-5 border-b"}${sticky ? " sticky top-0 z-10" : ""}`}
      style={{ borderColor: "var(--border)", ...(sticky ? { background: "var(--bg-surface)" } : {}) }}
    >
      <nav className="flex items-center gap-1.5 mb-2">
        {breadcrumbs.flatMap((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          const sep = i > 0
            ? [<span key={`s${i}`} className="text-xs" style={{ color: "var(--text-muted)" }}>/</span>]
            : [];
          // Last breadcrumb without href always renders as "..."
          const node = crumb.href
            ? <Link key={`c${i}`} href={crumb.href} className="text-xs breadcrumb-link">{crumb.label}</Link>
            : <span key={`c${i}`} className="text-xs" style={{ color: "var(--text-muted)" }}>{isLast && !crumb.href ? "..." : crumb.label}</span>;
          return [...sep, node];
        })}
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="typo-page-title" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {tertiaryNav}
    </div>
  );
}
