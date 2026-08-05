// The chapter prose parser — the front end of the authoring engine.
//
// An author writes a chapter as ordinary, grammatical German prose plus one
// topic tag (genus | kasus-dat | kasus-akk | plural). There is NO inline markup:
// the parser auto-detects every "<definite article> <Noun>" spot, reads the case
// straight off the surface article the author wrote (declension.caseForSurface),
// and decides — per the topic tag — whether that spot becomes a blank. Spots the
// tag doesn't drill stay as ordinary prose.
//
// It emits the SAME Segment[][] that hand-authored stories use (stories.ts), so
// the entire downstream pipeline (buildView → buildStoryRounds → the game loop →
// StoryCard) is reused unchanged. The grammar topic decides WHAT is blanked; the
// surface article decides the ANSWER; the dataset decides WHICH words are nouns.
//
// Stored vs derived (the project's recurring rule): the prose text is stored; the
// answer/options/tipp for each blank are DERIVED later by the resolvers — the
// parser only marks WHERE the blanks are and carries the trigger that explains
// the case.

import { caseForSurface, type Case } from '../declension';
import { generateItems, WEAK_MASCULINE, type PracticeItem } from '../data';
import { buildByPlural, hasPlural } from '../plurals';
import type { Gender } from '../rules';
import type { Segment } from '../stories';

/** The grammar a chapter drills. A *filter* over the prose, not a coercion: it
 *  selects which detected article+noun spots become blanks. */
export type ChapterTopic = 'genus' | 'kasus-dat' | 'kasus-akk' | 'plural';

/** The definite articles the parser treats as drill candidates. 'des' (genitive)
 *  is deliberately excluded — Genitiv is out of scope, so a 'des' phrase always
 *  stays prose (see the spec's v1 limits). */
const DRILL_ARTICLES = new Set(['der', 'die', 'das', 'dem', 'den']);

// Accusative triggers: words that force the Akkusativ, used as the escape hatch
// that lets a kasus-akk chapter blank an otherwise-ambiguous fem/neut spot
// ("die"/"das" are nom-or-akk by article alone). Phrased to slot into the Tipp
// exactly like sentences.ts ("the preposition 'für'"). Always-accusative
// prepositions only — two-way prepositions are left out because their case
// depends on the verb, which we don't parse.
const AKK_TRIGGERS: Record<string, string> = {
    'für': "the preposition 'für'",
    'durch': "the preposition 'durch'",
    'gegen': "the preposition 'gegen'",
    'ohne': "the preposition 'ohne'",
    'um': "the preposition 'um'",
};

// Dative triggers: prepositions that govern the Dativ, used to explain a dem/der
// blank in a kasus-dat chapter. The case is already pinned by the surface article
// ('dem' is dat-only); the trigger only enriches the Tipp.
const DAT_TRIGGERS: Record<string, string> = {
    'mit': "the preposition 'mit'",
    'zu': "the preposition 'zu'",
    'von': "the preposition 'von'",
    'bei': "the preposition 'bei'",
    'aus': "the preposition 'aus'",
    'nach': "the preposition 'nach'",
    'seit': "the preposition 'seit'",
};

/** A resolved noun match: the dataset item plus whether it appeared in singular
 *  or plural in the prose (which changes the case-decision column). */
interface NounMatch {
    item: PracticeItem;
    column: Gender | 'pl';
}

/** Build the three indices the parser matches against, over the WHOLE dataset
 *  (so a chapter's words resolve regardless of any active noun filter). */
function buildIndices() {
    const items = generateItems();
    const byWord = new Map(items.map(i => [i.word, i]));
    const byPlural = buildByPlural();
    return { byWord, byPlural };
}

/** Resolve a Capitalized token (the word after a definite article) to a dataset
 *  noun + its number, or null if it isn't a known noun. Resolution order matters:
 *   1. exact singular (byWord) — the common case;
 *   2. weak-masculine oblique: strip exactly one trailing -n and retry, accepting
 *      only WEAK_MASCULINE words (all -e-final, so "Jungen" → "Junge"; never strip
 *      -en, which would wreck the set → "Jung");
 *   3. plural surface form (byPlural) — recovers "Bücher" → Buch with column 'pl'. */
function matchNoun(
    token: string,
    byWord: Map<string, PracticeItem>,
    byPlural: Map<string, PracticeItem>,
): NounMatch | null {
    const direct = byWord.get(token);
    if (direct) return { item: direct, column: direct.gender };

    if (token.endsWith('n')) {
        const base = token.slice(0, -1);
        const weak = byWord.get(base);
        if (weak && WEAK_MASCULINE.has(base)) return { item: weak, column: weak.gender };
    }

    const plural = byPlural.get(token);
    if (plural) return { item: plural, column: 'pl' };

    return null;
}

/** Reduce caseForSurface's result to a single case under the no-genitive rule:
 *  drop 'gen', so fem 'der' ({dat,gen}) collapses to 'dat'. Returns the remaining
 *  case if exactly one survives, the surviving set if still ambiguous, or null. */
function nonGenitiveCase(result: Case | Case[] | null): Case | Case[] | null {
    if (result === null) return null;
    const arr = (Array.isArray(result) ? result : [result]).filter(c => c !== 'gen');
    if (arr.length === 0) return null;
    return arr.length === 1 ? arr[0] : arr;
}

const isCapitalized = (tok: string) => tok.length > 0 && tok[0] === tok[0].toUpperCase() && tok[0] !== tok[0].toLowerCase();

/** Whether an article+noun spot is blankable for this topic, and (for kasus) the
 *  trigger phrase to attach. Returns null when the spot should stay plain prose.
 *  The plural topic is handled separately (it blanks the bare noun, not an
 *  article spot), so it never reaches here. */
