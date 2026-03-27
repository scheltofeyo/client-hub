import Link from "next/link";
import { ReactNode } from "react";

type Crumb = { label: string; href?: string };

export default function PageHeader({
  breadcrumbs,
  title,
  actions,
  tertiaryNav,
}: {
  breadcrumbs: Crumb[];
  title: string;
  actions?: ReactNode;
  tertiaryNav?: ReactNode;
}) {
  return (
    <div
      className={`px-7 pt-6 shrink-0${tertiaryNav ? " pb-0" : " pb-5 border-b"}`}
      style={{ borderColor: "var(--border)" }}
    >
      <nav className="flex items-center gap-1.5 mb-2">
        {breadcrumbs.flatMap((crumb, i) => {
          const sep = i > 0
            ? [<span key={`s${i}`} className="text-xs" style={{ color: "var(--text-muted)" }}>/</span>]
            : [];
          const node = crumb.href
            ? <Link key={`c${i}`} href={crumb.href} className="text-xs breadcrumb-link">{crumb.label}</Link>
            : <span key={`c${i}`} className="text-xs" style={{ color: "var(--text-muted)" }}>{crumb.label}</span>;
          return [...sep, node];
        })}
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {tertiaryNav}
    </div>
  );
}
