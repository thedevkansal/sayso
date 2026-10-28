"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, CalendarPlus, Check, ExternalLink, Loader2, Mail, Plane, TrainFront, X } from "lucide-react";
import type { CalendarAction, TravelAction } from "@/lib/schemas";
import { actionKey, useApp, useAppApi } from "@/lib/store/demo";
import { conflictsFor, nextFreeSlot } from "@/lib/calendar";
import { bookEvent, sendReply } from "@/lib/client/pipeline";
import { formatDay, formatRange, formatTime, zonedToISO } from "@/lib/dates";
import { cn } from "@/lib/utils";

function CardShell({
  icon: Icon,
  title,
  done,
  doneLabel,
  children,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  done: boolean;
  doneLabel: string;
  children: React.ReactNode;
  tone?: "default" | "warn";
}) {
  return (
    <motion.section
      layout
      aria-label={title}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "overflow-hidden rounded-2xl border bg-surface",
        done ? "border-ok/30" : tone === "warn" ? "border-warn/40" : "border-line",
      )}
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm">
        <Icon className="size-4 text-ink-2" />
        <span className="font-medium text-ink">{title}</span>
        <AnimatePresence>
          {done && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok"
            >
              <Check className="size-3" strokeWidth={3} /> {doneLabel}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="p-4">{children}</div>
    </motion.section>
  );
}

/** Automated senders that won't read a reply or accept an invite. */
const isNoReply = (email?: string) => !!email && /(^|[._-])(no-?reply|do-?not-?reply|notifications?|mailer-daemon|bounce)s?([._+-]|@)/i.test(email);

const primaryBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-40";
const secondaryBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-sm font-medium text-ink hover:bg-surface-2";
const ghostBtn = "inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm text-mute hover:bg-surface-2 hover:text-ink";

export function SendCard({ threadId, disabled }: { threadId: string; disabled: boolean }) {
  const api = useAppApi();
  const p = useApp((s) => s.proposals[threadId]);
  const thread = useApp((s) => s.threads.find((t) => t.id === threadId));
  const status = useApp((s) => s.actionStatus[`${threadId}:send`]);
  const mode = useApp((s) => s.mode);
  const replyTo = useApp((s) => s.replyMeta[threadId]?.replyTo);
  const [sending, setSending] = useState(false);
  if (!p || !thread) return null;
  const to = mode === "live" ? replyTo : thread.messages.at(-1)!.from;
  const done = status === "done";
  const live = mode === "live";

  const send = async () => {
    setSending(true);
    try {
      await sendReply(api, threadId);
      toast.success("Reply sent", {
        description: live ? `Sent from your Gmail to ${to?.email}.` : "Saved to Sent. In the demo nothing leaves your browser.",
      });
    } catch (e) {
      toast.error("Couldn't send", { description: e instanceof Error ? e.message : "Try again." });
    } finally {
      setSending(false);
    }
  };

  return (
    <CardShell icon={Mail} title="Send reply" done={done} doneLabel="Sent">
      <dl className="grid grid-cols-[4.5rem_1fr] gap-y-1 text-sm">
        <dt className="text-mute">To</dt>
        <dd className="truncate text-ink">{to ? `${to.name} <${to.email}>` : "Resolving recipient…"}</dd>
        <dt className="text-mute">Subject</dt>
        <dd className="truncate text-ink">{p.replySubject}</dd>
      </dl>
      {!done && isNoReply(to?.email) && (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-warn-soft p-3 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> This looks like an automated no-reply address. Nobody will read a reply.
        </p>
      )}
      {live && !done && (
        <div className="mt-3">
          <p className="text-xs text-mute">Exactly this will be sent from your Gmail:</p>
          <pre className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-line bg-surface-2 p-3 font-sans text-sm whitespace-pre-wrap text-ink">
            {p.replyBody}
          </pre>
        </div>
      )}
      {!done && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-shortcut="send"
            disabled={disabled || sending || !p.replyBody.trim() || !to}
            className={primaryBtn}
            onClick={send}
          >
            {sending && <Loader2 className="size-4 animate-spin" />}
            {sending ? "Sending…" : live ? "Send from Gmail" : "Send reply"}
          </button>
          <span className="text-xs text-mute">
            {live ? "Real email. Goes out in this thread." : "Demo: goes to your in-app Sent folder"}
          </span>
        </div>
      )}
    </CardShell>
  );
}

