import { type Article, type Gender, articleForGender } from './rules';
import type { PluralPattern } from './plurals';
import nounsData from './nouns.json';

// ─── The noun dictionary is DATA, and the data lives in JSON ─────────────────
//
// Every fact about a word — its gender (the source of truth; the article is
// DERIVED), English hint, thematic category, declension facts, and the new
// enrichment fields (level, tags, cefr…) — lives in ONE row in `nouns.json`.
// Adding or enriching vocabulary is editing that file: no code change, no TS
// syntax to get wrong, and a non-dev can do it. This module only:
//   1. gives the JSON its types (PracticeItem),
//   2. validates it once at load so a bad row fails loudly, not silently,
//   3. re-derives the legacy PERSON_WORDS/PLURAL_ONLY/WEAK_MASCULINE/PLACE_WORDS
//      sets FROM the per-word fields (single source of truth = the JSON), so the
//      modules that import those sets keep working unchanged,
//   4. exposes generateItems()/getCategories()/shuffle, the stable API the rest
//      of the app builds rounds from.
//
// Why JSON over a .ts const: the same reason the map flow and chapter prose are
// data files — content you edit often should be plain data decoupled from code.
// Before this, one noun's facts were scattered across six places (a string row +
// five side-tables); now they're one object.

export type Animacy = 'person' | 'thing';

/** A noun row as it sits in nouns.json — every authored fact about the word. */
interface RawNoun {
    word: string;
    gender: Gender;
    hint: string;
    category: string;
    animacy: Animacy;
    /** Plural surface form, or null when not yet curated. */
    plural: string | null;
    pluralPattern: PluralPattern | null;
    pluralOnly: boolean;
    weakMasculine: boolean;
    place: boolean;
    /** Difficulty gate: higher = surfaced in higher-level quests. */
    level: number;
    /** Topic/theme grouping for quests + the story generator. */
    tags: string[];
    /** Enrichment, filled over time (LLM story generator / authoring). */
    cefr: string | null;
    theme: string | null;
    frequency: number | null;
    exampleSentence: string | null;
}

/** The unit the game loop consumes. A superset of the raw row: `answer`/`options`
 *  are DERIVED from gender, `id` is the row index. The optional declension flags
 *  stay optional (absent when false) so existing consumers are unchanged. */
export interface PracticeItem {
    id: string;
    word: string;
    /** Canonical grammatical gender — the source of truth for this noun. */
    gender: Gender;
    /** Nominativ-singular article, derived from gender. The article shown today;
     *  case modes derive other forms from `gender` instead. */
    answer: Article;
    hint: string;
    options: Article[];
    category: string;
    /** Whether the noun denotes a person — needed to slot it into sentence
     *  templates (dative verbs want a person, "essen" wants a thing). */
    animacy: Animacy;
    /** Plural-only noun (e.g. Eltern). Excluded from sentence mode in phase 1,
     *  which only handles singular declension. */
    pluralOnly?: boolean;
    /** Weak masculine (n-Deklination): takes -n/-en on the noun itself in
     *  accusative/dative singular, e.g. "der Junge" → "den Jungen". */
    isWeakMasculine?: boolean;
    /** A place you can go to / be in — fills two-way-preposition frames
     *  ("in den Park" / "im Park"). */
    isPlace?: boolean;
    /** The plural surface form, e.g. "Bücher". The SOURCE OF TRUTH for plural
     *  mode (plurals aren't reliably rule-derivable). */
    plural?: string;
    /** How the plural is formed — the rule. Drives decoy generation and the
     *  Tipp in plural mode; `foreign` for irregular stems (Thema → Themen). */
    pluralPattern?: PluralPattern;
    /** Difficulty gate (1 = easiest). Drives level-gated side quests. */
    level: number;
    /** Topic/theme tags for quest filtering + the story generator. */
    tags: string[];
    /** CEFR band (A1/A2/B1…), null until assigned. */
    cefr?: string;
    /** Semantic theme, null until assigned. */
    theme?: string;
    /** Usage-frequency rank, null until assigned. */
    frequency?: number;
    /** A canonical usage sentence (for the story generator), null until written. */
    exampleSentence?: string;
}

