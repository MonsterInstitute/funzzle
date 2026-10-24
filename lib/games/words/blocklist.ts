/**
 * Words that must never be a puzzle answer, a bonus word, or appear in a
 * letter grid: slurs, profanity, sexual and graphic-violence terms. The build
 * script (scripts/build-wordlists.mjs) imports this file and drops every match
 * from the generated lists, so the runtime lists are already clean.
 * `isBlocked` and `containsBlockedSubstring` are for generators (random grid
 * filler, every grid line in all 8 directions) and for user-supplied text such
 * as custom challenge words.
 *
 * Hand-curated, erring on the side of blocking. Keep entries lowercase a-z and
 * the file erasable-syntax TypeScript with no imports: the .mjs build script
 * imports it directly with Node's type stripping.
 */

/** Blocked stems. Common inflections (s, es, ed, ing, er, y, ...) are blocked too. */
export const BLOCKED_STEMS: readonly string[] = [
  // profanity / vulgar
  "arse", "arsehole", "asshole", "bastard", "bitch", "bollock", "bollocks",
  "boner", "boob", "booby", "bugger", "butthole", "crap", "cunt",
  "damn", "dickhead", "dildo", "douche", "fart", "fuck", "goddamn", "hell",
  "jizz", "piss", "poop", "pussy", "shit", "skank", "slut", "titty", "turd",
  "twat", "wank", "wanker", "whore", "bimbo", "hussy", "harlot", "jackass",
  "dumbass", "smartass", "bullshit", "horseshit",
  // slurs and identity insults
  "beaner", "chink", "coon", "cripple", "dago", "darkie", "dyke", "fag",
  "fagot", "faggot", "gook", "gimp", "gyp", "gypsy", "honky", "kike", "kraut",
  "lesbo", "midget", "mongol", "mongoloid", "negress", "negro", "nigga",
  "nigger", "paki", "polack", "queer", "raghead", "redskin", "retard",
  "shemale", "spastic", "spaz", "spick", "squaw", "tranny", "wetback",
  "towelhead", "coolie", "pikey", "yid", "hymie", "sambo", "pickaninny",
  // sexual
  "anal", "anus", "bdsm", "blowjob", "brothel", "buggery", "clit", "clitoris",
  "condom", "coitus", "cunnilingus", "ejaculate", "ejaculation", "erection",
  "erotic", "erotica", "fellatio", "fetish", "foreskin", "fornicate", "grope",
  "handjob", "hooker", "horny", "incest", "kinky", "masturbate",
  "masturbation", "milf", "molest", "molester", "nipple", "nude", "nudity",
  "orgasm", "orgy", "pedophile", "paedophile", "pedo", "penis", "pimp", "porn",
  "porno", "pornography", "prostitute", "pube", "pubes", "pubic", "rimjob",
  "scrotum", "semen", "sex", "sexual", "sexy", "smut", "sodomy", "sodomize",
  "sodomite", "sperm", "stripper", "testicle", "testes", "vagina", "vulva",
  "voyeur", "lewd", "wench", "harem", "cuckold", "nympho", "nymphomaniac",
  "rectum", "slutty", "skanky",
  // graphic violence, hate, self-harm, hard drugs
  "behead", "decapitate", "genocide", "holocaust", "kill", "killer", "lynch",
  "massacre", "murder", "murderer", "nazi", "rape", "rapist", "slaughter",
  "suicide", "terrorist", "terrorism", "torture", "abortion", "cocaine",
  "meth", "gore", "maim", "mutilate", "strangle", "assassinate",
  "execution", "corpse", "bloodbath", "jihad",
];

/**
 * Blocked only as these exact words: their longer forms are innocent
 * (butter, spicy, japes, shaggy, bonkers, prickly, titer, ...).
 */
export const BLOCKED_EXACT: readonly string[] = [
  "ass", "asses", "butt", "butts", "spic", "spics", "jap", "japs", "homo",
  "homos", "wop", "wops", "tit", "tits", "dick", "dicks", "prick", "pricks",
  "hump", "humps", "humping", "cum", "cums", "shag", "shags", "shagging",
  "bonk", "bonks", "bonking", "lust", "lusts", "lusting", "screw", "screwed",
  "nymph", "nymphs", "thong", "thongs", "cock", "cocks", "heroin", "heroins",
];

/**
 * Strings blocked anywhere inside a word or a grid line (check reversed lines
 * too). Only strings that never occur inside an innocent word belong here.
 */
export const BLOCKED_SUBSTRINGS: readonly string[] = [
  "fuck", "shit", "cunt", "nigg", "fagg", "whore", "porn", "slut",
  "jizz", "dildo", "kike",
];

const STEM_SET = new Set(BLOCKED_STEMS);
const EXACT_SET = new Set(BLOCKED_EXACT);

const SUFFIXES = [
  "s", "es", "ed", "d", "ing", "ings", "er", "ers", "est", "y", "ish", "ly",
  "ness", "ry", "ty", "ies", "ier", "iest", "ied",
];
/** Suffixes that drop a stem's final "e" (rape -> raping). */
const E_DROP = new Set(["ed", "ing", "ings", "er", "ers", "est", "y", "ish"]);
/** Suffixes that replace a stem's final "y" (horny -> horniest). */
const Y_TO_I = new Set(["ies", "ier", "iest", "ied"]);

function stemMatch(w: string): boolean {
  if (STEM_SET.has(w)) return true;
  for (const suf of SUFFIXES) {
    if (w.length <= suf.length + 1 || !w.endsWith(suf)) continue;
    const base = w.slice(0, -suf.length);
    if (STEM_SET.has(base)) return true;
    if (E_DROP.has(suf) && STEM_SET.has(base + "e")) return true;
    if (Y_TO_I.has(suf) && STEM_SET.has(base + "y")) return true;
    // doubled final consonant: "slutty", "twatted", "gypped"
    const n = base.length;
    if (n > 2 && base[n - 1] === base[n - 2] && STEM_SET.has(base.slice(0, -1))) return true;
  }
  return false;
}

/** True when `text` contains a blocked substring. Use on every grid line, both directions. */
export function containsBlockedSubstring(text: string): boolean {
  const t = text.toLowerCase();
  for (const s of BLOCKED_SUBSTRINGS) if (t.includes(s)) return true;
  return false;
}

/** True when `word` must never be used as an answer or bonus word, or be shown. */
export function isBlocked(word: string): boolean {
  const w = word.toLowerCase();
  return EXACT_SET.has(w) || stemMatch(w) || containsBlockedSubstring(w);
}
