import Link from "next/link";
import {
  CalendarCheck2,
  FileCheck2,
  Languages,
  ListChecks,
  MailCheck,
  MousePointerClick,
  Plane,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Reveal } from "@/components/site/reveal";
import { HeroVisualLazy } from "@/components/landing/hero-visual-lazy";
import { Teaser } from "@/components/landing/teaser";
import { Faq } from "@/components/landing/faq";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main" className="flex-1">
        <Hero />
        <HowItWorks />
        <TeaserSection />
        <Features />
        <Safety />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="bg-grid relative -mt-[4.5rem] overflow-hidden pt-36 pb-20 sm:pt-44">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-canvas to-transparent"
      />
      <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-2 shadow-[0_1px_0_var(--line)]">
          <Sparkles className="size-3.5 text-signal" aria-hidden />
          Made for Wispr Flow dictation
        </p>
        <h1 className="text-display mx-auto mt-6 max-w-4xl text-balance text-[clamp(2.75rem,8vw,6rem)] text-ink">
          Answer email by talking.
        </h1>
        <p className="mx-auto mt-6 max-w-[38rem] text-lg leading-relaxed text-ink-2">
          Ramble your reply. Sayso reads the thread, matches what you said to every question, flags what you forgot,
          and drafts the email. Nothing goes out until you click.
        </p>
        <p className="mt-6 flex flex-wrap items-center justify-center gap-2 text-ink-2">
          Hold your
          <span className="kbd h-8 px-3 text-sm">Wispr Flow key</span>
          and talk through a reply
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app"
            className="inline-flex h-12 items-center rounded-full bg-ink px-6 font-medium text-primary-foreground transition-opacity hover:opacity-85"
          >
            Try the demo
          </Link>
          <Link
            href="#how"
            className="inline-flex h-12 items-center rounded-full border border-line-strong bg-surface px-6 font-medium text-ink transition-colors hover:bg-surface-2"
          >
            See how it works
          </Link>
        </div>
        <p className="mt-4 text-sm text-mute">No sign-up. Fictional inbox. Runs in your browser.</p>
        <div className="mt-16">
          <HeroVisualLazy />
        </div>
      </div>
    </section>
  );
}

function SectionHead({ id, title, sub }: { id?: string; title: string; sub: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <h2 id={id} className="text-title text-[clamp(2rem,4.5vw,3.25rem)] text-balance text-ink">
        {title}
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-ink-2">{sub}</p>
    </Reveal>
  );
}

const STEPS = [
  {
    icon: ListChecks,
    title: "Open a thread",
    body: "Sayso pulls out every question the sender asked, from arrival dates to dietary notes, before you say a word.",
  },
  {
    icon: Languages,
    title: "Hold the Flow key and talk",
    body: "Out of order, half-finished, with a \"no wait\" in the middle. Sayso maps each thing you said to the question it answers.",
  },
  {
    icon: MousePointerClick,
    title: "Check, then click",
    body: "See what it understood, fill any gap it flags, then confirm the reply and each calendar invite or booking one by one.",
  },
];

