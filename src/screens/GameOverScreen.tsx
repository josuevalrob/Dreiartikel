interface GameOverScreenProps {
    score: number;
    bestStreak: number;
    /** Story mode: total questions, for an "X / N correct" tally. */
    total?: number;
    onPlayAgain: () => void;
}

export function GameOverScreen({ score, bestStreak, total, onPlayAgain }: GameOverScreenProps) {
    const isStory = total !== undefined;
    return (
        <div className="game-over pixel">
            <div className="game-over-panel">
                <div className="game-over-crest" aria-hidden="true">🏆</div>
                <h2 className="game-over-title">{isStory ? 'Geschafft!' : 'Fantastisch!'}</h2>
                <p className="game-over-sub">
                    {isStory ? 'You reached the end of the letter!' : 'You completed the whole dataset!'}
                </p>

                <div className="game-over-stats">
                    <div className="game-over-stat">
                        <span className="game-over-stat-label">{isStory ? 'Score' : 'Final'}</span>
                        <span className="game-over-stat-value">{isStory ? `${score} / ${total}` : score}</span>
                    </div>
                    <div className="game-over-stat">
                        <span className="game-over-stat-label">Best Streak</span>
                        <span className="game-over-stat-value">{bestStreak} 🔥</span>
                    </div>
                </div>

                <button className="start-btn game-over-btn" onClick={onPlayAgain}>
                    Back to Map
                </button>
            </div>
        </div>
    );
}
