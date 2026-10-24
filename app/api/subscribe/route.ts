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
      "INSERT INTO email_subscribers (id, email, unsubscribe_token) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING",
      crypto.randomUUID(),
      email,
      crypto.randomUUID()
    );
    if (!added) return NextResponse.json({ ok: true, message: "You're already subscribed!" });
    return NextResponse.json({ ok: true, message: "You're subscribed! Check your inbox daily." });
  } catch (err) {
    console.error("subscribe failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
