import { useState, useEffect, useCallback } from 'react';
import { generateItems, shuffle, type PracticeItem } from '../data';
import { playWord } from '../utils/speech';

export interface GameState {
    currentWord: PracticeItem | null;
    score: number;
    streak: number;
    feedback: 'correct' | 'incorrect' | null;
    tippText: string | null;
}

export function useGameState() {
    const [queue, setQueue] = useState<PracticeItem[]>([]);
    const [currentWord, setCurrentWord] = useState<PracticeItem | null>(null);
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [tippText, setTippText] = useState<string | null>(null);
    const [isAwaitingNext, setIsAwaitingNext] = useState(false);

    // Initialize game
    useEffect(() => {
        const initQueue = shuffle(generateItems());
        setQueue(initQueue);
        
        if (initQueue.length > 0) {
            const first = initQueue[0];
            setCurrentWord(first);
        }
    }, []);

    // Play word audio whenever a new word is displayed (and not awaiting next)
    useEffect(() => {
        if (currentWord && !isAwaitingNext) {
            playWord(currentWord.word);
        }
    }, [currentWord, isAwaitingNext]);

    const handleAnswer = useCallback((selectedArticle: string, tippEngine: (word: string, article: 'der'|'die'|'das') => string) => {
        if (!currentWord || isAwaitingNext) return;

        const isCorrect = selectedArticle === currentWord.answer;
        
        if (isCorrect) {
            setFeedback('correct');
            setScore(s => s + 1);
            setStreak(s => s + 1);
        } else {
            setFeedback('incorrect');
            setStreak(0);
        }

        // Generate Tipp
        const tipp = tippEngine(currentWord.word, currentWord.answer as 'der'|'die'|'das');
        setTippText(tipp);
        setIsAwaitingNext(true);

        // Queue logic
        setQueue(prevQueue => {
            const newQueue = [...prevQueue];
            // Remove the current word from the front of the queue
            const item = newQueue.shift();

            if (!item) return newQueue;

            if (!isCorrect) {
                // Determine insertion index roughly 2 to 5 slots ahead
                // Ensure it doesn't exceed the queue length
                const offset = Math.floor(Math.random() * 4) + 2; // 2, 3, 4, or 5
                const insertIndex = Math.min(offset, newQueue.length);
                newQueue.splice(insertIndex, 0, item);
            }
            
            return newQueue;
        });

    }, [currentWord, isAwaitingNext]);

    const handleNext = useCallback(() => {
        setIsAwaitingNext(false);
        setFeedback(null);
        setTippText(null);
        
        setQueue(prevQueue => {
            if (prevQueue.length > 0) {
                setCurrentWord(prevQueue[0]);
            } else {
                setCurrentWord(null); // Game finished (congrats!)
            }
            return prevQueue;
        });
    }, []);

    const handleReplay = useCallback(() => {
        if (currentWord) {
            playWord(currentWord.word);
        }
    }, [currentWord]);

    return {
        currentWord,
        score,
        streak,
        feedback,
        tippText,
        isAwaitingNext,
        handleAnswer,
        handleNext,
        handleReplay,
        itemsLeft: queue.length
    };
}
