"use client";

import { useLayoutEffect, useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import BrandLoader from "@/components/ui/BrandLoader";

const WELCOMED_KEY = "summ:welcomed";
const MIN_SHOW_MS = 900;
const FADE_MS = 350;

// useLayoutEffect reconciles the overlay before the browser paints the next
// frame; useEffect on the server avoids React's "useLayoutEffect does nothing
// on the server" warning.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Branded "Setting up your day…" moment, shown once per browser session on the
 * first time My Day is displayed — covering both fresh logins and returning
 * visitors whose session is still valid (they skip the login screen but should
 * still get the moment). The `summ:welcomed` sessionStorage key is the one-shot
 * guard; a new tab/session replays it.
 *
 * Mounted at the top of the My Day route (so it only server-renders there) and
 * starts `active`, so it is part of the initial SSR HTML and owns the very first
 * painted frame — covering the streaming route skeleton with no flash. A tiny
 * pre-paint script in the root layout sets `data-welcome-hide` on <html> for the
 * already-welcomed reload case so that too stays flash-free; the effect below
 * then unmounts it. After a ~0.9s hold it fades out into My Day.
 */
export default function WelcomeOverlay() {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(true);
  const [leaving, setLeaving] = useState(false);

  // The component owns the `summ:welcomed` guard (the pre-paint script only
  // reads it, never writes it, so this check stays authoritative). We clear the
  // script's `data-welcome-hide` first so a stale attribute can't wrongly hide
  // the overlay on a later client-side navigation to My Day.
  useIsoLayoutEffect(() => {
    document.documentElement.removeAttribute("data-welcome-hide");

    if (reduceMotion || sessionStorage.getItem(WELCOMED_KEY)) {
      setActive(false);
      return;
    }

    setActive(true);
    sessionStorage.setItem(WELCOMED_KEY, "1");
    // Hold the branded moment, then fade out via the CSS transition below and
    // unmount once the fade completes. Plain CSS (not motion/AnimatePresence)
    // on purpose: a fade is all it needs and this keeps the motion runtime out
    // of the first-load JS.
    const leaveTimer = setTimeout(() => setLeaving(true), MIN_SHOW_MS);
    const unmountTimer = setTimeout(() => setActive(false), MIN_SHOW_MS + FADE_MS);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(unmountTimer);
    };
  }, [reduceMotion]);

  if (!active) return null;

  return (
    <div
      className="welcome-overlay fixed inset-0 z-[100] flex flex-col items-center justify-center motion-reduce:hidden"
      style={{
        backgroundColor: "var(--bg-app)",
        backgroundImage: "var(--login-bg-mesh)",
        opacity: leaving ? 0 : 1,
        transition: `opacity ${FADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        pointerEvents: leaving ? "none" : "auto",
      }}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Definite (non-%) width via a plain block wrapper: BrandLoader's
            line field is `w-full`, but every flex-column ancestor here uses
            items-center and shrink-wraps, so a percentage width has nothing
            to resolve against. A block wrapper with a vw-based width gives
            BrandLoader a real containing block → the lines fan full 420px. */}
        <div className="w-[min(420px,calc(100vw-3rem))]">
          <BrandLoader showMessages={false} />
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Setting up your day&hellip;
        </p>
      </div>
    </div>
  );
}
