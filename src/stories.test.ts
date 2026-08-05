import { describe, it, expect } from 'vitest';
import { STORIES, buildStoryRounds, generateStoryRounds, generateStoryRoundsFor } from './stories';
import { generateItems, type PracticeItem } from './data';
import { pluralForm, hasPlural } from './plurals';
import { articleFor } from './declension';
import type { PracticeRound } from './round';

// Story mode is a narrative wrapper over the practice engine: each blank in a
// stored letter becomes ONE PracticeRound and the surrounding text rides along
// as `storyContext`. What a blank asks depends on the story's MODE:
//   - 'plural' stories  → the answer is the noun's plural ("Bücher"), 3 options.
//   - 'dativ' stories   → the answer is the Dativ article ('dem'/'der'), and the
//                          declined noun is shown as text after the blank. Dative
//                          has only TWO distinct definite forms, so 2 options.
// These guards protect the two failure modes hand-entered story data invites: a
// blank word that doesn't exist (or has no plural — unanswerable), and a
// prompt/hint that leaks the answer before the learner picks it.

const items = generateItems();
const byWord = new Map(items.map(i => [i.word, i]));

/** A story's grammar mode, by id (rounds carry only the id in storyContext). */
function modeForStory(storyId: string): Story['mode'] {
    const story = STORIES.find(s => s.id === storyId);
    if (!story) throw new Error(`unknown story id "${storyId}"`);
    return story.mode;
}

type Story = (typeof STORIES)[number];

/** The string that should fill a blank, given the item and the story's mode:
 *  the plural form for plural stories, the Dativ article for dativ stories. */
function expectedAnswer(item: PracticeItem, mode: Story['mode']): string {
    return mode === 'dativ' ? articleFor(item.gender, 'dat', 'sg') : pluralForm(item);
}

/** The option count a mode produces: 3 for plurals (1 answer + 2 decoys); 2 for
 *  Dativ (only 'dem'/'der' are distinct definite forms in the dative singular). */
function expectedOptionCount(mode: Story['mode']): number {
    return mode === 'dativ' ? 2 : 3;
}

/** Every blank word across all stories, in reading order, with its story id. */
function allBlankWords(): { storyId: string; word: string }[] {
    const out: { storyId: string; word: string }[] = [];
    for (const story of STORIES) {
        for (const line of story.lines) {
            for (const seg of line) {
                if (seg.kind === 'blank') out.push({ storyId: story.id, word: seg.word });
            }
        }
    }
    return out;
}

const TOTAL_BLANKS = allBlankWords().length;

// 1. Data integrity per story — the typo-guard, mirroring data.test.ts's curated
//    set checks: a blank word must exist AND be answerable (have a plural).
describe('story data integrity', () => {
    it('exposes at least one story', () => {
        expect(STORIES.length).toBeGreaterThan(0);
    });

    for (const story of STORIES) {
        describe(`"${story.id}"`, () => {
            it('has at least one blank segment', () => {
                const blanks = story.lines
                    .flat()
                    .filter(seg => seg.kind === 'blank');
                expect(blanks.length, `${story.id} has no blanks`).toBeGreaterThan(0);
            });

            it('every blank word exists in the dataset and has a plural', () => {
                for (const line of story.lines) {
                    for (const seg of line) {
                        if (seg.kind !== 'blank') continue;
                        const item = byWord.get(seg.word);
                        expect(item, `${story.id}: unknown blank word "${seg.word}"`).toBeDefined();
                        expect(
                            hasPlural(item as PracticeItem),
                            `${story.id}: blank "${seg.word}" has no plural (unanswerable)`,
                        ).toBe(true);
                    }
                }
            });
        });
    }
});

