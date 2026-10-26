/**
 * AdSense Management API v2 from the command line.
 *
 *   node scripts/adsense.mjs auth      one-time browser approval; saves a refresh token
 *   node scripts/adsense.mjs status    accounts, ad clients, site status, existing ad units
 *   node scripts/adsense.mjs create    create Funzzle's four display units (skips ones that exist)
 *
 * The OAuth client is a "Desktop app" client in the funzzle-gsc GCP project,
 * downloaded to ADSENSE_CLIENT_FILE (default ~/.config/gsc-keys/funzzle-adsense-client.json).
 * The refresh token goes next to it (…-token.json). Both stay outside the repo.
 */
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";

const CLIENT_FILE = process.env.ADSENSE_CLIENT_FILE || `${homedir()}/.config/gsc-keys/funzzle-adsense-client.json`;
const TOKEN_FILE = CLIENT_FILE.replace(/-client\.json$/, "-token.json");
const SCOPE = "https://www.googleapis.com/auth/adsense";
const API = "https://adsense.googleapis.com/v2";
const PORT = 8086;

/** Funzzle's units: names match NEXT_PUBLIC_ADSENSE_SLOT_* in lib/ads/adsense.ts. */
export const UNITS = [
  { env: "NEXT_PUBLIC_ADSENSE_SLOT_RECTANGLE", displayName: "funzzle-rectangle-300x250" },
  { env: "NEXT_PUBLIC_ADSENSE_SLOT_IN_CONTENT", displayName: "funzzle-in-content-300x250" },
  { env: "NEXT_PUBLIC_ADSENSE_SLOT_RAIL", displayName: "funzzle-rail-300x600" },
  { env: "NEXT_PUBLIC_ADSENSE_SLOT_RAIL_NARROW", displayName: "funzzle-rail-160x600" },
];

function client() {
  if (!existsSync(CLIENT_FILE)) throw new Error(`No OAuth client at ${CLIENT_FILE} (create a Desktop app client in funzzle-gsc and download its JSON there)`);
  const j = JSON.parse(readFileSync(CLIENT_FILE, "utf8"));
  return j.installed ?? j.web;
}

async function auth() {
  const c = client();
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(12).toString("hex");
  const redirect = `http://localhost:${PORT}/`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: c.client_id, redirect_uri: redirect, response_type: "code", scope: SCOPE, access_type: "offline", prompt: "consent", state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
  })}`;
  console.log(`Open this link and approve:\n\n${url}\n`);
  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const q = new URL(req.url, redirect).searchParams;
      if (!q.get("code") && !q.get("error")) return res.end();
      res.end(q.get("code") ? "AdSense access approved. You can close this tab." : `Not approved: ${q.get("error")}`);
      server.close();
      if (q.get("state") !== state) reject(new Error("state mismatch"));
      else if (q.get("code")) resolve(q.get("code"));
      else reject(new Error(q.get("error")));
    }).listen(PORT);
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ code, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: redirect, grant_type: "authorization_code", code_verifier: verifier }),
  });
  const tok = await res.json();
  if (!tok.refresh_token) throw new Error(`token exchange failed: ${JSON.stringify(tok).slice(0, 200)}`);
  writeFileSync(TOKEN_FILE, JSON.stringify({ refresh_token: tok.refresh_token }), { mode: 0o600 });
  console.log(`Saved refresh token to ${TOKEN_FILE}`);
}

async function accessToken() {
  const c = client();
  const { refresh_token } = JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ refresh_token, client_id: c.client_id, client_secret: c.client_secret, grant_type: "refresh_token" }),
  });
  const tok = await res.json();
  if (!tok.access_token) throw new Error(`refresh failed: ${JSON.stringify(tok).slice(0, 200)}`);
  return tok.access_token;
}

async function api(token, path, init = {}) {
  const res = await fetch(`${API}/${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers }, signal: AbortSignal.timeout(20_000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${body.error?.message ?? ""}`);
  return body;
}

async function status() {
  const t = await accessToken();
  const { accounts = [] } = await api(t, "accounts");
  for (const a of accounts) {
    console.log(`account ${a.name} ${a.displayName ?? ""} state=${a.state ?? "?"}`);
    const { sites = [] } = await api(t, `${a.name}/sites`);
    for (const s of sites) console.log(`  site ${s.domain} state=${s.state} autoAds=${s.autoAdsEnabled ?? false}`);
    const { adClients = [] } = await api(t, `${a.name}/adclients`);
    for (const c of adClients) {
      console.log(`  adclient ${c.name} product=${c.productCode} state=${c.state}`);
      const { adUnits = [] } = await api(t, `${c.name}/adunits`);
      for (const u of adUnits) console.log(`    unit ${u.displayName} id=${u.name.split("/").pop()} state=${u.state} ${u.contentAdsSettings?.type ?? ""} ${u.contentAdsSettings?.size ?? ""}`);
    }
  }
}

async function create() {
  const t = await accessToken();
  const { accounts = [] } = await api(t, "accounts");
  const { adClients = [] } = await api(t, `${accounts[0].name}/adclients`);
  const ac = adClients.find((c) => c.productCode === "AFC");
  if (!ac) throw new Error("no AFC (content) ad client on the account");
  const { adUnits = [] } = await api(t, `${ac.name}/adunits`);
  for (const u of UNITS) {
    let unit = adUnits.find((x) => x.displayName === u.displayName);
    if (!unit) {
      // Responsive display units; the size is set by the slot's CSS box on the page.
      unit = await api(t, `${ac.name}/adunits`, {
        method: "POST",
        body: JSON.stringify({ displayName: u.displayName, state: "ACTIVE", contentAdsSettings: { type: "DISPLAY", size: "RESPONSIVE" } }),
      });
    }
    console.log(`${u.env}=${unit.name.split("/").pop()}`);
  }
}

const cmd = process.argv[2];
await ({ auth, status, create }[cmd] ?? (() => console.log("usage: node scripts/adsense.mjs auth|status|create")))();
