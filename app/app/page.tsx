import type { Metadata } from "next";
import { DemoApp } from "@/components/app/demo-app";

export const metadata: Metadata = {
  title: "Demo inbox",
  description: "Answer a fictional inbox by talking. No sign-up; everything stays in your browser.",
};

export default function AppPage() {
  return <DemoApp />;
}
