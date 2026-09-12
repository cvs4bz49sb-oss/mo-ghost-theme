# The Faith Received — catalogue changes, 10–11 September 2026

The full catalogue (every work, its author, shelf, title, volume line, page count, TEI flag and reader URLs on both sites) is `works-catalogue.csv` (19,448 rows). This note lists what changed in the last two days so Ian can update MereO from the R2 copy (`mo-tfr/v1/works-index.json`, public variant, 19,447 rows — the Westminster vol-1 row is never on R2).

## 1. Author folds (169 rows)
Two fragmented author groups were folded into one canonical name each (the alias file `v1/author_aliases.json` carries the rulings):

- `Athanasius` → `Athanasius of Alexandria` (117 rows)
- `Bede` → `Bede the Venerable` (52 rows)

## 2. Titles (3 rows)
Three Suárez volumes were titled `Complete Works` while the rest of the set is `Works`; a set must share one title so the library groups it as one set.

- `suarez-opera-vol-19`: `Complete Works` → `Works`
- `suarez-opera-vol-20`: `Complete Works` → `Works`
- `suarez-opera-vol-9`: `Complete Works` → `Works`

## 3. Volume labels (56 rows changed, 59 labelled in total)
Multi-volume sets now carry a content label in the volume line, `Vol. N · <label>`, composed from each volume’s own table of contents. The number before the dot is the volume number the library sorts by; the label after ` · ` is free text. The label is the SAME in all three title sources (works-index row, the work’s `meta.json`, `library_overrides.json`).

