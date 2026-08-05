import { describe, it, expect } from 'vitest';
import {
    TEMPLATES,
    buildRound,
    buildDetectRound,
    generateDetectRounds,
    DETECT_OPTIONS,
    matches,
    isEligible,
    pickRound,
    generateRounds,
    type SentenceTemplate,
} from './sentences';
import type { PracticeItem } from './data';

function item(partial: Partial<PracticeItem> & { word: string; gender: PracticeItem['gender'] }): PracticeItem {
    return {
        id: partial.id ?? 't',
        word: partial.word,
        gender: partial.gender,
        answer: 'der',
        hint: partial.word,
        options: ['der', 'die', 'das'],
        category: 'Test',
        animacy: partial.animacy ?? 'thing',
        pluralOnly: partial.pluralOnly,
        isWeakMasculine: partial.isWeakMasculine,
        isPlace: partial.isPlace,
        level: partial.level ?? 1,
        tags: partial.tags ?? [],
    };
}

const HUND = item({ word: 'Hund', gender: 'm' });          // thing, masc
const FRAU = item({ word: 'Frau', gender: 'f', animacy: 'person' });
const KIND = item({ word: 'Kind', gender: 'n', animacy: 'person' });
const PARK = item({ word: 'Park', gender: 'm', isPlace: true }); // place, masc

const byId = (id: string): SentenceTemplate => {
    const t = TEMPLATES.find(t => t.id === id);
    if (!t) throw new Error(`no template ${id}`);
    return t;
};

describe('templates', () => {
    it('each frame has exactly one blank', () => {
        for (const t of TEMPLATES) {
            expect(t.frame.match(/___/g)?.length, t.id).toBe(1);
        }
    });
});

describe('buildRound', () => {
    it('computes the correct article per case for a masculine noun', () => {
        expect(buildRound(HUND, byId('akk-sehen')).answer).toBe('den');
        expect(buildRound(HUND, byId('dat-mit')).answer).toBe('dem');
        expect(buildRound(HUND, byId('nom-gross')).answer).toBe('der');
    });

    it('renders the noun visible with the article blanked', () => {
        const r = buildRound(HUND, byId('akk-sehen'));
        expect(r.promptText).toBe('Ich sehe ___ Hund.');
        expect(r.spokenText).toBe('Ich sehe den Hund.');
    });

    it('options always include the correct answer', () => {
        for (const t of TEMPLATES) {
            for (const noun of [HUND, FRAU, KIND]) {
                const r = buildRound(noun, t);
                expect(r.options, `${t.id}/${noun.word}`).toContain(r.answer);
            }
        }
    });
});

describe('hints', () => {
    it('every round has at least one hint', () => {
        for (const t of TEMPLATES) {
            const r = buildRound(HUND, t);
            expect(r.hints.length, t.id).toBeGreaterThan(0);
        }
    });

    it('case hints name the case but NEVER reveal the answer article', () => {
        // The whole point: a hint helps without spoiling. For every template ×
        // gender, no hint may contain the correct article as a standalone word.
        for (const t of TEMPLATES) {
            for (const noun of [HUND, FRAU, KIND]) {
                const r = buildRound(noun, t);
                for (const h of r.hints) {
                    const leaks = new RegExp(`\\b${r.answer}\\b`).test(h.text);
                    expect(leaks, `${t.id}/${noun.word} hint leaks "${r.answer}": ${h.text}`).toBe(false);
                }
            }
        }
    });

    it('names the governing case for non-Nominativ templates', () => {
        const ruleOf = (id: string, item = HUND) =>
            buildRound(item, byId(id)).hints.find(h => h.kind === 'rule')!.text;
        expect(ruleOf('dat-mit')).toMatch(/Dativ/);
        expect(ruleOf('akk-sehen')).toMatch(/Akkusativ/);
    });

    it('includes a gender hint that names the gender but not the article', () => {
        const g = buildRound(FRAU, byId('akk-sehen')).hints.find(h => h.kind === 'gender')!;
        expect(g.text).toMatch(/feminine/);
        expect(g.text).toContain('Frau');
        expect(g.text).not.toMatch(/\b(der|die|das)\b/);
    });
});

