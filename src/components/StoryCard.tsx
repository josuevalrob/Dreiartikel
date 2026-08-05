import { useEffect, useRef } from 'react';
import { glyphForOptionSlot } from '../hooks/useInput';
import type { Round } from '../hooks/useGameState';
import type { StorySegmentView } from '../stories';

interface StoryCardProps {
    round: Round;
    isAwaitingNext: boolean;
    selectedOption: string | null;
    showTipp: boolean;
    feedback: 'correct' | 'incorrect' | null;
    tippText: string | null;
    /** Per-blank outcomes so far (reading order): 'correct' | 'missed'. */
    storyResults: ('correct' | 'missed')[];
    onSelectOption: (option: string) => void;
    onReplay: () => void;
    onKnowWhy: () => void;
    onNext: (grantBonus?: boolean) => void;
}

/** The karaoke-letter view: the WHOLE story is always shown — read lines recede,
 *  the active sentence is full-strength, and not-yet-reached lines are faded but
 *  readable (future blanks stay as `___`, so nothing leaks). The view snaps the
 *  active line into position as you advance, like lyrics following a song. The
 *  3-option selector + feedback sit below.
 *
 *  What's stored vs derived: `storyResults` (per-blank outcomes) and the current
 *  blank index are STORED in the loop; the rendered letter is fully DERIVED from
 *  the story's `lines` view + those results. */
export function StoryCard({
    round,
    isAwaitingNext,
    selectedOption,
    showTipp,
    feedback,
    tippText,
    storyResults,
    onSelectOption,
    onReplay,
    onKnowWhy,
    onNext,
}: StoryCardProps) {
    const ctx = round.storyContext;
    const currentLineRef = useRef<HTMLParagraphElement>(null);

    // Snap the active line into view whenever it changes (karaoke scroll).
    const currentLineIndex = ctx ? lineIndexOfBlank(ctx.lines, ctx.blankIndex) : -1;
    useEffect(() => {
        currentLineRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }, [currentLineIndex]);

    if (!ctx) return null;

    const currentBlank = ctx.blankIndex;

    return (
        <div className="story-card">
            <h2 className="story-title">{ctx.title}</h2>

            <button className="replay-btn story-replay" onClick={onReplay} aria-label="Replay Audio" title="Replay Audio">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
            </button>

            <div className="story-text">
                {ctx.lines.map((line, li) => {
                    // The whole story is shown; lines recede / brighten / fade by
                    // position relative to the active line.
                    const tier = li < currentLineIndex ? 'done' : li === currentLineIndex ? 'current' : 'future';
                    return (
                        <p
                            key={li}
                            ref={li === currentLineIndex ? currentLineRef : undefined}
                            className={`story-line ${tier}`}
                        >
                            {line.map((seg, si) => renderSegment(seg, si, currentBlank, storyResults))}
                        </p>
                    );
                })}
            </div>

            {/* The 3-option selector for the current blank. */}
            <div className="options-grid">
                {round.options.map((option, idx) => {
                    let btnClass = 'option-btn';
                    if (isAwaitingNext) {
                        if (option === round.answer) btnClass += ' correct';
                        else if (option === selectedOption) btnClass += ' incorrect';
                    }
                    return (
                        <button
                            key={option}
                            onClick={() => onSelectOption(option)}
                            className={btnClass}
                            disabled={isAwaitingNext}
                        >
                            <span className="key-hint">{glyphForOptionSlot(idx, round.options.length)}</span>
                            {option}
                        </button>
                    );
                })}
            </div>

            {isAwaitingNext && (
                <div className="feedback-section" style={{ marginTop: '1rem' }}>
                    {showTipp ? (
                        <>
                            <div className="tipp-box">
                                <h3>{feedback === 'correct' ? 'Richtig! 🎉' : 'Weiter! ➡️'}</h3>
                                <p>{tippText}</p>
                            </div>
                            <button className="next-btn" autoFocus onClick={() => onNext(true)}>
                                Next <span className="key-hint-inline">space</span>
                            </button>
                        </>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <h3 style={{ color: feedback === 'correct' ? 'var(--color-success)' : 'var(--color-error)', margin: 0, fontSize: '1.5rem' }}>
                                {feedback === 'correct' ? 'Richtig! 🎉' : 'Weiter! ➡️'}
                            </h3>
                            <div className="feedback-buttons">
                                <button className="know-why-btn" onClick={onKnowWhy}>
                                    Know why
                                </button>
                                <button className="next-btn" autoFocus onClick={() => onNext(true)}>
                                    Next <span className="key-hint-inline">space</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/** The line index that contains the given global blank index. */
function lineIndexOfBlank(lines: StorySegmentView[][], blankIndex: number): number {
    for (let li = 0; li < lines.length; li++) {
        if (lines[li].some(s => s.kind === 'blank' && s.blankIndex === blankIndex)) {
            return li;
        }
    }
    // After the last blank (shouldn't render past the story), show everything.
    return lines.length - 1;
}

/** Render one segment: plain text, an answered blank (the real word filled in,
 *  green if got-right, red if missed), the active blank (a live slot), or a
 *  not-yet-reached blank (placeholder). */
function renderSegment(
    seg: StorySegmentView,
    key: number,
    currentBlank: number,
    results: ('correct' | 'missed')[],
) {
    if (seg.kind === 'text') return <span key={key}>{seg.text}</span>;

    const bi = seg.blankIndex!;
    if (bi < currentBlank) {
        // Answered: show the real word, coloured by outcome.
        const outcome = results[bi] ?? 'correct';
        return (
            <span key={key} className={`story-blank ${outcome === 'missed' ? 'missed' : 'filled'}`}>
                {seg.answer}
            </span>
        );
    }
    if (bi === currentBlank) {
        return <span key={key} className="story-blank current">______</span>;
    }
    return <span key={key} className="story-blank future">___</span>;
}
