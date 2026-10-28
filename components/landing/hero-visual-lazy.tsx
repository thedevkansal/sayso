"use client";

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

// The animated product loop carries the animation library; keep it off the critical path.
export const HeroVisualLazy = dynamic(() => import("./hero-visual").then((m) => m.HeroVisual), {
  ssr: false,
  loading: Frame,
});
