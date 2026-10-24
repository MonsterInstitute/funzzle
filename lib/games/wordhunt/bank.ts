/**
 * Fallback Word Hunt themes, written by hand for Funzzle. The page plays one
 * of these (picked by date) whenever no AI theme is stored for the day, and
 * practice puzzles come from here. Every theme is checked in bank.test.ts:
 * dictionary words, exactly 48 letters, and a grid that tiles.
 *
 * Format: [id, title, span word, ...theme words]. Lowercase.
 */
import type { WordHuntTheme } from "./types";

const ROWS: [id: string, title: string, span: string, ...words: string[]][] = [
  ["bake-sale", "Bake sale", "cupcakes", "brownie", "muffin", "cookie", "scone", "tart", "fudge", "biscuit"],
  ["shore", "A day at the shore", "sandcastle", "parasol", "kite", "waves", "sunscreen", "bucket", "seagull"],
  ["band", "Strike up the band", "orchestra", "violin", "cello", "flute", "oboe", "trumpet", "harp", "clarinet"],
  ["window", "Look out the window", "forecast", "rain", "snow", "thunder", "sunshine", "drizzle", "hail", "breeze"],
  ["grow", "Grow your own", "vegetables", "carrot", "potato", "radish", "pepper", "cabbage", "lettuce"],
  ["stars", "Under the stars", "campfire", "tent", "lantern", "compass", "backpack", "hammock", "matches"],
  ["drawer", "The cook's drawer", "utensils", "whisk", "ladle", "spatula", "tongs", "funnel", "grater", "skewer"],
  ["sleepy", "Feeling sleepy", "bedtime", "pillow", "blanket", "pajamas", "slippers", "lullaby", "dreams"],
  ["school", "Off to school", "classroom", "pencil", "eraser", "ruler", "notebook", "crayon", "textbook"],
  ["farm", "Down on the farm", "barnyard", "chicken", "horse", "goat", "sheep", "piglet", "rooster", "donkey"],
  ["fix-it", "Fix it yourself", "workshop", "hammer", "wrench", "pliers", "chisel", "hacksaw", "sandpaper"],
  ["rise", "Rise and shine", "breakfast", "oatmeal", "granola", "cereal", "omelet", "pancake", "waffle"],
  ["sea", "Under the sea", "shipwreck", "anemone", "whale", "shark", "octopus", "seahorse", "dolphin"],
  ["game-night", "Game night", "boardgames", "dominoes", "cards", "tokens", "spinner", "dice", "checkers"],
  ["there-yet", "Are we there yet?", "roadtrip", "highway", "gasoline", "billboard", "suitcase", "maps", "toll"],
  ["rack", "Spice rack", "seasoning", "pepper", "cinnamon", "paprika", "thyme", "nutmeg", "oregano"],
  ["canopy", "Deep in the canopy", "jungle", "parrot", "monkey", "jaguar", "toucan", "python", "gorilla", "sloth"],
  ["bundle", "Bundle up", "outerwear", "sweater", "mittens", "jacket", "earmuffs", "gloves", "boots"],
  ["wish", "Make a wish", "celebrate", "balloons", "candles", "presents", "confetti", "cake", "hats"],
  ["tropical", "Tropical treats", "pineapple", "mango", "papaya", "banana", "coconut", "guava", "kiwi", "citrus"],
  ["head-toe", "Head to toe", "skeleton", "elbow", "knee", "shoulder", "ankle", "wrist", "finger", "eyebrow"],
  ["safari", "On safari", "savanna", "lion", "zebra", "giraffe", "elephant", "rhino", "hippo", "cheetah"],
  ["woods", "Into the woods", "evergreen", "maple", "birch", "willow", "cedar", "spruce", "chestnut", "pine"],
  ["movie", "Movie night", "popcorn", "ticket", "screen", "trailer", "projector", "nachos", "armrest"],
  ["paint", "Paint box", "rainbow", "crimson", "scarlet", "orange", "violet", "indigo", "turquoise"],
  ["sport", "Pick a sport", "athletics", "tennis", "soccer", "hockey", "baseball", "cricket", "boxing"],
  ["blast-off", "Blast off", "astronaut", "rocket", "galaxy", "nebula", "orbit", "meteor", "planet", "moon"],
  ["save-room", "Save room for this", "sweettooth", "pudding", "sundae", "custard", "mousse", "sorbet", "trifle"],
  ["critters", "Tiny critters", "insects", "beetle", "hornet", "moth", "termite", "ladybug", "firefly", "wasp"],
  ["shapes", "Draw a shape", "geometry", "circle", "pentagon", "triangle", "oval", "hexagon", "rhombus"],
  ["ahoy", "Ahoy, matey", "treasure", "cannon", "anchor", "eyepatch", "cutlass", "island", "galleon"],
  ["furry", "Furry and finned", "companion", "goldfish", "kitten", "hamster", "rabbit", "gerbil", "ferret"],
  ["nine-five", "Nine to five", "occupation", "doctor", "teacher", "dentist", "baker", "farmer", "plumber"],
  ["coffee", "Coffee break", "espresso", "latte", "mocha", "barista", "cappuccino", "saucer", "caramel"],
  ["feathers", "Feathered friends", "birdsong", "penguin", "sparrow", "pigeon", "falcon", "pelican", "ostrich"],
  ["around", "Getting around", "transport", "bicycle", "scooter", "train", "ferry", "truck", "subway", "taxi"],
  ["spooky", "Spooky season", "graveyard", "ghost", "pumpkin", "witch", "broom", "zombie", "candy", "spider"],
  ["desk", "Desk drawer", "stationery", "stapler", "envelope", "paperclip", "tape", "marker", "glue"],
  ["gems", "Treasure chest", "gemstones", "ruby", "emerald", "diamond", "sapphire", "opal", "topaz", "jade"],
];

export const BANK: WordHuntTheme[] = ROWS.map(([id, title, span, ...words]) => ({ id, title, span, words }));

export const BANK_BY_ID: Record<string, WordHuntTheme> = Object.fromEntries(BANK.map((t) => [t.id, t]));
