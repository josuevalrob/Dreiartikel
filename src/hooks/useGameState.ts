import { useState, useEffect, useCallback, useRef } from 'react';
import { generateItems } from '../data';
import { hasRule } from '../rules';
import { generateArticleRounds } from '../articles';
import { generateRounds, generateDetectRounds, type CaseFilter } from '../sentences';
import { generatePluralRounds } from '../plurals';
import { generateStoryRounds, generateStoryRoundsFor } from '../stories';
import { generateChapterRoundsFor } from '../chapters';
import type { StoryContext } from '../stories';
import { HINT_BUDGET, HINT_KINDS, type Hint, type HintKind } from '../hints';
import type { PracticeRound, RoundGenerator } from '../round';
import { playWord, stopSpeech } from '../utils/speech';

const HINT_FREEZE_MS = 3000; // how long the timer freezes while a hint shows

export type FilterType = 'all' | 'by-rule' | 'without-rule' | string;
export type GameMode = 'article' | 'case-single' | 'case-detect' | 'plural' | 'story';
export type { CaseFilter } from '../sentences';

/** The presentable unit the game loop consumes, identical across modes. */
export interface Round {
    id: string;
    /** What the learner sees: a bare word, or a sentence with a `___` blank. */
    displayText: string;
    /** Secondary line under the word (translation hint), if any. */
    hint?: string;
    /** A substring of `displayText` to visually emphasise (detect mode). */
    highlight?: string;
    answer: string;
    options: string[];
    /** Explanation shown after answering. */
    tipp: string;
    /** Spoken when the round appears. Empty in case mode — speaking the full
     *  sentence up front would reveal the article. */
    speakOnShow: string;
    /** Spoken after the learner answers (reinforcement). The full correct
     *  sentence in case mode; empty in article mode. */
    speakOnAnswer: string;
    /** Replay button audio: what the round is "about". */
    speakReplay: string;
    /** Help the learner can reveal before answering — never the solution. */
    hints: Hint[];
    /** Story mode only: the narrative frame (for the cumulative-letter UI). Its
     *  presence marks the round graded-once (no wrong-answer re-queue). */
    storyContext?: StoryContext;
}

const DEFAULT_DURATION_SEC = 3; // per-word budget when no setting is supplied
const BONUS_CAP = 2000;         // max bonus you can recover per word

// Each mode is one pure pool→rounds function behind the same contract. Adding a
// mode means registering it here — the loop below never changes. Case mode also
// takes a CaseFilter (study only Dativ, etc.), bound in buildQueue.
const GENERATORS: Record<GameMode, RoundGenerator> = {
    'article': generateArticleRounds,
    'case-single': generateRounds,   // caseFilter applied in buildQueue
    'case-detect': generateDetectRounds, // caseFilter applied in buildQueue
    'plural': generatePluralRounds,
    'story': generateStoryRounds,
};

/** Adapt a mode's `PracticeRound` to the UI `Round` the loop renders. The only
 *  per-mode variation is audio safety: if the prompt can't be spoken without
 *  leaking the answer (case mode), stay silent on show and replay the bare noun;
 *  otherwise speak the prompt and reinforce with the full line after answering. */
function toRound(r: PracticeRound): Round {
    // Story rounds speak only the LEAD-IN on show — the words strictly before the
    // blank (carried on r.speakOnShow). The blank and any noun after it stay
    // visible but silent until answered, so the on-show audio never voices the
    // article (no leak) nor reads ahead into the noun / next sentence. On answer,
    // the continuous read (spokenText) fills the blank and glides onward.
    const story = r.storyContext;
    const storyLeadIn = story ? (r.speakOnShow ?? '').trim() : '';

    return {
        id: r.item.id,
        displayText: r.promptText,
        // Translation line: only meaningful for the bare-word article prompt;
        // the sentence/singular prompts already show the noun in context.
        hint: r.promptText === r.item.word ? r.item.hint : undefined,
        highlight: r.highlight,
        answer: r.answer,
        options: r.options,
        tipp: r.tipp,
        // On show: the prompt, but only if speaking it can't leak the answer.
        // Story: the lead-in up to the blank (never the "___").
        speakOnShow: story ? storyLeadIn : (r.speakOnShowSafe ? r.promptText : ''),
        // After answering: the full reinforcement line, when it adds something
        // beyond the prompt (plural: "das Buch — die Bücher"; case: the full
        // sentence). Article mode's spokenText === promptText, so no-op there.
        speakOnAnswer: r.spokenText !== r.promptText ? r.spokenText : '',
        // Replay: the prompt when safe, else the bare noun (never the article).
        speakReplay: story ? storyLeadIn : (r.speakOnShowSafe ? r.promptText : r.item.word),
        hints: r.hints,
        storyContext: r.storyContext,
    };
}

