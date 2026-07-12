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

*(To be added after the mining and verification passes. Nothing above this
line may change.)*
