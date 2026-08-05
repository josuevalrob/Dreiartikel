import { describe, it, expect } from 'vitest';
import { generateItems, getCategories, PERSON_WORDS, PLURAL_ONLY, WEAK_MASCULINE, PLACE_WORDS, PLURALS } from './data';
import { PLURAL_PATTERNS, applyPattern } from './plurals';
import type { Gender } from './rules';

// The dataset is hand-entered, so these guard against the most likely human
// errors: typos in the article, malformed entries, accidental duplicates.
describe('dataset integrity', () => {
    const items = generateItems();

    it('parses without throwing and is non-empty', () => {
        expect(items.length).toBeGreaterThan(0);
    });

    it('every entry has a word, a hint, a category and a valid gender', () => {
        for (const item of items) {
            expect(item.word, `entry ${item.id}`).toBeTruthy();
            expect(item.hint, `entry ${item.id} (${item.word})`).toBeTruthy();
            expect(item.category, `entry ${item.id} (${item.word})`).toBeTruthy();
            expect(['m', 'f', 'n'], `entry ${item.id} (${item.word})`).toContain(item.gender);
        }
    });

    it('words start with a capital letter (German nouns)', () => {
        for (const item of items) {
            const first = item.word[0];
            expect(first, `"${item.word}" should be capitalised`).toBe(first.toUpperCase());
        }
    });

    it('has no duplicate words', () => {
        const seen = new Map<string, string>();
        const duplicates: string[] = [];
        for (const item of items) {
            const prev = seen.get(item.word);
            if (prev && prev !== item.answer) {
                duplicates.push(`${item.word} (${prev} vs ${item.answer})`);
            } else if (prev) {
                duplicates.push(item.word);
            }
            seen.set(item.word, item.answer);
        }
        expect(duplicates, `duplicate words: ${duplicates.join(', ')}`).toEqual([]);
    });

    it('exposes every category used by an item', () => {
        const cats = new Set(getCategories());
        for (const item of items) {
            expect(cats, `category "${item.category}"`).toContain(item.category);
        }
    });

    it('every item has a valid animacy', () => {
        for (const item of items) {
            expect(['person', 'thing'], `entry ${item.id} (${item.word})`).toContain(item.animacy);
        }
    });
});

// The enrichment fields (level/tags + the story-generator fields) are hand-edited
// in nouns.json over time. Guard their shape so a bad row fails loudly here, not
// at runtime in a quest filter or the generator.
describe('enrichment fields', () => {
    const items = generateItems();

    it('every item has an integer level >= 1', () => {
        for (const item of items) {
            expect(Number.isInteger(item.level), `${item.word} level`).toBe(true);
            expect(item.level, `${item.word} level`).toBeGreaterThanOrEqual(1);
        }
    });

    it('every item has a tags array of non-empty strings', () => {
        for (const item of items) {
            expect(Array.isArray(item.tags), `${item.word} tags`).toBe(true);
            for (const tag of item.tags) {
                expect(typeof tag, `${item.word} tag`).toBe('string');
                expect(tag.length, `${item.word} empty tag`).toBeGreaterThan(0);
            }
        }
    });

    it('optional generator fields, when present, have the right type', () => {
        for (const item of items) {
            if (item.cefr !== undefined) expect(typeof item.cefr).toBe('string');
            if (item.theme !== undefined) expect(typeof item.theme).toBe('string');
            if (item.frequency !== undefined) expect(typeof item.frequency).toBe('number');
            if (item.exampleSentence !== undefined) expect(typeof item.exampleSentence).toBe('string');
        }
    });
});

