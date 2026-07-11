# Known issues & needed refinements

Dataset and verification issues found during the 2026-07-10 overnight build,
in the spirit of the #34 flag: things a reader of the findings should know,
and the concrete fix for each. App-code issues are tracked in commit messages
and the night log; this doc is about the *data*.

## Atwill layer (`parallels`, source `atwill-cm`)

### #34 — wrong endpoints for "Simon condemned and John spared" (RESOLVED)
**Issue.** The row anchored Luke 4:23 ↔ Wars 3.7.31 because chapter 5's coda
interleaves two arguments and the parser grabbed the first citations (the
Nazareth brow-of-the-hill decode) rather than the titular claim.
**Resolution.** Repointed to John 21:18–22 ↔ Wars 7.5.6 (Simon bar Gioras
executed at the triumph; John of Gischala's perpetual imprisonment is Wars
6.9.4, noted in the verification). Verdict re-graded *supported*: a Simon
condemned and a John spared are literally present in both texts. Surfaced by
a reader hitting the mismatch in the app — exactly what the index is for.
The Nazareth decode remains discussed in the findings doc but is no longer a
row endpoint.

### #3 — verification miss, corrected (method lesson)
**Issue.** Initially graded *partial* with the note "the 'right hand' half I
could not locate in the cited section." The maintainer located it in **Wars 4.2.2**,
one section before the cited Sabbath section: Titus's speech offers the
security of the Romans' "right hands" three times. Upgraded to *supported*.
**Lesson.** Verification read sections in isolation; several of Atwill's
claims span a section boundary (his citations mark where a *quote* sits, not
where the argument's elements sit). Re-verification should read ±1 section
around each citation.
**Outcome of applying the lesson.** Both flagged candidates upgraded on
re-read: **#25** (the gate stratagem is in Wars 5.3.3, two sections before
the citation — men outside the shut gates petitioning to be let in) and
**#30** (robbers "thrust out of the inner court of the temple," Wars 6.5.1,
upgraded with a sequence-displacement caveat). The remaining 14 partials
were graded on correspondence *strength*, not missing elements, so a full
±1 re-read is lower priority — but #14 (don't look back) and #22 (stripes)
would be the next candidates if anyone wants to hunt.

### #11 and #31 — sequence borrows from Matthew
**Issue.** Two steps need Matthew to complete the "contiguous block of Luke"
frame: #11's binding/loosing saying is Matt 16:19 (absent from Luke's
parallel passage), and #31's "abomination of desolation" wording is Matt
24:15 (Luke 21 has only "the desolation thereof is nigh"). Atwill
acknowledges this in #31's case and argues it's deliberate distribution
across Gospels — but as *data*, the left endpoints for these rows are Luke
positions carrying Matthean content.
**Impact.** Interpretive honesty, already noted in the findings doc; no data
change needed unless we add Matthew-side endpoints as alternates.

### #26 — paraphrased citation
**Issue.** Atwill's quote "Titus went round the wall looking for the best
place to build a tower" is a paraphrase; Whiston 5.6.2 reads "went round the
city… looked about for a proper place where he might make an impression upon
the walls." The only non-verbatim quote found among the 34.
**Impact.** Quote-matching still resolved the correct section (score 0.89);
the findings entry says "paraphrase" explicitly.

### #15 — first Josephus citation lacked a captured quote
**Issue.** The extraction captured no quote block for #15's first Wars
citation (2.19.554 — the earlier ambush of Cestius, which Atwill uses as
background); resolution used the second citation (5.2.1). Fine in practice,
but the JSON row's first citation is quote-less.
**Fix.** Optional: re-extract with a wider quote window, or ignore — the
resolved endpoint is the sequence-relevant one.

### NT ranges anchor their first verse
**Issue.** Atwill cites ranges (e.g. Luke 5:18–26); `parallels` stores
`left_segment_id` for the first verse only, so arcs and scroll targets land
on the range's head. Correct but lossy.
**Fix.** Add `left_end_verse` handling end-to-end (schema has `endVerse` in
extraction JSON already), and render range highlights in the pane.

### Atwill's Wars chapter numbers follow a non-Whiston edition
**Issue (resolved).** Citations like "Wars 4, 8, 425" use another edition's
chaptering; Whiston puts Niese ¶425 in ch. 7. Resolution now quote-matches
within the cited chapter, then falls back book-wide (0 low-confidence
matches). Recorded per-row in `parallels.verification`.

## Wilson layer (`motifs`, source `wilson-dbt`)

- **One known junk instance**: Kiss / Proverbs 27:6 carries rationale "Kiss
  of affection Song of" — leakage from an inline sub-list in the KISS entry.
  Judged not worth a third parsing mode; delete by hand if it bothers.
- **4 refs skipped** (book token unrecoverable after OCR), **2 refs
  unresolved** (verse absent from KJV corpus — versification edge cases).
  Counts printed by `npm run motifs:import`.
- Wilson (1957, Moody Press) is likely still under copyright — fine for
  personal research; resolve before any publishing of the imported data.

## Josephus corpus (`jos-*`)

- The Gutenberg *Wars* text has defects the importer works around: a missing
  `CHAPTER 5.` heading in Book IV (recovered via validated restart-at-1),
  occasional malformed section numbers (recovered by accepting a gap of one),
  and endnote blocks that mimic section numbering (filtered by
  sequence + "sect./B." heuristics). Section counts: Wars 687, Life 76.
  A spot-audit of chapter/section boundaries against a printed Whiston has
  not been done.
- *Life* is modeled as one chapter with sections as verses (`jos-Life`,
  ref "Life 75"), which reads fine but means its navigator chapter picker is
  hidden (single chapter).

## Verification scope (applies to all verdicts)

Verdicts grade **textual claims** (existence, quote fidelity, presence of
corresponding elements) — not the Flavian-authorship thesis, and not
probability. No control analysis has been done (e.g., how many "parallels" a
motivated reader could mine between Luke and an unrelated campaign history);
that would be a genuinely interesting future experiment to run *inside*
Typologos.
