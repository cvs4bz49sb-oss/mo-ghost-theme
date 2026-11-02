/*
 * Topic fallbacks for build-podcast-wiki.mjs, for episodes that the
 * primary source doesn't cover.
 *
 * Mere Fidelity's topics come from data/mere-fidelity-topics.json, which a
 * transcript pass fills by hand. That pass hasn't run since early August,
 * so new episodes have no entry and the "Browse by Topic" lens silently
 * skips them. For an episode with no entry:
 *   1. A replay ("Replay: <title>") takes the topics of its original.
 *   2. Anything else is tagged from its title and description with the
 *      keyword rules below, using the same vocabulary as the map.
 * A later transcript pass overrides both, since a map entry always wins.
 *
 * Scored against the 305 mapped episodes (scripts/check-podcast-wiki-topics.mjs):
 * about 7 in 10 keyword topics match the transcript pass, and about 3 in 4
 * episodes get at least one topic it also chose. Rough, but far better
 * than leaving every new episode out of the lens.
 *
 * Christians Reading Classics titles name the book, so the title rules in
 * build-podcast-wiki.mjs work well; when a new book matches none of them,
 * the same rules are tried on the description.
 */

// [topic, regex]. Every topic must already exist in the transcript map's
// vocabulary so the lens doesn't grow near-duplicate categories.
export const MF_KEYWORD_RULES = [
  ["Scripture & Hermeneutics", /\bscripture|\bbible\b|biblical interpret|hermeneutic|exegesis|\bgospel of\b|\bpsalm|\bgenesis\b|\bexodus\b|\bromans\b|\bcorinthians\b|\bepistle|\bparable|old testament|new testament|\btext of\b|reading the bible/i],
  ["Virtue, Character & Christian Ethics", /\bvirtue|\bethic|\bmoral(?!\s+psychology)|character|\bprudence|\bcourage|\bhonesty|\bfriendship|\bjustice\b|\bhumility/i],
  ["Ecclesiology & Sacraments", /denomination|baptism|eucharist|lord'?s supper|\bcommunion|sacrament|ecclesiolog|\bcatholic|\brome\b|protestant|\bthe church\b|church unity|\bchurch membership|\bpapacy|\bpope\b/i],
  ["Spiritual Formation & Prayer", /\bpray|spiritual formation|discipleship|devotion|\bfasting|\bsabbath|spiritual (?:life|disciplines)|christian life|contemplat|\bholiness/i],
  ["Politics & Public Life", /politic|\belection|democra|conservati|liberalism|\bnation|\bstate\b|government|\bpublic (?:life|square)|republic|\bpolicy|\bvote|america|christian nationalism|\blaw\b|\bcourt\b/i],
  ["Secularism & Expressive Individualism", /secular|expressive individualism|post-christian|modernity|\bmodern (?:world|age)|disenchant|charles taylor|\bwestern? (?:culture|civilization)|enlightenment|\bidentity\b/i],
  ["Biblical Theology & Typology", /typolog|biblical theology|\btype(?:s)? of\b|\bexodus\b|\btemple\b|\bcovenant|\bisrael\b|\bfigur(?:al|e)\b|\bleviticus|\btabernacle/i],
  ["Theological Retrieval & Method", /retrieval|\bchurch fathers\b|patristic|theological method|\bcreeds?\b|\bconfession(?:s|al)\b|\bdogmatic|systematic theology|\bscholastic|theolog(?:y|ians?) (?:nerd|influence)|\bresourcement|\bthe tradition\b|great tradition/i],
  ["Worship & Liturgy", /\bworship|\bliturg|\bhymn|\bsinging|\bpsalter|book of common prayer|\bchurch music|\bidolatry/i],
  ["Technology & Digital Life", /technolog|\bdigital|\binternet|\bonline\b|social media|smartphone|\bphones?\b|\bai\b|artificial intelligence|\bscreens?\b|algorithm/i],
  ["Doctrine of God & Classical Theism", /classical theism|doctrine of god|\btrinit|divine (?:simplicity|impassibility|attributes|nature)|impassib|attributes of god|\bimmutab|nature of god/i],
  ["Sexuality, Gender & Anthropology", /sexual|\bgender|transgender|\bmen and women|masculin|feminin|anthropolog|\bimage of god|imago dei|\bthe body\b|\bhuman nature/i],
  ["Resurrection & Eschatology", /resurrect|eschatolog|\bheaven|\bhell\b|end times|new creation|second coming|\bafterlife|\bjudgment day|millennial|\beaster\b|\bdeath\b/i],
  ["Suffering, Evil & Theodicy", /suffering|theodicy|problem of evil|\bgrief|\blament|\bpain\b|\bevil\b|\bsorrow|tragedy/i],
  ["Church Leadership & Abuse of Power", /\babuse|church leader|\bscandal|accountability|celebrity pastor|\bspiritual authority|\bmisconduct|\bpastoral (?:authority|failure)|\bcult\b/i],
  ["Sin, Desire & Moral Psychology", /\bsin\b|\bsins\b|sinful|\bdesire|temptation|\bvice|\bidol|\bpride\b|\benvy|\blust|\banger\b|\bshame\b|\bguilt/i],
  ["Apologetics, Doubt & Unbelief", /apologetic|\bdoubt|unbelie|\batheis|deconstruct|\bskeptic|\bnew atheis|\bbelief in god|\bevidence for/i],
  ["Marriage & Family", /\bmarriage|\bmarried|\bfamil(?:y|ies)\b|\bparent|\bchildren|\bkids\b|\bhusband|\bwife\b|\bsingleness|\bdivorce|\bmotherhood|\bfatherhood/i],
  ["Atonement & the Work of Christ", /atonement|\bthe cross\b|crucifi|penal substitution|work of christ|\bincarnation|\bchristolog|\bredemption|\bsacrifice/i],
  ["Nature & Grace", /nature and grace|grace and nature|natural law|\bnatural theology|\bcommon grace|\bnature perfect|\bthe natural order/i],
  ["Augustine", /augustin/i],
  ["Predestination, Grace & Providence", /predestin|\belection\b|providence|\bsovereign|free will|\bcalvinis|arminian|\bgrace\b/i],
  ["Reformed Theology & Bavinck", /bavinck|reformed|\bcalvin\b|\bpuritan|westminster|kuyper|\bturretin/i],
  ["Economics, Work & Mammon", /econom|\bvocation|\bmoney|\bwealth|\bmammon|\bcapitalis|\bmarket|\bdebt\b|\bpoverty|\bthe poor\b|\bwork(?:place|ers)\b|\bgood work\b/i],
  ["Literature & Moral Imagination", /literature|\bnovel(?:s|ist)?\b|\bpoet|\bpoem|\bfiction|moral imagination|\btolkien|c\.? ?s\.? lewis|\bdostoevsk|\bshakespeare|\bmilton\b|\bdante\b/i],
  ["Bioethics, Abortion & the Body", /bioethic|abortion|euthanasia|\bivf\b|\bembryo|\bmedical|\bmedicine|assisted suicide|\bpro-life/i],
  ["Sermon on the Mount / Beatitudes", /sermon on the mount|beatitude/i],
  ["Church Discipline & Shunning", /church discipline|\bshunning|excommunicat/i],
  ["Race & Justice", /\bracis|\bracial|civil rights|\bslavery|\brace relations|\bethnic/i],
];

const MAX_KEYWORD_TOPICS = 4;

// Topics ranked by how many times their rule fires. The title counts
// twice: it is short and says what the episode is about.
export function topicsByKeywords(title, description) {
  const hay = `${title} ${title} ${description || ""}`;
  const scored = [];
  for (const [topic, re] of MF_KEYWORD_RULES) {
    const hits = hay.match(new RegExp(re.source, "gi"));
    if (hits) scored.push([topic, hits.length]);
  }
  return scored
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KEYWORD_TOPICS)
    .map(([topic]) => topic);
}