// 2. Generator output — one answerable round per blank, with stable options.
describe('generateStoryRounds', () => {
    const rounds = generateStoryRounds(items);

    it('returns one round per blank across all stories', () => {
        expect(rounds.length).toBe(TOTAL_BLANKS);
    });

    it('every round answers with the plural (or Dativ article) of its blank word', () => {
        const blanks = allBlankWords();
        for (let i = 0; i < rounds.length; i++) {
            const r = rounds[i];
            const mode = modeForStory(blanks[i].storyId);
            const expectedItem = byWord.get(blanks[i].word) as PracticeItem;
            expect(
                r.answer,
                `round ${i} (${blanks[i].storyId}/${blanks[i].word}) answer`,
            ).toBe(expectedAnswer(expectedItem, mode));
            // For Dativ rounds, the article is one of the two distinct forms.
            if (mode === 'dativ') {
                expect(
                    ['dem', 'der'],
                    `round ${i} dativ article must be dem/der`,
                ).toContain(r.answer);
            }
            // The round's own item must be the right noun too.
            expect(r.item.word, `round ${i} item`).toBe(blanks[i].word);
        }
    });

    it('every round has all-distinct options including the answer (3 plural / 2 dativ)', () => {
        const blanks = allBlankWords();
        for (let i = 0; i < rounds.length; i++) {
            const r = rounds[i];
            const mode = modeForStory(blanks[i].storyId);
            expect(r.options, `round ${i} options must include answer`).toContain(r.answer);
            expect(new Set(r.options).size, `round ${i} distinct options`).toBe(r.options.length);
            expect(
                r.options.length,
                `round ${i} (${mode}) option count`,
            ).toBe(expectedOptionCount(mode));
        }
    });

    it('every round carries a storyContext', () => {
        for (let i = 0; i < rounds.length; i++) {
            expect(rounds[i].storyContext, `round ${i} storyContext`).toBeDefined();
        }
    });

    // The mode ignores the pool filter (a story is a fixed text), so even an
    // empty pool yields the full, answerable story.
    it('ignores the pool — an empty pool still plays the whole story', () => {
        const fromEmpty = generateStoryRounds([]);
        expect(fromEmpty.length).toBe(TOTAL_BLANKS);
        for (const r of fromEmpty) {
            expect(r.options).toContain(r.answer);
        }
    });
});

// 2b. Dativ-mode specifics — the second story drills the Dativ article, which
//     decouples it from the plural machinery: the answer is 'dem'/'der', options
//     are the two distinct dative forms, and the declined noun is rendered after
//     the blank. Asserted on the dativ story in isolation for clarity.
describe('dativ story mode', () => {
    const dativStories = STORIES.filter(s => s.mode === 'dativ');

    it('has at least one dativ story to exercise the case fork', () => {
        expect(dativStories.length, 'expected a dativ story').toBeGreaterThan(0);
    });

    for (const story of dativStories) {
        describe(`"${story.id}"`, () => {
            const rounds: PracticeRound[] = generateStoryRoundsFor(story.id, items);

            it('every blank\'s answer is the Dativ article dem or der', () => {
                expect(rounds.length, 'expected dativ rounds').toBeGreaterThan(0);
                for (let i = 0; i < rounds.length; i++) {
                    const r = rounds[i];
                    expect(
                        ['dem', 'der'],
                        `round ${i} (${r.item.word}) answer "${r.answer}" must be dem/der`,
                    ).toContain(r.answer);
                    // And it must match the rule table for the noun's gender.
                    expect(
                        r.answer,
                        `round ${i} (${r.item.word}/${r.item.gender}) dativ article`,
                    ).toBe(articleFor(r.item.gender, 'dat', 'sg'));
                }
            });

            it('offers exactly the two distinct dative forms as options', () => {
                for (let i = 0; i < rounds.length; i++) {
                    const r = rounds[i];
                    expect(new Set(r.options), `round ${i} options`).toEqual(new Set(['dem', 'der']));
                }
            });

            it('the on-answer read renders the declined noun after the article', () => {
                // spokenText begins "<article> <noun> …" — e.g. "dem Hund …" —
                // proving the declined noun is spoken right after the blank.
                for (let i = 0; i < rounds.length; i++) {
                    const r = rounds[i];
                    expect(
                        r.spokenText.startsWith(`${r.answer} ${r.item.word}`),
                        `round ${i} read should start "${r.answer} ${r.item.word}…": ${r.spokenText}`,
                    ).toBe(true);
                }
            });
        });
    }
});

