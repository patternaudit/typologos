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

---

# Second arm (pre-registered before its mining pass): blinded Luke ↔ Wars

**Registered 2026-07-12, after the Anabasis arm's results, before any
arm-2 mining.**

## Motivation

Two observations after arm 1:

1. **Geography.** The Flavian Signature claims its parallels co-locate —
   Luke's episodes and the campaign's events track the same places
   (Galilee, the lake, the road up, Jerusalem). The Anabasis control could
   not reproduce that dimension: Xenophon's route runs through Mesopotamia
   and Armenia. But Luke and the *War* are set in the same small country in
   the same generation, so some co-location comes free with the setting.
   The second arm measures how much.
2. **Yield on the actual pair.** Arm 1 measured the method's yield against
   an unrelated text. Running the identical rules against Josephus's *Wars*
   measures the size of the space Atwill was selecting his 34 from — and,
   separately, how many of his 34 a blinded pass rediscovers.

## Protocol deltas from arm 1 (everything else identical)

- **Corpus.** Luke (KJV) against *Wars of the Jews* books 1–7 (Whiston) —
  seven books, like the Anabasis; one miner per book, one pass.
- **Blinding.** Arm 1's prompts used Atwill's own claims as calibration
  examples; that would contaminate arm 2. Calibration examples are replaced
  with arm-1 (Anabasis) specimens. Miners are instructed not to reproduce
  remembered claims from any published parallel literature (Atwill, Mason,
  etc.); any candidate the miner suspects matches published work is still
  reported if the texts support it, but flagged `possiblyKnown` and tracked
  separately. LLM training exposure cannot be fully removed — the same
  limitation stated for arm 1, now sharper; the `possiblyKnown` flag and
  the rediscovery analysis make it measurable rather than invisible.
- **Geography.** Miners tag the named location of each side's passage
  (`lukePlace`, `otherPlace`) when the text names one. Post-hoc scoring:
  fraction of kept parallels whose two sides name the same or adjacent
  places. The same tagging is applied retroactively to arm 1 for
  comparison.
- **Analyses, fixed in advance:** (a) tally at the identical grading
  standard; (b) longest order-preserving sequence; (c) geographic
  co-location rate, arm 2 vs arm 1; (d) rediscovery: how many of Atwill's
  34 steps appear (same or overlapping passage pairs) in the blinded yield;
  (e) overlap flagged `possiblyKnown` vs not.
- **Grading.** Same grader (the maintainer's assistant), same standard,
  aware of Atwill's 34 — stated as a limitation; the mechanical quote check
  is bias-free.
- **Amendment (2026-08-15, before books 1–6 were mined).** The first
  arm-2 mining attempt (2026-07-12) completed only book 7 before hitting
  usage limits; the book-7 miner ran on the same model as all arm-1 miners
  (Claude Fable). Books 1–6 are re-run on Claude Sonnet to conserve quota.
  Model per book is recorded with the data; if Sonnet books yield
  systematically differently from the Fable book, that is reported rather
  than smoothed over.

## Arm-2 results

**Run completed 2026-08-15.** Seven blinded miners (book 7 on Fable
2026-07-12; books 1–6 on Sonnet per the amendment), one pass each; then the
mechanical quote check and a grading pass at the identical standard.

### Yield

| | Atwill (curated, years) | Arm 2 (one blinded pass) |
|---|---|---|
| Claims | 34 | 160 mined, **133 verified** |
| Supported | 21 | **79** |
| Partial | 13 | **54** |
| Unsupported | 0 | 0 |
| Quote fidelity | 33/34 verbatim | 153/160 verbatim (7 dropped: trivial abridgements/case changes, no invented content) |

Per model: Fable (book 7): 29/29 verbatim, 22 supported / 7 partial.
Sonnet (books 1–6): 124/131 verbatim, 57 supported / 47 partial — lower
per-book yield and support rate than the Fable book, as the amendment
anticipated might occur; reported, not smoothed.

The blinded pass over the same two texts out-yields the Flavian Signature
roughly 4× in claims and nearly 4× in supported parallels. Specimens the
blind pass surfaced that Atwill's 34 do not use: Mary of Bethezob's "Come,
eat of this food; for I have eaten of it myself" beside "This is my body
which is given for you"; the Masada dawn scene (women emerging from under
the ground to report the dead to men who "believed them not" until they
went in); Jesus ben Ananias's silence before the procurator; Emmaus at
exactly threescore furlongs (three independent rediscoveries); a man in
white appearing out of the ground where the temple stood.

### Pre-registered analyses

- **(b) Sequence.** Longest order-preserving subsequence of the 133 blinded
  rows: **20** (arm 1 against Xenophon: 21 of 184). Same-order "sequences"
  of this length arise from any such yield; the Signature's ordering is not
  distinctive.
- **(c) Geography.** Of rows with place tags on both sides, **42%
  co-locate** (overwhelmingly Jerusalem↔Jerusalem, plus shared toponyms:
  Emmaus, Nain, Mount of Olives, Jericho, the wilderness). Arm 1's
  co-location is ~0% by construction (Xenophon's route never enters
  Palestine). Conclusion: the Signature's geographic tracking is what
  shared setting produces automatically — two narratives set in the same
  small country co-locate at high rates with no dependence required.
- **(d) Rediscovery.** Blinded miners independently rediscovered **14 of
  Atwill's 34** steps (same Luke chapter, same Wars book ±1 chapter). His
  parallels are partially salient, but 119 of the 133 blinded rows are
  pairs his sequence does not use — his 34 sample a far larger space.
- **(e) possiblyKnown.** 59/133 flagged — the blinding is honest about its
  leakage, and the rediscovery figure above is robust to it (most
  rediscoveries were flagged).
- **APTVS mask test (registered in `menasgotz-aptvs-review.md` §6).** The
  APTVS letterforms were approximated as stroke corridors calibrated to
  cover 25.2% of the chart (Menasgotz's own stated coverage). The 133
  blinded dots land on the mask **30 times = 22.6%**, against ~25% expected
  by chance (z = −0.65). **Blinded parallels show no attraction whatever to
  the APTVS pattern.** The pattern is an artifact of unblinded selection
  and per-dot placement freedom, not a property of the texts.

### Reading

Arm 1 showed the method yields Signature-grade parallels against an
unrelated text. Arm 2 shows that on the *actual* text pair, one blinded
pass yields 4× the Signature — with the same-order property, the
geographic co-location, and none of the APTVS pattern coming along for
free. Together the arms measure precisely what parallelomania intuitions
miss: the base rate is enormous, order is cheap, geography is setting, and
the pattern lives in the analyst, not the author.
