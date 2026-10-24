/**
 * Fallback theme bank for Word Search: original themes, used when no stored
 * daily row exists for a date (the cron's DeepSeek themes are the first
 * choice) and for practice grids. Every word is a single lowercase dictionary
 * word of 3–12 letters; lib/games/wordsearch/themes.test.ts checks each one
 * against the lexicon and the blocklist and builds every grid size.
 */
import type { Theme } from "./generate";

export const THEMES: Theme[] = [
  { title: "Ocean Life", words: ["whale", "dolphin", "octopus", "shark", "coral", "squid", "starfish", "sardine", "jellyfish", "lobster", "crab", "clam", "oyster", "urchin", "turtle", "walrus", "plankton", "shrimp", "seal"] },
  { title: "Kitchen Tools", words: ["whisk", "ladle", "spatula", "grater", "strainer", "skillet", "colander", "tongs", "kettle", "blender", "toaster", "oven", "sieve", "mixer", "cleaver", "funnel", "saucepan", "timer"] },
  { title: "Wild Weather", words: ["thunder", "lightning", "rainbow", "drizzle", "blizzard", "tornado", "hurricane", "breeze", "frost", "hail", "sleet", "cloud", "fog", "monsoon", "humid", "storm", "mist", "cyclone"] },
  { title: "Fruit Bowl", words: ["apple", "banana", "cherry", "grape", "mango", "peach", "plum", "pear", "lemon", "lime", "kiwi", "papaya", "apricot", "melon", "orange", "coconut", "guava", "fig"] },
  { title: "Vegetable Patch", words: ["carrot", "potato", "onion", "garlic", "celery", "spinach", "lettuce", "cabbage", "turnip", "radish", "pepper", "tomato", "squash", "pumpkin", "broccoli", "leek", "beet", "kale"] },
  { title: "The Orchestra", words: ["piano", "guitar", "violin", "cello", "flute", "trumpet", "drum", "harp", "banjo", "clarinet", "oboe", "tuba", "organ", "ukulele", "cymbal", "bugle", "harmonica", "trombone"] },
  { title: "Birdwatching", words: ["robin", "sparrow", "eagle", "hawk", "owl", "parrot", "pigeon", "crow", "raven", "swan", "goose", "heron", "pelican", "falcon", "finch", "wren", "penguin", "ostrich", "flamingo"] },
  { title: "Outer Space", words: ["planet", "comet", "galaxy", "nebula", "asteroid", "meteor", "orbit", "rocket", "star", "moon", "eclipse", "telescope", "astronaut", "satellite", "gravity", "crater", "cosmos", "lunar", "solar"] },
  { title: "Camping Trip", words: ["tent", "lantern", "compass", "campfire", "backpack", "canteen", "hammock", "kindling", "trail", "cabin", "flashlight", "map", "hike", "canoe", "firewood", "blanket", "cooler", "sleeping"] },
  { title: "Game Day", words: ["soccer", "tennis", "hockey", "golf", "rugby", "cricket", "boxing", "rowing", "archery", "fencing", "cycling", "skiing", "surfing", "karate", "judo", "polo", "bowling", "baseball", "softball"] },
  { title: "Shades of Color", words: ["crimson", "scarlet", "amber", "ivory", "olive", "maroon", "teal", "indigo", "violet", "lilac", "turquoise", "coral", "beige", "magenta", "navy", "ruby", "khaki", "azure", "emerald", "mauve"] },
  { title: "Jobs People Do", words: ["doctor", "nurse", "teacher", "pilot", "farmer", "chef", "baker", "plumber", "lawyer", "dentist", "artist", "author", "banker", "sailor", "tailor", "carpenter", "engineer", "florist", "barber", "judge"] },
  { title: "In the Garden", words: ["shovel", "rake", "hoe", "trowel", "seed", "soil", "compost", "mulch", "hose", "sprinkler", "tulip", "daisy", "rose", "weed", "fence", "shed", "bulb", "sapling", "hedge", "wheelbarrow"] },
  { title: "Desert Days", words: ["cactus", "camel", "dune", "oasis", "mirage", "sand", "lizard", "scorpion", "vulture", "coyote", "mesa", "canyon", "arid", "drought", "tumbleweed", "sandstorm", "heat", "nomad"] },
  { title: "Down on the Farm", words: ["barn", "tractor", "cow", "pig", "sheep", "goat", "hen", "rooster", "horse", "hay", "silo", "plow", "pasture", "orchard", "harvest", "stable", "calf", "lamb", "piglet"] },
  { title: "Breakfast Table", words: ["pancake", "waffle", "bacon", "toast", "cereal", "omelet", "yogurt", "muffin", "bagel", "oatmeal", "coffee", "juice", "honey", "butter", "jam", "sausage", "granola", "crepe", "porridge"] },
  { title: "Forest Trees", words: ["oak", "maple", "birch", "willow", "cedar", "pine", "spruce", "elm", "aspen", "cypress", "poplar", "redwood", "sequoia", "beech", "chestnut", "walnut", "hemlock", "palm", "fir"] },
  { title: "Getting Around", words: ["car", "bus", "train", "tram", "subway", "bicycle", "scooter", "truck", "van", "taxi", "ferry", "yacht", "kayak", "airplane", "helicopter", "glider", "wagon", "sled", "rickshaw"] },
  { title: "Head to Toe", words: ["elbow", "knee", "ankle", "wrist", "shoulder", "finger", "thumb", "toe", "heel", "chin", "cheek", "forehead", "eyebrow", "ear", "nose", "lung", "heart", "liver", "spine", "muscle"] },
  { title: "Closet Check", words: ["shirt", "jacket", "sweater", "scarf", "gloves", "mittens", "hat", "boots", "sandals", "socks", "jeans", "skirt", "dress", "coat", "vest", "pajamas", "apron", "belt", "blouse"] },
  { title: "Feelings", words: ["happy", "angry", "calm", "proud", "brave", "joyful", "nervous", "curious", "grateful", "excited", "lonely", "jealous", "cheerful", "anxious", "content", "hopeful", "shy", "bored", "eager", "gentle"] },
  { title: "Bug Hunt", words: ["ant", "bee", "beetle", "butterfly", "moth", "cricket", "grasshopper", "ladybug", "dragonfly", "firefly", "termite", "wasp", "hornet", "flea", "gnat", "mosquito", "cicada", "locust", "aphid", "mantis"] },
  { title: "Game Night", words: ["chess", "checkers", "dice", "puzzle", "cards", "domino", "marbles", "bingo", "trivia", "riddle", "jigsaw", "maze", "hopscotch", "crossword", "charades", "backgammon", "tokens", "spinner"] },
  { title: "Making Music", words: ["melody", "rhythm", "harmony", "tempo", "chord", "scale", "octave", "chorus", "verse", "lyric", "beat", "note", "sharp", "solo", "duet", "opera", "ballad", "anthem", "encore"] },
  { title: "Day at the Beach", words: ["sand", "shell", "wave", "tide", "surf", "towel", "bucket", "umbrella", "sunscreen", "lifeguard", "pier", "dune", "gull", "sandcastle", "snorkel", "kite", "cooler", "boardwalk"] },
  { title: "Toolbox", words: ["hammer", "wrench", "pliers", "screwdriver", "saw", "drill", "chisel", "level", "clamp", "file", "sander", "mallet", "vise", "ruler", "tape", "nail", "bolt", "hatchet", "crowbar"] },
  { title: "The Bakery", words: ["bread", "bagel", "croissant", "muffin", "scone", "cookie", "pie", "tart", "cake", "cupcake", "doughnut", "brownie", "pretzel", "biscuit", "loaf", "flour", "yeast", "oven", "strudel"] },
  { title: "Mountain High", words: ["peak", "summit", "ridge", "valley", "cliff", "glacier", "avalanche", "boulder", "slope", "trail", "cave", "canyon", "alpine", "altitude", "climber", "rope", "crevasse", "hiker", "pass"] },
  { title: "Shapes", words: ["circle", "square", "triangle", "oval", "diamond", "star", "heart", "cube", "sphere", "cone", "cylinder", "pyramid", "hexagon", "octagon", "pentagon", "rectangle", "prism", "crescent", "spiral", "arrow"] },
  { title: "Pet Shop", words: ["puppy", "kitten", "hamster", "gerbil", "rabbit", "parrot", "goldfish", "turtle", "ferret", "lizard", "canary", "pony", "mouse", "iguana", "snake", "hedgehog", "parakeet", "tortoise"] },
  { title: "Science Lab", words: ["beaker", "flask", "atom", "molecule", "microscope", "magnet", "battery", "circuit", "laser", "prism", "lens", "energy", "element", "acid", "crystal", "experiment", "theory", "formula", "goggles"] },
  { title: "At the Library", words: ["novel", "author", "chapter", "page", "shelf", "index", "spine", "cover", "poem", "story", "fable", "legend", "myth", "atlas", "diary", "journal", "comic", "reader", "bookmark"] },
  { title: "Into the Jungle", words: ["jungle", "monkey", "jaguar", "parrot", "toucan", "sloth", "vine", "canopy", "orchid", "python", "gorilla", "leopard", "tiger", "frog", "macaw", "lemur", "fern", "moss", "river"] },
  { title: "Winter Wonderland", words: ["snow", "ice", "sled", "skate", "mitten", "scarf", "frost", "icicle", "snowman", "blizzard", "cocoa", "fireplace", "chimney", "sweater", "igloo", "penguin", "ski", "flurry", "freeze"] },
  { title: "Autumn Leaves", words: ["leaves", "pumpkin", "harvest", "acorn", "apple", "cider", "scarecrow", "maple", "sweater", "rake", "squirrel", "orchard", "chestnut", "cranberry", "gourd", "frost", "breeze", "amber", "bonfire"] },
  { title: "Spring Has Sprung", words: ["blossom", "tulip", "daffodil", "rain", "puddle", "bud", "robin", "nest", "lamb", "garden", "sprout", "umbrella", "breeze", "meadow", "bloom", "daisy", "butterfly", "picnic", "clover"] },
  { title: "Summer Fun", words: ["sunshine", "beach", "picnic", "lemonade", "sandals", "barbecue", "swim", "pool", "vacation", "fireworks", "camping", "hammock", "melon", "holiday", "heat", "sunset", "surf", "sprinkler"] },
  { title: "Under the Big Top", words: ["clown", "juggler", "acrobat", "trapeze", "tent", "ringmaster", "popcorn", "tightrope", "unicycle", "magician", "lion", "elephant", "balloon", "ticket", "carousel", "parade", "costume", "circus", "stilts"] },
  { title: "Cooking Verbs", words: ["bake", "boil", "fry", "grill", "roast", "steam", "stir", "chop", "dice", "slice", "mince", "knead", "whisk", "simmer", "broil", "toast", "poach", "blend", "marinate"] },
  { title: "Lay of the Land", words: ["island", "river", "lake", "ocean", "desert", "forest", "valley", "mountain", "plateau", "canyon", "delta", "bay", "coast", "peninsula", "volcano", "prairie", "tundra", "swamp", "lagoon", "glacier"] },
  { title: "Castle Life", words: ["castle", "knight", "king", "queen", "prince", "princess", "dragon", "tower", "moat", "sword", "shield", "armor", "throne", "crown", "jester", "banner", "dungeon", "wizard", "squire"] },
  { title: "Pirate Ship", words: ["pirate", "parrot", "treasure", "anchor", "cannon", "captain", "ship", "sail", "map", "island", "compass", "plank", "deck", "chest", "gold", "coin", "flag", "crew", "mast", "cutlass"] },
  { title: "At the Office", words: ["desk", "chair", "stapler", "folder", "printer", "laptop", "pencil", "eraser", "marker", "memo", "meeting", "email", "calendar", "paper", "clip", "envelope", "notebook", "keyboard", "monitor"] },
  { title: "Spice Rack", words: ["basil", "thyme", "oregano", "parsley", "mint", "ginger", "cinnamon", "pepper", "nutmeg", "paprika", "cumin", "sage", "dill", "rosemary", "clove", "saffron", "vanilla", "garlic", "mustard"] },
  { title: "Let's Dance", words: ["ballet", "tango", "waltz", "salsa", "polka", "samba", "tap", "jazz", "swing", "disco", "rumba", "hula", "jig", "minuet", "foxtrot", "mambo", "twirl", "spin", "leap", "dancer"] },
  { title: "Water Words", words: ["stream", "creek", "brook", "river", "pond", "lake", "ocean", "rain", "puddle", "spring", "fountain", "waterfall", "rapids", "current", "ripple", "splash", "drip", "flood", "tide", "wave"] },
  { title: "Around the House", words: ["kitchen", "bedroom", "bathroom", "attic", "cellar", "hallway", "closet", "garage", "porch", "pantry", "stairs", "window", "door", "ceiling", "floor", "chimney", "balcony", "basement", "study"] },
  { title: "Flower Shop", words: ["rose", "tulip", "daisy", "lily", "orchid", "iris", "peony", "poppy", "violet", "lilac", "daffodil", "sunflower", "marigold", "lavender", "jasmine", "magnolia", "carnation", "dahlia", "aster", "petunia"] },
];

/** A theme for a practice seed (the seed decides, so a challenge link replays it). */
export function themeForSeed(hash: number): Theme {
  return THEMES[hash % THEMES.length];
}
