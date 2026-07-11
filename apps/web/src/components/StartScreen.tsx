// Landing view: curated starting points into the corpora and layers, each a
// one-click deep link. Shown on first visit (or via the Start button).

interface Entry {
  title: string;
  blurb: string;
  href: string;
  tag: string;
  color: string;
}

interface Group {
  heading: string;
  entries: Entry[];
}

const GROUPS: Group[] = [
  {
    heading: "The maps",
    entries: [
      {
        title: "Old Testament ↔ New Testament",
        blurb:
          "Every chapter pair sharing typological symbols, drawn as one picture. Genesis pours into Matthew and Revelation; Daniel and Ezekiel cable into the Apocalypse.",
        href: "/?overview=1&a=ot&b=nt",
        tag: "overview",
        color: "#b8742a",
      },
      {
        title: "New Testament ↔ Josephus",
        blurb:
          "Two rival hypotheses as two shapes: Atwill's ordered cable from Luke into the war narrative, and the source-critical touchpoints from Acts into Antiquities.",
        href: "/?overview=1&a=nt&b=josephus",
        tag: "overview",
        color: "#4a6b8a",
      },
      {
        title: "Old Testament ↔ itself",
        blurb: "The Bible's internal echo chamber — shared symbols across the Hebrew canon.",
        href: "/?overview=1&a=ot&b=ot",
        tag: "overview",
        color: "#b8742a",
      },
    ],
  },
  {
    heading: "Typology (Wilson's dictionary)",
    entries: [
      {
        title: "Fig leaves ↔ leaves of healing",
        blurb:
          "Genesis 3:7 — leaves sewn to cover shame. Revelation 22:2 — leaves of the tree of life healing the nations. The canon's first and last leaves.",
        href: "/?left=kjv-Gen:3:7&right=kjv-Rev:22:2",
        tag: "motif arc",
        color: "#b8742a",
      },
      {
        title: "The burning bush ↔ the sea of glass and fire",
        blurb:
          "Fire that does not consume (Exodus 3:2) beside the fiery sea the victors stand on (Revelation 15:2).",
        href: "/?left=kjv-Exod:3:2&right=kjv-Rev:15:1",
        tag: "motif arc",
        color: "#b8742a",
      },
      {
        title: "The binding of Isaac ↔ God gives his Son",
        blurb:
          "The classic type and antitype: a father offers his only son on the mountain (Genesis 22; John 3:16).",
        href: "/?left=kjv-Gen:22:1&right=kjv-John:3:14",
        tag: "motif arc",
        color: "#b8742a",
      },
    ],
  },
  {
    heading: "Caesar's Messiah (Atwill) — checked against the texts",
    entries: [
      {
        title: "Fishing for men at the Sea of Galilee",
        blurb:
          "“From henceforth thou shalt catch men” beside Josephus's naval slaughter on the same lake — the drowning “caught by the vessels.” Verdict: supported.",
        href: "/?left=kjv-Luke:5:8&right=jos-War-3:10:9&parallel=par-atwill-1",
        tag: "Atwill #1",
        color: "#4a6b8a",
      },
      {
        title: "The son of Mary, a human Passover lamb",
        blurb:
          "Josephus's most infamous page: Mary of the House of Hyssop eats her son during the Passover-season famine. Verdict: supported (as text).",
        href: "/?left=kjv-Mark:14:22&right=jos-War-6:3:4&parallel=par-atwill-32",
        tag: "Atwill #32",
        color: "#4a6b8a",
      },
      {
        title: "Three crucified; one survives",
        blurb:
          "Josephus bar Matthias has three crucified friends taken down; one lives. Joseph of Arimathea takes one of three down; he lives. Verdict: supported (as text).",
        href: "/?left=kjv-Luke:23:50&right=jos-Life:1:75&parallel=par-atwill-33",
        tag: "Atwill #33",
        color: "#4a6b8a",
      },
    ],
  },
  {
    heading: "Did Luke read Josephus? (the mainstream hypothesis)",
    entries: [
      {
        title: "The Theudas problem",
        blurb:
          "Gamaliel cites Theudas, then Judas — chronologically impossible, but exactly the order of Josephus's page (Ant. 20.5). The dependence case's flagship exhibit.",
        href: "/?left=kjv-Acts:5:36&right=jos-Ant-20:5:1&parallel=par-mason-1",
        tag: "Mason #1",
        color: "#7d5a86",
      },
      {
        title: "The nobleman who went to receive a kingdom",
        blurb:
          "Luke's parable of the pounds adds a frame found nowhere else — and it is Archelaus's story, embassy of opponents and all (Ant. 17.11).",
        href: "/?left=kjv-Luke:19:12&right=jos-Ant-17:11:1&parallel=par-mason-8",
        tag: "Mason #8",
        color: "#7d5a86",
      },
      {
        title: "The Egyptian and the assassins",
        blurb:
          "The tribune mistakes Paul for “that Egyptian” who led sicarii into the wilderness — a pairing found only in Acts and Josephus (Wars 2.13).",
        href: "/?left=kjv-Acts:21:38&right=jos-War-2:13:5&parallel=par-mason-2",
        tag: "Mason #2",
        color: "#7d5a86",
      },
    ],
  },
];

interface StartScreenProps {
  onClose: () => void;
}

export function StartScreen({ onClose }: StartScreenProps) {
  return (
    <div className="start-screen">
      <div className="start-inner">
        <div className="start-head">
          <h1>Where would you like to begin?</h1>
          <p>
            Three corpora (the KJV, Wilson's <em>Dictionary of Bible Types</em>, and Whiston's
            Josephus) and three connection layers. Pick a thread — every view is a starting
            point, not a destination.
          </p>
          <button className="ghost" onClick={onClose}>
            Skip — take me to the reading view
          </button>
        </div>

        {GROUPS.map((g) => (
          <section key={g.heading} className="start-group">
            <h2>{g.heading}</h2>
            <div className="start-cards">
              {g.entries.map((e) => (
                <a key={e.title} className="start-card" href={e.href}>
                  <span className="start-tag" style={{ background: e.color }}>
                    {e.tag}
                  </span>
                  <h3>{e.title}</h3>
                  <p>{e.blurb}</p>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
