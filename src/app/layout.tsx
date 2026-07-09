import type { Metadata } from "next";
import { Ubuntu_Sans } from "next/font/google";
import "./globals.css";

const ubuntuSans = Ubuntu_Sans({
  subsets: ["latin"],
  variable: "--font-ubuntu-sans",
});

export const metadata: Metadata = {
  title: {
    default: "SUMM Hub",
    template: "%s",
  },
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

// Pre-paint guard for the My Day welcome overlay: the overlay is server-rendered
// active (so it owns the first paint on a fresh session), but on an already-
// welcomed reload it must not flash. Runs before paint and hides it via CSS.
// Reads the guard only — WelcomeOverlay owns writing it.
const welcomeInitScript = `(function(){try{if(location.pathname==='/my-day'&&sessionStorage.getItem('summ:welcomed')){document.documentElement.setAttribute('data-welcome-hide','')}}catch(e){}})()`;


export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={ubuntuSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: welcomeInitScript }} />
      </head>
      <body style={{ background: "var(--bg-app)" }}>
        {children}
      </body>
    </html>
  );
}
