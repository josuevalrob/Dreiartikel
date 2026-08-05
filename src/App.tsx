import { useState, useRef, useEffect } from 'react';
import { useGameState, type FilterType, type GameMode, type CaseFilter } from './hooks/useGameState';
import { useInput } from './hooks/useInput';
import { getCategories } from './data';
import { getHypeLevel, fireConfetti } from './utils/confetti';
import { setAudioEnabled } from './utils/speech';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { MapScreen } from './screens/MapScreen';
import { GameScreen } from './screens/GameScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { SettingsScreen } from './screens/SettingsScreen';

const thematicCategories = getCategories();

type Screen = 'map' | 'game' | 'over' | 'settings';

function App() {
  const [screen, setScreen] = useState<Screen>('map');
  const [filter, setFilter] = useState<FilterType>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [mode, setMode] = useState<GameMode>('article');
  const [caseFilter, setCaseFilter] = useState<CaseFilter>('all');
  const [storyId, setStoryId] = useState<string | undefined>(undefined);
  const [chapterId, setChapterId] = useState<string | undefined>(undefined);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const started = screen === 'game';

  // Keep the audio layer in sync with the setting (one global gate in speech.ts).
  useEffect(() => {
    setAudioEnabled(settings.audioEnabled);
  }, [settings.audioEnabled]);

  const {
    currentWord,
    score,
    streak,
    bestStreak,
    feedback,
    tippText,
    isAwaitingNext,
    selectedOption,
    showTipp,
    hintsRemaining,
    revealedHint,
    isFrozen,
    availableHintKinds,
    selectAnswer,
    knowWhy,
    next: onNext,
    useHint,
    replay: onReplay,
    itemsLeft,
    timeBank,
    storyResults,
  } = useGameState(filter, mode, caseFilter, started, storyId, chapterId, settings.durationSec);

  const prevStreakRef = useRef(0);

  // Story mode: remember the blank count while the story plays, so the game-over
  // screen can show "X / N correct" after the queue (and storyContext) is gone.
  const [storyTotal, setStoryTotal] = useState<number | null>(null);
  const storyBlankCount = currentWord?.storyContext?.blankCount ?? null;
  useEffect(() => {
    if (storyBlankCount !== null) setStoryTotal(storyBlankCount);
  }, [storyBlankCount]);

  // Reset confetti baseline when filter or mode changes
  useEffect(() => {
    prevStreakRef.current = 0;
    setStoryTotal(null);
  }, [filter, mode]);

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

  // Keyboard input (desktop); mobile taps the option buttons directly.
  useInput({
    active: started,
    currentWord,
    isAwaitingNext,
    onSelectOption: selectAnswer,
    onNext,
  });

  // ─── Routing ───────────────────────────────────────────────────────
  if (screen === 'settings') {
    return (
      <SettingsScreen
        settings={settings}
        onChange={setSettings}
        onClose={() => setScreen('map')}
      />
    );
  }

  if (screen === 'map') {
    return (
      <MapScreen
        onStart={(m, cf, f, sid, cid) => {
          setMode(m);
          setCaseFilter(cf);
          setFilter(f);
          setStoryId(sid);
          setChapterId(cid);
          setScreen('game');
        }}
        onOpenSettings={() => setScreen('settings')}
      />
    );
  }

  // A finished queue (no current round) means the run is over.
  if (!currentWord) {
    return (
      <GameOverScreen
        score={score}
        bestStreak={bestStreak}
        total={mode === 'story' ? storyTotal ?? undefined : undefined}
        onPlayAgain={() => setScreen('map')}
      />
    );
  }

  return (
    <GameScreen
      round={currentWord}
      mode={mode}
      score={score}
      streak={streak}
      bestStreak={bestStreak}
      timeBank={timeBank}
      itemsLeft={itemsLeft}
      isAwaitingNext={isAwaitingNext}
      selectedOption={selectedOption}
      showTipp={showTipp}
      feedback={feedback}
      tippText={tippText}
      hintsRemaining={hintsRemaining}
      availableHintKinds={availableHintKinds}
      isFrozen={isFrozen}
      revealedHint={revealedHint}
      onUseHint={useHint}
      filter={filter}
      categories={thematicCategories}
      filterOpen={filterOpen}
      onToggleFilter={() => setFilterOpen(o => !o)}
      onSelectFilter={(f) => { setFilter(f); setFilterOpen(false); }}
      storyResults={storyResults}
      onSelectOption={(option) => selectAnswer(option)}
      onReplay={onReplay}
      onKnowWhy={knowWhy}
      onNext={onNext}
      onMenu={() => setScreen('map')}
    />
  );
}

export default App;
