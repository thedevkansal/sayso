"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "sayso-flow-hotkey";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Wispr Flow's out-of-the-box shortcut; users often change it, so it's only a default. */
export function defaultFlowKey() {
  return isMac() ? ["fn"] : ["Ctrl", "Win"];
}

function readSaved(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.every((k) => typeof k === "string") && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

function keyLabel(e: KeyboardEvent) {
  const mac = isMac();
  switch (e.key) {
    case "Control":
      return "Ctrl";
    case "Meta":
      return mac ? "⌘" : "Win";
    case "Alt":
      return mac ? "⌥" : e.location === 2 ? "Right Alt" : "Alt";
    case "Shift":
      return "Shift";
    case "Fn":
      return "fn";
    case " ":
      return "Space";
    default:
      return e.key.length === 1 ? e.key.toUpperCase() : e.key;
  }
}

const ORDER = ["fn", "Ctrl", "⌥", "Alt", "Right Alt", "Shift", "⌘", "Win"];
const sortKeys = (keys: string[]) =>
  [...keys].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));

/**
 * "Hold <your Flow key> to dictate" hint. Shows the user's own Flow shortcut once they record it
 * (kept in this browser only), otherwise the platform default labelled as such.
 */
export function FlowKeyHint() {
  const [saved, setSaved] = useState<string[] | null>(() => (typeof window === "undefined" ? null : readSaved()));
  const [recording, setRecording] = useState(false);
  const held = useRef(new Set<string>());
  const combo = useRef<string[]>([]);

  useEffect(() => {
    if (!recording) return;
    held.current.clear();
    combo.current = [];
    const down = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return setRecording(false);
      held.current.add(keyLabel(e));
      if (held.current.size > combo.current.length) combo.current = sortKeys([...held.current]);
    };
    const up = (e: KeyboardEvent) => {
      e.preventDefault();
      held.current.delete(keyLabel(e));
      if (held.current.size === 0 && combo.current.length) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(combo.current));
        } catch {
          /* storage blocked: still show it for this session */
        }
        setSaved(combo.current);
        setRecording(false);
      }
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
    };
  }, [recording]);

  if (recording)
    return (
      <span className="flex items-center gap-1.5 text-xs text-ink" role="status">
        <span className="size-1.5 animate-pulse rounded-full bg-signal" />
        Press and release your Wispr Flow shortcut… <span className="text-mute">(Esc to cancel)</span>
      </span>
    );

  const keys = saved ?? defaultFlowKey();
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-mute">
      Hold {saved ? "" : "your Flow key"}
      <span className="inline-flex items-center gap-1">
        {!saved && "(default"}
        {keys.map((k) => (
          <kbd key={k} className="kbd">
            {k}
          </kbd>
        ))}
        {!saved && ")"}
      </span>
      to dictate, or just type ·
      <button
        type="button"
        onClick={() => setRecording(true)}
        className="rounded text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink"
      >
        {saved ? "Change" : "Set your key"}
      </button>
    </span>
  );
}