export function CalendarCard({ threadId, action }: { threadId: string; action: CalendarAction }) {
  const key = actionKey(threadId, action.id);
  const status = useApp((s) => s.actionStatus[key]);
  const events = useApp((s) => s.events);
  const tz = useApp((s) => s.tz);
  const setStatus = useApp((s) => s.setActionStatus);
  const live = useApp((s) => s.mode === "live");
  const api = useAppApi();
  const [booking, setBooking] = useState(false);
  const done = status === "done";

  const conflicts = useMemo(
    () => (done ? [] : conflictsFor(events, action.startISO, action.endISO)),
    [events, action, done],
  );
  const alt = useMemo(
    () => (conflicts.length ? nextFreeSlot(events, action.startISO, action.endISO) : null),
    [conflicts, events, action],
  );

  if (status === "dismissed") return <DismissedRow label="Calendar invite dismissed" onUndo={() => setStatus(key, "pending")} />;

  const book = async (startISO: string, endISO: string) => {
    setBooking(true);
    let link: string | null | undefined;
    try {
      ({ htmlLink: link } = await bookEvent(api, { id: `ev-${key}`, title: action.title, startISO, endISO, attendees: action.attendees }));
    } catch (e) {
      toast.error("Couldn't add the event", { description: e instanceof Error ? e.message : "Try again." });
      return;
    } finally {
      setBooking(false);
    }
    setStatus(key, "done");
    const label = formatRange(startISO, endISO, tz);
    // Moved to another slot: keep the email in sync with what was actually booked.
    if (startISO !== action.startISO) {
      const s = api.getState();
      const body = s.proposals[threadId]?.replyBody ?? "";
      const original = formatRange(action.startISO, action.endISO, tz);
      if (body.includes(original)) {
        s.setReplyBody(threadId, body.replaceAll(original, label));
      } else if (s.actionStatus[`${threadId}:send`] !== "done") {
        toast.warning("Check the time in your draft", { description: `The call is now ${label}.` });
      }
    }
    toast.success(live ? "Added to Google Calendar" : "Added to calendar", {
      description: live && action.attendees.length ? `${label}. Invite emailed to ${action.attendees.join(", ")}.` : label,
      action: link ? { label: "Open", onClick: () => window.open(link!, "_blank", "noopener") } : undefined,
    });
  };

  return (
    <CardShell icon={CalendarPlus} title="Calendar invite" done={done} doneLabel="Added" tone={conflicts.length ? "warn" : "default"}>
      <p className="font-medium text-ink">{action.title}</p>
      <p className="mt-0.5 text-sm text-ink">{formatRange(action.startISO, action.endISO, tz)}</p>
      {action.attendees.length > 0 && (
        <p className="mt-1 text-xs text-mute">
          {live ? "Google will email an invite to " : "Invite: "}
          {action.attendees.join(", ")}
        </p>
      )}
      <p className="mt-2 text-xs text-mute">From what you said: &ldquo;{action.sourceQuote}&rdquo;</p>
      {!done && action.attendees.some(isNoReply) && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-warn">
          <AlertTriangle className="mt-px size-3.5 shrink-0" /> The invitee looks like an automated no-reply address.
        </p>
      )}

      {conflicts.length > 0 && (
        <div className="mt-3 rounded-xl bg-warn-soft p-3 text-sm text-warn">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-4" /> Clashes with {conflicts.length === 1 ? "an event" : `${conflicts.length} events`}
          </p>
          <ul className="mt-1 space-y-0.5">
            {conflicts.map((c) => (
              <li key={c.id}>
                {c.title}, {formatTime(c.startISO, tz)}–{formatTime(c.endISO, tz)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {conflicts.length === 0 && !done && <p className="mt-3 text-sm text-ok">No conflicts in your calendar</p>}

      {!done && (
        <div className="mt-4 flex flex-wrap gap-2">
          {alt ? (
            <>
              <button type="button" disabled={booking} className={primaryBtn} onClick={() => book(alt.startISO, alt.endISO)}>
                {booking && <Loader2 className="size-4 animate-spin" />}
                Book {formatTime(alt.startISO, tz)} instead
              </button>
              <button type="button" disabled={booking} className={secondaryBtn} onClick={() => book(action.startISO, action.endISO)}>
                Book anyway
              </button>
            </>
          ) : (
            <button type="button" disabled={booking} className={primaryBtn} onClick={() => book(action.startISO, action.endISO)}>
              {booking && <Loader2 className="size-4 animate-spin" />}
              {live ? "Add to Google Calendar" : "Add to calendar"}
            </button>
          )}
          <button type="button" className={ghostBtn} onClick={() => setStatus(key, "dismissed")}>
            <X className="size-3.5" /> Dismiss
          </button>
        </div>
      )}
    </CardShell>
  );
}

function trainSearchUrl(a: TravelAction) {
  const q = `trains from ${a.origin} to ${a.destination} on ${a.date}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

type FlightOffer = {
  id: string;
  airline: string;
  airlineCode: string;
  logo: string | null;
  flightNumbers: string[];
  departAt: string;
  arriveAt: string;
  origin: string;
  destination: string;
  durationMinutes: number | null;
  stops: number;
  amount: string;
  currency: string;
  reliable?: boolean;
  /** Set client-side when the airline's test system refused this fare. */
  unavailable?: boolean;
};

type FlightState =
  | { step: "idle" }
  | { step: "searching" }
  | { step: "results"; offers: FlightOffer[]; selected: string | null; notice?: string }
  | { step: "booking"; offers: FlightOffer[]; selected: string }
  | { step: "error"; message: string; offers?: FlightOffer[] };

const clock = (local: string) => {
  const [h, m] = local.slice(11, 16).split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ampm}`;
};
const hm = (mins: number | null) => (mins == null ? "" : `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`);
const money = (amount: string, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount));

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.message ?? "Something went wrong. Try again."), { code: data?.error as string });
  return data;
}

export function TravelCard({ threadId, action }: { threadId: string; action: TravelAction }) {
  const key = actionKey(threadId, action.id);
  const status = useApp((s) => s.actionStatus[key]);
  const booking = useApp((s) => s.bookings.find((b) => b.id === `bk-${key}`));
  const tz = useApp((s) => s.tz);
  const setStatus = useApp((s) => s.setActionStatus);
  const addBooking = useApp((s) => s.addBooking);
  const addEvent = useApp((s) => s.addEvent);
  const [flight, setFlight] = useState<FlightState>({ step: "idle" });

  if (status === "dismissed") return <DismissedRow label="Travel search dismissed" onUndo={() => setStatus(key, "pending")} />;
  const Icon = action.mode === "train" ? TrainFront : Plane;
  const when = action.timeOfDay === "any" ? "" : `, ${action.timeOfDay}`;
  const done = status === "done";

  const search = async () => {
    setFlight({ step: "searching" });
    try {
      const data = await postJson("/api/travel/search", {
        origin: action.origin,
        originCode: action.originCode,
        destination: action.destination,
        destinationCode: action.destinationCode,
        date: action.date,
        timeOfDay: action.timeOfDay,
        passengers: action.passengers,
      });
      if (!data.offers.length) setFlight({ step: "error", message: "No test flights for that day. Try another time of day." });
      else
        setFlight({
          step: "results",
          offers: data.offers,
          selected: (data.offers.find((o: FlightOffer) => o.reliable) ?? data.offers[0]).id,
        });
    } catch (e) {
      setFlight({ step: "error", message: e instanceof Error ? e.message : "Search failed." });
    }
  };

  const book = async (offers: FlightOffer[], selected: string) => {
    setFlight({ step: "booking", offers, selected });
    try {
      const data = await postJson("/api/travel/book", { offerId: selected });
      const f: FlightOffer = data.flight;
      const summary = `${f.airline} ${f.flightNumbers.join(" + ")} · ${f.origin} → ${f.destination} · ${formatDay(action.date, tz)}, ${clock(f.departAt)}`;
      addBooking({ id: `bk-${key}`, threadId, summary, reference: data.reference, createdAt: new Date().toISOString() });
      addEvent({
        id: `ev-${key}`,
        title: `Flight ${f.origin} → ${f.destination} (${f.flightNumbers[0]})`,
        startISO: zonedToISO(f.departAt.slice(0, 10), f.departAt.slice(11, 16), tz),
        endISO: zonedToISO(f.arriveAt.slice(0, 10), f.arriveAt.slice(11, 16), tz),
        source: "sayso",
      });
      setStatus(key, "done");
      toast.success("Test booking confirmed", { description: `Ref ${data.reference}. No payment taken.` });
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code === "offer_request_already_booked" || code === "offer_expired") {
        await search();
        return;
      }
      // The airline's test system refused this fare (common for non-Duffel test carriers).
      // Keep the list, mark the fare, and move the selection to one that will book.
      if (code === "offer_no_longer_available" || code === "price_changed") {
        const next = offers.map((o) => (o.id === selected ? { ...o, unavailable: true } : o));
        const fallback = next.find((o) => !o.unavailable && o.reliable) ?? next.find((o) => !o.unavailable);
        setFlight({
          step: "results",
          offers: next,
          selected: fallback?.id ?? null,
          notice: fallback
            ? `That fare isn't bookable in the airline's test system. ${fallback.reliable ? "Duffel Airways always books in test mode, so it's selected now." : "Pick another fare."}`
            : "None of these fares can be booked in the test system right now. Search again.",
        });
        return;
      }
      setFlight({ step: "error", message: e instanceof Error ? e.message : "Booking failed.", offers });
    }
  };

  return (
    <CardShell icon={Icon} title={action.mode === "train" ? "Train options" : "Flight options"} done={done} doneLabel="Test booked">
      <p className="font-medium text-ink">
        {action.origin}
        {action.originCode ? ` (${action.originCode})` : ""} → {action.destination}
        {action.destinationCode ? ` (${action.destinationCode})` : ""}
      </p>
      <p className="mt-0.5 text-sm text-ink">
        {formatDay(action.date, tz)}
        {when} · {action.passengers} {action.passengers === 1 ? "traveller" : "travellers"}
      </p>
      <p className="mt-2 text-xs text-mute">From what you said: &ldquo;{action.sourceQuote}&rdquo;</p>

      {done && booking ? (
        <div className="mt-3 rounded-xl border border-ok/30 bg-ok-soft p-3 text-sm">
          <p className="font-medium text-ok">Test booking — no payment taken</p>
          <p className="mt-1 text-ink">{booking.summary}</p>
          <p className="mt-1 font-mono text-xs text-ink-2">Booking reference {booking.reference}</p>
        </div>
      ) : (
        <>
          {action.mode === "flight" && flight.step === "searching" && (
            <div className="mt-3 space-y-2" aria-busy="true" aria-label="Searching test flights">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-line" />
              ))}
            </div>
          )}

          {action.mode === "flight" && (flight.step === "results" || flight.step === "booking") && (
            <fieldset className="mt-3" disabled={flight.step === "booking"}>
              <legend className="mb-2 text-xs text-mute">Test fares from Duffel. Pick one.</legend>
              <div className="space-y-2">
                {flight.offers.map((o, i) => {
                  const checked = flight.selected === o.id;
                  return (
                    <motion.label
                      key={o.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                        o.unavailable
                          ? "cursor-not-allowed border-dashed border-line opacity-55"
                          : checked
                            ? "cursor-pointer border-ink bg-surface-2"
                            : "cursor-pointer border-line hover:border-line-strong",
                      )}
                    >
                      <input
                        type="radio"
                        name={`fare-${key}`}
                        className="sr-only"
                        checked={checked}
                        disabled={o.unavailable}
                        onChange={() => flight.step === "results" && setFlight({ ...flight, selected: o.id })}
                      />
                      {o.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.logo} alt="" className="size-6 shrink-0 rounded" />
                      ) : (
                        <Plane className="size-5 shrink-0 text-mute" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-ink tabular-nums">
                          {clock(o.departAt)} – {clock(o.arriveAt)}
                        </span>
                        <span className="block truncate text-xs text-mute">
                          {o.airline} · {hm(o.durationMinutes)} · {o.stops === 0 ? "Nonstop" : `${o.stops} stop`}
                        </span>
                        {o.unavailable ? (
                          <span className="block text-[11px] font-medium text-risk">Not available in test mode</span>
                        ) : o.reliable ? (
                          <span className="block text-[11px] font-medium text-ok">Always books in test mode</span>
                        ) : null}
                      </span>
                      <span className="font-medium text-ink tabular-nums">{money(o.amount, o.currency)}</span>
                    </motion.label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {flight.step === "results" && flight.notice && (
            <p role="status" className="mt-3 rounded-xl bg-warn-soft p-3 text-sm text-warn">
              {flight.notice}
            </p>
          )}
          {flight.step === "error" && <p className="mt-3 rounded-xl bg-risk-soft p-3 text-sm text-risk">{flight.message}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {action.mode === "flight" &&
              (flight.step === "results" || flight.step === "booking" ? (
                <button
                  type="button"
                  className={primaryBtn}
                  disabled={flight.step === "booking" || !flight.selected}
                  onClick={() => flight.step === "results" && flight.selected && book(flight.offers, flight.selected)}
                >
                  {flight.step === "booking" ? <Loader2 className="size-4 animate-spin" /> : null}
                  {flight.step === "booking" ? "Booking…" : "Book test flight"}
                </button>
              ) : (
                <button type="button" className={primaryBtn} disabled={flight.step === "searching"} onClick={search}>
                  {flight.step === "searching" ? <Loader2 className="size-4 animate-spin" /> : <Plane className="size-4" />}
                  {flight.step === "error" ? "Search again" : "Search test flights"}
                </button>
              ))}
            <a href={trainSearchUrl(action)} target="_blank" rel="noopener noreferrer" className={secondaryBtn}>
              Search trains <ExternalLink className="size-3.5" />
            </a>
            <button type="button" className={ghostBtn} onClick={() => setStatus(key, "dismissed")}>
              <X className="size-3.5" /> Dismiss
            </button>
          </div>
          {action.mode === "flight" && (
            <p className="mt-2 text-xs text-mute" aria-live="polite">
              {flight.step === "booking"
                ? "Confirming with the airline's test system. This can take up to 30 seconds."
                : "Test booking — no payment taken. Uses Duffel's test environment."}
            </p>
          )}
        </>
      )}
    </CardShell>
  );
}

function DismissedRow({ label, onUndo }: { label: string; onUndo: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-dashed border-line px-4 py-2.5 text-sm text-mute">
      {label}
      <button type="button" onClick={onUndo} className="font-medium text-ink hover:underline">
        Undo
      </button>
    </div>
  );
}
