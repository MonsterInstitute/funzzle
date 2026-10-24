import { NextResponse } from "next/server";
import { exec } from "@/lib/db";

/**
 * One-click unsubscribe (RFC 8058) for the reminder email's List-Unsubscribe
 * header: mail clients POST here. A GET (someone opening the link) goes to the
 * unsubscribe page, which does the same and says so.
 */

const TOKEN_RE = /^[0-9a-f-]{16,64}$/i;

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!TOKEN_RE.test(token)) return new NextResponse(null, { status: 400 });
  try {
    await exec("UPDATE email_subscribers SET unsubscribed = 1 WHERE unsubscribe_token = ?", token.toLowerCase());
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}

export function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!TOKEN_RE.test(token)) return new NextResponse(null, { status: 400 });
  return NextResponse.redirect(new URL(`/daily-email/unsubscribe/${token}`, request.url), 303);
}
