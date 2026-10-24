/**
 * Classify a document.referrer into a traffic source for analytics. AI
 * assistants are grouped so the weekly report can count "AI referral" visits.
 */

const RULES: [source: string, test: RegExp][] = [
  ["ai:chatgpt", /(^|\.)(chatgpt\.com|chat\.openai\.com)$/],
  ["ai:perplexity", /(^|\.)perplexity\.ai$/],
  ["ai:claude", /(^|\.)claude\.ai$/],
  ["ai:copilot", /(^|\.)(copilot\.microsoft\.com|copilot\.cloud\.microsoft)$/],
  ["ai:gemini", /(^|\.)gemini\.google\.com$/],
  ["search:bing", /(^|\.)bing\.com$/],
  ["search:google", /(^|\.)google\.[a-z.]+$/],
  ["search:duckduckgo", /(^|\.)duckduckgo\.com$/],
  ["search:yahoo", /(^|\.)yahoo\.com$/],
  ["social:reddit", /(^|\.)reddit\.com$/],
  ["social:facebook", /(^|\.)(facebook\.com|fb\.com)$/],
  ["social:x", /(^|\.)(t\.co|x\.com|twitter\.com)$/],
];

export function referralSource(referrer: string): string {
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (host === "www.funzzle.com" || host === "funzzle.com") return "internal";
  for (const [source, test] of RULES) if (test.test(host)) return source;
  return "other";
}
