"use client";

import { useState } from "react";

export default function EmailCapture() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStatus("ok");
        setMessage(data.message ?? "You're subscribed!");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error — please try again.");
    }
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <h2 className="text-xl font-bold text-[#111827]">
        Get daily answers in your inbox
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        One email a day with the Mini, Wordle, and Connections answers. Free,
        unsubscribe anytime.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded-lg border border-[#e5e7eb] px-4 py-2.5 text-sm focus:border-[#16a34a] focus:outline-none"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-lg bg-[#16a34a] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#15803d] disabled:opacity-60"
        >
          {status === "loading" ? "…" : "Get daily answers"}
        </button>
      </form>
      {message && (
        <p className={`mt-2 text-sm ${status === "ok" ? "text-[#16a34a]" : "text-red-500"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
