import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = {
  title: "Live inbox",
  robots: { index: false },
};

export default function LivePage() {
  return (
    <Suspense fallback={<div className="h-dvh animate-pulse bg-canvas" />}>
      <LiveGate />
    </Suspense>
  );
}

async function LiveGate() {
  const session = await auth();
  if (!session?.user) redirect("/connect");
  return <AppShell mode="live" />;
}
