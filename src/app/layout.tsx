import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Client Hub",
  description: "Agency client management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: `(function(){var s=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s===null&&d)){document.documentElement.classList.add('dark')}})()` }}
        />
      </head>
      <body style={{ background: "var(--bg-app)" }}>
        {children}
      </body>
    </html>
  );
}