// 3. storyContext coherence — the narrative frame must be internally consistent
//    so the UI can render and tally the cumulative letter.
describe('storyContext coherence', () => {
    for (const story of STORIES) {
        describe(`"${story.id}"`, () => {
            const rounds = buildStoryRounds(story, items.filter(hasPlural));
            const blankWords = story.lines
                .flat()
                .filter(seg => seg.kind === 'blank')
                .map(seg => (seg as { kind: 'blank'; word: string }).word);
            const N = blankWords.length;

            it('blankIndex runs 0..N-1 contiguously and uniquely, in reading order', () => {
                const indices = rounds.map(r => r.storyContext!.blankIndex);
                expect(indices).toEqual([...Array(N).keys()]);
            });

            it('all rounds share blankCount === N', () => {
                for (let i = 0; i < rounds.length; i++) {
                    expect(rounds[i].storyContext!.blankCount, `round ${i} blankCount`).toBe(N);
                }
            });

            it('each round storyContext.answer equals the round answer', () => {
                for (let i = 0; i < rounds.length; i++) {
                    expect(
                        rounds[i].storyContext!.answer,
                        `round ${i} context answer`,
                    ).toBe(rounds[i].answer);
                }
            });

            it('every round carries the right story id and title', () => {
                for (const r of rounds) {
                    expect(r.storyContext!.storyId).toBe(story.id);
                    expect(r.storyContext!.title).toBe(story.title);
                }
            });

            it('the lines view resolves each blank to its plural (or Dativ article)', () => {
                // The shared view is identical across rounds; read it off the first.
                const view = rounds[0].storyContext!.lines;
                const blankViews = view
                    .flat()
                    .filter(seg => seg.kind === 'blank');
                expect(blankViews.length, 'view blank count').toBe(N);
                for (let i = 0; i < blankViews.length; i++) {
                    const expectedItem = byWord.get(blankWords[i]) as PracticeItem;
                    expect(blankViews[i].blankIndex, `view blank ${i} index`).toBe(i);
                    expect(
                        blankViews[i].answer,
                        `view blank ${i} (${story.id}/${blankWords[i]}) answer`,
                    ).toBe(expectedAnswer(expectedItem, story.mode));
                }
            });

            // Dativ-specific: the article blank is followed by the declined noun
            // as a text segment, so the cumulative letter reads "mit dem Hund".
            if (story.mode === 'dativ') {
                it('renders the declined noun as text right after each Dativ blank', () => {
                    const view = rounds[0].storyContext!.lines;
                    const flat = view.flat();
                    for (let i = 0; i < flat.length; i++) {
                        const seg = flat[i];
                        if (seg.kind !== 'blank') continue;
                        const after = flat[i + 1];
                        expect(after, `blank ${seg.blankIndex} should be followed by a segment`).toBeDefined();
                        expect(
                            after!.kind,
                            `blank ${seg.blankIndex} should be followed by noun text`,
                        ).toBe('text');
                        // The noun text is the blank word's stem (declension may add
                        // -n/-en for weak masculines, so check a prefix match).
                        const word = blankWords[seg.blankIndex!];
                        expect(
                            after!.text.trim().startsWith(word),
                            `blank ${seg.blankIndex} noun text "${after!.text.trim()}" should start with "${word}"`,
                        ).toBe(true);
                    }
                });
            }
        });
    }
});

