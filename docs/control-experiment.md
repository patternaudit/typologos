# Control experiment: Luke ↔ Xenophon's Anabasis

**Status: rules pre-registered; mining not yet begun.** This document was
written and committed *before* any mining pass over the control text. The
mining results will be added in a follow-up section and must not alter
anything above the "Results" heading.

## The question

The Flavian Signature layer records 34 claimed parallels between the New
Testament (mostly Luke) and Josephus's *Wars*, of which textual verification
graded 21 *supported* and 13 *partial* (see
`atwill-flavian-signature-findings.md`). Those verdicts grade **textual
claims** — whether the corresponding elements are really in both texts —
not the inference Atwill draws from them (deliberate dependence).

The missing quantity is the **base rate**: how many parallels of the same
grade could a motivated reader mine between Luke and a text *nobody claims
Luke read*? If the answer is "roughly as many," the Signature's evidential
weight drops accordingly; if "far fewer," it rises. Either result is worth
publishing.

## The control text

**Xenophon's *Anabasis*** (H. G. Dakyns translation, Project Gutenberg
#1170), chosen because it is genre-matched to *Wars of the Jews*: a
first-person Greek military campaign narrative — marches, sieges, battles,
speeches, embassies, omens — long enough (7 books) to give a motivated
reader room to work. No scholarly tradition claims any dependence between
Luke and the Anabasis in either direction.

*Runner-up considered*: Caesar's *Gallic War* (rejected: third-person
commentarii, Latin tradition, less genre-similar to Josephus's
Greek-historiographical narrative).

## Pre-registered mining rules

The miner plays the same game the Flavian Signature plays, under the same
constraints, with the same verification standard applied afterward.

