import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";

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
    const supabase = createServiceSupabase();
    const { error } = await supabase.from("email_subscribers").insert({ email });

    if (error) {
      // Unique violation → already subscribed (treat as success).
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, message: "You're already subscribed!" });
      }
      // Table missing (Postgres 42P01 or PostgREST schema-cache PGRST205).
      if (error.code === "42P01" || error.code === "PGRST205") {
        console.error("email_subscribers table missing — run supabase/email-subscribers.sql");
        return NextResponse.json(
          { ok: false, error: "Subscriptions aren't set up yet. Try again soon." },
          { status: 503 }
        );
      }
      console.error("subscribe insert failed:", error.message);
      return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "You're subscribed! Check your inbox daily." });
  } catch (err) {
    console.error("subscribe threw:", err);
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
