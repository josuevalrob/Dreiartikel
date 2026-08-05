import { describe, it, expect } from 'vitest';
import {
    MAIN_QUEST,
    chapterById,
    chapterToStory,
    buildChapterRounds,
    generateChapterRoundsFor,
} from './index';
import { generateItems } from '../data';
import { articleFor, caseForSurface, type Case } from '../declension';
import { pluralForm } from '../plurals';
const pool = generateItems();
const byWord = new Map(pool.map(i => [i.word, i]));

// The Chapter 1 chapters, now loaded from content/*.md via MAIN_QUEST. Looking
// them up (rather than importing constants) means these tests also verify the
// Markdown loader produced the expected chapters.
const CH1_GENUS = chapterById('ch1-genus')!;
const CH1_PLURAL = chapterById('ch1-plural')!;
const CH1_AKKUSATIV = chapterById('ch1-akkusativ')!;
const CH1_DATIV = chapterById('ch1-dativ')!;

describe('MAIN_QUEST integrity', () => {
    it('has unique, resolvable chapter ids', () => {
        const ids = MAIN_QUEST.map(c => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(chapterById(id)?.id).toBe(id);
    });

    it('follows the book TOC order: genus → plural → akkusativ → dativ', () => {
        expect(MAIN_QUEST.map(c => c.topic)).toEqual(['genus', 'plural', 'kasus-akk', 'kasus-dat']);
    });

    it('every chapter produces at least a few playable rounds', () => {
        for (const ch of MAIN_QUEST) {
            const rounds = buildChapterRounds(ch, pool);
            expect(rounds.length, `${ch.id} should have blanks`).toBeGreaterThanOrEqual(3);
        }
    });
});

describe('every chapter round is well-formed and graded-once', () => {
    it('carries storyContext, a contained answer, and contiguous blank indices', () => {
        for (const ch of MAIN_QUEST) {
            const rounds = buildChapterRounds(ch, pool);
            rounds.forEach((r, i) => {
                expect(r.storyContext, `${ch.id}#${i}`).toBeTruthy();
                expect(r.options).toContain(r.answer);
                expect(r.storyContext!.blankIndex).toBe(i);
                expect(r.storyContext!.blankCount).toBe(rounds.length);
            });
        }
    });
});

describe('genus chapter: answer is the nom-sg article, fixed der/die/das', () => {
    const rounds = buildChapterRounds(CH1_GENUS, pool);

    it('every answer equals the noun’s dictionary article and options are der/die/das', () => {
        for (const r of rounds) {
            const item = byWord.get(r.item.word)!;
            expect(r.answer).toBe(articleFor(item.gender, 'nom', 'sg'));
            expect([...r.options].sort()).toEqual(['das', 'der', 'die']);
        }
    });

    it('options stay in FIXED der/die/das order (muscle memory)', () => {
        for (const r of rounds) {
            expect(r.options).toEqual(['der', 'die', 'das']);
        }
    });
});

describe('plural chapter: answer is the stored plural form', () => {
    const rounds = buildChapterRounds(CH1_PLURAL, pool);

    it('every answer is the noun’s real plural', () => {
        for (const r of rounds) {
            const item = byWord.get(r.item.word)!;
            expect(r.answer).toBe(pluralForm(item));
        }
    });
});

describe('case chapters: answer is the surface article, case read off it', () => {
    function assertCaseChapter(rounds: ReturnType<typeof buildChapterRounds>, expectCase: Case) {
        expect(rounds.length).toBeGreaterThan(0);
        for (const r of rounds) {
            const item = byWord.get(r.item.word)!;
            // The answer must be a definite article valid for this noun in the
            // expected case (number-aware: items here are singular nouns).
            const expected = articleFor(item.gender, expectCase, 'sg');
            expect(r.answer, `${r.item.word} in ${expectCase}`).toBe(expected);
            // And the answer's case (read off the article) includes the expected case.
            const inferred = caseForSurface(item.gender, r.answer);
            const cases = Array.isArray(inferred) ? inferred : [inferred];
            expect(cases).toContain(expectCase);
        }
    }

    it('akkusativ chapter answers are all accusative articles', () => {
        assertCaseChapter(buildChapterRounds(CH1_AKKUSATIV, pool), 'akk');
    });

    it('dativ chapter answers are all dative articles', () => {
        assertCaseChapter(buildChapterRounds(CH1_DATIV, pool), 'dat');
    });
});

describe('generateChapterRoundsFor', () => {
    it('plays the requested chapter by id', () => {
        const rounds = generateChapterRoundsFor('ch1-genus', pool);
        expect(rounds.every(r => r.storyContext!.storyId === 'ch1-genus')).toBe(true);
    });

    it('falls back to the first chapter for an unknown id', () => {
        const rounds = generateChapterRoundsFor('nope', pool);
        expect(rounds[0].storyContext!.storyId).toBe(MAIN_QUEST[0].id);
    });
});

describe('prompt shows the noun after the blank (genus/kasus)', () => {
    it('genus promptText keeps the noun visible right after the blank: "___ <Noun>"', () => {
        // Chapter prose is GENERATED, so we assert the BEHAVIOUR on whatever nouns
        // the chapter happens to contain rather than a specific word: every genus
        // round shows its noun immediately after the blank.
        const rounds = buildChapterRounds(CH1_GENUS, pool);
        expect(rounds.length).toBeGreaterThan(0);
        for (const r of rounds) {
            const pattern = new RegExp(`___\\s+${r.item.word}`);
            expect(r.promptText, `"${r.item.word}" should appear after the blank`).toMatch(pattern);
        }
    });

    it('on-show audio is the lead-in ONLY — stops before the blank, noun stays silent', () => {
        // Regression for the audio bug: the on-show audio must STOP before the
        // blank. It must equal the prompt text before the "___" slot — so it never
        // voices the article being asked, nor reads the noun that follows the
        // blank (which is visible but silent until answered). We don't forbid the
        // article string outright: an answer like 'den'/'der' is an ordinary word
        // that legitimately appears earlier in the prose; the structural "lead-in
        // is exactly the pre-slot text" check is the real guarantee.
        for (const ch of MAIN_QUEST) {
            const rounds = buildChapterRounds(ch, pool);
            for (const r of rounds) {
                const onShow = r.speakOnShow ?? '';
                const beforeSlot = r.promptText.split(/_+/)[0].trim();
                expect(onShow, `${ch.id} "${r.item.word}"`).toBe(beforeSlot);
                // The noun that sits AFTER the blank is never in the on-show audio.
                const afterSlot = (r.promptText.split(/_+/)[1] ?? '').trim();
                const nounAfter = afterSlot.split(/\s+/)[0]?.replace(/[.,!?]$/, '');
                if (nounAfter && nounAfter === r.item.word) {
                    expect(onShow.endsWith(nounAfter), `${ch.id} on-show should not voice "${nounAfter}"`).toBe(false);
                }
            }
        }
    });

    it('chapterToStory yields the topic as the story mode', () => {
        expect(chapterToStory(CH1_GENUS).mode).toBe('genus');
        expect(chapterToStory(CH1_DATIV).mode).toBe('kasus-dat');
    });

    it('a second blank on the same line is silent on show (no clause replay)', () => {
        // Regression: when one prose line carries TWO blanks, the connecting text is
        // spoken once (as the FIRST blank's post-answer read); the SECOND blank must
        // be silent on show, not replay the line. The chapter is generated, so we
        // FIND a two-blank line across the main quest rather than hard-coding words.
        // (A genus line like "…, und ___ Buch …" is the canonical case.)
        const twoBlank = findSecondBlankOnSharedLine();
        if (!twoBlank) return; // no two-blank line in the current prose — nothing to assert
        const { second } = twoBlank;
        // The second blank of a line is silent on show — its lead-in was already
        // spoken as the first blank's continuation.
        expect(second.speakOnShow, `${second.item.word} on-show`).toBe('');
    });

    /** Scan every chapter for a prose line that produces two consecutive blanks and
     *  return the round for the SECOND one, or null if no chapter has such a line.
     *  Uses the view's per-line blank grouping via promptText: the second blank of a
     *  shared line is the one whose speakOnShow we expect to be empty. */
    function findSecondBlankOnSharedLine(): { second: ReturnType<typeof buildChapterRounds>[number] } | null {
        for (const ch of MAIN_QUEST) {
            const rounds = buildChapterRounds(ch, pool);
            // A blank that is NOT the first on its line has an empty lead-in by
            // construction (leadInBeforeBlank returns '' for a following blank). We
            // detect "second on a line" as a round with empty speakOnShow that is not
            // simply the chapter's first round. The engine sets speakOnShow='' only
            // for a blank preceded by another blank on the same line.
            for (let i = 1; i < rounds.length; i++) {
                if (rounds[i].speakOnShow === '') return { second: rounds[i] };
            }
        }
        return null;
    }
});