// ─── Load + validate the authored JSON ──────────────────────────────────────

const RAW_NOUNS = (nounsData as unknown as { nouns: RawNoun[] }).nouns;

const VALID_ARTICLES: readonly Article[] = ['der', 'die', 'das'];
const VALID_GENDERS: readonly Gender[] = ['m', 'f', 'n'];

function validate(rows: RawNoun[]): void {
    const seen = new Set<string>();
    rows.forEach((n, i) => {
        if (!n.word) throw new Error(`nouns.json: row ${i} has no word`);
        if (seen.has(n.word)) throw new Error(`nouns.json: duplicate word "${n.word}"`);
        seen.add(n.word);
        if (!VALID_GENDERS.includes(n.gender)) {
            throw new Error(`nouns.json: word "${n.word}" has invalid gender "${n.gender}"`);
        }
        if (typeof n.level !== 'number' || n.level < 1) {
            throw new Error(`nouns.json: word "${n.word}" must have level >= 1`);
        }
        if (!Array.isArray(n.tags)) {
            throw new Error(`nouns.json: word "${n.word}" tags must be an array`);
        }
    });
}

validate(RAW_NOUNS);

// ─── Legacy sets, re-derived FROM the JSON ───────────────────────────────────
// The per-word fields are the single source of truth. These sets are a derived
// VIEW kept for the modules that still import them (sentences.ts, tests). No
// drift is possible — change a word's field, the set follows.

/** Animate nouns. Everything else is 'thing'; a miss only narrows which
 *  templates a noun can fill, never produces a wrong answer. */
export const PERSON_WORDS: Set<string> = new Set(
    RAW_NOUNS.filter(n => n.animacy === 'person').map(n => n.word),
);

/** Plural-only nouns — declension differs and is out of phase-1 scope. */
export const PLURAL_ONLY: Set<string> = new Set(
    RAW_NOUNS.filter(n => n.pluralOnly).map(n => n.word),
);

/** Weak masculine nouns (n-Deklination): add -n/-en outside the nominative
 *  singular (Junge → Jungen, Franzose → Franzosen). */
export const WEAK_MASCULINE: Set<string> = new Set(
    RAW_NOUNS.filter(n => n.weakMasculine).map(n => n.word),
);

/** Places you can go to / be in — fill two-way-preposition frames. */
export const PLACE_WORDS: Set<string> = new Set(
    RAW_NOUNS.filter(n => n.place).map(n => n.word),
);

/** The singular word → [plural form, pattern]. The plural string is the source
 *  of truth; the pattern drives decoy generation + the Tipp. Re-derived from the
 *  rows that carry plural data. */
export const PLURALS: Record<string, [string, PluralPattern]> = Object.fromEntries(
    RAW_NOUNS.filter((n): n is RawNoun & { plural: string; pluralPattern: PluralPattern } =>
        n.plural !== null && n.pluralPattern !== null,
    ).map(n => [n.word, [n.plural, n.pluralPattern]]),
);

// ─── Public API (unchanged signatures) ───────────────────────────────────────

export function generateItems(): PracticeItem[] {
    return RAW_NOUNS.map((n, index) => ({
        id: String(index),
        word: n.word,
        gender: n.gender,
        answer: articleForGender(n.gender),
        hint: n.hint,
        options: [...VALID_ARTICLES],
        category: n.category,
        animacy: n.animacy,
        pluralOnly: n.pluralOnly || undefined,
        isWeakMasculine: n.weakMasculine || undefined,
        isPlace: n.place || undefined,
        plural: n.plural ?? undefined,
        pluralPattern: n.pluralPattern ?? undefined,
        level: n.level,
        tags: n.tags,
        cefr: n.cefr ?? undefined,
        theme: n.theme ?? undefined,
        frequency: n.frequency ?? undefined,
        exampleSentence: n.exampleSentence ?? undefined,
    }));
}

/** All unique thematic categories, in first-seen order. */
export function getCategories(): string[] {
    const cats = new Set(RAW_NOUNS.map(n => n.category));
    return Array.from(cats);
}

export function shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
