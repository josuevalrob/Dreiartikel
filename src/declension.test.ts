import { describe, it, expect } from 'vitest';
import { articleFor, optionsForCase, declineNoun, caseForSurface, type Case } from './declension';
import { articleForGender, type Gender } from './rules';

const GENDERS: Gender[] = ['m', 'f', 'n'];

describe('articleFor — definite article table', () => {
    it('returns the full singular table', () => {
        // case → { m, f, n }
        const expected: Record<Case, Record<Gender, string>> = {
            nom: { m: 'der', f: 'die', n: 'das' },
            akk: { m: 'den', f: 'die', n: 'das' },
            dat: { m: 'dem', f: 'der', n: 'dem' },
            gen: { m: 'des', f: 'der', n: 'des' },
        };
        for (const c of Object.keys(expected) as Case[]) {
            for (const g of GENDERS) {
                expect(articleFor(g, c, 'sg'), `${c}/${g}`).toBe(expected[c][g]);
            }
        }
    });

    it('returns the plural column', () => {
        expect(articleFor('m', 'nom', 'pl')).toBe('die');
        expect(articleFor('m', 'akk', 'pl')).toBe('die');
        expect(articleFor('m', 'dat', 'pl')).toBe('den');
        expect(articleFor('m', 'gen', 'pl')).toBe('der');
    });
});

describe('seam: articleForGender === articleFor(g, nom, sg)', () => {
    it('agrees for every gender', () => {
        for (const g of GENDERS) {
            expect(articleForGender(g)).toBe(articleFor(g, 'nom', 'sg'));
        }
    });
});

describe('optionsForCase', () => {
    it('akkusativ has 3 distinct forms', () => {
        expect(optionsForCase('akk').sort()).toEqual(['das', 'den', 'die']);
    });

    it('dativ collapses to exactly 2 forms (dem, der)', () => {
        expect(optionsForCase('dat').sort()).toEqual(['dem', 'der']);
    });

    it('always includes every gender’s correct answer for the case', () => {
        for (const c of ['nom', 'akk', 'dat', 'gen'] as Case[]) {
            const opts = optionsForCase(c);
            for (const g of GENDERS) {
                expect(opts, `${c}/${g}`).toContain(articleFor(g, c, 'sg'));
            }
        }
    });
});

describe('caseForSurface — reading the case off a surface article', () => {
    it('masculine is fully unambiguous (one case per article)', () => {
        expect(caseForSurface('m', 'der')).toBe('nom');
        expect(caseForSurface('m', 'den')).toBe('akk');
        expect(caseForSurface('m', 'dem')).toBe('dat');
        expect(caseForSurface('m', 'des')).toBe('gen');
    });

    it('feminine is ambiguous: die→[nom,akk], der→[dat,gen]', () => {
        expect(caseForSurface('f', 'die')).toEqual(['nom', 'akk']);
        expect(caseForSurface('f', 'der')).toEqual(['dat', 'gen']);
    });

    it('neuter: das→[nom,akk], dem→dat (unambiguous), des→gen', () => {
        expect(caseForSurface('n', 'das')).toEqual(['nom', 'akk']);
        expect(caseForSurface('n', 'dem')).toBe('dat');
        expect(caseForSurface('n', 'des')).toBe('gen');
    });

    it('plural (number-aware): den→dat, die→[nom,akk], der→gen', () => {
        // The number-aware key is what stops "den <plural>" being misread as
        // masculine accusative singular.
        expect(caseForSurface('pl', 'den')).toBe('dat');
        expect(caseForSurface('pl', 'die')).toEqual(['nom', 'akk']);
        expect(caseForSurface('pl', 'der')).toBe('gen');
    });

    it('returns null when the article never appears in that column', () => {
        expect(caseForSurface('m', 'die')).toBeNull();   // 'die' is never masculine
        expect(caseForSurface('f', 'dem')).toBeNull();   // 'dem' is never feminine
        expect(caseForSurface('n', 'den')).toBeNull();   // 'den' is never neuter
    });

    it('is a true inverse of articleFor for every cell', () => {
        const columns: (Gender | 'pl')[] = ['m', 'f', 'n', 'pl'];
        for (const col of columns) {
            for (const c of ['nom', 'akk', 'dat', 'gen'] as Case[]) {
                const article = col === 'pl' ? articleFor('m', c, 'pl') : articleFor(col, c, 'sg');
                const got = caseForSurface(col, article);
                const cases = Array.isArray(got) ? got : [got];
                expect(cases, `${col}/${article} should include ${c}`).toContain(c);
            }
        }
    });
});

describe('declineNoun (n-Deklination)', () => {
    it('leaves non-weak nouns unchanged in every case', () => {
        for (const c of ['nom', 'akk', 'dat', 'gen'] as Case[]) {
            expect(declineNoun('Hund', false, c)).toBe('Hund');
        }
    });

    it('adds -n to a weak noun ending in -e outside the nominative', () => {
        expect(declineNoun('Junge', true, 'nom')).toBe('Junge');   // nom unchanged
        expect(declineNoun('Junge', true, 'akk')).toBe('Jungen');
        expect(declineNoun('Junge', true, 'dat')).toBe('Jungen');
        expect(declineNoun('Franzose', true, 'dat')).toBe('Franzosen');
        expect(declineNoun('Name', true, 'akk')).toBe('Namen');
    });

    it('adds -en to a weak noun not ending in -e', () => {
        expect(declineNoun('Student', true, 'akk')).toBe('Studenten');
    });
});
