# German Article Training Web App

This application will be built as a client-side React SPA, designed for training German articles dynamically.

## Proposed Changes

### 1. Framework & Setup
* Scaffold a React + TypeScript project using Vite.
* Rely on vanilla CSS variables and CSS modules for a fast, modern structure that supports a clean, vibrant aesthetic.

### 2. Data Structure & Parser
* **File:** `src/data.ts`
* The provided raw strings separated by `#` will be parsed into an array of objects during app initialization.

### 3. State Management (React Hooks)
* **File:** `src/hooks/useGameState.ts`
* **Queue logic:** Maintain a mutated `mainQueue`.
* Wrong answers are placed `Math.floor(Math.random() * 4) + 2` slots ahead.
* Score & Streak tracking.

### 4. Audio Engine
* **File:** `src/utils/speech.ts`
* Wraps the native `window.speechSynthesis`, dynamically fetching the best `de-DE` voice.
* Pure Web Speech API usage with an exported `playWord` driver.

### 5. Tipp Engine (Rules Explanation)
* **File:** `src/utils/tipp.ts`
* A pure function `getTipp(word: string, article: "der" | "die" | "das")` to determine the grammatical rule.
* **Logic:**
  * Checks word suffix against static feminine (`-ung`, `-heit`, `-keit`, `-schaft`, `-tion`, `-tät`, `-ik`, `-ei`, `-ie`, `-ur`, `-enz`), neuter (`-chen`, `-lein`, `-ment`, `-um`, `-ma`), and masculine (`-ling`, `-ismus`, `-or`, `-ig`, `-ich`, `-ant`, `-ast`, `-us`) endings.
  * Checks for common prefixes (`Ge-` usually neuter).
  * Returns a short rule text (1-2 lines) explaining *why* it is correct.
  * Fallbacks gracefully if no hard rule strictly applies ("This one is best memorized — no strong pattern applies.").
  * No exceptions list beyond strictly enforcing string ending/starts constraints.

### 6. UI Layout & Components
* **Layout:** Centered active word, hint below it, 3 dynamic options buttons.
* **Tipp Feature:** A dedicated call-out box shown after an option is selected that displays the output of `getTipp`.
* Uses vibrant colors, large fonts, and smooth CSS transitions.

## User Review Required
> [!IMPORTANT]
> The plan is updated with the Pure Function Tipp Engine, prioritizing strict string suffix/prefix rules without using external datasets or an LLM call.

## Verification Plan
### Manual Verification
1. Click through answers and verify the logic output from the Tipp Engine matches the suffix/prefix.
2. Ensure words ending in `-chen` specify it is a diminutive neuter word, etc.
