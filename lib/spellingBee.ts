import { parseISODate } from "./dates";

export interface BeePuzzle {
  center: string;
  others: string[]; // 6 outer letters
}

/** Seven daily puzzles, rotating by day of week. */
export const BEE_PUZZLES: BeePuzzle[] = [
  { center: "A", others: ["R", "T", "E", "S", "I", "N"] },
  { center: "E", others: ["L", "P", "A", "S", "T", "R"] },
  { center: "O", others: ["C", "K", "R", "B", "S", "E"] },
  { center: "I", others: ["G", "H", "T", "L", "S", "E"] },
  { center: "U", others: ["M", "S", "C", "L", "E", "T"] },
  { center: "Y", others: ["D", "A", "R", "G", "E", "S"] },
  { center: "N", others: ["O", "W", "D", "E", "R", "S"] },
];

/**
 * Built-in dictionary (500+ common words). Validation is subset-based (NYT
 * style): a guess counts when it is in this list, is at least 4 letters, uses
 * only the puzzle's seven letters, and includes the center letter — so one list
 * serves every puzzle. Curated per-puzzle groups guarantee each day is playable;
 * a general block rounds the dictionary out past 500 entries.
 */
const RAW_WORDS = [
  // ---- Day 0: A · R T E S I N -----------------------------------------
  "ANTE", "ANTES", "ANTI", "ANTIS", "ANTA", "ANTAS", "ANTRE", "ANTRES",
  "ARSE", "ARTS", "ARES", "EARS", "EARN", "EARNS", "NEAR", "NEARS", "NEAREST",
  "SANE", "SANER", "SNARE", "SEAR", "SITAR", "STAIR", "STAIN", "SATIN",
  "SAINT", "TRAIN", "TRAINS", "STRAIN", "RETAIN", "RETAINS", "RETINA",
  "RETINAS", "RATINE", "RATINES", "RESIN", "ARISE", "ARISEN", "RAISE",
  "RAISIN", "RANI", "RANIS", "RAIN", "RAINS", "RANT", "RANTS", "RATE",
  "RATES", "RATS", "TARS", "STAR", "STARE", "TEAR", "TEARS", "TEASE",
  "TEASER", "TSAR", "IRATE", "NASTIER", "STAINER", "STEARIN", "RETSINA",
  "EARNEST", "INSANE", "INANE", "INANEST", "ANISE", "TERRAIN", "TERRAINS",
  "TSARINA", "ATTAIN", "ATTAINS", "ATTAR", "ARENA", "ARENAS", "ANEAR",
  "TARSI", "TARSIER", "ARTIER", "SIENNA", "SEITAN", "TISANE",

  // ---- Day 1: E · L P A S T R -----------------------------------------
  "ALEE", "ALES", "APES", "APSE", "ARLE", "ATES", "EALE", "EASE", "EASEL",
  "ELAPSE", "ELATE", "ELATES", "ERAS", "ESTATE", "LAPSE", "LATER", "LEAP",
  "LEAPS", "LEAPT", "LEASE", "LEAST", "PALE", "PALER", "PALES", "PALEST",
  "PARE", "PARES", "PARSE", "PASTE", "PASTEL", "PEAL", "PEALS", "PEAR",
  "PEARL", "PEARLS", "PEARS", "PEAT", "PEATS", "PELT", "PELTS", "PEST",
  "PETAL", "PETALS", "PLATE", "PLATES", "PLATTER", "PLEA", "PLEAS", "PLEAT",
  "PLEATS", "PLASTER", "PRATE", "PRATES", "REAL", "REALS", "REAP", "REAPS",
  "REPAST", "REPEAT", "REPEATS", "REPEL", "REPELS", "RESET", "REST", "SEAL",
  "SEAT", "SEATER", "SLATE", "SLATER", "SLEEP", "SLEET", "SPEAR", "SPELT",
  "STAPLE", "STAPLER", "STEAL", "STEEL", "STEEP", "STEEPLE", "STEER",
  "STREET", "TALE", "TALES", "TAPE", "TAPER", "TAPERS", "TAPES", "TEAL",
  "TEALS", "TEASE", "TEASEL", "TESLA", "PALATE", "PALATES", "PARLE",
  "PARLES", "PALTER", "PALTERS", "PSALTER", "REPLATE",

  // ---- Day 2: O · C K R B S E -----------------------------------------
  "BOCK", "BOCKS", "BOND", "BONE", "BONES", "BOOK", "BOOKS", "BOOR", "BOORS",
  "BORE", "BORES", "BOSK", "BROKE", "BROKER", "BROKERS", "BROOK", "BROOKS",
  "COBS", "COKE", "COKES", "CORE", "CORES", "CORK", "CORKS", "CROOK",
  "CROOKS", "EBBS", "ECHO", "OBOE", "OBOES", "OCKER", "OKRA", "ORBS",
  "ROBE", "ROBES", "ROCK", "ROCKS", "ROOK", "ROOKS", "ROSE", "SCORE",
  "SCORER", "SOBER", "SORE", "COBBER", "COBBERS", "ROOKERS", "BROCKS",
  "CORKER", "CORKERS", "REBORE", "REBORES", "COOKER", "COOKERS", "BROOKS",
  "OCHRE", "OCHRES",

  // ---- Day 3: I · G H T L S E -----------------------------------------
  "EDIT", "EELS", "GELS", "GILT", "GILTS", "GIST", "GLEE",
  "HEIST", "HILT", "HILTS", "ISLE", "ISLET", "ITCH", "LIES", "LIGHT",
  "LIGHTS", "LILT", "LILTS", "LISLE", "LITE", "LITES", "SIGH", "SIGHT",
  "SIGHTS", "SILT", "SITE", "SLEIGH", "SLEIGHT", "SLIGHT", "SLIT", "STILE",
  "STILT", "STILTS", "TIES", "TILE", "TILES", "TILT", "TILTS", "TITHE",
  "TITHES", "TITLE", "TITLES", "LIGHTEST", "SLIGHTS", "HIGHEST", "EIGHTS",
  "EIGHTH", "EIGHTHS", "LIGHTLY", "TIGHT", "TIGHTS", "TIGHTLY",

  // ---- Day 4: U · M S C L E T -----------------------------------------
  "CELT", "CELTS", "CLUE", "CLUES", "CLUMP", "CULT", "CULTS", "CUTE",
  "CUTES", "CUTLET", "CUTLETS", "ELMS", "EMUS", "LUCE", "LUCES", "LUTE",
  "LUTES", "MELT", "MELTS", "MULE", "MULES", "MULCT", "MULCTS", "MUSCLE",
  "MUSCLES", "MUSE", "MUTE", "MUTES", "SCUM", "SCUT", "SCUTE", "SLUE",
  "SLUM", "SLUT", "SMELT", "SMUT", "SUET", "SUET", "TELECOM", "TULE",
  "TULES", "CULET", "CULETS", "CULM", "CULMS",

  // ---- Day 5: Y · D A R G E S -----------------------------------------
  "AYES", "DARE", "DARES", "DAYS", "DEAR", "DEARS", "DRAY", "DRAYS", "DRYS",
  "DYADS", "DYER", "DYERS", "DYES", "EASY", "EDGY", "EYAS", "EYED", "EYES",
  "GRAD", "GRADE", "GRADES", "GRADS", "GRAY", "GRAYED", "GRAYS", "GREY",
  "GREYS", "READY", "REDYE", "REDYES", "RYES", "SAGY", "SAYER", "SAYERS",
  "YARD", "YARDS", "YEAR", "YEARS", "YEAS", "DREGS", "DRAGS", "GEARS",
  "AGERS", "DRAYAGE",

  // ---- Day 6: N · O W D E R S -----------------------------------------
  "DENS", "DEWS", "DONE", "DONS", "DOSE", "DOWN", "DOWNS", "DOWNER",
  "DOWNERS", "DRONE", "DRONES", "DRESS", "ENDS", "ENDOW", "ENDOWS", "EONS",
  "NERD", "NERDS", "NEWS", "NODE", "NODES", "NODS", "NOSE", "NOWS",
  "ONES", "OWNED", "OWNER", "OWNERS", "OWNS", "REDON", "REDONS", "REDOWN",
  "RESOWN", "RONDE", "RONDES", "SNORE", "SNORED", "SNOW", "SNOWED", "SODDEN",
  "SWORD", "SWORE", "SWORN", "WANDER", "WEND", "WENDS", "WOMEN", "WONDER",
  "WONDERS", "WORDS", "WORN", "WORSEN", "WORSENED", "WRENS", "WONDERED",
  "DOWNERS", "DROWSE", "DROWSED", "NEWSROOM",

  // ---- General common words (rounds the dictionary past 500) ----------
  "ABLE", "ABOUT", "ABOVE", "ACID", "ACRE", "ACTS", "AGED", "AGES", "AGREE",
  "AHEAD", "AIDE", "AIMS", "AIRS", "ALSO", "AMID", "AREA", "ARMY", "ATOP",
  "AWAY", "AXES", "BABY", "BACK", "BAKE", "BALL", "BAND", "BANK", "BARE",
  "BARN", "BASE", "BATH", "BEAM", "BEAN", "BEAR", "BEAT", "BEEN", "BELL",
  "BELT", "BEND", "BEST", "BIKE", "BILL", "BIND", "BIRD", "BITE", "BLOW",
  "BLUE", "BOAT", "BODY", "BOLD", "BOLT", "BOMB", "BOOM", "BOOT", "BOSS",
  "BOTH", "BOWL", "BULK", "BURN", "BUSY", "CAGE", "CAKE", "CALL", "CALM",
  "CAMP", "CANE", "CARD", "CARE", "CART", "CASE", "CASH", "CAST", "CAVE",
  "CELL", "CENT", "CHAT", "CHEF", "CHIN", "CHIP", "CITY", "CLAP", "CLAY",
  "CLIP", "CLUB", "COAL", "COAT", "CODE", "COIN", "COLD", "COOK", "COOL",
  "COPE", "COPY", "CORD", "COST", "CREW", "CROP", "CUBE", "CURE", "CURL",
  "DARK", "DASH", "DATA", "DATE", "DAWN", "DEAD", "DEAL", "DEEP", "DESK",
  "DIAL", "DICE", "DIET", "DIRT", "DISH", "DIVE", "DOCK", "DOLL", "DOOR",
  "DOSE", "DRAG", "DRAW", "DREW", "DRIP", "DROP", "DRUG", "DRUM", "DUAL",
  "DUCK", "DUKE", "DULL", "DUMP", "DUSK", "DUST", "DUTY", "EACH", "EARL",
  "EAST", "EDGE", "ELSE", "EPIC", "EVEN", "EVER", "EVIL", "EXAM", "EXIT",
  "FACE", "FACT", "FADE", "FAIL", "FAIR", "FALL", "FARM", "FAST", "FATE",
  "FEAR", "FEAT", "FEED", "FEEL", "FEET", "FELL", "FELT", "FILE", "FILL",
  "FILM", "FIND", "FINE", "FIRE", "FIRM", "FISH", "FIST", "FIVE", "FLAG",
  "FLAT", "FLED", "FLEE", "FLEW", "FLOW", "FOLD", "FOLK", "FOND", "FOOD",
  "FOOT", "FORD", "FORK", "FORM", "FORT", "FOUR", "FREE", "FROG", "FUEL",
  "FULL", "FUND", "GAIN", "GAME", "GATE", "GAVE", "GEAR", "GENE", "GIFT",
  "GIRL", "GIVE", "GLAD", "GOAL", "GOAT", "GOLD", "GOLF", "GONE", "GOOD",
  "GRAB", "GRAY", "GRIM", "GRIN", "GRIP", "GROW", "GULF", "HAIR", "HALF",
  "HALL", "HAND", "HANG", "HARD", "HARM", "HATE", "HEAD", "HEAL", "HEAP",
  "HEAR", "HEAT", "HEEL", "HELD", "HELL", "HELP", "HERB", "HERD", "HERO",
  "HIDE", "HIGH", "HILL", "HINT", "HIRE", "HOLD", "HOLE", "HOME", "HOOD",
  "HOOK", "HOPE", "HORN", "HOST", "HOUR", "HUGE", "HUNT", "HURT", "ICON",
  "IDEA", "IDLE", "INCH", "INTO", "IRON", "ITEM", "JAIL", "JAZZ", "JOIN",
  "JOKE", "JUMP", "JUNK", "JURY", "JUST", "KEEN", "KEEP", "KICK", "KILL",
  "KIND", "KING", "KISS", "KITE", "KNEE", "KNEW", "KNIT", "KNOT", "KNOW",
  "LACE", "LACK", "LADY", "LAID", "LAKE", "LAMB", "LAMP", "LAND", "LANE",
  "LAST", "LATE", "LAWN", "LEAD", "LEAF", "LEAN", "LEND", "LENS", "LESS",
  "LIFE", "LIFT", "LIKE", "LIME", "LINE", "LINK", "LION", "LIST", "LIVE",
  "LOAD", "LOAN", "LOCK", "LONG", "LOOK", "LOOP", "LORD", "LOSE", "LOSS",
  "LOUD", "LOVE", "LUCK", "MADE", "MAIL", "MAIN", "MAKE", "MALE", "MALL",
  "MANY", "MASK", "MASS", "MATE", "MEAL", "MEAN", "MEAT", "MEET", "MELT",
  "MENU", "MILD", "MILE", "MILK", "MILL", "MIND", "MINE", "MINT", "MISS",
  "MIST", "MODE", "MOOD", "MOON", "MORE", "MOST", "MOVE", "MUCH", "NAIL",
  "NAME", "NAVY", "NEAT", "NECK", "NEED", "NEST", "NEWS", "NEXT", "NICE",
  "NINE", "NODE", "NONE", "NOON", "NOSE", "NOTE", "OKAY", "ONCE", "ONLY",
  "ONTO", "OPEN", "ORAL", "OVAL", "OVEN", "OVER", "PACE", "PACK", "PAGE",
  "PAID", "PAIN", "PAIR", "PALM", "PARK", "PART", "PASS", "PAST", "PATH",
  "PEAK", "PEEL", "PICK", "PILE", "PINE", "PINK", "PIPE", "PLAN", "PLAY",
  "PLOT", "PLUG", "PLUS", "POEM", "POET", "POLE", "POLL", "POOL", "POOR",
  "PORT", "POSE", "POST", "POUR", "PRAY", "PREP", "PREY", "PULL", "PUMP",
  "PURE", "PUSH", "QUIT", "QUIZ", "RACE", "RACK", "RAGE", "RAID", "RAIL",
  "RAIN", "RANK", "RARE", "RASH", "RATE", "READ", "REAL", "REAR", "RELY",
  "RENT", "REST", "RICE", "RICH", "RIDE", "RING", "RIPE", "RISE", "RISK",
  "ROAD", "ROAR", "ROCK", "ROLE", "ROLL", "ROOF", "ROOM", "ROOT", "ROPE",
  "ROSE", "RUIN", "RULE", "RUSH", "SAFE", "SAID", "SAIL", "SALE", "SALT",
  "SAME", "SAND", "SAVE", "SEAL", "SEAT", "SEED", "SEEK", "SEEM", "SEEN",
  "SELF", "SELL", "SEND", "SHIP", "SHOE", "SHOP", "SHOT", "SHOW", "SHUT",
  "SICK", "SIDE", "SIGN", "SILK", "SING", "SINK", "SITE", "SIZE", "SKIN",
  "SKIP", "SLIP", "SLOW", "SNAP", "SNOW", "SOAP", "SOFT", "SOIL", "SOLD",
  "SOLE", "SOME", "SONG", "SOON", "SORT", "SOUL", "SOUP", "SOUR", "SPAN",
  "SPIN", "SPOT", "STAR", "STAY", "STEM", "STEP", "STIR", "STOP", "SUCH",
  "SUIT", "SURE", "SWAP", "SWIM", "TAIL", "TAKE", "TALE", "TALK", "TALL",
  "TANK", "TAPE", "TASK", "TEAM", "TEAR", "TELL", "TEND", "TENT", "TERM",
  "TEST", "TEXT", "THAN", "THAT", "THEM", "THEN", "THEY", "THIN", "THIS",
  "TIDE", "TIDY", "TILE", "TIME", "TINY", "TIRE", "TOLL", "TONE", "TOOK",
  "TOOL", "TORN", "TOUR", "TOWN", "TRAP", "TREE", "TRIM", "TRIP", "TRUE",
  "TUBE", "TUNE", "TURN", "TWIN", "TYPE", "UGLY", "UNIT", "UPON", "URGE",
  "USED", "USER", "VARY", "VAST", "VERY", "VIEW", "VOTE", "WAGE", "WAIT",
  "WAKE", "WALK", "WALL", "WANT", "WARD", "WARM", "WARN", "WASH", "WAVE",
  "WEAK", "WEAR", "WEEK", "WELL", "WENT", "WERE", "WEST", "WHAT", "WHEN",
  "WIDE", "WIFE", "WILD", "WILL", "WIND", "WINE", "WING", "WIRE", "WISE",
  "WISH", "WITH", "WOLF", "WOOD", "WOOL", "WORD", "WORE", "WORK", "WORM",
  "WORN", "YARD", "YEAR", "ZERO", "ZONE", "ZOOM",
];

