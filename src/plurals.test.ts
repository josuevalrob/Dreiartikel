import { describe, it, expect } from 'vitest';
import {
    applyPattern,
    pluralForm,
    hasPlural,
    makeDecoys,
    buildPluralRound,
    pickPluralRound,
    generatePluralRounds,
    buildByPlural,
    PLURAL_PATTERNS,
    type PluralPattern,
} from './plurals';
import { generateItems, type PracticeItem } from './data';

function item(partial: Partial<PracticeItem> & { word: string }): PracticeItem {
    return {
        id: partial.id ?? 't',
        word: partial.word,
        gender: partial.gender ?? 'm',
        answer: partial.answer ?? 'der',
        hint: partial.word,
        options: ['der', 'die', 'das'],
        category: 'Test',
        animacy: partial.animacy ?? 'thing',
        pluralOnly: partial.pluralOnly,
        plural: partial.plural,
        pluralPattern: partial.pluralPattern,
        level: partial.level ?? 1,
        tags: partial.tags ?? [],
    };
}

describe('applyPattern', () => {
    it('produces the textbook surface form for each pattern', () => {
        expect(applyPattern('Tag', 'e')).toBe('Tage');
        expect(applyPattern('Bart', 'umlaut-e')).toBe('Bärte');
        expect(applyPattern('Frau', 'en')).toBe('Frauen');
        expect(applyPattern('Fehler', 'none')).toBe('Fehler');
        expect(applyPattern('Apfel', 'umlaut')).toBe('Äpfel');
        expect(applyPattern('Lied', 'er')).toBe('Lieder');
        expect(applyPattern('Buch', 'umlaut-er')).toBe('Bücher');
        expect(applyPattern('Kino', 's')).toBe('Kinos');
    });

    it('umlauts the last back vowel (a→ä, o→ö, u→ü, au→äu)', () => {
        expect(applyPattern('Apfel', 'umlaut')).toBe('Äpfel');
        expect(applyPattern('Vogel', 'umlaut')).toBe('Vögel');
        expect(applyPattern('Mutter', 'umlaut')).toBe('Mütter');
        expect(applyPattern('Haus', 'umlaut-er')).toBe('Häuser'); // au → äu
    });

    it('-en becomes -n after -e/-el/-er and doubles n after -in', () => {
        expect(applyPattern('Blume', 'en')).toBe('Blumen');
        expect(applyPattern('Gabel', 'en')).toBe('Gabeln');
        expect(applyPattern('Freundin', 'en')).toBe('Freundinnen');
    });
});

describe('pluralForm', () => {
    it('uses the stored plural verbatim (the source of truth)', () => {
        const buch = item({ word: 'Buch', gender: 'n', answer: 'das', plural: 'Bücher', pluralPattern: 'umlaut-er' });
        expect(pluralForm(buch)).toBe('Bücher');
    });

    it('handles foreign plurals via stored data, not derivation', () => {
        const thema = item({ word: 'Thema', gender: 'n', answer: 'das', plural: 'Themen', pluralPattern: 'foreign' });
        expect(pluralForm(thema)).toBe('Themen'); // NOT "Themaen"
    });

    it('falls back to applying the pattern when no plural is stored', () => {
        const tag = item({ word: 'Tag', pluralPattern: 'e' });
        expect(pluralForm(tag)).toBe('Tage');
    });
});

describe('hasPlural', () => {
    it('is true only for nouns with plural data and not plural-only', () => {
        expect(hasPlural(item({ word: 'Buch', plural: 'Bücher', pluralPattern: 'umlaut-er' }))).toBe(true);
        expect(hasPlural(item({ word: 'Brot' }))).toBe(false); // no plural data
        expect(hasPlural(item({ word: 'Eltern', plural: 'Eltern', pluralPattern: 'none', pluralOnly: true }))).toBe(false);
    });
});

describe('makeDecoys', () => {
    const buch = item({ word: 'Buch', gender: 'n', answer: 'das', plural: 'Bücher', pluralPattern: 'umlaut-er' });

    it('never includes the correct answer', () => {
        for (let i = 0; i < 50; i++) {
            expect(makeDecoys(buch, 3)).not.toContain('Bücher');
        }
    });

    it('returns the requested number of DISTINCT decoys', () => {
        const decoys = makeDecoys(buch, 3);
        expect(decoys.length).toBe(3);
        expect(new Set(decoys).size).toBe(3);
    });

    it('produces distinct decoys even for a noun whose patterns collide', () => {
        // "Kino" → Kinos. Several patterns yield believable look-alikes.
        const kino = item({ word: 'Kino', gender: 'n', answer: 'das', plural: 'Kinos', pluralPattern: 's' });
        const decoys = makeDecoys(kino, 3);
        expect(decoys.length).toBe(3);
        expect(new Set([...decoys, 'Kinos']).size).toBe(4); // all distinct incl. answer
    });
});

