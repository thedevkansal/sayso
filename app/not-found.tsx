import Link from "next/link";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Waveform } from "@/components/site/waveform";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main id="main" className="bg-grid flex flex-1 items-center justify-center px-4 py-32">
        <div className="text-center">
          <Waveform active={false} className="mx-auto h-10 justify-center text-mute" />
          <h1 className="text-display mt-6 text-[clamp(2.5rem,6vw,4rem)] text-ink">Nothing here.</h1>
          <p className="mx-auto mt-4 max-w-sm text-lg leading-relaxed text-ink-2">
            This page doesn&apos;t exist. The demo inbox does, and it has five emails waiting.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/app"
              className="inline-flex h-11 items-center rounded-full bg-ink px-5 font-medium text-primary-foreground hover:opacity-85"
            >
              Open the demo
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-full border border-line-strong bg-surface px-5 font-medium text-ink hover:bg-surface-2"
            >
              Go home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
