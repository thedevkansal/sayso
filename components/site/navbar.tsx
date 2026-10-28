"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#safety", label: "Safety" },
  { href: "/#faq", label: "FAQ" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-3 z-50 px-4 sm:top-4">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 rounded-full border border-line bg-surface/85 pr-2 pl-5 shadow-float backdrop-blur-md"
      >
        <Logo />
        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="rounded-full px-3 py-1.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/app"
            className="hidden h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85 sm:inline-flex"
          >
            Try the demo
          </Link>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full hover:bg-surface-2 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>
      {open && (
        <div
          id="mobile-nav"
          className="mx-auto mt-2 max-w-5xl animate-in rounded-3xl border border-line bg-surface p-2 shadow-float fade-in slide-in-from-top-2 duration-200 md:hidden"
        >
          <ul>
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-ink-2 hover:bg-surface-2 hover:text-ink"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="p-1">
              <Link
                href="/app"
                className="flex h-11 items-center justify-center rounded-full bg-ink text-sm font-medium text-primary-foreground"
              >
                Try the demo
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