// 4. No answer leak — the prompt shows the slot as ___, never the plural, and no
//    hint reveals the form (mirrors plurals.test.ts's hint-leak test).
describe('story rounds never leak the answer', () => {
    const rounds = generateStoryRounds(items);

    /** Whole-word presence, so "Fotos" in the prompt wouldn't hide inside a
     *  longer word and a short answer wouldn't false-positive on a substring. */
    function containsWord(haystack: string, needle: string): boolean {
        const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|\\W)${escaped}(\\W|$)`).test(haystack);
    }

    it('promptText marks a ___ blank, not pre-filled with the answer', () => {
        const blanks = allBlankWords();
        for (let i = 0; i < rounds.length; i++) {
            const r = rounds[i];
            const mode = modeForStory(blanks[i].storyId);
            expect(r.promptText, `round ${i} prompt should mark the blank`).toContain('___');
            // The slot may now sit MID-sentence — the same-line text after the
            // blank (e.g. the noun in "Ich sehe ___ Hund") is shown for context.
            // The invariant isn't "ends with ___" any more; it's that the slot is
            // never pre-filled with the answer.
            const [beforeSlot = '', afterSlot = ''] = r.promptText.split(/_+/);
            const wordBefore = beforeSlot.trim().split(/\s+/).pop() ?? '';
            const wordAfter = afterSlot.trim().split(/\s+/)[0] ?? '';
            expect(
                wordBefore,
                `round ${i} slot should not be pre-filled (before) with "${r.answer}": ${r.promptText}`,
            ).not.toBe(r.answer);
            expect(
                wordAfter,
                `round ${i} slot should not be pre-filled (after) with "${r.answer}": ${r.promptText}`,
            ).not.toBe(r.answer);

            if (mode !== 'dativ') {
                // Plural answers are distinctive forms; they must never appear in
                // the prompt at all (a true leak of the thing being asked). Dativ
                // answers (der/dem) are ordinary words that legitimately occur in
                // the surrounding prose, so they're exempt from the word-leak check.
                expect(
                    containsWord(r.promptText, r.answer),
                    `round ${i} prompt leaks "${r.answer}": ${r.promptText}`,
                ).toBe(false);
            }
        }
    });

    it('no hint reveals the plural form', () => {
        for (let i = 0; i < rounds.length; i++) {
            const r = rounds[i];
            for (const h of r.hints) {
                expect(
                    h.text,
                    `round ${i} hint (${h.kind}) leaks "${r.answer}"`,
                ).not.toContain(r.answer);
            }
        }
    });
});

describe('story mode — continuous audio', () => {
    const rounds = generateStoryRounds(generateItems());

    it('the on-answer read starts with the just-filled blank word', () => {
        // spokenText is what plays after answering: it begins with this blank's
        // answer (the slot getting filled), then flows onward.
        for (let i = 0; i < rounds.length; i++) {
            const r = rounds[i];
            expect(
                r.spokenText.startsWith(r.answer),
                `round ${i} continuation should start with "${r.answer}": ${r.spokenText}`,
            ).toBe(true);
        }
    });

    it('the on-answer read STOPS at the end of its own sentence (no read-ahead)', () => {
        // In Liebe Lisa, blank 0 sits in the first sentence; the blank-free
        // sentence that follows ("Nur um Max mache ich mir Gedanken.") belongs to
        // the NEXT round's reading, not this one. The read after blank 0 must NOT
        // spill into it — otherwise that text gets spoken twice. This is the fix
        // for audio reading past the answered sentence.
        expect(rounds[0].spokenText).not.toContain('Gedanken');
    });

    it('each story\'s final blank reads to the end of its own letter', () => {
        // Tested per story (via generateStoryRoundsFor) so it's robust to the
        // order STORIES are concatenated in. Each closing word is the last word
        // of that story's final line.
        const closings: Record<string, string> = {
            'liebe-lisa': 'Elisabeth', // "Alles Liebe, deine Elisabeth."
            'familientag': 'Felix',    // "Schreib bald! Dein Felix."
        };
        for (const story of STORIES) {
            const storyRounds = generateStoryRoundsFor(story.id, generateItems());
            const last = storyRounds[storyRounds.length - 1];
            const closing = closings[story.id];
            expect(closing, `add a closing word for story "${story.id}"`).toBeDefined();
            expect(
                last.spokenText,
                `${story.id} final blank should read to "${closing}"`,
            ).toContain(closing);
        }
    });

    it('a second blank on a line does NOT re-read the first blank\'s clause', () => {
        // The "Freundinnen" blank is the 2nd on its line. The connecting text
        // ("…mit anderen Kindern und seinen ___") was already spoken as the tail
        // of the FIRST blank's post-answer read, so the second blank's on-show
        // audio must be empty — re-reading it would repeat the clause (the bug a
        // two-blank line exposed). The visible context still shows the first blank
        // filled via the storyContext.lines view (the karaoke card), not the audio.
        const r = rounds.find(x => x.answer === 'Freundinnen');
        expect(r, 'expected a Freundinnen blank').toBeDefined();
        expect(r!.speakOnShow, 'second-on-line blank should be silent on show').toBe('');

        // The cumulative view for this round shows the earlier blank's answer
        // (so the reader sees "Kindern" filled, not a gap).
        const ctx = r!.storyContext!;
        const filledWords = ctx.lines.flat()
            .filter(s => s.kind === 'blank' && (s.blankIndex ?? 0) < ctx.blankIndex)
            .map(s => s.answer);
        expect(filledWords).toContain('Kinder');
    });
});
