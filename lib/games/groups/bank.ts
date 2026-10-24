/**
 * Fallback bank: original Groups puzzles written for Funzzle (not taken from
 * any other puzzle). The page uses one when no generated daily row exists
 * for a date, and practice draws from it. Every puzzle is checked by
 * lib/games/groups/bank.test.ts: real everyday words, nothing blocked, and
 * no word that also fits another group's link (wordplay groups are checked
 * mechanically). Levels go 1 (most direct) → 4 (trickiest).
 */
import type { Group, GroupsPuzzle } from "./puzzle";

type Row = [title: string, hint: string, words: string];

function P(id: string, ...rows: [Row, Row, Row, Row]): GroupsPuzzle {
  const groups = rows.map(([title, hint, words], i) => ({
    level: (i + 1) as Group["level"],
    title,
    hint,
    words: words.split(",").map((w) => w.trim()) as Group["words"],
  }));
  return { id, groups: groups as GroupsPuzzle["groups"] };
}

export const BANK: GroupsPuzzle[] = [
  P(
    "b01",
    ["Breakfast foods", "What's on the plate before noon", "toast, cereal, pancake, waffle"],
    ["Things with keys", "You press them or turn them", "piano, lock, typewriter, keyboard"],
    ["Shades of red", "Deep, warm colors", "crimson, scarlet, maroon, ruby"],
    ["___ball", "Add a round toy to the end", "snow, eye, foot, hand"]
  ),
  P(
    "b02",
    ["Pets", "Animals that live in the house with you", "hamster, rabbit, goldfish, parrot"],
    ["Planets", "Look up past the moon", "Mars, Venus, Saturn, Jupiter"],
    ["___cake", "Something sweet goes on the end", "cup, cheese, carrot, sponge"],
    ["Hidden body parts", "Look inside each word for part of you", "orchestra, pearl, machine, harmless"]
  ),
  P(
    "b03",
    ["Weather", "Check the forecast", "drizzle, hail, sleet, fog"],
    ["Card games", "Shuffle and deal", "poker, bridge, rummy, solitaire"],
    ["Things with a shell", "Hard on the outside", "egg, snail, turtle, peanut"],
    ["___fish", "Each one becomes a sea creature", "star, sword, cat, jelly"]
  ),
  P(
    "b04",
    ["Things with wheels", "They roll", "bicycle, wagon, tricycle, cart"],
    ["Instruments", "Join the band", "violin, flute, trumpet, drum"],
    ["You can draw one", "Not with a pencil", "sword, breath, blood, conclusion"],
    ["Hidden animals", "A creature hides in each word", "beard, bowl, pirate, scatter"]
  ),
  P(
    "b05",
    ["Ocean animals", "They live under the waves", "dolphin, whale, octopus, shark"],
    ["In a classroom", "Back to school", "desk, globe, eraser, stapler"],
    ["Royal titles", "Who sits on the throne, and family", "king, queen, prince, duke"],
    ["___fly", "Each one becomes an insect", "butter, dragon, fire, house"]
  ),
  P(
    "b06",
    ["Farm animals", "Old MacDonald had them", "cow, sheep, goat, pig"],
    ["Fabrics", "What clothes are made of", "cotton, silk, denim, wool"],
    ["Trees", "Found in a forest", "oak, maple, birch, willow"],
    ["You can crack one", "Safes, eggs and comedians", "code, joke, smile, whip"]
  ),
  P(
    "b07",
    ["Vegetables", "Eat your greens, and your roots", "carrot, potato, onion, celery"],
    ["Table games", "Played on a board with pieces", "chess, checkers, backgammon, dominoes"],
    ["Things that buzz", "Listen for the hum", "bee, razor, alarm, mosquito"],
    ["Hidden numbers", "Count what hides inside", "often, weight, canine, stone"]
  ),
  P(
    "b08",
    ["Shapes", "Geometry class", "circle, square, triangle, oval"],
    ["Desserts", "Save room for these", "pudding, brownie, sundae, custard"],
    ["Parts of a shoe", "Look at your feet", "sole, heel, lace, tongue"],
    ["Sound like letters", "Say them out loud", "queue, sea, why, tea"]
  ),
  P(
    "b09",
    ["Sports", "Played on a field, court or course", "hockey, tennis, golf, rugby"],
    ["Herbs", "Grown on a kitchen windowsill", "basil, mint, thyme, parsley"],
    ["Kept in a wallet", "Check your pocket", "cash, receipt, photo, coupon"],
    ["Green ___", "A color goes in front", "house, bean, light, thumb"]
  ),
  P(
    "b10",
    ["Bodies of water", "Places to swim or sail", "lake, river, ocean, pond"],
    ["Hats", "Worn on your head", "beret, bowler, bonnet, helmet"],
    ["Rain___", "Wet weather goes in front", "bow, coat, drop, forest"],
    ["Hidden vehicles", "A ride hides in each word", "scarf, busy, vanilla, worship"]
  ),
  P(
    "b11",
    ["In the sky", "Look up", "cloud, moon, kite, comet"],
    ["Dog breeds", "Best friends with four legs", "poodle, beagle, boxer, collie"],
    ["Sticky things", "They don't let go", "glue, honey, tape, syrup"],
    ["Add a letter in front for a color", "One letter at the start paints it", "ink, ray, old, range"]
  ),
  P(
    "b12",
    ["Hot drinks", "Served in a mug", "coffee, cocoa, tea, cider"],
    ["Mythical creatures", "Found in legends, not zoos", "dragon, unicorn, phoenix, mermaid"],
    ["Chess pieces", "On the board with the king", "bishop, knight, rook, pawn"],
    ["Sound like numbers", "Say them out loud and count", "won, ate, for, too"]
  ),
  P(
    "b13",
    ["Kitchen appliances", "Plug them in to cook", "oven, toaster, kettle, microwave"],
    ["Flowers", "Pick a bouquet", "tulip, daisy, rose, lily"],
    ["They have pages", "Turn them one at a time", "book, diary, magazine, atlas"],
    ["___stick", "Something thin goes on the end", "chop, drum, lip, joy"]
  ),
  P(
    "b14",
    ["Furniture", "Fill an empty room", "chair, sofa, stool, wardrobe"],
    ["Insects", "Six legs each", "ant, beetle, wasp, moth"],
    ["Things you roll", "Board games, bakers and the red ones", "dice, dough, carpet, sleeves"],
    ["Start with a body part", "Look at the first few letters", "earnest, legend, handsome, kneel"]
  ),
  P(
    "b15",
    ["Seasons", "The year goes round", "spring, summer, autumn, winter"],
    ["Nuts", "Crack them open", "almond, walnut, pecan, cashew"],
    ["In a toolbox", "Fix it yourself", "hammer, wrench, pliers, chisel"],
    ["___fall", "Something drops at the end", "water, rain, night, land"]
  ),
  P(
    "b16",
    ["Fruit", "Grows on trees and vines", "banana, grape, mango, peach"],
    ["Currencies", "Money around the world", "dollar, franc, pound, yen"],
    ["Things you can break", "And sometimes regret", "record, promise, silence, ice"],
    ["Pine ___", "Think of an evergreen", "cone, needle, nut, tree"]
  ),
  P(
    "b17",
    ["In the bathroom", "Washing up", "towel, soap, toothbrush, shampoo"],
    ["Birds", "They nest and sing", "robin, sparrow, eagle, pigeon"],
    ["Very big", "Not small at all", "huge, giant, massive, enormous"],
    ["___man", "Each one becomes a person", "post, fire, snow, chair"]
  ),
  P(
    "b18",
    ["Baby animals", "Very young ones", "puppy, kitten, foal, calf"],
    ["Things you blow", "Take a deep breath first", "bubble, whistle, horn, kiss"],
    ["Containers", "Put things inside", "jar, box, crate, barrel"],
    ["Anagrams of each other", "Same six letters, rearranged", "listen, silent, tinsel, enlist"]
  ),
  P(
    "b19",
    ["Months", "Flip the calendar", "March, October, December, February"],
    ["Ways to cook", "What the oven or the pan does", "bake, fry, boil, roast"],
    ["Greek letters", "From the start and end of an old alphabet", "alpha, beta, delta, omega"],
    ["Verbs that are also names", "Each could be someone's name", "bill, mark, rob, sue"]
  ),
  P(
    "b20",
    ["Clothing", "In your closet", "shirt, jacket, sock, scarf"],
    ["At the beach", "A day by the sea", "sand, wave, umbrella, bucket"],
    ["Fast", "In a hurry", "quick, rapid, swift, speedy"],
    ["Butter___", "Spread something on the front", "cup, fly, milk, nut"]
  ),
  P(
    "b21",
    ["European capitals", "Seats of government", "Paris, Rome, Madrid, Berlin"],
    ["Things with a screen", "You look at it", "television, tablet, phone, monitor"],
    ["Sour things", "They make you pucker", "lemon, lime, vinegar, pickle"],
    ["___board", "A flat plank goes on the end", "skate, black, card, surf"]
  ),
  P(
    "b22",
    ["Snacks", "Something to munch", "popcorn, pretzel, cracker, peanut"],
    ["Hospital jobs", "Who helps when you're sick", "nurse, surgeon, midwife, pharmacist"],
    ["Things you can set", "Get them ready", "table, record, trap, scene"],
    ["End with a body part", "Look at the last few letters", "spaceship, spear, tulip, mistletoe"]
  ),
  P(
    "b23",
    ["Zoo animals", "Visit them on safari or in the city", "lion, tiger, zebra, giraffe"],
    ["Units of time", "Tick tock", "second, minute, hour, decade"],
    ["In the garden", "Out back with the plants", "shed, hose, rake, trowel"],
    ["___line", "Each one becomes a kind of row", "dead, head, life, sky"]
  ),
  P(
    "b24",
    ["In a pencil case", "School supplies", "pen, ruler, eraser, crayon"],
    ["Gemstones", "Precious and sparkly", "ruby, emerald, sapphire, diamond"],
    ["Grand ___", "Think big", "piano, canyon, slam, total"],
    ["Palindromes", "Read them backward", "level, radar, kayak, civic"]
  ),
  P(
    "b25",
    ["Drinks", "Fill a glass", "juice, milk, water, soda"],
    ["At the bakery", "Fresh from the oven", "bagel, muffin, biscuit, doughnut"],
    ["Dances", "Hit the floor", "waltz, tango, polka, ballet"],
    ["Hand___", "Something you hold goes in front", "rail, bag, cuff, writing"]
  ),
  P(
    "b26",
    ["Transport", "Ways to get across town", "train, bus, taxi, ferry"],
    ["Spices", "Shake them into a recipe", "pepper, cinnamon, ginger, nutmeg"],
    ["Fairy-tale figures", "Once upon a time", "witch, giant, troll, goblin"],
    ["Anagrams of each other", "Same four letters, rearranged", "east, seat, teas, eats"]
  ),
  P(
    "b27",
    ["Parts of a car", "Under the hood and around it", "wheel, engine, bumper, brake"],
    ["Pizza toppings", "Order a large one", "mushroom, olive, sausage, onion"],
    ["Things you hatch", "Not only birds do this", "egg, plan, plot, scheme"],
    ["Moon___", "Look up at night", "light, walk, beam, stone"]
  ),
  P(
    "b28",
    ["Toys", "In the toy box", "doll, kite, rattle, robot"],
    ["Writing tools", "Put it on paper or a board", "pen, marker, chalk, quill"],
    ["___work", "Each one becomes a kind of effort", "home, team, clock, net"],
    ["End with a number", "Count the last few letters", "often, canine, phone, freight"]
  ),
  P(
    "b29",
    ["Footwear", "What goes on your feet", "boot, sandal, slipper, sneaker"],
    ["On a farm", "Out in the country", "barn, tractor, silo, scarecrow"],
    ["Angry", "Seeing red", "cross, mad, irate, livid"],
    ["Things with scales", "Not only for weighing", "map, piano, snake, thermometer"]
  ),
  P(
    "b30",
    ["Countries", "Find them on a world map", "Spain, Japan, Brazil, Egypt"],
    ["Fasteners", "They hold your clothes together", "button, zipper, buckle, clasp"],
    ["___room", "Each one becomes a space", "bath, bed, class, mush"],
    ["Sound like vegetables", "Say them out loud at the market", "leak, beat, carat, maze"]
  ),
  P(
    "b31",
    ["Big cats", "Spots, roars and speed", "leopard, cheetah, jaguar, panther"],
    ["First-aid kit", "For cuts and scrapes", "bandage, gauze, tweezers, ointment"],
    ["Painters", "Their work hangs in museums", "Monet, Picasso, Rembrandt, Vermeer"],
    ["___print", "Each one leaves a mark", "foot, finger, blue, news"]
  ),
  P(
    "b32",
    ["School subjects", "Check the timetable", "math, history, science, music"],
    ["Things with buttons", "Press to make it work", "remote, elevator, calculator, camera"],
    ["Things you fold", "Crease them neatly", "laundry, napkin, map, arms"],
    ["Add S to the front", "One letter makes a new word", "nail, tar, wing, hop"]
  ),
];

export const BANK_BY_ID: Record<string, GroupsPuzzle> = Object.fromEntries(BANK.map((p) => [p.id, p]));
