import "server-only";
import { LIMITS, type Thread } from "@/lib/schemas";
import { google } from "./client";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

type Header = { name: string; value: string };
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[]; headers?: Header[] };
type GMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: Part & { headers?: Header[] };
};

const header = (m: GMessage, name: string) =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

/** "Mira Okafor <mira@x.com>" → { name, email }. */
export function parseAddress(raw: string) {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || m[2].trim(), email: m[2].trim().toLowerCase() };
  const email = raw.trim().toLowerCase();
  return { name: email, email };
}

function parseList(raw: string) {
  // Split on commas that aren't inside quotes.
  return (raw.match(/(?:"[^"]*"|[^,])+/g) ?? []).map((s) => s.trim()).filter(Boolean).map(parseAddress);
}

const decode = (data: string) => Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findPart(p: Part | undefined, type: string): Part | undefined {
  if (!p) return undefined;
  if (p.mimeType === type && p.body?.data) return p;
  for (const c of p.parts ?? []) {
    const hit = findPart(c, type);
    if (hit) return hit;
  }
  return undefined;
}

/** Plain-text body with quoted history trimmed (the thread already contains earlier messages). */
function bodyText(m: GMessage) {
  const plain = findPart(m.payload, "text/plain");
  const html = plain ? undefined : findPart(m.payload, "text/html");
  let text = plain?.body?.data ? decode(plain.body.data) : html?.body?.data ? htmlToText(decode(html.body.data)) : m.snippet ?? "";
  const quoteStart = text.search(/\n\s*On .{5,200}wrote:\s*\n|\n-{2,}\s*Original Message\s*-{2,}|\n>.*\n>/);
  if (quoteStart > 40) text = text.slice(0, quoteStart);
  return text.replace(/\r\n/g, "\n").trim().slice(0, LIMITS.messageBody);
}

export type InboxItem = {
  id: string;
  subject: string;
  from: { name: string; email: string };
  date: string;
  preview: string;
  unread: boolean;
  starred: boolean;
  count: number;
};

export async function listInbox(token: string): Promise<InboxItem[]> {
  const q = encodeURIComponent("in:inbox -category:promotions -category:social -category:forums");
  const list = await google<{ threads?: { id: string }[] }>(token, `${GMAIL}/threads?maxResults=15&q=${q}`);
  const ids = (list.threads ?? []).map((t) => t.id);
  const meta = "format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date";
  const threads = await Promise.all(
    ids.map((id) => google<{ id: string; messages: GMessage[] }>(token, `${GMAIL}/threads/${id}?${meta}`).catch(() => null)),
  );
  return threads
    .filter((t): t is { id: string; messages: GMessage[] } => Boolean(t?.messages?.length))
    .map((t) => {
      const last = t.messages.at(-1)!;
      return {
        id: t.id,
        subject: header(t.messages[0], "Subject") || "(no subject)",
        from: parseAddress(header(last, "From")),
        date: new Date(Number(last.internalDate ?? Date.now())).toISOString(),
        preview: (last.snippet ?? "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&"),
        unread: t.messages.some((m) => m.labelIds?.includes("UNREAD")),
        starred: t.messages.some((m) => m.labelIds?.includes("STARRED")),
        count: t.messages.length,
      };
    });
}

export type ReplyMeta = {
  replyTo: { name: string; email: string };
  subject: string;
  messageId: string;
  references: string;
  participants: string[];
};

export async function getThread(token: string, id: string, me: string): Promise<{ thread: Thread; reply: ReplyMeta }> {
  const t = await google<{ id: string; messages: GMessage[] }>(token, `${GMAIL}/threads/${encodeURIComponent(id)}?format=full`);
  const msgs = t.messages.slice(-LIMITS.messagesPerThread);
  const thread: Thread = {
    id: t.id,
    subject: (header(msgs[0], "Subject") || "(no subject)").slice(0, LIMITS.subject),
    messages: msgs.map((m) => ({
      id: m.id,
      from: parseAddress(header(m, "From")),
      to: parseList(header(m, "To")).slice(0, 20),
      date: new Date(Number(m.internalDate ?? Date.now())).toISOString(),
      body: bodyText(m),
    })),
  };

  // Reply to the latest message not sent by the user, honouring Reply-To.
  const lastFromOther = [...msgs].reverse().find((m) => parseAddress(header(m, "From")).email !== me) ?? msgs.at(-1)!;
  const replyToRaw = header(lastFromOther, "Reply-To") || header(lastFromOther, "From");
  const subject = header(msgs[0], "Subject") || "";
  const participants = new Set<string>();
  for (const m of msgs)
    for (const h of ["From", "To", "Cc", "Reply-To"]) for (const a of parseList(header(m, h))) participants.add(a.email);

  return {
    thread,
    reply: {
      replyTo: parseAddress(replyToRaw),
      subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
      messageId: header(lastFromOther, "Message-ID") || header(lastFromOther, "Message-Id"),
      references: [header(lastFromOther, "References"), header(lastFromOther, "Message-ID")].filter(Boolean).join(" "),
      participants: [...participants],
    },
  };
}

/** RFC 2047 encode non-ASCII header values. */
const encodeHeader = (v: string) => (/^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`);
const clean = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

export async function sendReply(
  token: string,
  msg: { threadId: string; to: string; subject: string; body: string; inReplyTo?: string; references?: string },
) {
  const headers = [
    `To: ${clean(msg.to)}`,
    `Subject: ${encodeHeader(clean(msg.subject))}`,
    ...(msg.inReplyTo ? [`In-Reply-To: ${clean(msg.inReplyTo)}`] : []),
    ...(msg.references ? [`References: ${clean(msg.references)}`] : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  const body = Buffer.from(msg.body.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
  const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`, "utf8").toString("base64url");
  return google<{ id: string; threadId: string }>(token, `${GMAIL}/messages/send`, {
    method: "POST",
    body: { raw, threadId: msg.threadId },
  });
}
