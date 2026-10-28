import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarCheck2, Check, Lock, MailOpen, Send } from "lucide-react";
import { auth, signIn } from "@/auth";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";

export const metadata: Metadata = {
  title: "Connect Gmail",
  description: "Use Sayso on your real inbox. Read, send and calendar access only; nothing is stored.",
};

const SCOPES = [
  { icon: MailOpen, title: "Read your email", body: "To open the thread you're answering. Fetched on demand, never stored." },
  { icon: Send, title: "Send email as you", body: "Only when you click Send on a card that shows the exact recipient, subject and body." },
  { icon: CalendarCheck2, title: "Add calendar events", body: "Only when you confirm an invite card. Conflicts are checked first." },
];

export default function ConnectPage({ searchParams }: PageProps<"/connect">) {
  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 pt-20 pb-24 sm:px-6">
        <h1 className="text-display text-[clamp(2.5rem,6vw,4rem)] text-balance text-ink">Use Sayso on your real inbox</h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-2">
          Connect Google to answer real threads by voice. Sayso asks for three permissions and nothing more.
        </p>

        <ul className="mt-10 space-y-3">
          {SCOPES.map((s) => (
            <li key={s.title} className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
              <s.icon className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
              <div>
                <p className="font-medium text-ink">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <Suspense fallback={<div className="mt-10 h-12 w-56 animate-pulse rounded-full bg-line" />}>
          <ConnectAction searchParams={searchParams} />
        </Suspense>

        <div className="mt-12 space-y-3 rounded-2xl bg-surface-2 p-5 text-sm leading-relaxed text-ink-2">
          <p className="flex items-center gap-2 font-medium text-ink">
            <Lock className="size-4" /> Good to know
          </p>
          <p>
            Your session lives in an encrypted cookie in this browser. There is no database; email content is read when you open a
            thread and sent to the model to draft your reply, then discarded.
          </p>
          <p>
            The Google app is in Testing mode, so only approved test accounts can connect, and Google may ask you to sign in again
            after about seven days.
          </p>
          <p>
            Just looking? The <Link href="/app" className="text-ink underline underline-offset-2">demo inbox</Link> needs no sign-in.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}

async function ConnectAction({ searchParams }: { searchParams: PageProps<"/connect">["searchParams"] }) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const error = typeof params.error === "string" ? params.error : null;
  const connected = session?.user && !(session as { error?: string }).error;

  if (connected)
    return (
      <div className="mt-10 rounded-2xl border border-ok/30 bg-ok-soft p-5">
        <p className="flex items-center gap-2 font-medium text-ok">
          <Check className="size-4" /> Connected as {session.user?.email}
        </p>
        {(session as { scopesOk?: boolean }).scopesOk === false && (
          <p className="mt-2 text-sm text-warn">
            Some permissions weren&apos;t granted. Sending or calendar invites won&apos;t work until you reconnect and tick every box.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/app/live" className="inline-flex h-11 items-center rounded-full bg-ink px-5 font-medium text-primary-foreground">
            Open my inbox
          </Link>
          <ConnectButton label="Reconnect" variant="secondary" />
        </div>
      </div>
    );

  return (
    <div className="mt-10">
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-risk-soft p-3 text-sm text-risk">
          {error === "AccessDenied"
            ? "Google didn't allow access. If this account isn't an approved test user, it can't connect yet."
            : "Couldn't connect to Google. Try again."}
        </p>
      )}
      <ConnectButton label="Connect Google" />
    </div>
  );
}

function ConnectButton({ label, variant = "primary" }: { label: string; variant?: "primary" | "secondary" }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/app/live" });
      }}
    >
      <button
        type="submit"
        className={
          variant === "primary"
            ? "inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 font-medium text-primary-foreground hover:opacity-85"
            : "inline-flex h-11 items-center rounded-full border border-line-strong px-5 font-medium text-ink hover:bg-surface-2"
        }
      >
        {label}
      </button>
    </form>
  );
}
