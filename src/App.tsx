import { useState, useRef, useEffect } from 'react';
import { useGameState } from './hooks/useGameState';
import { getTipp } from './utils/tipp';

function App() {
  const {
    currentWord,
    score,
    streak,
    feedback,
    tippText,
    isAwaitingNext,
    handleAnswer,
    handleNext,
    handleReplay,
    itemsLeft
  } = useGameState();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showTipp, setShowTipp] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!currentWord) {
    return (
      <div className="game-over">
        <h2>Fantastisch! 🎉</h2>
        <p>You have completed the entire dataset correctly!</p>
        <p>Final Score: {score}</p>
        <button className="next-btn" onClick={() => window.location.reload()}>Play Again</button>
      </div>
    );
  }

  const onSelectOption = (option: string) => {
    setSelectedOption(option);
    handleAnswer(option, getTipp);

    if (option === currentWord.answer) {
      setShowTipp(false);
      timerRef.current = window.setTimeout(() => {
        onNext();
      }, 2000);
    } else {
      setShowTipp(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const onKnowWhy = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowTipp(true);
  };

  const onNext = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setSelectedOption(null);
    setShowTipp(false);
    handleNext();
  };

  return (
    <main>
      <div className="scoreboard">
        <span className="score-correct">Score: {score}</span>
        <span className="streak">🔥 Streak: {streak}</span>
        <span className="items-left">Left: {itemsLeft}</span>
      </div>

      <div className="word-card">
        <div className="word-container">
          <h1 className="active-word">{currentWord.word}</h1>
          <button className="replay-btn" onClick={handleReplay} aria-label="Replay Audio" title="Replay Audio">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          </button>
        </div>
        <p className="hint-text">{currentWord.hint}</p>

        <div className="options-grid">
          {currentWord.options.map(option => {
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
                <button className="next-btn" autoFocus onClick={onNext}>
                  Next Word
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <h3 style={{ color: feedback === 'correct' ? 'var(--color-success)' : 'var(--color-error)', margin: 0, fontSize: '1.5rem' }}>
                  {feedback === 'correct' ? 'Richtig! 🎉' : 'Falsch! ❌'}
                </h3>
                <button className="know-why-btn" autoFocus onClick={onKnowWhy}>
                  Know why
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
