import { NextResponse } from "next/server";
import { exec } from "@/lib/db";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
  let email = "";
  try {
    const body = await request.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email." }, { status: 400 });
  }

  try {
    const added = await exec(
      // Re-subscribing after an unsubscribe turns the reminder back on.
      "INSERT INTO email_subscribers (id, email, unsubscribe_token) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET unsubscribed = 0 WHERE unsubscribed = 1",
      crypto.randomUUID(),
      email,
      crypto.randomUUID()
    );
    if (!added) return NextResponse.json({ ok: true, message: "You're already subscribed!" });
    return NextResponse.json({ ok: true, message: "You're subscribed! One email a day when the new puzzles are ready." });
  } catch (err) {
    console.error("subscribe failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
