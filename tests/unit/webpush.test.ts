import { describe, expect, it } from "vitest";
import { b64urlDecode, b64urlEncode, encryptPayload, vapidAuthorization } from "@/lib/webpush";

const enc = new TextEncoder();
const concat = (...p: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const x of p) {
    out.set(x, i);
    i += x.length;
  }
  return out;
};
async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/** The browser's side of RFC 8291: decrypt an aes128gcm push message. */
async function decrypt(body: Uint8Array<ArrayBuffer>, ua: CryptoKeyPair, auth: Uint8Array<ArrayBuffer>) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
  const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, ua.privateKey, 256));
  const prkKey = await hmac(auth, ecdh);
  const ikm = await hmac(prkKey, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, cipher));
  expect(plain.at(-1)).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

describe("web push", () => {
  it("encrypts a payload the subscriber can decrypt (RFC 8291)", async () => {
    const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const p256dh = b64urlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey)));
    const body = await encryptPayload(JSON.stringify({ title: "Today’s puzzles are ready" }), { p256dh, auth: b64urlEncode(auth) });
    expect(body.length).toBeLessThan(4096);
    expect(JSON.parse(await decrypt(body, ua, auth))).toEqual({ title: "Today’s puzzles are ready" });
  });

  it("signs a VAPID JWT the public key verifies", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const publicKey = b64urlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
    const privateJwk = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey));
    const header = await vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", { publicKey, privateJwk, subject: "mailto:hello@funzzle.com" }, 0);
    const m = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)!;
    expect(m[4]).toBe(publicKey);
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(m[2])));
    expect(claims).toEqual({ aud: "https://fcm.googleapis.com", exp: 12 * 3600, sub: "mailto:hello@funzzle.com" });
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, b64urlDecode(m[3]), enc.encode(`${m[1]}.${m[2]}`));
    expect(ok).toBe(true);
  });
});
