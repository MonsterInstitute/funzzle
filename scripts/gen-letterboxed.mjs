/**
 * Generate solvable Letter Boxed puzzles.
 * Finds chainable two-word solutions whose combined distinct letters number
 * exactly 12, then partitions those 12 letters into 4 sides of 3 such that no
 * two letters adjacent within either solution word share a side. Emits
 * lib/content/letterBoxed.ts with PUZZLES + DICTIONARY.
 *
 * Run:  node scripts/gen-letterboxed.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "lib", "content", "letterBoxed.ts");

// Validation dictionary + candidate pool. Long, diverse-letter words help the
// search find 12-letter unions; short words give players moves.
const WORDS = [
  // longer, letter-diverse (good solution candidates)
  "PLAYGROUND","BACKGROUND","DUMPLINGS","WORKPLACE","QUICKSAND","BLACKSMITH",
  "FLAMINGO","JUKEBOX","GHERKIN","VAMPIRE","DIPLOMAT","EXPLAIN","JACKPOT",
  "MUDGUARD","OVERTAKING","BATHROOM","CUPBOARD","DAYLIGHT","EXHAUSTING",
  "FRAGMENT","GARNISHED","HAND","THUMBTACK","KINGDOM","MOONLIGHT","NIGHTCLUB",
  "OUTFIELD","PITCHFORK","QUARTZ","RAINBOW","SANDWICH","TRUMPET","UMBRELLA",
  "VOYAGE","WHIRLPOOL","EXPORTING","YARDSTICK","ZIGZAG","COMPLAIN","NIGHTMARE",
  "EXCLAMATION","BOULEVARD","MICROWAVE","PENGUIN","THIRDLY","GLOVE","EXPANDING",
  "GUMDROP","WATCHFUL","BEDROCK","PACKING","GONE","VELCRO","WIZARD","DUSKY",
  "FROGMEN","PLAYBACK","JUMBLED","QUICKENS","VORTEX","HANDBAG","MELODY",
  "YOGURT","THANKED","DWARF","GLIMPSED","BACKYARD","VOWELS","MIGHTY",
  "PACKED","DELTAS","SHRIMP","VOWING","BLACKEN","MUDGE","GRUMPY","FLICKS",
  "VAULTING","EXHIBIT","JOYFULNESS","BRAZING","MUCKY","THORNY","PLUMBING",
  "GAMBIT","WORDPLAY","EXCITING","THUMBS","VOICED","GNARLY","BUDGET","PICKAXE",
  // common shorter words (chaining + validation)
  "ABLE","ACID","AGED","AGES","AIDE","AIMS","ALSO","AREA","ARMY","ATOP","AXIS",
  "BAKE","BAND","BANK","BARE","BARN","BASE","BATH","BEAM","BEAN","BEAR","BEAT",
  "BELT","BEND","BEST","BIKE","BILL","BIND","BIRD","BITE","BLOW","BLUE","BOAT",
  "BODY","BOLD","BOLT","BOMB","BOND","BONE","BOOK","BOOM","BOOT","BORE","BOTH",
  "CAGE","CAKE","CALL","CALM","CAMP","CANE","CARD","CARE","CART","CASE","CASH",
  "CAST","CAVE","CELL","CENT","CHAT","CHIN","CHIP","CITY","CLAP","CLAY","CLIP",
  "CLUB","COAL","COAT","CODE","COIN","COLD","COOK","COOL","COPE","COPY","CORD",
  "DARK","DASH","DATA","DATE","DAWN","DEAD","DEAL","DEEP","DESK","DIAL","DICE",
  "DIET","DIRT","DISH","DIVE","DOCK","DOLL","DOOR","DOSE","DRAG","DRAW","DREW",
  "EACH","EARL","EARN","EAST","EDGE","ELSE","EPIC","EVEN","EVER","EXAM","EXIT",
  "FACE","FACT","FADE","FAIL","FAIR","FALL","FARM","FAST","FATE","FEAR","FEAT",
  "FEED","FEEL","FEET","FELL","FELT","FILE","FILL","FILM","FIND","FINE","FIRE",
  "GAIN","GAME","GATE","GAVE","GEAR","GENE","GIFT","GIRL","GIVE","GLAD","GOAL",
  "GOAT","GOLD","GOLF","GONE","GOOD","GRAB","GRAY","GRID","GRIM","GRIN","GRIP",
  "HAIR","HALF","HALL","HAND","HANG","HARD","HARM","HATE","HEAD","HEAL","HEAP",
  "HEAR","HEAT","HEEL","HELD","HELL","HELP","HERB","HERD","HERO","HIDE","HIGH",
  "ICON","IDEA","IDLE","INCH","INTO","IRON","ITEM","JADE","JAIL","JOIN","JOKE",
  "JUMP","JUNK","JURY","JUST","KEEN","KEEP","KICK","KILL","KIND","KING","KISS",
  "LACE","LACK","LADY","LAID","LAKE","LAMB","LAMP","LAND","LANE","LAST","LATE",
  "LEAD","LEAF","LEAN","LEND","LENS","LESS","LIFE","LIFT","LIKE","LIME","LINE",
  "MADE","MAIL","MAIN","MAKE","MALE","MANY","MASK","MASS","MATE","MEAL","MEAN",
  "MEAT","MEET","MELT","MENU","MILD","MILE","MILK","MILL","MIND","MINE","MINT",
  "NAIL","NAME","NAVY","NEAR","NEAT","NECK","NEED","NEST","NEWS","NEXT","NICE",
  "OKAY","ONCE","ONLY","ONTO","OPEN","ORAL","OVAL","OVEN","OVER","PACE","PACK",
  "PAGE","PAID","PAIN","PAIR","PALM","PARK","PART","PASS","PAST","PATH","PEAK",
  "QUIT","QUIZ","RACE","RACK","RAGE","RAID","RAIL","RAIN","RANK","RARE","RATE",
  "SAFE","SAID","SAIL","SALE","SALT","SAME","SAND","SAVE","SEAL","SEAT","SEED",
  "TAIL","TAKE","TALE","TALK","TALL","TANK","TAPE","TASK","TEAM","TEAR","TELL",
  "UGLY","UNIT","UPON","URGE","USED","USER","VARY","VAST","VERY","VIEW","VOTE",
  "WAGE","WAIT","WAKE","WALK","WALL","WANT","WARM","WARN","WASH","WAVE","WEAK",
  "WEAR","WEEK","WELL","WENT","WEST","WIDE","WIFE","WILD","WILL","WIND","WINE",
  "YARD","YEAR","ZERO","ZONE","ZOOM",
];

const DICT = Array.from(new Set(WORDS.map((w) => w.toUpperCase())));
const distinct = (w) => new Set(w.split(""));

// Backtracking 4-coloring with capacity 3 per side.
function partition(letters, edges) {
  const sides = [[], [], [], []];
  const letterArr = [...letters];
  const adj = new Map(letterArr.map((l) => [l, new Set()]));
  for (const [a, b] of edges) {
    if (adj.has(a) && adj.has(b)) {
      adj.get(a).add(b);
      adj.get(b).add(a);
    }
  }
  function place(i) {
    if (i === letterArr.length) return sides.every((s) => s.length === 3);
    const L = letterArr[i];
    for (let s = 0; s < 4; s++) {
      if (sides[s].length >= 3) continue;
      if (sides[s].some((x) => adj.get(L).has(x))) continue;
      sides[s].push(L);
      if (place(i + 1)) return true;
      sides[s].pop();
    }
    return false;
  }
  return place(0) ? sides.map((s) => s.join("")) : null;
}

function edgesOf(word) {
  const e = [];
  for (let i = 0; i < word.length - 1; i++) {
    if (word[i] !== word[i + 1]) e.push([word[i], word[i + 1]]);
  }
  return e;
}

const puzzles = [];
const seenSets = new Set();
const usedFirst = new Set();
const usedWords = new Set();

outer: for (const w1 of DICT) {
  if (w1.length < 6) continue; // longer first words → more distinct letter sets
  if (usedFirst.has(w1)) continue;
  for (const w2 of DICT) {
    if (w2.length < 4) continue;
    if (w2 === w1 || usedWords.has(w2)) continue;
    if (w2[0] !== w1[w1.length - 1]) continue;
    const union = new Set([...w1, ...w2]);
    if (union.size !== 12) continue;
    const key = [...union].sort().join("");
    if (seenSets.has(key)) continue;
    const sides = partition(union, [...edgesOf(w1), ...edgesOf(w2)]);
    if (!sides) continue;
    seenSets.add(key);
    usedFirst.add(w1);
    usedWords.add(w1);
    usedWords.add(w2);
    puzzles.push({ sides, solution: [w1, w2] });
    if (puzzles.length >= 7) break outer;
    break; // move to a different first word for the next puzzle
  }
}

if (puzzles.length < 7) {
  console.error(`Only found ${puzzles.length} puzzles — add more diverse words.`);
  process.exit(1);
}

const body = `// Auto-generated Letter Boxed puzzles + validation dictionary.
export interface LetterBoxedPuzzle {
  sides: string[]; // 4 sides of 3 letters
  solution: string[]; // a known valid solution chain
}

export const LETTER_BOXED_PUZZLES: LetterBoxedPuzzle[] = ${JSON.stringify(puzzles, null, 2)};

export const LETTER_BOXED_DICT: string[] = ${JSON.stringify(DICT)};
`;

writeFileSync(OUT, body);
console.error(`Wrote ${puzzles.length} puzzles, dict ${DICT.length} words.`);
for (const p of puzzles) console.error(p.sides.join(" | "), "=>", p.solution.join(" → "));