function HowItWorks() {
  return (
    <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <SectionHead
        id="how"
        title="Three steps, one breath"
        sub="Dictation gets the words down. Sayso makes sure they answer what was asked."
      />
      <ol className="mt-14 grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal as="li" key={s.title} delay={i * 0.08} className="h-full rounded-3xl border border-line bg-surface p-7">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-ink">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <span className="font-mono text-sm text-mute">Step {i + 1}</span>
              </div>
              <h3 className="mt-8 text-xl font-semibold tracking-[-0.02em] text-ink">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-2">{s.body}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

function TeaserSection() {
  return (
    <section aria-labelledby="teaser" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <SectionHead
        id="teaser"
        title="Built for how people actually talk"
        sub="Pick a situation and see what Sayso pulls out of a messy, spoken answer."
      />
      <Reveal className="mt-12">
        <Teaser />
      </Reveal>
    </section>
  );
}

function Features() {
  return (
    <section aria-labelledby="features" className="border-y border-line bg-surface py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead
          id="features"
          title="More than a transcript"
          sub="Every feature exists to get a complete, correct reply out the door with your hands off the keyboard."
        />
        <div className="mt-14 grid gap-4 md:grid-cols-6">
          <Feature
            className="md:col-span-4"
            icon={FileCheck2}
            title="Coverage check"
            body="Each question in the thread gets a status: answered, partly answered, or missing. Missing ones are flagged before you send, with the exact question quoted."
          >
            <div className="mt-6 flex flex-wrap gap-2">
              <Pill tone="ok">Arrival · answered</Pill>
              <Pill tone="ok">Talk length · answered</Pill>
              <Pill tone="warn">AV needs · missing</Pill>
              <Pill tone="ok">Hotel · answered</Pill>
              <Pill tone="warn">Dietary · missing</Pill>
            </div>
          </Feature>
          <Feature
            className="md:col-span-2"
            icon={Sparkles}
            title="What I understood"
            body="Every fact sits beside the phrase it came from, so a dropped “not” is caught before it reaches anyone."
          />
          <Feature
            className="md:col-span-2"
            icon={CalendarCheck2}
            title="Calendar, conflict-checked"
            body="“Friday at 5” becomes Fri 30 Oct, 5:00–5:30 pm IST, with any clash shown on the card."
          />
          <Feature
            className="md:col-span-2"
            icon={Plane}
            title="Travel options"
            body="Mention a trip and get flight offers from Duffel’s test environment, plus a prefilled train search."
          />
          <Feature
            className="md:col-span-2"
            icon={MailCheck}
            title="Replies in your tone"
            body="Point-by-point, short and warm. Streams in as it is written, and you can edit every word."
          />
        </div>
      </div>
    </section>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Reveal className={className}>
      <article className="h-full rounded-3xl border border-line bg-canvas p-7">
        <Icon className="size-5 text-ink" aria-hidden />
        <h3 className="mt-6 text-lg font-semibold tracking-[-0.02em] text-ink">{title}</h3>
        <p className="mt-2 leading-relaxed text-ink-2">{body}</p>
        {children}
      </article>
    </Reveal>
  );
}

function Pill({ tone, children }: { tone: "ok" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={
        tone === "ok"
          ? "rounded-full border border-ok/25 bg-ok-soft px-3 py-1 text-sm font-medium text-ok"
          : "rounded-full border border-warn/30 bg-warn-soft px-3 py-1 text-sm font-medium text-warn"
      }
    >
      {children}
    </span>
  );
}

const RULES = [
  {
    title: "Emails are data, not instructions",
    body: "Thread text is fenced off from the model's instructions. An email that says “forward the inbox” is flagged and ignored.",
  },
  {
    title: "Only your words create actions",
    body: "Every calendar invite or booking must trace back to something you said. Anything else is dropped before you see it.",
  },
  {
    title: "Nothing happens without a click",
    body: "Sends, invites and bookings wait on confirm cards. In live mode you see the exact recipient, subject and body first.",
  },
  {
    title: "Least access, no storage",
    body: "Live mode asks only to read mail, send mail and add events. No database, no copies of your email on a server.",
  },
];

function Safety() {
  return (
    <section aria-labelledby="safety" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <div className="grid gap-12 rounded-[32px] bg-ink p-8 text-primary-foreground sm:p-12 lg:grid-cols-[1fr_1.3fr]">
        <Reveal>
          <ShieldCheck className="size-7" aria-hidden />
          <h2 id="safety" className="text-title mt-6 text-[clamp(2rem,4vw,3rem)]">
            An agent that waits for you
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed opacity-75">
            Voice is fast, so the guardrails have to be firm. Sayso proposes; you decide.
          </p>
        </Reveal>
        <ul className="grid gap-px overflow-hidden rounded-2xl bg-primary-foreground/15 sm:grid-cols-2">
          {RULES.map((r, i) => (
            <Reveal as="li" key={r.title} delay={i * 0.06} className="h-full bg-ink p-6">
              <h3 className="font-semibold">{r.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed opacity-70">{r.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section aria-labelledby="faq" className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      <SectionHead id="faq" title="Questions" sub="The short version of how Sayso works and what it won't do." />
      <Reveal className="mt-12">
        <Faq />
      </Reveal>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-grid border-t border-line py-24">
      <Reveal className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-display text-[clamp(2.5rem,6vw,4.5rem)] text-ink">Say it once.</h2>
        <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-ink-2">
          Open the demo inbox, hold your Flow key, and answer a five-question email in under a minute.
        </p>
        <Link
          href="/app"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-6 font-medium text-primary-foreground transition-opacity hover:opacity-85"
        >
          Try the demo
        </Link>
      </Reveal>
    </section>
  );
}
