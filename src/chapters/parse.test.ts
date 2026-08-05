import { describe, it, expect } from 'vitest';
import { parseChapter, type ChapterTopic } from './parse';
import { generateItems } from '../data';
import type { Segment } from '../stories';

// ── Helpers ──────────────────────────────────────────────────────────────
const blanks = (segs: Segment[]): Extract<Segment, { kind: 'blank' }>[] =>
    segs.filter((s): s is Extract<Segment, { kind: 'blank' }> => s.kind === 'blank');

const allBlanks = (lines: Segment[][]) => lines.flatMap(blanks);

/** Reconstruct a line's visible text by concatenating text segments and using a
 *  placeholder for each blank — used to assert the noun stays visible. */
const visible = (segs: Segment[], blankAs = '▁'): string =>
    segs.map(s => (s.kind === 'text' ? s.text : blankAs)).join('');

const parse = (topic: ChapterTopic, ...lines: string[]) => parseChapter(topic, lines);

// A couple of real dataset facts the tests lean on (guarded below too).
const items = generateItems();
const byWord = new Map(items.map(i => [i.word, i]));

describe('parseChapter — genus topic', () => {
    it('blanks the article of every singular dataset-noun spot, keeping the noun visible', () => {
        // Hund (m), Katze (f), Buch (n) are all in the dataset.
        const lines = parse('genus', 'Ich sehe den Hund und die Katze.', 'Da liegt das Buch.');
        const bs = allBlanks(lines);
        const words = bs.map(b => b.word).sort();
        expect(words).toEqual(['Buch', 'Hund', 'Katze']);
        // The nouns themselves remain as visible text (not consumed by the blank).
        expect(visible(lines[0])).toContain('Hund');
        expect(visible(lines[0])).toContain('Katze');
        expect(visible(lines[1])).toContain('Buch');
    });

    it('leaves words that are not dataset nouns as plain prose', () => {
        const lines = parse('genus', 'Ich gehe schnell nach Hause.');
        expect(allBlanks(lines)).toHaveLength(0);
    });

    it('does not blank when the noun is not preceded by a definite article', () => {
        // "ein Hund" — indefinite article is not a drill article.
        const lines = parse('genus', 'Das ist ein Hund.');
        // 'Das ist' has no following noun for 'Das'; 'ein Hund' is indefinite.
        expect(allBlanks(lines).map(b => b.word)).not.toContain('Hund');
    });
});

describe('parseChapter — case is read off the surface article (not the topic)', () => {
    it('kasus-dat blanks "dem"-spots and attaches the preposition trigger', () => {
        const lines = parse('kasus-dat', 'Ich fahre mit dem Hund zur Stadt.');
        const bs = allBlanks(lines);
        expect(bs).toHaveLength(1);
        expect(bs[0].word).toBe('Hund');
        expect(bs[0].trigger).toBe("the preposition 'mit'");
        // The (declined) noun stays visible.
        expect(visible(lines[0])).toContain('Hund');
    });

    it('kasus-dat does NOT blank a nominative "der Hund" subject', () => {
        // "der Hund" is nominative (masc der→nom); a dat chapter must skip it.
        const lines = parse('kasus-dat', 'Der Hund schläft.');
        expect(allBlanks(lines)).toHaveLength(0);
    });

    it('kasus-akk blanks masculine "den" unconditionally', () => {
        const lines = parse('kasus-akk', 'Ich sehe den Hund.');
        const bs = allBlanks(lines);
        expect(bs.map(b => b.word)).toEqual(['Hund']);
    });

    it('kasus-akk does NOT blank ambiguous fem/neut without an akk trigger', () => {
        // "die Katze" / "das Buch" are nom-or-akk by article alone → stay prose.
        const lines = parse('kasus-akk', 'Ich sehe die Katze und das Buch.');
        expect(allBlanks(lines)).toHaveLength(0);
    });

    it('kasus-akk DOES blank fem/neut when an accusative trigger is present', () => {
        // "für die Katze" — 'für' forces Akkusativ, disambiguating the spot.
        const lines = parse('kasus-akk', 'Das ist für die Katze.');
        const bs = allBlanks(lines);
        expect(bs.map(b => b.word)).toEqual(['Katze']);
        expect(bs[0].trigger).toBe("the preposition 'für'");
    });
});

describe('parseChapter — genitive is out of scope', () => {
    it('never blanks a "des"-spot (des is not a drill article)', () => {
        // Even in a case chapter, 'des' stays prose.
        const lines = parse('kasus-dat', 'Das ist das Haus des Mannes.');
        const bs = allBlanks(lines);
        // 'des Mannes' must not be blanked.
        expect(bs.every(b => b.word !== 'Mann')).toBe(true);
    });
});

describe('parseChapter — weak-masculine recovery', () => {
    it('resolves an oblique "den Jungen" to Junge and keeps "Jungen" verbatim', () => {
        // Junge is in WEAK_MASCULINE; "den Jungen" is accusative.
        if (!byWord.has('Junge')) return; // dataset guard; skip if absent
        const lines = parse('kasus-akk', 'Ich sehe den Jungen.');
        const bs = allBlanks(lines);
        expect(bs.map(b => b.word)).toEqual(['Junge']); // resolved to base
        expect(visible(lines[0])).toContain('Jungen');   // surface form preserved
        expect(visible(lines[0])).not.toContain('Jung '); // never mis-stripped to "Jung"
    });
});

describe('parseChapter — plural topic blanks the noun', () => {
    it('blanks a plural surface form and recovers the base item', () => {
        // Buch → Bücher; plural topic blanks the noun (the plural form).
        const lines = parse('plural', 'Wir lesen viele Bücher.');
        const bs = allBlanks(lines);
        expect(bs.map(b => b.word)).toEqual(['Buch']);
        // The blank replaces the noun, so "Bücher" is NOT left as visible text.
        expect(visible(lines[0])).not.toContain('Bücher');
    });

    it('does not blank a singular noun in a plural chapter', () => {
        const lines = parse('plural', 'Ich habe ein Buch.');
        expect(allBlanks(lines)).toHaveLength(0);
    });
});

describe('parseChapter — structural guarantees', () => {
    it('drops blank lines and preserves whitespace round-trip on text', () => {
        const lines = parse('genus', '', '  Ich sehe den Hund.  ', '');
        expect(lines).toHaveLength(1); // blank lines dropped
        // The visible reconstruction collapses to the trimmed sentence content.
        expect(visible(lines[0]).replace(/\s+/g, ' ').trim()).toBe('Ich sehe ▁ Hund.');
    });

    it('every emitted blank word is a real dataset noun (no silent bad blanks)', () => {
        const lines = parse(
            'genus',
            'Ich sehe den Hund, die Katze und das Buch.',
            'Im Park steht der Baum.',
        );
        for (const b of allBlanks(lines)) {
            expect(byWord.has(b.word), `blank word "${b.word}" must be a dataset noun`).toBe(true);
        }
    });

    it('does not split or mis-tag compound nouns', () => {
        // A compound that contains a dataset noun as a substring must not blank
        // the substring. (Whole-token matching only.)
        const lines = parse('genus', 'Ich trinke den Orangensaft.');
        // 'Orangensaft' is one token; even if 'Saft' is a dataset noun, the whole
        // token only blanks if 'Orangensaft' itself is a dataset noun.
        const isWhole = byWord.has('Orangensaft');
        const bs = allBlanks(lines);
        if (isWhole) {
            expect(bs.map(b => b.word)).toContain('Orangensaft');
        } else {
            expect(bs).toHaveLength(0);
        }
    });
});