- `philipp-melanchthon-opera-vol-1`: `Vol. 1` → `Vol. 1 · Letters, prefaces and counsels, books I–IV (1514–1530)`
- `philipp-melanchthon-opera-vol-2`: `Vol. 2` → `Vol. 2 · Letters, books V–VI (1530–1535); Apology of the Confession`
- `philipp-melanchthon-opera-vol-3`: `Vol. 3` → `Vol. 3 · Letters, book VII (1536–1541); On the power and primacy of the pope`
- `philipp-melanchthon-opera-vol-4`: `Vol. 4` → `Vol. 4 · Letters, books VIII–IX (1541–1543)`
- `philipp-melanchthon-opera-vol-5`: `Vol. 5` → `Vol. 5 · Letters, book IX (1543–1545)`
- `philipp-melanchthon-opera-vol-6`: `Vol. 6` → `Vol. 6 · Letters, books X–XI (1546–1549)`
- `philipp-melanchthon-opera-vol-7`: `Vol. 7` → `Vol. 7 · Letters, book XII (1549–1552)`
- `philipp-melanchthon-opera-vol-8`: `Vol. 8` → `Vol. 8 · Letters, book XII continued (1553–1556)`
- `philipp-melanchthon-opera-vol-9`: `Vol. 9` → `Vol. 9 · Letters, book XIII (1557–1560)`
- `philipp-melanchthon-opera-vol-10`: `Vol. 10` → `Vol. 10 · Letters, book XIV; supplements; life and death of Melanchthon; orations`
- `philipp-melanchthon-opera-vol-11`: `Vol. 11` → `Vol. 11 · Declamations I (to 1552)`
- `philipp-melanchthon-opera-vol-12`: `Vol. 12` → `Vol. 12 · Declamations II (1553–1560)`
- `philipp-melanchthon-opera-vol-13`: `Vol. 13` → `Vol. 13 · On the soul; Initia doctrinae physicae; Elements of rhetoric`
- `philipp-melanchthon-opera-vol-14`: `Vol. 14` → `Vol. 14 · On Proverbs and Ecclesiastes; annotations on Matthew and John`
- `philipp-melanchthon-opera-vol-15`: `Vol. 15` → `Vol. 15 · Annotations on the Gospels; Romans; Corinthians; Colossians`
- `philipp-melanchthon-opera-vol-16`: `Vol. 16` → `Vol. 16 · Ethical and political writings; Scripture expositions`
- `philipp-melanchthon-opera-vol-17`: `Vol. 17` → `Vol. 17 · Scholia on Cicero, Sallust, Tacitus and other classical authors`
- `philipp-melanchthon-opera-vol-18`: `Vol. 18` → `Vol. 18 · Ptolemy's Tetrabiblos; interpretations of Greek authors`
- `philipp-melanchthon-opera-vol-19`: `Vol. 19` → `Vol. 19 · Greek poets interpreted: Tyrtaeus, Solon, Theognis, Callimachus, Plato`
- `philipp-melanchthon-opera-vol-20`: `Vol. 20` → `Vol. 20 · Greek and Latin grammar; syntax; prosody; elementary texts`
- `philipp-melanchthon-opera-vol-21`: `Vol. 21` → `Vol. 21 · Loci theologici: the Latin editions`
- `philipp-melanchthon-opera-vol-22`: `Vol. 22` → `Vol. 22 · Loci theologici: German and other translations; Corpus doctrinae`
- `philipp-melanchthon-opera-vol-23`: `Vol. 23` → `Vol. 23 · Examen ordinandorum; Catechesis puerilis; expositions of the Nicene Creed; shorter dogmatic writings`
- `philipp-melanchthon-opera-vol-24`: `Vol. 24` → `Vol. 24 · Postils I–II`
- `philipp-melanchthon-opera-vol-25`: `Vol. 25` → `Vol. 25 · Postils III–IV`
- `philipp-melanchthon-opera-vol-26`: `Vol. 26` → `Vol. 26 · Visitation articles; the Augsburg Confession`
- `philipp-melanchthon-opera-vol-27`: `Vol. 27` → `Vol. 27 · Confutation and Apology of the Augsburg Confession`
- `philipp-melanchthon-opera-vol-28`: `Vol. 28` → `Vol. 28 · Apology of the Augsburg Confession; Confessio Saxonica`
- `suarez-opera-vol-1`: `Vol. 1` → `Vol. 1 · On God, one and triune; on predestination`
- `suarez-opera-vol-10`: `Vol. 10` → `Vol. 10 · On grace XII; efficacious grace; dissertations`
- `suarez-opera-vol-11`: `Vol. 11` → `Vol. 11 · Opuscula: divine concursus, foreknowledge, freedom of the divine will`
- `suarez-opera-vol-12`: `Vol. 12` → `Vol. 12 · On faith, hope and charity`
- `suarez-opera-vol-13`: `Vol. 13` → `Vol. 13 · On religion I–III: its nature, precepts, and the vices opposed to it`
- `suarez-opera-vol-14`: `Vol. 14` → `Vol. 14 · On religion: prayer; oaths and adjuration`
- `suarez-opera-vol-15`: `Vol. 15` → `Vol. 15 · On religion: the religious state (books I–VI)`
- `suarez-opera-vol-16`: `Vol. 16` → `Vol. 16 · On religion: the Society of Jesus`
- `suarez-opera-vol-17`: `Vol. 17` → `Vol. 17 · On the Incarnation I (Summa III, qq. 1–9)`
- `suarez-opera-vol-18`: `Vol. 18` → `Vol. 18 · On the Incarnation II (Summa III, qq. 10–26)`
- `suarez-opera-vol-19`: `Vol. 19` → `Vol. 19 · On the mysteries of the life of Christ (qq. 27–59)`
- `suarez-opera-vol-2`: `Vol. 2` → `Vol. 2 · On the angels`
- `suarez-opera-vol-20`: `Vol. 20` → `Vol. 20 · On the sacraments: in general, baptism, confirmation, the Eucharist (qq. 60–74)`
- `suarez-opera-vol-21`: `Vol. 21` → `Vol. 21 · On the Eucharist and the sacrifice of the Mass (qq. 75–83)`
- `suarez-opera-vol-22`: `Vol. 22` → `Vol. 22 · On penance and indulgences (qq. 84–90)`
- `suarez-opera-vol-24`: `Vol. 24` → `Vol. 24 · Defensio fidei catholicae against the Anglican sect`
- `suarez-opera-vol-3`: `Vol. 3` → `Vol. 3 · On the work of the six days; on the soul`
- `suarez-opera-vol-4`: `Vol. 4` → `Vol. 4 · On the end of man; the voluntary; goodness and malice; the passions; vices and sins`
- `suarez-opera-vol-5`: `Vol. 5` → `Vol. 5 · On laws I–V: law in general, eternal and natural law, human and canon law`
- `suarez-opera-vol-6`: `Vol. 6` → `Vol. 6 · On laws VI–X: interpretation and change of law, custom, privilege, divine law`
- `suarez-opera-vol-7`: `Vol. 7` → `Vol. 7 · On grace: prolegomena`
- `suarez-opera-vol-8`: `Vol. 8` → `Vol. 8 · On grace: the aids of grace (De auxiliis)`
- `suarez-opera-vol-9`: `Vol. 9` → `Vol. 9 · On grace VI–XI: habitual grace and justification`
- `gennadius-scholarios-works-vol-5`: `Vol. 5` → `Vol. 5 · Summaries of Aquinas: Summa contra Gentiles and Summa theologiae I`
- `gennadius-scholarios-works-vol-6`: `Vol. 6` → `Vol. 6 · Summary of the Prima Secundae; De ente et essentia; commentary on De anima`
- `gennadius-scholarios-works-vol-7`: `Vol. 7` → `Vol. 7 · Logic: Isagoge, Categories, De interpretatione; annotations on Aristotle`
- `gennadius-scholarios-works-vol-8`: `Vol. 8` → `Vol. 8 · Physics; De fallaciis; Summulae of Peter of Spain; De sex principiis; grammar; varia`
- `gennadius-scholarios-works-vol-1`: `` → `Vol. 1 · Sermons and panegyrics; funeral orations; the Florence discourse; on predestination and the soul`
- `gennadius-scholarios-works-vol-2`: `` → `Vol. 2 · Three treatises on the procession of the Holy Spirit`
- `gennadius-scholarios-works-vol-3`: `` → `Vol. 3 · Anti-Latin and anti-Barlaamite polemic; against simony`
- `gennadius-scholarios-works-vol-4`: `` → `Vol. 4 · Against Plethon; pastoral, liturgical and poetic works`

## 4. New work (1 row)
- `hadow-antinomianism-of-the-marrow-detected` — added to the catalogue, search and R2.

## 5. How to take these into MereO
1. Read `v1/works-index.json` from `mo-tfr` (NEW_LIBRARY). Do not derive titles from `mo-tfr-library` — its catalogue is the 21 August state.
2. Display title = `v1/titles_en.json[slug]` if present, else the row `title`; the volume line is the row `volume` verbatim.
3. For the 59 labelled volumes the per-work `meta.json` on R2 carries the same `volume` string (`tei_v` unchanged — no text changed).
4. Author names: use the row `author` as shipped; the alias file is only needed to fold OLD data you may hold.
