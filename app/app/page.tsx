import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/site/logo";

export const metadata: Metadata = { title: "Demo inbox" };

// Placeholder until milestone 2 lands the three-pane app.
export default function AppPage() {
  return (
    <main className="bg-grid flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <Logo />
      <h1 className="text-title text-3xl text-ink">The demo inbox is being wired up.</h1>
      <p className="max-w-md text-ink-2">Check back shortly. In the meantime, the landing page shows how it works.</p>
      <Link href="/" className="inline-flex h-11 items-center rounded-full bg-ink px-5 font-medium text-primary-foreground">
        Back to home
      </Link>
    </main>
  );
}
