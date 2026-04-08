import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "SUMM Client Hub",
  description: "Agency client management dashboard",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ background: "var(--bg-app)" }}>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: `(function(){var s=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s===null&&d)){document.documentElement.classList.add('dark')}})()` }}
        />
        <Script
          id="app-splash-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=document.createElement('style');s.textContent='@keyframes splash-fadein{to{opacity:1}}@keyframes splash-pulse{0%,100%{opacity:.6;transform:scale(.95)}50%{opacity:1;transform:scale(1)}}';document.head.appendChild(s);var d=document.createElement('div');d.id='app-splash';d.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:var(--bg-app);opacity:0;animation:splash-fadein 0.3s ease 0.15s forwards';d.innerHTML='<svg width="44" height="44" viewBox="0 0 24 24" fill="none" style="animation:splash-pulse 1.5s ease-in-out infinite"><rect x="3" y="3" width="7" height="7" rx="1.5" fill="var(--primary)"/><rect x="14" y="3" width="7" height="7" rx="1.5" fill="var(--primary)" opacity="0.5"/><rect x="3" y="14" width="7" height="7" rx="1.5" fill="var(--primary)" opacity="0.5"/><rect x="14" y="14" width="7" height="7" rx="1.5" fill="var(--primary)"/></svg>';document.body.appendChild(d)})()`,
          }}
        />
        {children}
        <Script
          id="app-splash-hide"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=document.getElementById('app-splash');if(s){s.style.opacity='0';s.style.animation='none';setTimeout(function(){s.remove()},200)}})()`,
          }}
        />
      </body>
    </html>
  );
}
