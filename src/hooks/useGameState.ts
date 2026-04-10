import { useState, useEffect, useCallback, useRef } from 'react';
import { generateItems, shuffle, hasRule, type PracticeItem } from '../data';
import { playWord } from '../utils/speech';

export type FilterType = 'all' | 'by-rule' | 'without-rule' | string;

const INITIAL_TIME_BANK = 3000; // 3 seconds starting budget
const TIME_PER_WORD = 3000;     // 3 seconds allowed per word
const BONUS_CAP = 2000;         // max bonus you can recover per word

export function useGameState(filter: FilterType) {
    const [queue, setQueue] = useState<PracticeItem[]>([]);
    const [currentWord, setCurrentWord] = useState<PracticeItem | null>(null);
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [bestStreak, setBestStreak] = useState(0);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [tippText, setTippText] = useState<string | null>(null);
    const [isAwaitingNext, setIsAwaitingNext] = useState(false);
    const [timeBank, setTimeBank] = useState(INITIAL_TIME_BANK);

    // Timing refs
    const answerTimerRef = useRef<number | null>(null);
    const wordPresentedAtRef = useRef<number>(0);       // when word was shown
    const feedbackShownAtRef = useRef<number>(0);        // when answer was submitted
    const handleAnswerRef = useRef<((selectedArticle: string, tippEngine: (word: string, article: 'der'|'die'|'das') => string) => void) | null>(null);

    const clearAnswerTimer = useCallback(() => {
        if (answerTimerRef.current) {
            clearTimeout(answerTimerRef.current);
            answerTimerRef.current = null;
        }
    }, []);

    // Initialize / reset game when filter changes
    useEffect(() => {
        clearAnswerTimer();
        let items = generateItems();

        if (filter === 'by-rule') {
            items = items.filter(i => hasRule(i.word, i.answer));
        } else if (filter === 'without-rule') {
            items = items.filter(i => !hasRule(i.word, i.answer));
        } else if (filter !== 'all') {
            items = items.filter(i => i.category === filter);
        }

        const shuffled = shuffle(items);
        setQueue(shuffled);
        setCurrentWord(shuffled.length > 0 ? shuffled[0] : null);
        setScore(0);
        setStreak(0);
        setBestStreak(0);
        setFeedback(null);
        setTippText(null);
        setIsAwaitingNext(false);
        setTimeBank(INITIAL_TIME_BANK);
    }, [filter, clearAnswerTimer]);

    // Play word audio whenever a new word is displayed
    useEffect(() => {
        if (currentWord && !isAwaitingNext) {
            playWord(currentWord.word);
        }
    }, [currentWord, isAwaitingNext]);

    const handleAnswer = useCallback((selectedArticle: string, tippEngine: (word: string, article: 'der'|'die'|'das') => string) => {
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

        const tipp = tippEngine(currentWord.word, currentWord.answer as 'der'|'die'|'das');
        setTippText(tipp);
        setIsAwaitingNext(true);

        setQueue(prevQueue => {
            const newQueue = [...prevQueue];
            const item = newQueue.shift();
            if (!item) return newQueue;
            if (!isCorrect) {
                const offset = Math.floor(Math.random() * 4) + 2;
                const insertIndex = Math.min(offset, newQueue.length);
                newQueue.splice(insertIndex, 0, item);
            }
            return newQueue;
        });

    }, [currentWord, isAwaitingNext, clearAnswerTimer]);

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

    // Start answer timer using time bank whenever a new word is presented
    useEffect(() => {
        if (currentWord && !isAwaitingNext) {
            clearAnswerTimer();
            wordPresentedAtRef.current = Date.now();

            answerTimerRef.current = window.setTimeout(() => {
                // Time's up — drain from bank
                setTimeBank(t => {
                    const remaining = t - TIME_PER_WORD;
                    if (remaining <= 0) {
                        // Bank depleted — still allow play but mark wrong
                    }
                    return Math.max(0, remaining);
                });

                if (handleAnswerRef.current && currentWord) {
                    const wrongOption = currentWord.options.find(o => o !== currentWord.answer) || currentWord.options[0];
                    handleAnswerRef.current(wrongOption, (_w, article) => {
                        return `Time's up! The correct article is "${article}".`;
                    });
                }
            }, TIME_PER_WORD);
        }

        return () => clearAnswerTimer();
    }, [currentWord, isAwaitingNext, clearAnswerTimer]);

    const handleReplay = useCallback(() => {
        if (currentWord) {
            playWord(currentWord.word);
        }
    }, [currentWord]);

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
        handleAnswer,
        handleNext,
        handleReplay,
        itemsLeft: queue.length,
        timeBank,
    };
}