function blankability(
    topic: Exclude<ChapterTopic, 'plural'>,
    match: NounMatch,
    surfaceArticle: string,
    precedingWord: string | null,
): { trigger?: string } | null {
    const item = match.item;

    if (item.pluralOnly) return null; // no singular gender/case drill possible

    const inferred = nonGenitiveCase(caseForSurface(match.column, surfaceArticle));
    if (inferred === null) return null;

    if (topic === 'genus') {
        // Genus is a singular der/die/das drill; skip plural spots.
        return match.column === 'pl' ? null : {};
    }

    const prep = precedingWord ? precedingWord.toLowerCase() : null;

    if (topic === 'kasus-dat') {
        // Blank only genuinely-dative spots: 'dem' (m/n, unambiguous), fem 'der'
        // (dat under no-gen), or 'den' + plural (dat-plural, number-aware).
        const isDat = inferred === 'dat';
        if (!isDat) return null;
        const trigger = prep && DAT_TRIGGERS[prep] ? DAT_TRIGGERS[prep] : undefined;
        return { trigger };
    }

    // kasus-akk
    if (inferred === 'akk') {
        // Unambiguously accusative (masc 'den'). Blank it; trigger optional.
        const trigger = prep && AKK_TRIGGERS[prep] ? AKK_TRIGGERS[prep] : undefined;
        return { trigger };
    }
    if (Array.isArray(inferred) && inferred.includes('akk')) {
        // Ambiguous fem/neut {nom,akk}: blank ONLY when an akk trigger is present,
        // else leave as prose (the documented v1 limit). The trigger both
        // disambiguates and explains.
        const trigger = prep ? AKK_TRIGGERS[prep] : undefined;
        return trigger ? { trigger } : null;
    }
    return null;
}

/** Split a prose line into alternating word tokens and the raw text (spaces +
 *  punctuation) between them, so text Segments keep their exact whitespace. A
 *  token is a maximal run of letters / German diacritics / hyphen. */
interface Tok { word: string; before: string }
function tokenize(line: string): { toks: Tok[]; trailing: string } {
    const toks: Tok[] = [];
    const wordRe = /[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]*/g;
    let lastEnd = 0;
    let m: RegExpExecArray | null;
    while ((m = wordRe.exec(line)) !== null) {
        toks.push({ word: m[0], before: line.slice(lastEnd, m.index) });
        lastEnd = m.index + m[0].length;
    }
    return { toks, trailing: line.slice(lastEnd) };
}

/** Parse one prose line into Segments, detecting article+noun spots and blanking
 *  per the topic. A blank emits the article position as {kind:'blank', word: the
 *  noun-as-written, trigger?}, and the noun rides on as a following text segment
 *  carrying its own leading space — so the noun is always visible (the engine
 *  never re-declines or re-injects it). */
function parseLine(
    line: string,
    topic: ChapterTopic,
    byWord: Map<string, PracticeItem>,
    byPlural: Map<string, PracticeItem>,
): Segment[] {
    const { toks, trailing } = tokenize(line);
    const out: Segment[] = [];
    let pending = ''; // text accumulated but not yet flushed

    const flush = () => { if (pending) { out.push({ kind: 'text', text: pending }); pending = ''; } };

    for (let i = 0; i < toks.length; i++) {
        const tok = toks[i];

        // Plural drills the NOUN form itself, which in prose often has no
        // definite article ("viele Bücher", "Bücher liegen hier"). So for the
        // plural topic, match any Capitalized token that is a plural surface form
        // — no preceding-article requirement.
        if (topic === 'plural' && isCapitalized(tok.word)) {
            const match = matchNoun(tok.word, byWord, byPlural);
            if (match && match.column === 'pl' && hasPlural(match.item)) {
                pending += tok.before;
                flush();
                out.push({ kind: 'blank', word: match.item.word });
                continue;
            }
        }

        const isArticle = DRILL_ARTICLES.has(tok.word.toLowerCase());
        const next = toks[i + 1];

        if (topic !== 'plural' && isArticle && next && isCapitalized(next.word)) {
            const match = matchNoun(next.word, byWord, byPlural);
            if (match) {
                const precedingWord = i > 0 ? toks[i - 1].word : null;
                const decision = blankability(topic, match, tok.word.toLowerCase(), precedingWord);
                if (decision) {
                    // genus / kasus: blank the ARTICLE; noun rides as text after.
                    pending += tok.before;
                    flush();
                    const blank: Segment = { kind: 'blank', word: match.item.word };
                    if (decision.trigger) blank.trigger = decision.trigger;
                    // Kasus blanks carry the surface article (the answer + the case
                    // cue); genus reads its own nom-sg article from the item.
                    if (topic === 'kasus-dat' || topic === 'kasus-akk') blank.article = tok.word.toLowerCase();
                    out.push(blank);
                    // The noun (as the author wrote it — already declined) + its
                    // leading space become the following text segment.
                    pending += next.before + next.word;
                    i += 1; // consumed the noun token
                    continue;
                }
            }
        }

        // Not a drill spot: accumulate the token as plain text.
        pending += tok.before + tok.word;
    }

    pending += trailing;
    flush();
    return out;
}

/** Parse a chapter's prose (one string per line) into the Segment[][] the story
 *  engine consumes. Blank lines are dropped (they carry no content). */
export function parseChapter(topic: ChapterTopic, lines: string[]): Segment[][] {
    const { byWord, byPlural } = buildIndices();
    return lines
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(line => parseLine(line, topic, byWord, byPlural));
}
