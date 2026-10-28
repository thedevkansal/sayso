"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

/** Placeholder with the visual's footprint so nothing shifts when it loads. */
function Frame() {
  return (
    <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-[22px] border border-line bg-surface shadow-float" aria-hidden>
      <div className="h-[41px] border-b border-line bg-surface-2" />
      <div className="h-[560px] md:h-[420px]" />
    </div>
  );
}

const HeroVisual = dynamic(() => import("./hero-visual").then((m) => m.HeroVisual), { ssr: false, loading: Frame });

/**
 * The animated product loop carries the animation library. Load it only after the page has
 * painted and gone idle, so it never competes with first paint or hydration.
 */
export function HeroVisualLazy() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idle = (cb: () => void) =>
      typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 200);
    const go = () => idle(() => setReady(true));
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);

  return ready ? <HeroVisual /> : <Frame />;
}
