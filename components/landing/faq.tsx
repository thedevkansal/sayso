"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const QA = [
  {
    q: "Do I need Wispr Flow to use Sayso?",
    a: "No. The composer is a normal text box, so you can type. Sayso is designed for dictation though: hold your Flow key, talk the way you would to a colleague, and let go. Rambling, out-of-order facts and corrections are all expected.",
  },
  {
    q: "Why not just dictate straight into Gmail?",
    a: "Flow already types anywhere. What it can't do is read the thread. Sayso finds every question the sender asked, matches your answer to each one, tells you what you forgot, and turns things like \"call her Friday at 5\" into a calendar invite you can confirm.",
  },
  {
    q: "Will it ever send something on its own?",
    a: "No. Every send, calendar event and booking sits on a confirm card until you click it. In live mode the card shows the exact recipient, subject and body that will go out.",
  },
  {
    q: "What happens with my email data?",
    a: "The demo uses a fictional inbox and stores everything in your browser. In live mode Sayso reads the thread you open, sends it to the model to draft a reply, and stores nothing on a server. There is no database.",
  },
  {
    q: "What if an email tries to give Sayso instructions?",
    a: "Email text is treated as data, never as commands. Only your own dictation can create an action, and emails that contain instructions aimed at an AI are flagged in the inbox.",
  },
  {
    q: "Is the flight booking real?",
    a: "No. Flights use the Duffel test environment, so you see real-looking offers and a test order, labelled \"Test booking — no payment taken\". Trains open a prefilled search link and stop there.",
  },
];

export function Faq() {
  return (
    <Accordion className="divide-y divide-line rounded-3xl border border-line bg-surface px-5 sm:px-7">
      {QA.map((item) => (
        <AccordionItem key={item.q} value={item.q} className="border-0">
          <AccordionTrigger className="py-5 text-base font-medium text-ink hover:no-underline">
            {item.q}
          </AccordionTrigger>
          <AccordionContent>
            <p className="max-w-[68ch] pb-5 text-[0.95rem] leading-relaxed text-ink-2">{item.a}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
