// About / methodology: what this is, what the layers are, what the verdicts
// mean, and who to contact.

export function AboutPage() {
  return (
    <div className="index-page about-page">
      <div className="index-inner about-inner">
        <h1>About Typologos</h1>
        <p className="about-lede">
          Typologos is a reading instrument for <em>claimed connections between texts</em>:
          biblical typology, alleged literary parallels, and your own annotations — always one
          click from the primary sources, side by side.
        </p>

        <h2>The corpora</h2>
        <p>
          The <strong>King James Bible</strong> (from the{" "}
          <a href="https://github.com/seven1m/open-bibles">open-bibles</a> OSIS edition) and{" "}
          <strong>Flavius Josephus</strong> in William Whiston's translation — <em>The Wars of
          the Jews</em>, <em>Antiquities of the Jews</em>, and the <em>Life</em> (Project
          Gutenberg). Every verse and section is an addressable unit; deep links restore any
          juxtaposition.
        </p>

        <h2>The connection layers</h2>
        <p>
          <strong style={{ color: "#b8742a" }}>Wilson's dictionary</strong> — Walter L. Wilson's{" "}
          <em>A Dictionary of Bible Types</em> (1957): ~1,100 symbol headwords with ~4,100
          verse-anchored readings, each carrying Wilson's own confidence grade — (a) named a
          type by Scripture itself, (b) evident from usage, (c) suggested. Amber in the maps.
          Wilson's commentary is presumed to remain under copyright; it is published here for
          research and criticism with a takedown-on-complaint policy (see contact below).
        </p>
        <p>
          <strong style={{ color: "#4a6b8a" }}>Caesar's Messiah</strong> — the 34-step "Flavian
          Signature" sequence from Joseph Atwill's book, which claims the Gospels
          typologically mirror Josephus's war narrative. Slate in the maps. Every step has
          been checked against the actual texts (see verdicts below).
        </p>
        <p>
          <strong style={{ color: "#7d5a86" }}>Did Luke read Josephus?</strong> — the
          mainstream source-critical hypothesis (Krenkel 1894; Mason 1992; Pervo 2006) that
          the author of Luke–Acts used Josephus, especially the <em>Antiquities</em>. Plum in
          the maps. The same shared material, a rival explanation — the point of this site is
          letting you weigh them with the sources open.
        </p>
        <p>
          <strong style={{ color: "#3a8a5f" }}>Your links</strong> — anchors and links you
          create live in your own browser (nothing is uploaded), and can be exported as a
          portable file for others to import.
        </p>

        <h2>What the verdicts mean</h2>
        <p>
          Each claimed parallel carries a verdict from manual verification against the cited
          texts: <span className="verdict-chip verdict-supported">supported</span> means the
          corresponding elements are literally present in both passages;{" "}
          <span className="verdict-chip verdict-partial">partial</span> means the quotes are
          faithful but the correspondence depends on the author's interpretation;{" "}
          <span className="verdict-chip verdict-unsupported">unsupported</span> would mean a
          cited passage does not contain the claimed content (none so far). Verdicts judge{" "}
          <em>textual claims only</em> — never the authorship theses built on them. Current
          tally for the Atwill sequence: 21 supported, 13 partial, 0 unsupported.
        </p>
        <p>
          The verification has a public correction history: two errors in the original pass
          (a missed "right hands" speech one section outside a citation, and one claim
          anchored to the wrong half of an interleaved argument) were caught by a reader using
          this site and are documented in the{" "}
          <a href="https://github.com/patternaudit/typologos/blob/main/docs/atwill-flavian-signature-findings.md">
            findings document
          </a>{" "}
          and{" "}
          <a href="https://github.com/patternaudit/typologos/blob/main/docs/known-issues.md">
            known issues
          </a>
          . If you catch another, please say so.
        </p>

        <h2>How it runs</h2>
        <p>
          There is no server. The corpus ships as a static SQLite file queried inside your
          browser (WebAssembly, fetching only the pages each query touches), and your
          annotations live in your browser's local storage. The entire project is open source
          at{" "}
          <a href="https://github.com/patternaudit/typologos">github.com/patternaudit/typologos</a>.
        </p>

        <h2>Contact</h2>
        <p>
          Maintained pseudonymously as <strong>Pattern Auditor</strong>. Corrections,
          questions, and rights concerns:{" "}
          <a href="https://github.com/patternaudit/typologos/issues">open a GitHub issue</a>.
          Rights holders: content will be removed on request.
        </p>
      </div>
    </div>
  );
}
