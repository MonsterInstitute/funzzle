"use client";

import { useEffect, useState } from "react";
import { disablePush, enablePush, pushEnabled, pushSupported, subscribeEmail } from "@/lib/games/kit/reminders";
import { Icon } from "./Icons";

/**
 * Opt-in daily reminder, "Today's puzzles are ready": a notification (web
 * push, also from the home-screen app) and/or one email a day.
 */
export default function ReminderOptIn({ compact = false }: { compact?: boolean }) {
  const [push, setPush] = useState<"unknown" | "on" | "off" | "denied" | "unsupported" | "working">("unknown");
  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!pushSupported()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability check after hydration
      setPush("unsupported");
      return;
    }
    if (Notification.permission === "denied") return setPush("denied");
    pushEnabled().then((on) => setPush(on ? "on" : "off"));
  }, []);

  return (
    <div className={`flex flex-col gap-3 rounded-[22px] border border-line p-[22px] ${compact ? "" : "max-w-[560px]"}`}>
      <span className="flex items-center gap-2 text-[15px] font-semibold">
        <Icon name="bell" size={18} />
        Daily reminder
      </span>
      <p className="m-0 text-sm text-muted">One nudge a day when the new puzzles are ready. Never more than one, and you can turn it off anytime.</p>

      {push !== "unsupported" && push !== "unknown" && (
        <div className="flex flex-wrap items-center gap-2.5">
          {push === "on" ? (
            <>
              <span className="text-sm font-semibold text-success">Notifications are on.</span>
              <button
                type="button"
                className="min-h-11 rounded-full border border-line-strong px-4 text-sm font-semibold"
                onClick={async () => {
                  await disablePush();
                  setPush("off");
                }}
              >
                Turn off
              </button>
            </>
          ) : push === "denied" ? (
            <span className="text-sm text-muted">Notifications are blocked for this site in your browser settings.</span>
          ) : (
            <button
              type="button"
              disabled={push === "working"}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-ground disabled:opacity-60"
              onClick={async () => {
                setPush("working");
                const r = await enablePush();
                setPush(r === "on" ? "on" : r === "denied" ? "denied" : "off");
              }}
            >
              <Icon name="bell" size={16} />
              Notify me each day
            </button>
          )}
        </div>
      )}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setSending(true);
          setEmailMsg(await subscribeEmail(email));
          setSending(false);
        }}
      >
        <label htmlFor="reminder-email" className="sr-only">
          Email address
        </label>
        <input
          id="reminder-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Or get it by email"
          className="min-h-11 min-w-0 flex-[1_1_200px] rounded-xl border border-line-strong bg-ground px-3 text-base text-ink"
        />
        <button type="submit" disabled={sending} className="min-h-11 rounded-full border border-line-strong px-4 text-sm font-semibold disabled:opacity-60">
          Email me
        </button>
      </form>
      {emailMsg && (
        <p role="status" className={`m-0 text-sm ${emailMsg.ok ? "text-success" : "text-card-red"}`}>
          {emailMsg.message}
        </p>
      )}
    </div>
  );
}
