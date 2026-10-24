/**
 * Web Push from a Worker with only WebCrypto: VAPID (RFC 8292) authorization
 * and aes128gcm payload encryption (RFC 8291). No dependencies, so it runs the
 * same in workerd and Node (tests decrypt what it produces).
 */

export interface PushSubscriptionKeys {
  endpoint: string;
  /** Browser's P-256 public key, base64url (65 bytes uncompressed). */
  p256dh: string;
  /** Browser's auth secret, base64url (16 bytes). */
  auth: string;
}

export interface Vapid {
  /** Application server public key, base64url (65 bytes uncompressed). */
  publicKey: string;
  /** Matching private key as a JWK JSON string. */
  privateJwk: string;
  /** "mailto:…" or "https://…" contact for push services. */
  subject: string;
}

const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/** VAPID JWT (ES256) for the push service that owns `endpoint`. */
export async function vapidAuthorization(endpoint: string, vapid: Vapid, now = Date.now()): Promise<string> {
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject }))
  );
  const key = await crypto.subtle.importKey("jwk", JSON.parse(vapid.privateJwk), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  // WebCrypto's ECDSA signature is already the raw r‖s that JWS wants.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64urlEncode(sig)}, k=${vapid.publicKey}`;
}

/** aes128gcm-encrypt `payload` for one subscription (a single record). */
export async function encryptPayload(payload: string, sub: Pick<PushSubscriptionKeys, "p256dh" | "auth">, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));

  const prkKey = await hmac(authSecret, ecdhSecret);
  const ikm = await hmac(prkKey, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // 0x02 marks the last (only) record.
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

export type PushOutcome = "sent" | "gone" | "failed";

/** Send one notification. "gone" (404/410) means delete the subscription. */
export async function sendPush(sub: PushSubscriptionKeys, payload: object, vapid: Vapid, ttlSeconds = 12 * 3600): Promise<{ outcome: PushOutcome; status?: number }> {
  try {
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        authorization: await vapidAuthorization(sub.endpoint, vapid),
        "content-encoding": "aes128gcm",
        "content-type": "application/octet-stream",
        ttl: String(ttlSeconds),
        urgency: "normal",
      },
      body: await encryptPayload(JSON.stringify(payload), sub),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { outcome: "sent", status: res.status };
    return { outcome: res.status === 404 || res.status === 410 ? "gone" : "failed", status: res.status };
  } catch {
    return { outcome: "failed" };
  }
}