// Guard the curated lexical sets against typos: a word listed there that doesn't
// exist in rawData is silently dead, so fail loudly.
describe('curated lexical sets', () => {
    const items = generateItems();
    const words = new Set(items.map(i => i.word));

    it('every PERSON_WORDS entry exists in the dataset', () => {
        const missing = [...PERSON_WORDS].filter(w => !words.has(w));
        expect(missing, `unknown person words: ${missing.join(', ')}`).toEqual([]);
    });

    it('every PLURAL_ONLY entry exists in the dataset', () => {
        const missing = [...PLURAL_ONLY].filter(w => !words.has(w));
        expect(missing, `unknown plural-only words: ${missing.join(', ')}`).toEqual([]);
    });

    it('every WEAK_MASCULINE entry exists and is masculine', () => {
        const byWord = new Map(items.map(i => [i.word, i]));
        for (const w of WEAK_MASCULINE) {
            const item = byWord.get(w);
            expect(item, `unknown weak-masculine word: ${w}`).toBeDefined();
            expect(item?.gender, `${w} should be masculine`).toBe('m');
            expect(item?.isWeakMasculine, `${w} should carry the flag`).toBe(true);
        }
    });

    it('every PLACE_WORDS entry exists and is flagged isPlace', () => {
        const byWord = new Map(items.map(i => [i.word, i]));
        for (const w of PLACE_WORDS) {
            const item = byWord.get(w);
            expect(item, `unknown place word: ${w}`).toBeDefined();
            expect(item?.isPlace, `${w} should carry isPlace`).toBe(true);
        }
    });

    it('has at least one place per gender so Wechsel rounds are answerable', () => {
        const byGender: Record<Gender, number> = { m: 0, f: 0, n: 0 };
        for (const item of items) {
            if (item.isPlace) byGender[item.gender]++;
        }
        for (const g of ['m', 'f', 'n'] as Gender[]) {
            expect(byGender[g], `no place noun for gender ${g}`).toBeGreaterThan(0);
        }
    });

    it('every PLURALS key exists in the dataset', () => {
        const missing = Object.keys(PLURALS).filter(w => !words.has(w));
        expect(missing, `unknown plural words: ${missing.join(', ')}`).toEqual([]);
    });

    it('every PLURALS entry carries a known pattern and a non-empty plural', () => {
        const valid = new Set([...PLURAL_PATTERNS, 'foreign']);
        for (const [word, [plural, pattern]] of Object.entries(PLURALS)) {
            expect(plural, `${word} plural must be non-empty`).toBeTruthy();
            expect(valid.has(pattern), `${word} has unknown pattern "${pattern}"`).toBe(true);
        }
    });

    it('regular (non-foreign) plurals match what the pattern derives — catches typos', () => {
        // foreign is exempt (its stem changes); every other pattern must reproduce
        // the stored plural exactly, so a mismatch flags either a wrong stored form
        // or a wrong pattern label.
        for (const [word, [plural, pattern]] of Object.entries(PLURALS)) {
            if (pattern === 'foreign') continue;
            expect(applyPattern(word, pattern), `${word} (${pattern})`).toBe(plural);
        }
    });

    it('generateItems wires plural data onto the matching items', () => {
        const byWord = new Map(items.map(i => [i.word, i]));
        for (const [word, [plural, pattern]] of Object.entries(PLURALS)) {
            const it = byWord.get(word);
            expect(it?.plural, `${word} should carry its plural`).toBe(plural);
            expect(it?.pluralPattern, `${word} should carry its pattern`).toBe(pattern);
        }
    });

    it('covers every regular plural pattern at least once', () => {
        const used = new Set(Object.values(PLURALS).map(([, p]) => p));
        for (const p of PLURAL_PATTERNS) {
            expect(used.has(p), `no curated noun uses pattern "${p}"`).toBe(true);
        }
    });

    it('has at least one person per gender so person-templates are satisfiable', () => {
        const byGender: Record<Gender, number> = { m: 0, f: 0, n: 0 };
        for (const item of items) {
            if (item.animacy === 'person' && !item.pluralOnly) byGender[item.gender]++;
        }
        for (const g of ['m', 'f', 'n'] as Gender[]) {
            expect(byGender[g], `no singular person noun for gender ${g}`).toBeGreaterThan(0);
        }
    });
});
