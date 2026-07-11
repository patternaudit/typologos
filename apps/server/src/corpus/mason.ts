import { db } from "../db/client.js";

// The "Luke used Josephus" dependence layer (Mason, Krenkel, Pervo): the
// classic touchpoints argued to show that the author of Luke-Acts had read
// Josephus — especially the Antiquities (published 93/94 CE). A separate
// provenance layer (source 'mason-dependence') from Atwill's: same texts,
// rival explanation.
//
// Each row was verified against the imported Whiston text (segments checked
// to exist and to contain the claimed content) before authoring.

const SOURCE = "mason-dependence";
const NOW = new Date().toISOString();

interface Touchpoint {
  n: number;
  title: string;
  claim: string;
  left: { seg: string; ref: string; quote: string };
  right: { seg: string; ref: string; quote: string };
  verdict: "supported" | "partial";
  verification: string;
}

const TOUCHPOINTS: Touchpoint[] = [
  {
    n: 1,
    title: "Theudas and Judas in the same (wrong) order",
    claim:
      "Gamaliel (speaking ~35 CE) cites Theudas — whose revolt happened ~45 CE, later — and then Judas the Galilean 'after him', inverting real chronology. Antiquities 20.5.1-2 narrates Theudas and then flashes back to Judas in the same order. The argument: Luke inherited both the anachronism and the inverted sequence from Josephus's page. The flagship exhibit of the dependence case (Krenkel; Mason).",
    left: {
      seg: "seg-kjv-Acts-5-36",
      ref: "Acts 5:36-37",
      quote:
        "For before these days rose up Theudas… After this man rose up Judas of Galilee in the days of the taxing…",
    },
    right: {
      seg: "seg-jos-Ant-20-5-1",
      ref: "Ant 20.5.1-2",
      quote:
        "…while Fadus was procurator of Judea… a certain magician, whose name was Theudas… [20.5.2:] the sons of Judas of Galilee were now slain; I mean of that Judas who caused the people to revolt, when Cyrenius came to take an account of the estates of the Jews.",
    },
    verdict: "supported",
    verification:
      "Both texts verified: Theudas under Fadus (Ant 20.5.1); Judas flashback follows in 20.5.2. Acts 5:36-37 has the same order and the anachronism. The narrative-order artifact is textually real in both.",
  },
  {
    n: 2,
    title: "The Egyptian false prophet and the sicarii",
    claim:
      "The tribune asks Paul: 'Art not thou that Egyptian… that leddest out into the wilderness four thousand men that were murderers (sikarion)?' Josephus is the only other author who pairs the Egyptian prophet with the sicarii — in adjacent sections of the same chapter.",
    left: {
      seg: "seg-kjv-Acts-21-38",
      ref: "Acts 21:38",
      quote:
        "Art not thou that Egyptian, which… leddest out into the wilderness four thousand men that were murderers?",
    },
    right: {
      seg: "seg-jos-War-2-13-5",
      ref: "Wars 2.13.3-5",
      quote:
        "…there sprang up another sort of robbers in Jerusalem, which were called Sicarii… [2.13.5:] But there was an Egyptian false prophet… got together thirty thousand men that were deluded… out of the wilderness…",
    },
    verdict: "supported",
    verification:
      "Verified: sicarii introduced Wars 2.13.3; the Egyptian follows in 2.13.5 with wilderness. The conjunction of the two — unique to these authors — is textually present. Numbers differ (4,000 vs 30,000).",
  },
  {
    n: 3,
    title: "The census of Quirinius",
    claim:
      "Luke dates the nativity by 'the taxing… when Cyrenius was governor of Syria'. Josephus is our source for Quirinius's census (6 CE) and its impact — and Acts 5:37 ties Judas's revolt to 'the days of the taxing' exactly as Josephus does.",
    left: {
      seg: "seg-kjv-Luke-2-2",
      ref: "Luke 2:1-2",
      quote: "(And this taxing was first made when Cyrenius was governor of Syria.)",
    },
    right: {
      seg: "seg-jos-Ant-18-1-1",
      ref: "Ant 18.1.1",
      quote:
        "Now Cyrenius, a Roman senator… came… to take an account of their substance… Judas… became zealous to draw them to a revolt.",
    },
    verdict: "supported",
    verification:
      "Verified: Ant 18.1.1 is the census + Judas passage. The dependence reading also explains Luke's dating tension (census 6 CE vs Herod d. 4 BCE) as reliance on Josephus rather than records.",
  },
  {
    n: 4,
    title: "Lysanias of Abilene",
    claim:
      "Luke synchronizes the Baptist's ministry (~29 CE) partly by 'Lysanias the tetrarch of Abilene'. The famous Lysanias died 36 BCE; Josephus twice refers to 'Abila of Lysanias' as a territory in the right period — the phrase Luke's synchronism needs.",
    left: {
      seg: "seg-kjv-Luke-3-1",
      ref: "Luke 3:1",
      quote: "…and Lysanias the tetrarch of Abilene…",
    },
    right: {
      seg: "seg-jos-Ant-19-5-1",
      ref: "Ant 19.5.1",
      quote: "But for Abila of Lysanias, and all that lay at Mount Libanus, he bestowed them upon him…",
    },
    verdict: "supported",
    verification:
      "Verified: 'Abila of Lysanias' present in Ant 19.5.1 (Claudius grants to Agrippa). Whether a second, later Lysanias existed is debated; the shared designation is the textual fact.",
  },
  {
    n: 5,
    title: "The famine under Claudius",
    claim:
      "Agabus prophesies a great famine 'throughout all the world… in the days of Claudius Caesar'. Josephus records the famine that oppressed Judea under the same emperor, relieved by queen Helena's grain purchases.",
    left: {
      seg: "seg-kjv-Acts-11-28",
      ref: "Acts 11:28",
      quote:
        "…there should be great dearth throughout all the world: which came to pass in the days of Claudius Caesar.",
    },
    right: {
      seg: "seg-jos-Ant-20-2-5",
      ref: "Ant 20.2.5",
      quote:
        "…a famine did oppress them at that time, and many people died for want… queen Helena sent some of her servants to Alexandria with money to buy a great quantity of corn…",
    },
    verdict: "supported",
    verification:
      "Verified: famine + Helena's relief in Ant 20.2.5. Luke universalizes ('all the world') what Josephus localizes to Judea — consistent with secondhand knowledge.",
  },
  {
    n: 6,
    title: "The death of Agrippa I at Caesarea",
    claim:
      "Both authors have Agrippa at Caesarea, acclaimed as a god in shining garb, accepting the acclaim, and struck with sudden fatal illness. Acts: 'the angel of the Lord smote him… eaten of worms.' Josephus: an owl as death's messenger, five days of belly pain.",
    left: {
      seg: "seg-kjv-Acts-12-21",
      ref: "Acts 12:21-23",
      quote:
        "…the people gave a shout, saying, It is the voice of a god… he was eaten of worms, and gave up the ghost.",
    },
    right: {
      seg: "seg-jos-Ant-19-8-2",
      ref: "Ant 19.8.2",
      quote:
        "…his flatterers cried out… that he was a god… A severe pain also arose in his belly, and began in a most violent manner… he departed this life.",
    },
    verdict: "supported",
    verification:
      "Verified: Ant 19.8.2 is the Caesarea death scene — silver garment, divine acclaim accepted, sudden agony. Shared scene structure with divergent omen details (owl vs angel/worms).",
  },
  {
    n: 7,
    title: "John the Baptist executed by Herod",
    claim:
      "Both record John the Baptist as a preacher of righteousness executed by Herod Antipas — the only two independent accounts. Motives differ: Luke has the Herodias rebuke; Josephus has fear of insurrection.",
    left: {
      seg: "seg-kjv-Luke-3-19",
      ref: "Luke 3:19-20",
      quote: "But Herod the tetrarch… shut up John in prison.",
    },
    right: {
      seg: "seg-jos-Ant-18-5-2",
      ref: "Ant 18.5.2",
      quote:
        "Now some of the Jews thought that the destruction of Herod's army came from God… as a punishment of what he did against John, that was called the Baptist.",
    },
    verdict: "supported",
    verification:
      "Verified: Ant 18.5.2 is the Baptist passage (imprisonment at Machaerus and execution follow in the section). Overlap of figure and executioner; independent details.",
  },
  {
    n: 8,
    title: "The nobleman who went to receive a kingdom (Archelaus)",
    claim:
      "Luke's parable of the pounds uniquely adds: a nobleman travels to a far country to receive a kingdom, 'but his citizens hated him, and sent a message after him, saying, We will not have this man to reign over us' — then returns and slays them. Archelaus's story exactly: he sailed to Rome for the kingship while a Jewish embassy of fifty followed to oppose him.",
    left: {
      seg: "seg-kjv-Luke-19-14",
      ref: "Luke 19:12-27",
      quote:
        "But his citizens hated him, and sent a message after him, saying, We will not have this man to reign over us.",
    },
    right: {
      seg: "seg-jos-Ant-17-11-1",
      ref: "Ant 17.11.1",
      quote:
        "…the number of the ambassadors that were sent by the authority of the nation were fifty… to petition [against Archelaus's kingship]…",
    },
    verdict: "supported",
    verification:
      "Verified: the fifty-man embassy opposing Archelaus's kingship is in Ant 17.11.1. Luke's parable frame (unparalleled in Matthew's version) matches the Archelaus episode point for point.",
  },
  {
    n: 9,
    title: "Galileans whose blood Pilate mingled with their sacrifices",
    claim:
      "Luke 13:1 alludes to a Pilate atrocity against Galileans at sacrifice. No direct source exists in Josephus, but his portrait of Pilate's violent provocations (the standards, the aqueduct riot, the Samaritan massacre) is argued to be Luke's raw material.",
    left: {
      seg: "seg-kjv-Luke-13-1",
      ref: "Luke 13:1",
      quote: "…the Galilaeans, whose blood Pilate had mingled with their sacrifices.",
    },
    right: {
      seg: "seg-jos-Ant-18-3-2",
      ref: "Ant 18.3.1-2",
      quote:
        "…[Pilate] spent that sacred money… the Jews were displeased… he gave the soldiers the signal… who laid upon them much greater blows than Pilate had commanded them.",
    },
    verdict: "partial",
    verification:
      "Verified that Ant 18.3.1-2 records Pilate's aqueduct violence; no Josephus passage matches Luke 13:1's specific incident. A thematic-source argument only — the weakest touchpoint, included for completeness.",
  },
  {
    n: 10,
    title: "Jerusalem compassed with armies and a bank",
    claim:
      "Luke alone rewrites Mark's 'abomination of desolation' as 'Jerusalem compassed with armies' and adds 'thine enemies shall cast a trench (bank) about thee' — matching how the siege actually proceeded (Titus's circumvallation). The dependence reading: Luke wrote with knowledge of the event, plausibly via Josephus's account.",
    left: {
      seg: "seg-kjv-Luke-19-43",
      ref: "Luke 19:43-44; 21:20",
      quote:
        "…thine enemies shall cast a trench about thee, and compass thee round, and keep thee in on every side…",
    },
    right: {
      seg: "seg-jos-War-5-12-1",
      ref: "Wars 5.12.1-2",
      quote:
        "…they must build a wall round about the whole city… the only way to prevent the Jews from coming out any way…",
    },
    verdict: "supported",
    verification:
      "Verified (also in the Atwill layer as #29): the circumvallation is Wars 5.12.1-2. Under this layer's reading it evidences post-70 composition with siege knowledge, not shared authorship.",
  },
];

