import Link from "next/link";
import { Logo } from "./logo";

const groups = [
  {
    title: "Product",
    links: [
      { href: "/app", label: "Demo" },
      { href: "/connect", label: "Connect Gmail" },
      { href: "/#how", label: "How it works" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/#safety", label: "Safety model" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm space-y-4">
          <Logo />
          <p className="text-sm leading-relaxed text-mute">
            Answer email by talking. Sayso turns a spoken ramble into a complete, point-by-point reply and
            only acts when you click.
          </p>
          <p className="text-sm leading-relaxed text-mute">
            Built for <span className="text-ink">No Hands: The Wispr Challenge</span>. Designed for dictation
            with Wispr Flow. Sayso is an independent project and is not affiliated with Wispr.
          </p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="text-sm font-medium text-ink">{g.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-mute hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-mute sm:flex-row sm:justify-between sm:px-6">
          <p>© 2026 Sayso. Demo data is fictional.</p>
          <p>Nothing is sent without your click.</p>
        </div>
      </div>
    </footer>
  );
}
