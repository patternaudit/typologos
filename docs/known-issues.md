# Known issues & needed refinements

Dataset and verification issues found during the 2026-07-10 overnight build,
in the spirit of the #34 flag: things a reader of the findings should know,
and the concrete fix for each. App-code issues are tracked in commit messages
and the night log; this doc is about the *data*.

## Atwill layer (`parallels`, source `atwill-cm`)

### #34 — wrong endpoints for "Simon condemned and John spared"
**Issue.** The row anchors Luke 4:23 ↔ Wars 3.7.31 because chapter 5's coda
interleaves two arguments, and the parser grabbed the first citations in the
section: Atwill's closing decode of the Nazareth brow-of-the-hill episode
(Luke 4:29–30 ↔ the Japha/Jotapata fighting, Wars 3.7). The actual
Simon/John claim rests on **Wars 7.5.6** — at the Flavian triumph Simon bar
Giora is executed and John of Gischala imprisoned for life.
**Impact.** The deep link opens a real Atwill argument, but not the titular
one; verdict held at *partial* until fixed.
**Fix.** Split into two rows (34a Nazareth-brow decode; 34b Simon/John at
the triumph, right side Wars 7.5.6) or repoint 34 and drop the decode.
Requires touching `atwill-parallels.json` hand-patch section, not the parser.

### #3 — verification miss, corrected (method lesson)
**Issue.** Initially graded *partial* with the note "the 'right hand' half I
could not locate in the cited section." The maintainer located it in **Wars 4.2.2**,
one section before the cited Sabbath section: Titus's speech offers the
security of the Romans' "right hands" three times. Upgraded to *supported*.
**Lesson.** Verification read sections in isolation; several of Atwill's
claims span a section boundary (his citations mark where a *quote* sits, not
where the argument's elements sit). Any future re-verification pass should
read ±1 section around each citation. Candidates worth re-reading with that
wider window: **#25** (narrow gate/shut door — graded partial specifically
because the correspondence wasn't visible in the one section read) and
**#30** (temple cleansing — the robbers-driven-from-the-temple material may
sit in Wars 6 rather than the cited 5.7.2).

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