function run() {
  const segExists = db.prepare("SELECT id FROM segments WHERE id = ? AND kind = 'verse'");
  const insert = db.prepare(
    `INSERT INTO parallels
       (id, source, title, claim,
        left_document_id, left_segment_id, left_ref, left_quote,
        right_document_id, right_segment_id, right_ref, right_quote,
        verification, verdict, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM parallels WHERE source = ?").run(SOURCE);
    let inserted = 0;
    for (const t of TOUCHPOINTS) {
      const leftOk = segExists.get(t.left.seg);
      const rightOk = segExists.get(t.right.seg);
      if (!leftOk || !rightOk) {
        console.warn(`[mason] #${t.n} skipped — missing segment ${!leftOk ? t.left.seg : t.right.seg}`);
        continue;
      }
      const docOf = (seg: string) => seg.replace(/^seg-/, "").split("-").slice(0, -2).join("-");
      insert.run(
        `par-mason-${t.n}`,
        SOURCE,
        t.title,
        t.claim,
        docOf(t.left.seg),
        t.left.seg,
        t.left.ref,
        t.left.quote,
        docOf(t.right.seg),
        t.right.seg,
        t.right.ref,
        t.right.quote,
        t.verification,
        t.verdict,
        t.n,
        NOW,
        NOW,
      );
      inserted++;
    }
    db.exec("COMMIT");
    console.log(`[mason] imported ${inserted} dependence touchpoints`);
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

run();
