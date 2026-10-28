import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = {
  title: "Demo inbox",
  description: "Answer a fictional inbox by talking. No sign-up; everything stays in your browser.",
};

export default function AppPage() {
  return <AppShell mode="demo" />;
}