1. **Corpora.** Luke (KJV) against Anabasis books 1–7 (Dakyns). Other
   Gospels may supply secondary wording only where Atwill's sequence does
   the same (his #11 and #31 borrow Matthew), and any such borrowing must
   be flagged.
2. **What counts as a candidate.** A Luke passage and an Anabasis passage
   sharing concrete narrative elements: actions, objects, settings,
   numbers, roles, place/name meanings, or distinctive phrases. Typological
   inversions ("X prefigures Y", "X parodies Y") are allowed — Atwill's
   method uses them freely. Name decodes and wordplay are allowed but must
   be labeled as such.
3. **Sequence.** The Flavian Signature's headline property is order: Luke's
   narrative order tracking Wars' narrative order. The control must earn
   the same property honestly — the reported sequence is the longest
   order-preserving subset of the mined candidates (Luke order vs.
   Anabasis order, weakly increasing). Candidates that fall outside the
   sequence are still reported, separately.
4. **Grading — identical standard to the Atwill layer.**
   - *supported*: the corresponding concrete elements are literally present
     in both texts at the cited locations;
   - *partial*: quotes are faithful but the correspondence requires
     interpretive framing;
   - *unsupported*: cited elements not present as claimed.
   Verification reads ±1 section around each citation (the lesson from
   Atwill #3/#25/#30). Quotes must be verbatim from the Dakyns / KJV texts.
5. **Honest yield, fixed effort.** The target is *every candidate that
   clears the bar*, not a predetermined count. One systematic mining pass
   over the Anabasis with Luke in hand (divided among parallel readers, one
   per Anabasis book, to mirror a motivated reader's sustained attention),
   followed by one verification pass. Every candidate examined is recorded
   — kept or rejected with a reason. No discarding results after seeing
   the tally.
6. **Reporting.** Results are published as a fourth connection layer
   (`control-anabasis`) with per-row verdicts, a findings doc, and a
   side-by-side comparison with the Atwill tally (34 claimed; 21/13/0),
   including the sequence lengths. Publication happens after maintainer
   review, **whatever the result shows** — the review gate is for accuracy,
   not for direction of the result.

## Known limitations (stated up front)

- The miner (an LLM) has read the Anabasis in training; "before reading the
  text" can only mean "before this mining pass." The same is true of any
  human classicist who might run the control.
- Effort is not perfectly commensurable with Atwill's years of work. The
  control measures what *one honest systematic pass* yields; Atwill's 34
  are the curated best of a much longer search, which biases the comparison
  *against* the control. If the control still yields a comparable tally,
  that asymmetry strengthens the conclusion; if it yields fewer, the
  asymmetry must temper it.
- KJV English vs. Dakyns English: verbal echoes are translation artifacts
  in both directions. The Atwill layer has the same property (Whiston's
  English vs. KJV English), so the comparison is fair, but neither measures
  Greek-level dependence.

## Results

**Run 2026-07-12** (rules committed `e8dec4f`, 2026-07-12 00:35 CDT, before
any mining). One systematic pass: seven parallel miners, one per Anabasis
book, each reading all of Luke against its book; then mechanical quote
verification; then a grading pass applying the Atwill-layer standard.

### Headline numbers

| | Atwill (Flavian Signature) | Control (Luke ↔ Anabasis) |
|---|---|---|
| Claims | 34 (curated over years) | **184** (one pre-registered pass) |
| Supported | 21 | **123** |
| Partial | 13 | **61** |
| Unsupported | 0 | 0 |
| Quote fidelity | 33/34 verbatim, 1 paraphrase | **184/184 verbatim** (mechanically checked) |
| Order-preserving sequence | 34 claimed | **21** (18 among supported-only) — found *incidentally*, with no effort spent optimizing for order |

Every candidate the miners kept survived grading at the same bar used on
the Atwill layer: *supported* = the claimed concrete elements are literally
present in both cited passages; *partial* = quotes faithful, correspondence
carried by interpretive/typological framing. 0 unsupported mirrors the
Atwill result for the same reason: motivated miners self-filter fabrications
out before publishing.

### What one book yields

Candidates per Anabasis book: 26, 26, 25, 26, 28, 25, 28. **Any single book
of Xenophon out-yields the entire Flavian Signature** in supported parallels
at the same standard.

### Specimen results (all quotes verbatim)

- **The betrayal supper** — Tissaphernes "with kindliest expression"
  entertains Clearchus at dinner and then has him seized at a signal;
  "the hand of him that betrayeth me is with me on the table" (Luke 22:21
  ↔ Anab 2.5.24). *Supported.*
- **Reckoned among the transgressors** — Clearchus, whom the narrator holds
  innocent, is officially declared a perjurer and truce-breaker and executed
  (Luke 22:37 ↔ Anab 2.5.32). *Supported.*
- **The third day** — the Hellenes wait "troubled with anxieties" until "on
  the third day he arrived with the news… he was permitted to save the
  Hellenes" (Luke 24:21 ↔ Anab 2.3.23). *Supported.*
- **Crucified royal claimant** — the Persian king nails the severed head and
  hand of his brother, the pretender to the throne, to a cross (Luke 23:38
  ↔ Anab 3.1.13). *Supported.*
- **Darkness at the fall** — "a cloud hid the face of the sun and blotted
  out the light thereof, until…" the city was taken (Luke 23:44 ↔ Anab
  3.4.3). *Supported.*
- **The honeycomb** — honey-poisoned soldiers lie "apparently at death's
  door" and "on the third or fourth day got on their legs again"; the
  third-day risen one eats "a piece of a broiled fish, and of an honeycomb"
  (Luke 24:42 ↔ Anab 4.8.16). *Supported.*
- **Exactly threescore furlongs** — a night journey of "sixty furlongs"
  ending in dawning recognition (Luke 24:13 ↔ Anab 7.2.15). *Supported.*
- **Ten servants / ten generals** — ten commanders each assigned a
  settlement, then the reckoning, "some with somewhat to show for their
  pains, others empty-handed" (Luke 19:13 ↔ Anab 6.3.1). *Supported.*

### Reading

The Flavian Signature's evidential engine is the claim that its parallels
are too many, too specific, and too well-ordered to be chance. The control
measures that intuition against a base rate: at the same evidential bar,
Luke against a genre-matched text *nobody* claims Luke read yields **5×
the claims and 6× the supported parallels of the Signature in a single
pass**, including a 21-step order-preserving sequence that nobody was
looking for. Whatever the Signature's 34 steps demonstrate, they do not
demonstrate more than what the method itself produces from noise —
shared genre furniture (armies, betrayals, meals, sieges, executions,
omens), translation-era English, and a motivated reader.

The same caution cuts both ways and is stated in the layer's UI: the
control measures the *method*, not any real dependence of Luke on Xenophon
— and by construction it cannot prove Luke *didn't* use Josephus; it shows
only that this kind of evidence cannot establish that he did.

### Data

The full graded layer is `apps/server/src/corpus/control-anabasis.json`
(`npm run control:import`), rendered in-app as the **Control (Anabasis)**
layer — teal — in the Overview, Index, and Reading views. The public build
excludes it until review (`db:publish --include-control` to ship).
