import { useState, useRef, useEffect, useCallback } from 'react';
import { useSwipeable } from 'react-swipeable';
import { useGameState, type FilterType } from './hooks/useGameState';
import { getTipp } from './utils/tipp';
import { getCategories } from './data';
import { getHypeLevel, fireConfetti, getStreakColor } from './utils/confetti';

const thematicCategories = getCategories();

function App() {
  const [started, setStarted] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [filterOpen, setFilterOpen] = useState(false);

  const {
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
    itemsLeft,
    timeBank,
  } = useGameState(filter);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showTipp, setShowTipp] = useState(false);
  const [swipeDir, setSwipeDir] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const prevStreakRef = useRef(0);

  const clearAutoAdvance = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearAutoAdvance();
  }, [clearAutoAdvance]);

  // Reset local state when filter changes
  useEffect(() => {
    setSelectedOption(null);
    setShowTipp(false);
    setSwipeDir(null);
    clearAutoAdvance();
    prevStreakRef.current = 0;
  }, [filter, clearAutoAdvance]);

  // Fire confetti only when matching or doubling the previous best
  useEffect(() => {
    if (streak > prevStreakRef.current && streak > 0 && bestStreak > 0) {
      const isMatchOrMultiple = streak === bestStreak || (streak > bestStreak && streak % bestStreak === 0);
      if (isMatchOrMultiple) {
        const hype = getHypeLevel(streak, bestStreak);
        fireConfetti(hype);
      }
    }
    prevStreakRef.current = streak;
  }, [streak, bestStreak]);

  // ─── Core action handlers ─────────────────────────────────────────
  const onSelectOption = useCallback((option: string, direction?: string) => {
    if (!currentWord || isAwaitingNext) return;
    setSelectedOption(option);
    if (direction) setSwipeDir(direction);
    handleAnswer(option, getTipp);

    if (option === currentWord.answer) {
      setShowTipp(false);
      timerRef.current = window.setTimeout(() => {
        handleNext(false);
        setSelectedOption(null);
        setShowTipp(false);
        setSwipeDir(null);
      }, 2000);
    } else {
      setShowTipp(true);
      clearAutoAdvance();
    }
  }, [currentWord, isAwaitingNext, handleAnswer, handleNext, clearAutoAdvance]);

  const onKnowWhy = useCallback(() => {
    clearAutoAdvance();
    setShowTipp(true);
  }, [clearAutoAdvance]);

  const onNext = useCallback((grantBonus = true) => {
    clearAutoAdvance();
    setSelectedOption(null);
    setShowTipp(false);
    setSwipeDir(null);
    handleNext(grantBonus);
  }, [clearAutoAdvance, handleNext]);

  // ─── Swipe handlers (Tinder-style) ────────────────────────────────
  const swipeMap: Record<string, string> = {
    Left: 'der',
    Down: 'die',
    Right: 'das',
  };

  const swipeHandlers = useSwipeable({
    onSwiped: (e) => {
      const article = swipeMap[e.dir];
      if (article && !isAwaitingNext && currentWord) {
        onSelectOption(article, e.dir);
      }
    },
    trackMouse: false,
    preventScrollOnSwipe: true,
    delta: 40,
  });

  // ─── Keyboard shortcuts (desktop) ─────────────────────────────────
  useEffect(() => {
    if (!started) return;

    const keyMap: Record<string, string> = {
      ArrowLeft: 'der',
      ArrowDown: 'die',
      ArrowRight: 'das',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (keyMap[e.key] && !isAwaitingNext && currentWord) {
        e.preventDefault();
        onSelectOption(keyMap[e.key]);
        return;
      }
      if (e.key === ' ' && isAwaitingNext) {
        e.preventDefault();
        onNext(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [started, isAwaitingNext, currentWord, onSelectOption, onNext]);

  // ─── Filter label helper ──────────────────────────────────────────
  const filterLabel = filter === 'all' ? 'All Words'
    : filter === 'by-rule' ? 'By Rule'
    : filter === 'without-rule' ? 'Without Rule'
    : filter;

  // ─── Welcome / Start Screen ───────────────────────────────────────
  if (!started) {
    return (
      <main>
        <div className="start-screen">
          <h1 className="start-title">Dreiartikel</h1>
          <p className="start-subtitle">Master German articles — der, die, das</p>

          <div className="rules-card">
            <h3>📜 How to play</h3>
            <ul>
              <li>A German word appears — pick the correct article.</li>
              <li>You have <strong>3 seconds</strong> to answer or it counts as wrong.</li>
              <li>Answer fast and press <strong>Next</strong> early to recover time!</li>
              <li>Wrong answers come back later until you get them right.</li>
              <li>Build a <strong>streak</strong> to trigger confetti! 🎉</li>
            </ul>

            <h3>📱 On mobile</h3>
            <ul>
              <li><strong>Swipe ← left</strong> = der</li>
              <li><strong>Swipe ↓ down</strong> = die</li>
              <li><strong>Swipe → right</strong> = das</li>
            </ul>

            <h3 className="desktop-only">⌨️ On desktop</h3>
            <ul className="desktop-only">
              <li><strong>← Left Arrow</strong> = der</li>
              <li><strong>↓ Down Arrow</strong> = die</li>
              <li><strong>→ Right Arrow</strong> = das</li>
              <li><strong>Space</strong> = Next word</li>
            </ul>

            <h3>🏷️ Filters</h3>
            <ul>
              <li><strong>By Rule</strong> — words that follow a suffix/prefix pattern.</li>
              <li><strong>Without Rule</strong> — words you just have to memorize.</li>
              <li>Or pick a topic: Food, Family, Body, Animals, etc.</li>
            </ul>
          </div>

          <button className="start-btn" onClick={() => setStarted(true)}>
            Los geht's!
          </button>
        </div>
      </main>
    );
  }

  // ─── Game Over Screen ─────────────────────────────────────────────
  if (!currentWord) {
    return (
      <div className="game-over">
        <h2>Fantastisch! 🎉</h2>
        <p>You have completed the entire dataset correctly!</p>
        <p>Final Score: {score}</p>
        <p>Best Streak: {bestStreak} 🔥</p>
        <button className="next-btn" onClick={() => window.location.reload()}>Play Again</button>
      </div>
    );
  }

  const streakColor = getStreakColor(streak, bestStreak);
  const timeBankSeconds = (timeBank / 1000).toFixed(1);

  // Swipe direction labels to show on card during swipe
  const swipeDirClass = swipeDir ? `swipe-${swipeDir.toLowerCase()}` : '';

  // ─── Main Game UI ─────────────────────────────────────────────────
  return (
    <main>
      <h2 className="app-title">Dreiartikel</h2>

      {/* ─── Collapsible Filter Dropdown ─── */}
      <div className="filter-dropdown">
        <button
          className="filter-toggle"
          onClick={() => setFilterOpen(!filterOpen)}
        >
          🏷️ {filterLabel}
          <span className={`filter-arrow ${filterOpen ? 'open' : ''}`}>▾</span>
        </button>

        {filterOpen && (
          <div className="filter-menu">
            {[
              { key: 'all', label: 'All Words' },
              { key: 'by-rule', label: '📏 By Rule' },
              { key: 'without-rule', label: '🎲 Without Rule' },
              ...thematicCategories.map(cat => ({ key: cat, label: cat })),
            ].map(item => (
              <button
                key={item.key}
                className={`filter-menu-item ${filter === item.key ? 'active' : ''}`}
                onClick={() => {
                  setFilter(item.key as FilterType);
                  setFilterOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="scoreboard">
        <span className="score-correct">Score: {score}</span>
        <span className="streak" style={{ color: streakColor, transition: 'color 0.3s' }}>
          🔥 {streak} {bestStreak > 0 && <span className="best-streak">(best: {bestStreak})</span>}
        </span>
        <span className="time-bank">⏱ {timeBankSeconds}s</span>
        <span className="items-left">Left: {itemsLeft}</span>
      </div>

      {/* Answer timer bar */}
      {!isAwaitingNext && (
        <div className="answer-timer-track">
          <div className="answer-timer-bar" key={currentWord.id}></div>
        </div>
      )}

      {/* ─── Swipeable Word Card ─── */}
      <div {...swipeHandlers} className={`word-card ${swipeDirClass}`}>
        {/* Mobile swipe direction indicators */}
        <div className="swipe-hints">
          <span className="swipe-hint left">← der</span>
          <span className="swipe-hint down">↓ die</span>
          <span className="swipe-hint right">das →</span>
        </div>

        <div className="word-container">
          <h1 className="active-word">{currentWord.word}</h1>
          <button className="replay-btn" onClick={handleReplay} aria-label="Replay Audio" title="Replay Audio">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          </button>
        </div>
        <p className="hint-text">{currentWord.hint}</p>

        {/* Desktop: clickable article buttons */}
        <div className="options-grid">
          {currentWord.options.map((option, idx) => {
            const keyLabels = ['←', '↓', '→'];
            let btnClass = "option-btn";
            if (isAwaitingNext) {
              if (option === currentWord.answer) {
                btnClass += " correct";
              } else if (option === selectedOption) {
                btnClass += " incorrect";
              }
            }

            return (
              <button
                key={option}
                onClick={() => onSelectOption(option)}
                className={btnClass}
                disabled={isAwaitingNext}
              >
                <span className="key-hint">{keyLabels[idx]}</span>
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
                  <h3>{feedback === 'correct' ? 'Richtig! 🎉' : 'Falsch! ❌'}</h3>
                  <p>{tippText}</p>
                </div>
                <button className="next-btn" autoFocus onClick={() => onNext(true)}>
                  Next Word <span className="key-hint-inline">space</span>
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <h3 style={{ color: feedback === 'correct' ? 'var(--color-success)' : 'var(--color-error)', margin: 0, fontSize: '1.5rem' }}>
                  {feedback === 'correct' ? 'Richtig! 🎉' : 'Falsch! ❌'}
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
    </main>
  );
}

export default App;