const REPLAY = /^\s*replay\s*:\s*/i;

// "Replay: The Fractured Republic with Yuval Levin (Fixed Audio)" and
// "The Fractured Republic with Yuval Levin" normalise to the same key.
export function replayKey(title) {
  return String(title || "")
    .toLowerCase()
    .replace(REPLAY, "")
    .replace(/\(fixed audio\)|\[[^\]]*\]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isReplay(title) {
  return REPLAY.test(String(title || ""));
}

/*
 * Fills `topics` (and, for replays, `guests` when the title gave none) on
 * every Mere Fidelity episode that has no topics yet. Mutates and returns
 * a count per source so the build log shows how much is fallback.
 */
export function fillMissingTopics(episodes) {
  const originals = new Map();
  for (const ep of episodes) {
    if (!isReplay(ep.title) && ep.topics.length) originals.set(replayKey(ep.title), ep);
  }
  const counts = { replay: 0, keywords: 0, none: 0 };
  for (const ep of episodes) {
    if (ep.topics.length) continue;
    const original = isReplay(ep.title) ? originals.get(replayKey(ep.title)) : null;
    if (original) {
      ep.topics = [...original.topics];
      if (!ep.guests.length) ep.guests = [...original.guests];
      counts.replay++;
      continue;
    }
    ep.topics = topicsByKeywords(ep.title, ep.description);
    ep.topics.length ? counts.keywords++ : counts.none++;
  }
  return counts;
}