describe('buildPluralRound', () => {
    const buch = item({ word: 'Buch', gender: 'n', answer: 'das', plural: 'Bücher', pluralPattern: 'umlaut-er' });

    it('shows the singular with its article and answers with the plural', () => {
        const r = buildPluralRound(buch);
        expect(r.promptText).toBe('das Buch');
        expect(r.answer).toBe('Bücher');
        expect(r.spokenText).toBe('das Buch — die Bücher');
    });

    it('options always contain the answer and are all distinct', () => {
        for (let i = 0; i < 50; i++) {
            const r = buildPluralRound(buch);
            expect(r.options).toContain('Bücher');
            expect(new Set(r.options).size).toBe(r.options.length);
        }
    });

    it('defaults to 3 options (1 answer + 2 decoys) — keeps the ← ↓ → loop', () => {
        expect(buildPluralRound(buch).options.length).toBe(3);
    });

    it('hints name the pattern and gender but NEVER the plural form', () => {
        const r = buildPluralRound(buch);
        const ruleHint = r.hints.find(h => h.kind === 'plural')!;
        const genderHintText = r.hints.find(h => h.kind === 'gender')!.text;
        expect(ruleHint.text).not.toContain('Bücher');
        expect(genderHintText).toMatch(/neuter/);
        expect(genderHintText).toContain('Buch');
        // The whole point: no hint leaks the answer.
        for (const h of r.hints) {
            expect(h.text).not.toContain(r.answer);
        }
    });
});

describe('pickPluralRound / generatePluralRounds', () => {
    const pool = [
        item({ word: 'Buch', gender: 'n', answer: 'das', plural: 'Bücher', pluralPattern: 'umlaut-er' }),
        item({ word: 'Tag', plural: 'Tage', pluralPattern: 'e' }),
        item({ word: 'Brot' }), // no plural data — excluded
    ];

    it('only ever picks nouns that have plural data', () => {
        for (let i = 0; i < 100; i++) {
            const r = pickPluralRound(pool);
            expect(r).not.toBeNull();
            expect(['Buch', 'Tag']).toContain(r!.item.word);
        }
    });

    it('returns null for a pool with no plural data', () => {
        expect(pickPluralRound([item({ word: 'Brot' })])).toBeNull();
    });

    it('generates one round per eligible noun', () => {
        expect(generatePluralRounds(pool).length).toBe(2);
    });
});

describe('pattern table', () => {
    it('lists exactly the eight regular shapes (foreign is stored, not generated)', () => {
        const expected: PluralPattern[] = ['e', 'umlaut-e', 'en', 'none', 'umlaut', 'er', 'umlaut-er', 's'];
        expect([...PLURAL_PATTERNS].sort()).toEqual([...expected].sort());
    });
});

describe('buildByPlural (reverse plural index for the chapter parser)', () => {
    const byPlural = buildByPlural();

    it('maps a known plural surface form back to its base item', () => {
        // Buch → Bücher; the parser must recover Buch from "die Bücher".
        expect(byPlural.get('Bücher')?.word).toBe('Buch');
    });

    it('every entry round-trips: the key is the item’s own plural form', () => {
        for (const [form, item] of byPlural) {
            expect(pluralForm(item)).toBe(form);
        }
    });

    it('contains exactly the dataset’s plural-capable nouns', () => {
        const eligible = generateItems().filter(hasPlural);
        // Map size ≤ eligible count (collisions collapse), and never larger.
        expect(byPlural.size).toBeGreaterThan(0);
        expect(byPlural.size).toBeLessThanOrEqual(eligible.length);
        // Every eligible noun's plural form is resolvable.
        for (const it of eligible) {
            expect(byPlural.has(pluralForm(it))).toBe(true);
        }
    });

    it('does not index plural-only nouns (no singular to drill)', () => {
        const pluralOnly = generateItems().filter(i => i.pluralOnly);
        for (const it of pluralOnly) {
            // Its surface form may exist via another noun, but never points back
            // to the plural-only item itself.
            const hit = byPlural.get(it.word);
            expect(hit?.word).not.toBe(it.word);
        }
    });
});