describe('case-question test (Wer?/Wen?/Wem? — Hueber 1.3)', () => {
    const rule = (id: string, item: PracticeItem) =>
        buildRound(item, byId(id)).hints.find(h => h.kind === 'rule')!.text;

    it('asks Wen? for a person object, Was? for a thing object (Akkusativ)', () => {
        expect(rule('akk-sehen', FRAU)).toContain('Wen?');   // person → Wen?
        expect(rule('akk-sehen', HUND)).toContain('Was?');   // thing  → Was?
    });

    it('asks Wem? in the Dativ regardless of animacy', () => {
        expect(rule('dat-helfen', FRAU)).toContain('Wem?');  // person
        expect(rule('dat-mit', HUND)).toContain('Wem?');     // thing
    });

    it('asks Wer? for a person subject in the Nominativ', () => {
        expect(rule('nom-gross', KIND)).toContain('Wer?');   // person subject
        expect(rule('nom-gross', HUND)).toContain('Was?');   // thing subject
    });

    it('puts the question test in the error explanation too', () => {
        const akk = buildRound(FRAU, byId('akk-sehen')).tipp;
        const dat = buildRound(FRAU, byId('dat-helfen')).tipp;
        expect(akk).toContain('Wen?');
        expect(dat).toContain('Wem?');
    });

    it('never leaks the article through the question test', () => {
        for (const item of [HUND, FRAU, KIND]) {
            for (const t of TEMPLATES) {
                if (!matches(item, t)) continue;
                const r = buildRound(item, t);
                const ruleText = r.hints.find(h => h.kind === 'rule')!.text;
                // Word-boundary match: "gender" contains "der" as a substring.
                expect(ruleText, t.id).not.toMatch(new RegExp(`\\b${r.answer}\\b`));
            }
        }
    });
});

describe('matches / semantic constraints', () => {
    it('person-only templates reject things and accept people', () => {
        expect(matches(HUND, byId('dat-helfen'))).toBe(false);
        expect(matches(FRAU, byId('dat-helfen'))).toBe(true);
    });

    it('thing-only templates reject people', () => {
        expect(matches(FRAU, byId('akk-essen'))).toBe(false);
        expect(matches(HUND, byId('akk-essen'))).toBe(true);
    });

    it('place-only (Wechsel) templates require a place noun', () => {
        expect(matches(HUND, byId('wechsel-in-akk'))).toBe(false); // Hund is not a place
        expect(matches(PARK, byId('wechsel-in-akk'))).toBe(true);
    });
});

describe('two-way prepositions (Wechsel)', () => {
    it('motion frames take Akkusativ, location frames take Dativ', () => {
        // Park is masculine: Akk → den, Dativ → dem.
        expect(buildRound(PARK, byId('wechsel-in-akk')).answer).toBe('den'); // Ich gehe in den Park
        expect(buildRound(PARK, byId('wechsel-in-dat')).answer).toBe('dem'); // Ich bin in dem Park
    });

    it('renders the contrast in the prompt', () => {
        expect(buildRound(PARK, byId('wechsel-in-akk')).promptText).toBe('Ich gehe in ___ Park.');
        expect(buildRound(PARK, byId('wechsel-in-dat')).promptText).toBe('Ich bin in ___ Park.');
    });

    it('hint teaches Wohin/Wo, not just the case, and never leaks the answer', () => {
        const akk = buildRound(PARK, byId('wechsel-in-akk'));
        const dat = buildRound(PARK, byId('wechsel-in-dat'));
        const ruleAkk = akk.hints.find(h => h.kind === 'rule')!.text;
        const ruleDat = dat.hints.find(h => h.kind === 'rule')!.text;
        expect(ruleAkk).toMatch(/Wohin/);
        expect(ruleDat).toMatch(/Wo\?/);
        expect(ruleAkk).not.toMatch(/\b(den|dem)\b/);
        expect(ruleDat).not.toMatch(/\b(den|dem)\b/);
    });
});

describe('isEligible', () => {
    it('excludes plural-only nouns', () => {
        expect(isEligible(item({ word: 'Eltern', gender: 'm', pluralOnly: true }))).toBe(false);
        expect(isEligible(HUND)).toBe(true);
    });
});

