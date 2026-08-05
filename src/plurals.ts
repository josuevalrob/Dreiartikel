// German plural practice: show the singular ("das Buch") and ask the learner to
// pick the correct plural form ("Bücher") from believable look-alikes.
//
// Design note — why this is built differently from cases:
//   Case article forms are 100% rule-derivable (case × gender × number), so they
//   need no per-word data. Plurals are NOT: the rules in the textbook are only
//   *tendencies* ("most masculine → -e", but Mann → Männer). So the plural form
//   is a STORED per-noun fact (the source of truth, always correct), and the
//   answer buttons are DERIVED from it: the real plural plus decoys produced by
//   applying the *other* patterns to the same stem. A stored string is always
//   right, so even foreign irregulars (Thema → Themen) need no special-casing in
//   the answer logic — they simply stand out as the one real form among decoys.

import { genderHint, type Hint } from './hints';
import { generateItems, type PracticeItem } from './data';
import { shuffle, randomOf } from './utils/random';
import { capitalize } from './utils/text';
import type { PracticeRound } from './round';
import type { Gender } from './rules';

/** The shapes a German plural can take (the eight rows of the Formen table) plus
 *  `foreign` for irregular stems that don't fit any shape (Thema → Themen). The
 *  pattern is the rule: it drives decoy generation and the explanatory Tipp. */
export type PluralPattern =
    | 'e'          // der Tag   → die Tage
    | 'umlaut-e'   // der Bart  → die Bärte
    | 'en'         // die Frau  → die Frauen   (also -n: die Blume → die Blumen)
    | 'none'       // der Fehler → die Fehler
    | 'umlaut'     // der Apfel → die Äpfel
    | 'er'         // das Lied  → die Lieder
    | 'umlaut-er'  // das Buch  → die Bücher
    | 's'          // das Kino  → die Kinos
    | 'foreign';   // das Thema → die Themen   (stem changes; stored literally)

export const PLURAL_PATTERNS: PluralPattern[] = [
    'e', 'umlaut-e', 'en', 'none', 'umlaut', 'er', 'umlaut-er', 's',
];

/** Short, non-spoiling description of a pattern — names the shape, not the word. */
export const PATTERN_LABEL: Record<PluralPattern, string> = {
    'e': 'ending in -e',
    'umlaut-e': 'umlaut + -e',
    'en': 'ending in -en/-n',
    'none': 'no change',
    'umlaut': 'umlaut only',
    'er': 'ending in -er',
    'umlaut-er': 'umlaut + -er',
    's': 'ending in -s',
    'foreign': 'an irregular (foreign) plural',
};