function buildQueue(filter: FilterType, mode: GameMode, caseFilter: CaseFilter, storyId?: string, chapterId?: string): Round[] {
    let items = generateItems();

    if (filter === 'by-rule') {
        items = items.filter(i => hasRule(i.word, i.gender));
    } else if (filter === 'without-rule') {
        items = items.filter(i => !hasRule(i.word, i.gender));
    } else if (filter !== 'all') {
        items = items.filter(i => i.category === filter);
    }

    // Case modes narrow by case; story mode plays one selected letter OR — when a
    // chapterId is set — one main-quest chapter (a chapter is a story whose rounds
    // come from authored prose). Other modes ignore all three.
    let rounds: PracticeRound[];
    if (mode === 'case-single') {
        rounds = generateRounds(items, caseFilter);
    } else if (mode === 'case-detect') {
        rounds = generateDetectRounds(items, caseFilter);
    } else if (mode === 'story') {
        rounds = chapterId
            ? generateChapterRoundsFor(chapterId, items)
            : generateStoryRoundsFor(storyId, items);
    } else {
        rounds = GENERATORS[mode](items);
    }
    return rounds.map(toRound);
}

export function useGameState(filter: FilterType, mode: GameMode = 'article', caseFilter: CaseFilter = 'all', active = true, storyId?: string, chapterId?: string, durationSec: number = DEFAULT_DURATION_SEC) {
    // Per-word time budget from settings (chess clock). The starting bank matches
    // one word's allowance, as it always has.
    const TIME_PER_WORD = durationSec * 1000;
    const INITIAL_TIME_BANK = TIME_PER_WORD;

    const [queue, setQueue] = useState<Round[]>([]);
    const [currentWord, setCurrentWord] = useState<Round | null>(null);
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [bestStreak, setBestStreak] = useState(0);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [tippText, setTippText] = useState<string | null>(null);
    const [isAwaitingNext, setIsAwaitingNext] = useState(false);
    const [timeBank, setTimeBank] = useState(INITIAL_TIME_BANK);

    // Story mode: per-blank outcome in reading order, for the cumulative letter
    // (filled vs missed) and the end-of-story X/N tally. Empty in other modes.
    const [storyResults, setStoryResults] = useState<('correct' | 'missed')[]>([]);

    // Answer-flow state — what's happening *this turn*. Owned here so there is a
    // single source of truth (previously this was split into App.tsx).
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showTipp, setShowTipp] = useState(false);

    // Hint system — a separate budget per hint kind.
    const [hintsRemaining, setHintsRemaining] = useState<Record<HintKind, number>>({ ...HINT_BUDGET });
    const [revealedHint, setRevealedHint] = useState<Hint | null>(null);
    const [isFrozen, setIsFrozen] = useState(false);

    // Timing refs
    const answerTimerRef = useRef<number | null>(null);
    const autoAdvanceRef = useRef<number | null>(null);  // 2s "next" timer on correct
    const freezeTimerRef = useRef<number | null>(null);  // hint freeze (3s) timer
    const wordPresentedAtRef = useRef<number>(0);       // when word was shown
    const answerDeadlineRef = useRef<number>(0);         // when the answer timer fires
    const frozenRemainingRef = useRef<number>(0);       // ms left when frozen
    const feedbackShownAtRef = useRef<number>(0);        // when answer was submitted
    const handleAnswerRef = useRef<((selectedArticle: string, timedOut?: boolean) => void) | null>(null);

    const clearAnswerTimer = useCallback(() => {
        if (answerTimerRef.current) {
            clearTimeout(answerTimerRef.current);
            answerTimerRef.current = null;
        }
    }, []);

    const clearAutoAdvance = useCallback(() => {
        if (autoAdvanceRef.current) {
            clearTimeout(autoAdvanceRef.current);
            autoAdvanceRef.current = null;
        }
    }, []);

    const clearFreeze = useCallback(() => {
        if (freezeTimerRef.current) {
            clearTimeout(freezeTimerRef.current);
            freezeTimerRef.current = null;
        }
        setIsFrozen(false);
    }, []);

    // Initialize / reset game when filter, mode, or case filter changes
    useEffect(() => {
        clearAnswerTimer();
        clearAutoAdvance();
        clearFreeze();
        const rounds = buildQueue(filter, mode, caseFilter, storyId, chapterId);
        setQueue(rounds);
        setCurrentWord(rounds.length > 0 ? rounds[0] : null);
        setScore(0);
        setStreak(0);
        setBestStreak(0);
        setFeedback(null);
        setTippText(null);
        setIsAwaitingNext(false);
        setTimeBank(INITIAL_TIME_BANK);
        setSelectedOption(null);
        setShowTipp(false);
        setHintsRemaining({ ...HINT_BUDGET });   // refill hints on a new run
        setRevealedHint(null);
        setStoryResults([]);
    }, [filter, mode, caseFilter, storyId, chapterId, INITIAL_TIME_BANK, clearAnswerTimer, clearAutoAdvance, clearFreeze]);

    // Play audio whenever a new round is displayed (only while the game is on
    // screen). Empty speakOnShow (case mode) is a no-op so the article isn't
    // revealed before the learner answers.
    useEffect(() => {
        if (active && currentWord && !isAwaitingNext && currentWord.speakOnShow) {
            playWord(currentWord.speakOnShow);
        }
    }, [active, currentWord, isAwaitingNext]);

    // Cut off any audio in progress the moment the game leaves the screen.
    useEffect(() => {
        if (!active) stopSpeech();
    }, [active]);

    const handleAnswer = useCallback((selectedArticle: string, timedOut = false) => {
        if (!currentWord || isAwaitingNext) return;

        clearAnswerTimer();
        feedbackShownAtRef.current = Date.now();

        const isCorrect = selectedArticle === currentWord.answer;
        
        if (isCorrect) {
            setFeedback('correct');
            setScore(s => s + 1);
            setStreak(s => s + 1);

            // Chess clock: time saved from answering fast gets added to bank
            const elapsed = Date.now() - wordPresentedAtRef.current;
            const saved = Math.min(TIME_PER_WORD - elapsed, BONUS_CAP);
            if (saved > 0) {
                setTimeBank(t => t + saved);
            }
        } else {
            setFeedback('incorrect');
            setStreak(s => {
                setBestStreak(prev => Math.max(prev, s));
                return 0;
            });
        }

        const tipp = timedOut
            ? `Time's up! The correct answer is "${currentWord.answer}".`
            : currentWord.tipp;
        setTippText(tipp);
        setIsAwaitingNext(true);

        // Story mode is graded-once: record each blank's result for the X/N tally
        // and the dimmed-letter rendering (correct vs missed).
        const graded = !!currentWord.storyContext;
        if (graded) {
            setStoryResults(prev => [...prev, isCorrect ? 'correct' : 'missed']);
        }

        // Reinforce with the full correct sentence (case mode); no-op in article mode.
        if (currentWord.speakOnAnswer) {
            playWord(currentWord.speakOnAnswer);
        }

        setQueue(prevQueue => {
            const newQueue = [...prevQueue];
            const item = newQueue.shift();
            if (!item) return newQueue;
            // Re-queue wrong answers so they come back — EXCEPT in graded story
            // mode, which advances linearly and never repeats a blank.
            if (!isCorrect && !graded) {
                const offset = Math.floor(Math.random() * 4) + 2;
                const insertIndex = Math.min(offset, newQueue.length);
                newQueue.splice(insertIndex, 0, item);
            }
            return newQueue;
        });

    }, [currentWord, isAwaitingNext, clearAnswerTimer, TIME_PER_WORD]);

    useEffect(() => {
        handleAnswerRef.current = handleAnswer;
    }, [handleAnswer]);

    /** Called when user presses Next (or auto-advance fires).
     *  Returns the bonus ms recovered if user pressed Next early. */
    const handleNext = useCallback((grantBonus = false) => {
        clearAnswerTimer();

        if (grantBonus) {
            const feedbackElapsed = Date.now() - feedbackShownAtRef.current;
            const bonus = Math.max(0, 2000 - feedbackElapsed); // remaining from the 2s window
            if (bonus > 0) {
                setTimeBank(t => t + bonus);
            }
        }

        setIsAwaitingNext(false);
        setFeedback(null);
        setTippText(null);
        
        setQueue(prevQueue => {
            if (prevQueue.length > 0) {
                setCurrentWord(prevQueue[0]);
            } else {
                setCurrentWord(null);
            }
            return prevQueue;
        });
    }, [clearAnswerTimer]);

    // ─── High-level turn actions (the API the UI calls) ────────────────

    /** Submit an answer. On a correct answer, auto-advance after 2s; on a wrong
     *  answer, reveal the tipp and wait for the learner to press Next. */
    const selectAnswer = useCallback((option: string) => {
        if (!currentWord || isAwaitingNext) return;
        // Answering ends any active hint freeze.
        clearFreeze();
        frozenRemainingRef.current = 0;
        setRevealedHint(null);
        setSelectedOption(option);

        const wasCorrect = option === currentWord.answer;
        handleAnswer(option);

        if (wasCorrect) {
            setShowTipp(false);
            autoAdvanceRef.current = window.setTimeout(() => {
                handleNext(false);
                setSelectedOption(null);
                setShowTipp(false);
            }, 2000);
        } else {
            setShowTipp(true);
            clearAutoAdvance();
        }
    }, [currentWord, isAwaitingNext, handleAnswer, handleNext, clearAutoAdvance, clearFreeze]);

    /** Reveal the explanation on a wrong answer ("Know why" button). */
    const knowWhy = useCallback(() => {
        clearAutoAdvance();
        setShowTipp(true);
    }, [clearAutoAdvance]);

    /** Advance to the next round (Next button / Space). */
    const next = useCallback((grantBonus = true) => {
        clearAutoAdvance();
        clearFreeze();
        frozenRemainingRef.current = 0;
        setSelectedOption(null);
        setShowTipp(false);
        setRevealedHint(null);
        handleNext(grantBonus);
    }, [clearAutoAdvance, clearFreeze, handleNext]);

    /** Reveal a hint of the given kind for the current round, freezing the timer
     *  for HINT_FREEZE_MS. Costs one use from that kind's budget. */
    const useHint = useCallback((kind: HintKind) => {
        if (!currentWord || isAwaitingNext || isFrozen) return;
        if (hintsRemaining[kind] <= 0) return;

        const hint = currentWord.hints.find(h => h.kind === kind);
        if (!hint) return;

        // Freeze the answer timer, stashing how much time was left to resume with.
        clearAnswerTimer();
        frozenRemainingRef.current = Math.max(0, answerDeadlineRef.current - Date.now());

        setRevealedHint(hint);
        setHintsRemaining(prev => ({ ...prev, [kind]: prev[kind] - 1 }));
        setIsFrozen(true);

        freezeTimerRef.current = window.setTimeout(() => {
            setIsFrozen(false); // timer effect resumes with the stashed remaining
            freezeTimerRef.current = null;
        }, HINT_FREEZE_MS);
    }, [currentWord, isAwaitingNext, isFrozen, hintsRemaining, clearAnswerTimer]);

    // Clear the auto-advance and freeze timers if the game leaves the screen.
    useEffect(() => {
        if (!active) {
            clearAutoAdvance();
            clearFreeze();
        }
        return () => { clearAutoAdvance(); clearFreeze(); };
    }, [active, clearAutoAdvance, clearFreeze]);

    // Start the answer timer whenever a word is presented and not frozen. A hint
    // freeze pauses this (isFrozen) and stashes the remaining time, which is
    // consumed here on resume so the countdown picks up where it left off.
    useEffect(() => {
        if (active && currentWord && !isAwaitingNext && !isFrozen) {
            clearAnswerTimer();

            const resuming = frozenRemainingRef.current > 0;
            const duration = resuming ? frozenRemainingRef.current : TIME_PER_WORD;
            frozenRemainingRef.current = 0;
            if (!resuming) wordPresentedAtRef.current = Date.now();
            answerDeadlineRef.current = Date.now() + duration;

            answerTimerRef.current = window.setTimeout(() => {
                // Time's up — drain from bank
                setTimeBank(t => Math.max(0, t - TIME_PER_WORD));

                if (handleAnswerRef.current && currentWord) {
                    const wrongOption = currentWord.options.find(o => o !== currentWord.answer) || currentWord.options[0];
                    handleAnswerRef.current(wrongOption, true);
                }
            }, duration);
        }

        return () => clearAnswerTimer();
    }, [active, currentWord, isAwaitingNext, isFrozen, clearAnswerTimer, TIME_PER_WORD]);

    const handleReplay = useCallback(() => {
        if (currentWord) {
            // After answering in case mode, replay the full sentence; otherwise
            // the noun on its own (which never leaks the article).
            const text = isAwaitingNext && currentWord.speakOnAnswer
                ? currentWord.speakOnAnswer
                : currentWord.speakReplay;
            playWord(text);
        }
    }, [currentWord, isAwaitingNext]);

    useEffect(() => {
        return () => clearAnswerTimer();
    }, [clearAnswerTimer]);

    return {
        currentWord,
        score,
        streak,
        bestStreak,
        feedback,
        tippText,
        isAwaitingNext,
        // Answer-flow state (this turn)
        selectedOption,
        showTipp,
        // Hint system
        hintsRemaining,
        revealedHint,
        isFrozen,
        availableHintKinds: currentWord
            ? HINT_KINDS.filter(k => currentWord.hints.some(h => h.kind === k))
            : [],
        // Turn actions — the API the UI calls
        selectAnswer,
        knowWhy,
        next,
        useHint,
        replay: handleReplay,
        itemsLeft: queue.length,
        timeBank,
        // Story mode: per-blank outcomes so far (for the cumulative letter + tally)
        storyResults,
    };
}