/** Deduped, uppercased word set. */
export const BEE_DICTIONARY: string[] = Array.from(
  new Set(RAW_WORDS.map((w) => w.toUpperCase()))
);

/** Pick the puzzle for a date by day of week (0 Sun … 6 Sat). */
export function beePuzzleForDate(iso: string): BeePuzzle {
  const dow = parseISODate(iso).getUTCDay();
  return BEE_PUZZLES[dow % BEE_PUZZLES.length];
}

function letterSet(puzzle: BeePuzzle): Set<string> {
  return new Set([puzzle.center, ...puzzle.others]);
}

/** A word is valid: >=4 letters, contains center, uses only puzzle letters. */
export function isValidBeeWord(word: string, puzzle: BeePuzzle): boolean {
  const w = word.toUpperCase();
  if (w.length < 4) return false;
  if (!w.includes(puzzle.center)) return false;
  const allowed = letterSet(puzzle);
  for (const ch of w) if (!allowed.has(ch)) return false;
  return true;
}

/** True when the word uses all seven letters at least once. */
export function isPangram(word: string, puzzle: BeePuzzle): boolean {
  const used = new Set(word.toUpperCase().split(""));
  const all = letterSet(puzzle);
  for (const ch of all) if (!used.has(ch)) return false;
  return true;
}

