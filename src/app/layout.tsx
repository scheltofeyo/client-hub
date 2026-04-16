import type { Metadata } from "next";
import { Ubuntu_Sans } from "next/font/google";
import "./globals.css";

const ubuntuSans = Ubuntu_Sans({
  subsets: ["latin"],
  variable: "--font-ubuntu-sans",
});

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

const themeInitScript = `(function(){var s=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s===null&&d)){document.documentElement.classList.add('dark')}})()`;


export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={ubuntuSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body style={{ background: "var(--bg-app)" }}>
        {children}
      </body>
    </html>
  );
}
