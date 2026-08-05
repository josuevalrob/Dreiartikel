// The Vocabulary List — the player's personal word list, as described in the
// README's Table of elements. Words enter it from the Translator Support
// (Learning Score 0) and from the Challenge Game's top-ups; the Learning
// Algorithm (learning.ts, roadmap step 2) reads and updates the scores.
//
// Design mirrors the rest of the logic layer: everything here is PURE except
// the two thin localStorage wrappers at the bottom. The pure core
// (parse/serialize/add/update) is what vocabulary.test.ts exercises — no
// mocks, no jsdom, per repo convention. localStorage is the client-side
// stand-in for the README's `VocabularyList.json`; `serializeVocabulary` is
// also the JSON-file export.

import type { Gender } from './rules';

/** The three per-word characteristics the README tracks, each with its own
 *  Learning Score: the word itself (recognition), its gender, its plural. */
export type VocabAttribute = 'word' | 'gender' | 'plural';

export const VOCAB_ATTRIBUTES: VocabAttribute[] = ['word', 'gender', 'plural'];

/** Learning Score bounds: 0 = brand new, 100 = memorized. */
export const MIN_SCORE = 0;
export const MAX_SCORE = 100;

export interface VocabularyEntry {
    /** The German noun, capitalised, e.g. "Wurst". Unique key of the list. */
    word: string;
    /** Canonical gender — same source-of-truth rule as PracticeItem. */
    gender: Gender;
    /** Plural surface form, or null when the dataset hasn't curated one. */
    plural: string | null;
    /** One Learning Score per attribute, each in [0, 100]. */
    scores: Record<VocabAttribute, number>;
}

/** Clamp a Learning Score into [0, 100]. */
export function clampScore(score: number): number {
    return Math.max(MIN_SCORE, Math.min(MAX_SCORE, score));
}

/** A fresh entry: all Learning Scores start at 0 (a new word to learn). */
export function createEntry(word: string, gender: Gender, plural: string | null = null): VocabularyEntry {
    return {
        word,
        gender,
        plural,
        scores: { word: 0, gender: 0, plural: 0 },
    };
}

/** Add an entry to the list, returning a NEW list. Words are unique: if the
 *  word is already present the list is returned unchanged (a Translator lookup
 *  of a known word must not reset its scores). */
export function addWord(list: VocabularyEntry[], entry: VocabularyEntry): VocabularyEntry[] {
    if (list.some(e => e.word === entry.word)) return list;
    return [...list, entry];
}

/** Set one attribute's Learning Score on one word, clamped, returning a NEW
 *  list. Unknown words are a no-op — the caller may hold a stale selection. */
export function updateScore(
    list: VocabularyEntry[],
    word: string,
    attribute: VocabAttribute,
    score: number,
): VocabularyEntry[] {
    return list.map(e =>
        e.word === word
            ? { ...e, scores: { ...e.scores, [attribute]: clampScore(score) } }
            : e,
    );
}

// ─── (De)serialization — the pure half of persistence ───────────────────────

const GENDERS: Gender[] = ['m', 'f', 'n'];

/** True when a parsed value has the exact VocabularyEntry shape. */
function isValidEntry(e: unknown): e is VocabularyEntry {
    if (typeof e !== 'object' || e === null) return false;
    const o = e as Record<string, unknown>;
    if (typeof o.word !== 'string' || o.word.length === 0) return false;
    if (!GENDERS.includes(o.gender as Gender)) return false;
    if (o.plural !== null && typeof o.plural !== 'string') return false;
    const scores = o.scores as Record<string, unknown> | null;
    if (typeof scores !== 'object' || scores === null) return false;
    return VOCAB_ATTRIBUTES.every(a => {
        const s = scores[a];
        return typeof s === 'number' && s >= MIN_SCORE && s <= MAX_SCORE;
    });
}

/** Parse a stored JSON string into a vocabulary list. Corrupt or partial data
 *  degrades gracefully: invalid entries are dropped, garbage yields []. The
 *  player's list must never brick the app. */
export function parseVocabulary(json: string | null): VocabularyEntry[] {
    if (!json) return [];
    try {
        const parsed: unknown = JSON.parse(json);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isValidEntry);
    } catch {
        return [];
    }
}

/** Serialize the list — the storage format AND the `VocabularyList.json`
 *  export (pretty-printed so the exported file is human-readable). */
export function serializeVocabulary(list: VocabularyEntry[]): string {
    return JSON.stringify(list, null, 2);
}

// ─── localStorage wrappers — the only impure code in this module ────────────

const STORAGE_KEY = 'dreiartikel.vocabularyList';

/** Load the player's Vocabulary List. Missing key, corrupt data, or an
 *  environment without localStorage (tests, SSR) all yield []. */
export function loadVocabulary(): VocabularyEntry[] {
    try {
        return parseVocabulary(localStorage.getItem(STORAGE_KEY));
    } catch {
        return [];
    }
}

/** Persist the list. Failures (quota, private mode) are swallowed — the
 *  in-memory list keeps working for the session. */
export function saveVocabulary(list: VocabularyEntry[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, serializeVocabulary(list));
    } catch {
        // Non-fatal: persistence is best-effort.
    }
}