/** 4-letter word = 1pt; 5+ = length; pangram adds +7. */
export function scoreWord(word: string, puzzle: BeePuzzle): number {
  const len = word.length;
  let pts = len === 4 ? 1 : len;
  if (isPangram(word, puzzle)) pts += 7;
  return pts;
}

/** Every valid dictionary word for a puzzle. */
export function validWordsFor(puzzle: BeePuzzle): string[] {
  return BEE_DICTIONARY.filter((w) => isValidBeeWord(w, puzzle)).sort();
}

/** Maximum achievable score for a puzzle. */
export function maxScoreFor(puzzle: BeePuzzle): number {
  return validWordsFor(puzzle).reduce((sum, w) => sum + scoreWord(w, puzzle), 0);
}

export interface Rank {
  name: string;
  pct: number; // fraction of max score to reach this rank
}

/** Rank thresholds as fractions of the max score. Genius = win. */
export const BEE_RANKS: Rank[] = [
  { name: "Beginner", pct: 0 },
  { name: "Good Start", pct: 0.05 },
  { name: "Moving Up", pct: 0.15 },
  { name: "Almost", pct: 0.25 },
  { name: "Great", pct: 0.4 },
  { name: "Amazing", pct: 0.55 },
  { name: "Genius", pct: 0.7 },
];

/** The rank achieved for a score given the puzzle's max. */
export function rankForScore(score: number, maxScore: number): Rank {
  if (maxScore <= 0) return BEE_RANKS[0];
  const frac = score / maxScore;
  let current = BEE_RANKS[0];
  for (const r of BEE_RANKS) if (frac >= r.pct) current = r;
  return current;
}
