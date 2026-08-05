import { FilterDropdown } from '../components/FilterDropdown';
import { Scoreboard } from '../components/Scoreboard';
import { WordCard } from '../components/WordCard';
import { StoryCard } from '../components/StoryCard';
import { HintBar } from '../components/HintButton';
import { PlaceBanner } from './PlaceBanner';
import type { FilterType, GameMode, Round } from '../hooks/useGameState';
import type { Hint, HintKind } from '../hints';

interface GameScreenProps {
    round: Round;
    mode: GameMode;
    // scoreboard
    score: number;
    streak: number;
    bestStreak: number;
    timeBank: number;
    itemsLeft: number;
    // turn state
    isAwaitingNext: boolean;
    selectedOption: string | null;
    showTipp: boolean;
    feedback: 'correct' | 'incorrect' | null;
    tippText: string | null;
    // hints
    hintsRemaining: Record<HintKind, number>;
    availableHintKinds: HintKind[];
    isFrozen: boolean;
    revealedHint: Hint | null;
    onUseHint: (kind: HintKind) => void;
    // filter
    filter: FilterType;
    categories: string[];
    filterOpen: boolean;
    onToggleFilter: () => void;
    onSelectFilter: (filter: FilterType) => void;
    // story mode
    storyResults: ('correct' | 'missed')[];
    // actions
    onSelectOption: (option: string) => void;
    onReplay: () => void;
    onKnowWhy: () => void;
    onNext: (grantBonus?: boolean) => void;
    onMenu: () => void;
}

export function GameScreen(props: GameScreenProps) {
    const { round, isAwaitingNext } = props;
    const isStory = props.mode === 'story';

    return (
        <main className="game-screen pixel">
            <div className="game-header">
                <button className="menu-btn" onClick={props.onMenu} aria-label="Back to menu">
                    ← Menu
                </button>
                <PlaceBanner mode={props.mode} />
                <span className="game-header-spacer" aria-hidden="true">← Menu</span>
            </div>

            {/* A story is a fixed text — no noun-pool filter. */}
            {!isStory && (
                <FilterDropdown
                    filter={props.filter}
                    categories={props.categories}
                    open={props.filterOpen}
                    onToggle={props.onToggleFilter}
                    onSelect={props.onSelectFilter}
                />
            )}

            <Scoreboard
                score={props.score}
                streak={props.streak}
                bestStreak={props.bestStreak}
                timeBank={props.timeBank}
                itemsLeft={props.itemsLeft}
            />

            {/* Answer timer bar — pauses while a hint freezes the timer */}
            {!isAwaitingNext && (
                <div className="answer-timer-track">
                    <div
                        className={`answer-timer-bar ${props.isFrozen ? 'frozen' : ''}`}
                        key={round.id}
                    ></div>
                </div>
            )}

            {isStory ? (
                <StoryCard
                    round={round}
                    isAwaitingNext={isAwaitingNext}
                    selectedOption={props.selectedOption}
                    showTipp={props.showTipp}
                    feedback={props.feedback}
                    tippText={props.tippText}
                    storyResults={props.storyResults}
                    onSelectOption={props.onSelectOption}
                    onReplay={props.onReplay}
                    onKnowWhy={props.onKnowWhy}
                    onNext={props.onNext}
                />
            ) : (
                <WordCard
                    round={round}
                    mode={props.mode}
                    isAwaitingNext={isAwaitingNext}
                    selectedOption={props.selectedOption}
                    showTipp={props.showTipp}
                    feedback={props.feedback}
                    tippText={props.tippText}
                    onSelectOption={props.onSelectOption}
                    onReplay={props.onReplay}
                    onKnowWhy={props.onKnowWhy}
                    onNext={props.onNext}
                />
            )}

            {!isAwaitingNext && props.availableHintKinds.length > 0 && (
                <HintBar
                    kinds={props.availableHintKinds}
                    remaining={props.hintsRemaining}
                    frozen={props.isFrozen}
                    hint={props.revealedHint}
                    disabled={isAwaitingNext}
                    onUse={props.onUseHint}
                />
            )}
        </main>
    );
}
