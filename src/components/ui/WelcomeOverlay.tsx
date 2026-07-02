"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import BrandLoader from "@/components/ui/BrandLoader";

const WELCOMED_KEY = "summ:welcomed";
const MIN_SHOW_MS = 900;

/**
 * Post-login branded moment. The login server action's fallback redirect
 * carries ?welcome=1 (fresh logins only — mid-session re-auth follows its
 * callbackUrl and never gets the param), so normal navigation renders null
 * here at zero cost. The overlay renders from the very first paint (covering
 * the route skeleton) while the real page streams in behind it; after a
 * ~0.9s minimum it fades out into the landing reveal already running
 * underneath.
 *
 * Mounted in (app)/layout.tsx inside <Suspense> (useSearchParams).
 */
export default function WelcomeOverlay() {
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  // Captured once: stripping the param below syncs into useSearchParams, and
  // reading it live would unmount the overlay a frame after it appeared.
  const [active] = useState(() => searchParams.get("welcome") === "1");
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!active) return;

    // Strip the param without a router round-trip: router.replace on this
    // force-dynamic page would refetch the route mid-overlay, while native
    // replaceState is synced into the Next router (since 14.1).
    window.history.replaceState(null, "", window.location.pathname);

    // Replay guard (back button / bfcache with the param still in the URL)
    // and reduced motion (no artificial delay — the CSS motion-reduce:hidden
    // below already keeps the overlay invisible from first paint) dismiss
    // immediately; a fresh login holds the branded moment for MIN_SHOW_MS.
    const skip = Boolean(sessionStorage.getItem(WELCOMED_KEY)) || reduceMotion;
    if (!skip) sessionStorage.setItem(WELCOMED_KEY, "1");
    const timer = setTimeout(() => setLeaving(true), skip ? 0 : MIN_SHOW_MS);
    return () => clearTimeout(timer);
  }, [active, reduceMotion]);

  if (!active) return null;

  return (
    <AnimatePresence>
      {!leaving && (
        <motion.div
          key="welcome"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center motion-reduce:hidden"
          style={{
            backgroundColor: "var(--bg-app)",
            backgroundImage: "var(--login-bg-mesh)",
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-col items-center gap-6">
            <BrandLoader showMessages={false} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Setting up your day&hellip;
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
