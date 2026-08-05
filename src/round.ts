// The practice-round contract — the seam every game mode plugs into.
//
// The app has one game loop (timer, streak, re-queue, hints, audio in
// useGameState) and several *modes* that feed it: articles, cases, plurals, and
// whatever comes next. Each mode is, at heart, one function:
//
//     pool of nouns  →  list of rounds to play
//
// Every mode produces the SAME round shape (`PracticeRound`), so the loop stays
// mode-agnostic. The morphology differs wildly between modes — an article is
// derived from (gender × case), a plural is a stored fact — but once a round is
// built it is just a prompt, a correct answer, some shuffled options, an
// explanation and hints. That uniformity is what lets a new mode be *registered*
// rather than *wired in*.
//
// See plurals.ts's header for the deeper rule this encodes: some facts are
// STORED (gender, plural) and some are DERIVED (article, decoys). A mode owns
// that decision; the round it emits hides it.

import type { Hint } from './hints';
import type { PracticeItem } from './data';
import type { StoryContext } from './stories';

/** The unit a mode emits and the game loop consumes — identical across modes. */
export interface PracticeRound {
    /** The noun this round is about (carried for id, audio fallbacks, debugging). */
    item: PracticeItem;
    /** What the learner sees: a bare word, a sentence with a `___`, a singular. */
    promptText: string;
    /** Read aloud only on `speakOnShow` if it can't leak the answer; always the
     *  full reinforcement line after answering ("das Buch — die Bücher"). */
    spokenText: string;
    /** Whether the prompt audio is safe to play before the learner answers.
     *  False when speaking the prompt would reveal the article (case mode). */
    speakOnShowSafe: boolean;
    /** The correct choice, e.g. 'den' or 'Bücher'. */
    answer: string;
    /** The answer plus distinct decoys, shuffled. */
    options: string[];
    /** Explanation shown after answering. */
    tipp: string;
    /** Help revealable before answering — never the solution. */
    hints: Hint[];
    /** A substring of `promptText` to visually emphasise (detect mode marks the
     *  phrase whose case the learner must identify). Absent in other modes. */
    highlight?: string;
    /** Present only for story-mode rounds: the narrative frame this blank sits
     *  in, so the UI can render the cumulative letter. Its presence also tells
     *  the loop this round is graded-once (no wrong-answer re-queue). Absent in
     *  every other mode — the loop stays mode-agnostic. */
    storyContext?: StoryContext;
    /** Story-mode rounds only: the words STRICTLY BEFORE the blank — what to
     *  speak on show. The blank (and everything after it on the line) stays
     *  silent until answered, so the on-show audio never voices the noun the
     *  learner is judging nor leaks the article. `promptText` may include the
     *  trailing noun for the VISIBLE prompt; this field is the audio-only subset. */
    speakOnShow?: string;
}

/** A mode is a pure function from a noun pool to the rounds to play. */
export type RoundGenerator = (pool: PracticeItem[]) => PracticeRound[];
