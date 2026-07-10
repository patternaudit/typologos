import { db } from "./client.js";

// Deterministic, re-runnable seed. Fixed ids make re-seeding idempotent
// (delete + reinsert). Anchor offsets are derived from the body text via
// indexOf so the seeded highlights always line up with the real characters.

const NOW = "2026-06-03T00:00:00.000Z";

const GENESIS_22 = `1 After these things, God tested Abraham, and said to him, "Abraham!" He said, "Here I am."
2 He said, "Now take your son, your only son, whom you love, even Isaac, and go into the land of Moriah. Offer him there as a burnt offering on one of the mountains which I will tell you of."
3 Abraham rose early in the morning, and saddled his donkey, and took two of his young men with him, and Isaac his son. He split the wood for the burnt offering, and rose up, and went to the place of which God had told him.
4 On the third day Abraham lifted up his eyes, and saw the place far off.
5 Abraham said to his young men, "Stay here with the donkey. The boy and I will go yonder. We will worship, and come back to you."
6 Abraham took the wood of the burnt offering and laid it on Isaac his son. He took in his hand the fire and the knife. They both went together.
7 Isaac spoke to Abraham his father, and said, "My father?" He said, "Here I am, my son." He said, "Here is the fire and the wood, but where is the lamb for a burnt offering?"
8 Abraham said, "God will provide himself the lamb for a burnt offering, my son." So they both went together.
9 They came to the place which God had told him of. Abraham built the altar there, and laid the wood in order. He bound Isaac his son, and laid him on the altar, on the wood.
10 Abraham stretched out his hand, and took the knife to kill his son.
11 The angel of Yahweh called to him out of the sky, and said, "Abraham, Abraham!" He said, "Here I am."
12 He said, "Don't lay your hand on the boy, neither do anything to him. For now I know that you fear God, since you have not withheld your son, your only son, from me."
13 Abraham lifted up his eyes, and looked, and saw that behind him was a ram caught in the thicket by his horns. Abraham went and took the ram, and offered him up for a burnt offering instead of his son.
14 Abraham called the name of that place "Yahweh Will Provide." As it is said to this day, "On Yahweh's mountain, it will be provided."
15 The angel of Yahweh called to Abraham a second time out of the sky,
16 and said, "I have sworn by myself, says Yahweh, because you have done this thing, and have not withheld your son, your only son,
17 that I will bless you greatly, and I will multiply your offspring greatly like the stars of the heavens, and like the sand which is on the seashore. Your offspring will possess the gate of his enemies.
18 All the nations of the earth will be blessed by your offspring, because you have obeyed my voice."
19 So Abraham returned to his young men, and they rose up and went together to Beersheba. Abraham lived at Beersheba.`;

const JOHN_3 = `16 For God so loved the world, that he gave his only Son, that whoever believes in him should not perish, but have eternal life.
17 For God didn't send his Son into the world to judge the world, but that the world should be saved through him.`;

const DOC_GENESIS = "doc-genesis-22";
const DOC_JOHN = "doc-john-3";
const WORKSPACE_ID = "ws-genesis-john";
const ANCHOR_GENESIS = "anc-gen-22-2";
const ANCHOR_JOHN = "anc-john-3-16";
const LINK_ID = "link-beloved-son";

function offsetsOf(body: string, phrase: string): { start: number; end: number } {
  const start = body.indexOf(phrase);
  if (start === -1) {
    throw new Error(`Seed phrase not found in body: ${JSON.stringify(phrase)}`);
  }
  return { start, end: start + phrase.length };
}

const GEN_PHRASE = "your son, your only son, whom you love";
const JOHN_PHRASE = "his only Son";

const gen = offsetsOf(GENESIS_22, GEN_PHRASE);
const john = offsetsOf(JOHN_3, JOHN_PHRASE);

// Reset ONLY the legacy demo (idempotent reseed). Crucially this must not touch
// the imported KJV corpus (documents/segments with id like 'kjv-%') or anchors
// targeting it.
db.prepare("DELETE FROM links WHERE workspace_id = ?").run(WORKSPACE_ID);
db.prepare("DELETE FROM anchors WHERE document_id IN (?, ?)").run(DOC_GENESIS, DOC_JOHN);
db.prepare("DELETE FROM workspace_panes WHERE workspace_id = ?").run(WORKSPACE_ID);
db.prepare("DELETE FROM workspaces WHERE id = ?").run(WORKSPACE_ID);
db.prepare("DELETE FROM documents WHERE id IN (?, ?)").run(DOC_GENESIS, DOC_JOHN);

const insertDoc = db.prepare(
  `INSERT INTO documents (id, title, reference, body, source, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);
insertDoc.run(DOC_GENESIS, "Binding of Isaac", "Genesis 22:1–19", GENESIS_22, "World English Bible (public domain)", NOW, NOW);
insertDoc.run(DOC_JOHN, "God Gives His Son", "John 3:16–17", JOHN_3, "World English Bible (public domain)", NOW, NOW);

db.prepare(
  `INSERT INTO workspaces (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
).run(WORKSPACE_ID, "Genesis 22 ↔ John 3", NOW, NOW);

const insertPane = db.prepare(
  `INSERT INTO workspace_panes (id, workspace_id, side, document_id) VALUES (?, ?, ?, ?)`,
);
insertPane.run("pane-left", WORKSPACE_ID, "left", DOC_GENESIS);
insertPane.run("pane-right", WORKSPACE_ID, "right", DOC_JOHN);

const insertAnchor = db.prepare(
  `INSERT INTO anchors (id, document_id, passage_ref, start_offset, end_offset, selected_text, kind, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
insertAnchor.run(ANCHOR_GENESIS, DOC_GENESIS, "Genesis 22:2", gen.start, gen.end, GEN_PHRASE, "text_span", NOW, NOW);
insertAnchor.run(ANCHOR_JOHN, DOC_JOHN, "John 3:16", john.start, john.end, JOHN_PHRASE, "text_span", NOW, NOW);

db.prepare(
  `INSERT INTO links (id, workspace_id, source_anchor_id, target_anchor_id, type, title, rationale, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  LINK_ID,
  WORKSPACE_ID,
  ANCHOR_GENESIS,
  ANCHOR_JOHN,
  "typology",
  "Beloved son offered by father",
  "Abraham's willingness to offer Isaac, his beloved only son, prefigures the Father giving his only Son. The father–beloved son pattern is the typological hinge.",
  NOW,
  NOW,
);

console.log("[seed] workspace seeded:", WORKSPACE_ID);
console.log(`[seed]   genesis anchor offsets ${gen.start}..${gen.end}`);
console.log(`[seed]   john anchor offsets ${john.start}..${john.end}`);
