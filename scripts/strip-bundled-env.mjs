/**
 * Run between `opennextjs-cloudflare build` and deploy (npm run cf:deploy).
 *
 * OpenNext copies every key from the project's .env* files into
 * .open-next/cloudflare/next-env.mjs, which ships inside the Worker. Locally
 * that includes everything in .env.local (local tokens and keys). Keep only NEXT_PUBLIC_* keys — public, and
 * already inlined into the pages — so runtime secrets come only from Wrangler
 * secrets (wrangler secret put).
 */
import fs from "node:fs";

const file = ".open-next/cloudflare/next-env.mjs";
const modes = await import(`../${file}`);
const out = Object.entries(modes)
  .map(([mode, vars]) => {
    const kept = Object.fromEntries(Object.entries(vars).filter(([k]) => k.startsWith("NEXT_PUBLIC_")));
    const dropped = Object.keys(vars).filter((k) => !(k in kept));
    if (dropped.length) console.log(`next-env ${mode}: dropped ${dropped.join(", ")}`);
    return `export const ${mode} = ${JSON.stringify(kept)};\n`;
  })
  .join("");
fs.writeFileSync(file, out);