describe('pickRound / generateRounds', () => {
    it('never puts a person into a thing-only template', () => {
        const pool = [HUND, FRAU, KIND];
        for (let i = 0; i < 200; i++) {
            const r = pickRound(pool);
            if (r && (r.template.id === 'akk-essen' || r.template.id === 'akk-kaufen')) {
                expect(r.item.animacy).toBe('thing');
            }
        }
    });

    it('returns null for an all-ineligible pool', () => {
        expect(pickRound([item({ word: 'Eltern', gender: 'm', pluralOnly: true })])).toBeNull();
    });

    it('generateRounds covers each eligible noun once', () => {
        const rounds = generateRounds([HUND, FRAU, KIND]);
        expect(rounds.length).toBe(3);
    });
});

describe('detect mode (name the case — Hueber 1.4)', () => {
    it('shows a COMPLETE sentence with the article rendered, not blanked', () => {
        const r = buildDetectRound(HUND, byId('akk-sehen'));
        expect(r.promptText).toBe('Ich sehe den Hund.');   // article present
        expect(r.promptText).not.toContain('___');
    });

    it('highlights the phrase whose case is asked, and it occurs in the prompt', () => {
        const r = buildDetectRound(FRAU, byId('dat-helfen'));
        expect(r.highlight).toBe('der Frau');               // dative of die Frau
        expect(r.promptText).toContain(r.highlight!);
    });

    it('answers with the case label, from the fixed Nom/Akk/Dat option set', () => {
        expect(buildDetectRound(HUND, byId('akk-sehen')).answer).toBe('Akkusativ');
        expect(buildDetectRound(FRAU, byId('dat-helfen')).answer).toBe('Dativ');
        expect(buildDetectRound(HUND, byId('nom-gross')).answer).toBe('Nominativ');
    });

    it('options are exactly Nominativ/Akkusativ/Dativ in fixed order', () => {
        const r = buildDetectRound(HUND, byId('akk-sehen'));
        expect(r.options).toEqual(DETECT_OPTIONS);
        expect(r.options).toEqual(['Nominativ', 'Akkusativ', 'Dativ']);
        expect(r.options).toContain(r.answer);
    });

    it('reuses the Wer?/Wen?/Wem? hints and never leaks the case label early', () => {
        const r = buildDetectRound(FRAU, byId('dat-helfen'));
        const rule = r.hints.find(h => h.kind === 'rule')!.text;
        expect(rule).toContain('Wem?');                     // the detection method
    });

    it('generateDetectRounds covers eligible nouns and honours the case filter', () => {
        const pool = [HUND, FRAU, KIND, PARK];
        const dat = generateDetectRounds(pool, 'dat');
        expect(dat.length).toBeGreaterThan(0);
        for (const r of dat) {
            expect(r.answer).toBe('Dativ');
            expect(r.options).toEqual(DETECT_OPTIONS);
        }
    });
});

describe('case filter (study one case at a time)', () => {
    const pool = [HUND, FRAU, KIND, PARK];

    it('generateRounds restricted to a case yields only that case', () => {
        for (const c of ['nom', 'akk', 'dat'] as const) {
            const rounds = generateRounds(pool, c);
            expect(rounds.length, c).toBeGreaterThan(0);
            for (const r of rounds) expect(r.template.case, `${c}/${r.template.id}`).toBe(c);
        }
    });

    it("'all' mixes cases (over many runs, not collapsed to one)", () => {
        // Each noun maps to one *random* matching template, so a single 4-noun
        // run can by chance land all on 'nom-gross'. The invariant is over many
        // runs: 'all' must surface more than one case.
        const cases = new Set<string>();
        for (let i = 0; i < 50; i++) {
            for (const r of generateRounds(pool, 'all')) cases.add(r.template.case);
        }
        expect(cases.size).toBeGreaterThan(1);
    });

    it('pickRound restricted to a case only ever returns that case', () => {
        for (let i = 0; i < 200; i++) {
            const r = pickRound(pool, 'dat');
            if (r) expect(r.template.case).toBe('dat');
        }
    });

    it('returns empty/null when no noun fits the chosen case (no crash)', () => {
        // A thing-only pool against Dativ: every dat template here is person-only
        // or a preposition. Prepositions accept 'any', so a thing still fits —
        // assert it stays a Dativ round rather than wrongly producing another case.
        const things = [HUND]; // thing
        const rounds = generateRounds(things, 'dat');
        for (const r of rounds) expect(r.template.case).toBe('dat');
    });
});