// ── Umlaut handling ──────────────────────────────────────────────────────
// German pluralisation umlauts the LAST back vowel of the stem: a→ä, o→ö, u→ü,
// with the digraph 'au'→'äu' treated as a unit. Case is preserved (A→Ä).
const UMLAUT: Record<string, string> = { a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' };

function umlautStem(stem: string): string {
    // Find the last umlautable unit scanning from the right. 'au' is a digraph
    // and must win over the bare 'u' inside it (Maus → Mäuse, not Maüse), so at
    // each back vowel we first check whether it's the 'u' of a preceding 'a'.
    for (let i = stem.length - 1; i >= 0; i--) {
        const ch = stem[i];
        if (!UMLAUT[ch]) continue;

        // Is this the 'u' of an 'au' digraph? Then umlaut the whole 'au' → 'äu'.
        if ((ch === 'u' || ch === 'U') && i > 0 && (stem[i - 1] === 'a' || stem[i - 1] === 'A')) {
            const head = stem[i - 1] === 'A' ? 'Äu' : 'äu';
            return stem.slice(0, i - 1) + head + stem.slice(i + 1);
        }
        return stem.slice(0, i) + UMLAUT[ch] + stem.slice(i + 1);
    }
    return stem; // nothing to umlaut
}

/** Apply a pattern to a singular stem to produce a plural surface form. Used
 *  both to render regular plurals and to generate believable decoys. `foreign`
 *  has no derivable form, so we fall back to a plain -en (decoy use only; the
 *  real foreign plural is always supplied as stored data, never derived). */
export function applyPattern(word: string, pattern: PluralPattern): string {
    switch (pattern) {
        case 'none': return word;
        case 'e': return `${word}e`;
        case 'er': return `${word}er`;
        case 's': return `${word}s`;
        case 'umlaut': return umlautStem(word);
        case 'umlaut-e': return `${umlautStem(word)}e`;
        case 'umlaut-er': return `${umlautStem(word)}er`;
        case 'en':
            // -n if the word already ends in -e (Blume → Blumen) or -n-friendly
            // endings; -en otherwise. -in doubles the n (Freundin → Freundinnen).
            if (word.endsWith('in')) return `${word}nen`;
            if (/[en]$/.test(word) || word.endsWith('el') || word.endsWith('er')) return `${word}n`;
            return `${word}en`;
        case 'foreign': return `${word}en`; // decoy fallback only
    }
}

/** The real plural surface form for an item: its stored plural when present,
 *  else the pattern applied to the word. */
export function pluralForm(item: PracticeItem): string {
    if (item.plural) return item.plural;
    if (item.pluralPattern) return applyPattern(item.word, item.pluralPattern);
    return applyPattern(item.word, 'en'); // last-ditch default; shouldn't happen for eligible items
}

/** Can this noun appear in plural mode? Needs a known plural and isn't a
 *  plural-only word (those have no singular to show). */
export function hasPlural(item: PracticeItem): boolean {
    return !item.pluralOnly && (!!item.plural || !!item.pluralPattern);
}

// Decoy patterns to try, in rough order of how believable a wrong guess they
// make. We apply each to the stem and keep the first few that differ from the
// real answer and from each other.
const DECOY_ORDER: PluralPattern[] = ['e', 'en', 'er', 'umlaut-e', 'umlaut-er', 'umlaut', 's', 'none'];

/** Up to `count` plausible but wrong plural forms for an item: apply the other
 *  patterns to its stem, drop any that collide with the real answer or each
 *  other. Guarantees distinct decoys (so the learner always has real choices),
 *  padding with simple suffix variants if the patterns don't yield enough. */
export function makeDecoys(item: PracticeItem, count: number): string[] {
    const answer = pluralForm(item);
    const seen = new Set<string>([answer]);
    const decoys: string[] = [];

    for (const p of DECOY_ORDER) {
        if (decoys.length >= count) break;
        const form = applyPattern(item.word, p);
        if (!seen.has(form)) {
            seen.add(form);
            decoys.push(form);
        }
    }

    // Pad defensively if patterns produced too few distinct forms (e.g. a short
    // stem where several collide), so the option count is always stable.
    const padders = [`${item.word}e`, `${item.word}en`, `${item.word}er`, `${item.word}s`, `${item.word}n`];
    for (const form of padders) {
        if (decoys.length >= count) break;
        if (!seen.has(form)) {
            seen.add(form);
            decoys.push(form);
        }
    }

    return decoys.slice(0, count);
}

/** A non-spoiling hint that names the *kind* of plural without giving the form.
 *  e.g. "This noun's plural takes umlaut + -er." */
function pluralHint(pattern: PluralPattern): Hint {
    return { kind: 'plural', text: `The plural here is formed by ${PATTERN_LABEL[pattern]}.` };
}

const GENDER_WORD: Record<Gender, string> = { m: 'masculine', f: 'feminine', n: 'neuter' };

/** A plural round is a `PracticeRound` whose answer is a stored plural and whose
 *  options are the real plural plus pattern-derived decoys. The prompt ("das
 *  Buch") never reveals the plural, so it is safe to speak on show. */
export interface PluralRound extends PracticeRound {
    pattern: PluralPattern;
}

const DEFAULT_OPTION_COUNT = 3; // 1 answer + 2 decoys — keeps the ← ↓ → loop and
                                // a readable count for the 3-second timer.

/** Build a plural round from an item. The answer is the stored/derived plural;
 *  options are the answer plus distinct decoys, shuffled. */
export function buildPluralRound(item: PracticeItem, optionCount = DEFAULT_OPTION_COUNT): PluralRound {
    const answer = pluralForm(item);
    const article = item.answer; // der/die/das of the singular
    const decoys = makeDecoys(item, optionCount - 1);
    const options = shuffle([answer, ...decoys]);
    const pattern = item.pluralPattern ?? 'en';

    const promptText = `${article} ${item.word}`;
    const spokenText = `${article} ${item.word} — die ${answer}`;
    const tipp = `${capitalize(GENDER_WORD[item.gender])} "${article} ${item.word}" → plural "die ${answer}" (${PATTERN_LABEL[pattern]}).`;
    const hints: Hint[] = [pluralHint(pattern), genderHint(item.word, item.gender)];

    // The singular prompt never contains the plural, so it's safe to speak on show.
    return { item, promptText, spokenText, speakOnShowSafe: true, answer, options, tipp, hints, pattern };
}

/** Pick one random plural round from a pool, or null if none are eligible. */
export function pickPluralRound(pool: PracticeItem[]): PluralRound | null {
    const eligible = pool.filter(hasPlural);
    if (eligible.length === 0) return null;
    return buildPluralRound(randomOf(eligible));
}

/** Build a shuffled list of plural rounds covering every eligible noun once. */
export function generatePluralRounds(pool: PracticeItem[]): PluralRound[] {
    return shuffle(pool.filter(hasPlural)).map(item => buildPluralRound(item));
}

/** Index every noun's PLURAL surface form back to its item — the reverse of
 *  pluralForm. The chapter parser uses this to recognise a plural noun written
 *  in prose ("die Bücher") and recover its base item (Buch), so it can detect
 *  *number* before reading the case off the surface article.
 *
 *  Built over the whole dataset (not a filtered pool) so a chapter's words always
 *  resolve regardless of the active noun filter. Singular-first resolution in the
 *  parser means a form that is also some noun's singular is matched as that
 *  singular before this map is consulted; on the rare plural↔plural collision the
 *  first item wins (deterministic over generateItems' fixed order). */
export function buildByPlural(): Map<string, PracticeItem> {
    const byPlural = new Map<string, PracticeItem>();
    for (const item of generateItems()) {
        if (!hasPlural(item)) continue;
        const form = pluralForm(item);
        if (!byPlural.has(form)) byPlural.set(form, item);
    }
    return byPlural;
}
