# The German Adventure

A German learning app built around story-driven exercises. The game presents a short story and guides the player through targeted drills covering the vocabulary and grammar needed to understand it. Within each story, players can select words or structures to translate directly — but the real goal is to internalize that knowledge and apply it in the exercises that follow.

## Table of versions

Verisons:

V.1 : Minimun Valuable Product. It will contain the necesary elements to play the first 3 minigames.

## Table of elements

| Element | Description |
|---------|-------------|
| <a id="map"></a>Map | The map where the player can see the [Story Points](#story-point), the [Challenge Points](#challenge-point), and the path between them. The player cannot advance until previous points have been completed. |
| <a id="story-point"></a>Story Point | The first point the player will find. Illustrated on the map as a blue square. When the player enters a Story Point, the [Story Box](#story-box) renders over the screen. |
| <a id="challenge-point"></a>Challenge Point | Illustrated on the map in V1 as red circles. These are the points where the player practises the vocabulary and grammar presented in the previous [Story Points](#story-point). When the player enters a Challenge Point, the Challenge Game renders in full screen. It pulls vocabulary from the Vocabulary List using the Learning Vocabulary Algorithm, pushes updates to the Vocabulary List after each player action (updating the Learning Score), and adds new vocabulary from nouns.js if the player has completed all words in the list or is on a very high answer streak. n |
| <a id="story-box"></a>Story Box | A box with a pixelated profile picture of the speaking character. The player can use the [Translator Support](#translator-support) from this screen. Renders over the [Map](#map). |
| <a id="translator-support"></a>Translator Support | A tool that allows the player to select words or concepts to translate or explain them. In V1, it only translates words as they appear. It sends the words that required help to the Vocabulary List in `VocabularyList.json` with a Learning Score of 0. |
| <a id="learning-algorithm"></a>Learning Algorithm | The algorithm that determines the probability of a word being chosen and how the Learning Score is modified after new inclusions, correct answers, and wrong answers in the Challenge Game. More details in the [Learning Algorithm](#learning-algorithm-section) section. |



## How to play

1. The player opens the app and sees the [Map](#map), which shows the available [Story Points](#story-point) and [Challenge Points](#challenge-point) connected by a path.
2. The player taps a [Story Point](#story-point). The [Story Box](#story-box) appears over the map, showing a short story told by a character. The player can tap any word they don't understand to get a translation via the [Translator Support](#translator-support). Words looked up are saved to the Vocabulary List with a Learning Score of 0.
3. Once the story is read, the player closes the Story Box and returns to the map. The next point — a [Challenge Point](#challenge-point) — is now unlocked.
4. The player taps the Challenge Point. The Challenge Game launches in full screen. The game picks words from the Vocabulary List using the [Learning Algorithm](#learning-algorithm), favouring words the player knows least. The player answers each challenge and their Learning Scores update in real time.
5. Once the Challenge Point is completed, the path advances and the next Story Point is unlocked. The cycle repeats.

## Project structure

| Path | Responsibility |
|------|----------------|
| `src/data.ts` | The word dataset and `PracticeItem` shape. Each noun's canonical fact is its **gender** (`m`/`f`/`n`); the article is derived from it. |
| `src/rules.ts` | **Single source of truth** for German gender rules — drives both the "By Rule" filter (`hasRule`) and the Tipp explanations (`getTipp`). Also holds `articleForGender`, the seam where grammatical cases will plug in. |
| `src/hooks/useGameState.ts` | Game loop: queue, scoring, streaks, the time-bank "chess clock", and spaced re-queueing of wrong answers. |
| `src/utils/speech.ts` | Web Speech API wrapper that reads each word aloud in German. |
| `src/utils/confetti.ts` | Escalating confetti and streak-color logic. |
| `src/App.tsx` | UI: start screen, game screen, swipe/keyboard handling. |

## Scripts

```bash
npm run dev      # start the dev server
npm run build    # type-check + production build
npm run check    # type-check + lint
npm test         # run the test suite (vitest)
npm run preview  # preview the production build
```

## Tests

- `src/rules.test.ts` — gender-rule logic and Tipp explanations.
- `src/data.test.ts` — dataset integrity: valid genders, capitalised nouns,
  no duplicates. This is the safety net for the hand-entered word list.

## Roadmap

The steps below implement The German Adventure (V1) on top of the existing
codebase. They are ordered by dependency and sized so each one can be done in a
single short session. To run one, ask Claude: *"Do Roadmap step N"*.

**Already in place** (no work needed): the scrolling [Map](#map) with nodes and
paths (`src/map.json`, `MapScreen`), story letters with fill-in-the-blank
reading (`stories.ts`, `StoryCard`), the challenge game loop
(`useGameState.ts`), and the noun dataset (`nouns.json`).

| Step | Status | Task | What it delivers | Depends on |
|------|--------|------|------------------|------------|
| 1 | ✅ Done | **Vocabulary List store** | New pure module `src/vocabulary.ts`: the `VocabularyEntry` shape (word, gender, plural — each with its own Learning Score 0–100), load/save via `localStorage` (the client-side stand-in for `VocabularyList.json`), `addWord` (score 0, no duplicates), and a JSON export helper. Plus `vocabulary.test.ts`. Touches no UI. | — |
| 2 | ⬜ | **Learning Algorithm** | New pure module `src/learning.ts`: `selectWord(list, attribute, recentWords)` — weighted roulette where weight = 100 − Learning Score, skipping the last 6 challenged words — and `applyResult` (+15 correct / −15 wrong, clamped to 0–100). Plus `learning.test.ts` (invariant-based, per repo convention). | Step 1 |
| 3 | ⬜ | **Translator Support** | In the [Story Box](#story-box): tapping any word shows its translation (from `nouns.json`, falling back to a small story-glossary). Every looked-up word is added to the Vocabulary List with Learning Score 0. | Step 1 |
| 4 | ⬜ | **Challenge Game ↔ Vocabulary List** | The Challenge Game pulls its words through `selectWord` instead of shuffling the whole pool, updates Learning Scores after every answer, and tops the list up from `nouns.json` when all words are learned or the player is on a high streak. | Steps 1–2 |
| 5 | ⬜ | **Map progression** | Points are locked until all previous points on the path are completed; completion is persisted in `localStorage` so progress survives reloads. Story Points render as blue squares, Challenge Points as red circles. | — |
| 6 | ⬜ | **Story Box portrait** | The pixelated profile picture of the speaking character in the Story Box, per story. | — |
| 7 | ⬜ | **Polish & verify** | Run the full app end-to-end: story → translator → vocabulary → challenge → map advance. Fix seams, update this README's Project structure table, and bump the [Table of versions](#table-of-versions). | Steps 1–6 |

> **Note on the pseudo-code:** in the [Learning Algorithm](#learning-algorithm-section)
> section, `TotalWeight` sums the raw attribute score but the roulette counter
> sums `100 − score`. Step 2 implements the consistent version (both use
> `100 − score`, i.e. low-score words are picked more often).


## <a id="learning-algorithm-section"></a>Learning Algorithm

The learning algorithm for V1 is straightforward — it uses weighted random selection (a method where elements with more weight have a higher probability of being chosen). Each word has three important characteristics: word, gender, and plural. Each characteristic has a Learning Score associated with it, which is the inverse of the weight: when it reaches 100, the word is successfully memorized; when it is 0, it is still a new word to learn. Each game selects words for the challenge randomly depending on their weight in the relevant attribute. After a correct answer, the game improves the score by 15. After a wrong answer, it reduces the score by 15. One word cannot be chosen again until 6 different words have been challenged.

```
Function selectWord(vocabularyList, relAtt, repeatedWords)


// Total words
TW = numberOfElements(VocabularyList);

// Sum all weights
TotalWeight = 0;
for i = 0 : TW - 1
    TotalWeight = TotalWeight + VocabularyList(i).Attribute(RelAtt);
end;

randomNumber = generateRandom(1 : TotalWeight);

// Select word by roulette wheel
wordSelected = 0;
counter = 0;
for i = 0 : TW - 1
    counter = counter + 100-VocabularyList(i).Attribute(RelAtt);
    if counter >= randomNumber
        if VocabularyList(i) is not in repeatedWords;
            wordSelected = i;
            break;
        else
    else
        end;
end;

output(VocabularyList(wordSelected));
```

### Example

In the Article game, the game is interested in the gender attribute of the words. It then chooses a random word from the vocabulary list considering the weight of the relevant attribute (inverse of its Learning Score). If the word was already selected in the previous 7 challenges, it picks the next one. After the challenge, if the player's answer was correct, the game increases the score by 15; if it was incorrect, it reduces the score by 15.