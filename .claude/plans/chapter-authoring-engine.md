# Chapter-Authoring Engine — Verified Build Spec

Status: design verified by two workflow passes (investigate→synthesize→critique,
then corrected-design verification). Render half and case half both `holds:true`.
Build against this. On `feat/story-mode` (engine work).

## The idea

Author writes a **chapter** = plain grammatical German prose + one **topic tag**
(`genus` | `kasus-dat` | `kasus-akk` | `plural`). The engine auto-detects
`<definite article> <Noun>` spots, infers the case **from the surface article the
author wrote** (not from the tag — the tag is a *filter* over which spots to
drill), derives each blank's answer/options/tipp from the existing grammar
machinery, and emits the SAME `PracticeRound[]` with `storyContext` that
`stories.ts` produces — so the game loop + StoryCard play it unchanged.

Main quest = an ordered sequence of these per-topic chapters following the book
TOC (Ch1 Nomen: genus → plural → kasus). Side quests = the existing standalone
drills. No XP/points; free map nav unchanged.

## Two corrections the critique forced (do not regress)

- **A. Blank the ARTICLE, not the noun.** The noun stays a visible text segment.
  (Blanking the noun + injecting the article dropped the noun from the view.)
- **B. The surface article determines the case.** "mit dem Hund" → dat; "ich
  sehe den Hund" → akk. The author writes normal German; answers are correct by
  construction. The tag only *filters* which spots get drilled.

## Key reuse facts (verified against real code)

- Story rounds render from `storyContext.lines` via **StoryCard** (GameScreen.tsx:90,
  StoryCard.tsx:147), NOT from `promptText`. So the noun-after-blank is ALWAYS
  visible — genus needs no render change.
- `nounAfter:''` is correct (noun is a real text segment; stories.ts:180 short-circuits).
- `buildView` / `leadInBeforeBlank` / `continuationAfterBlank` / `buildStoryRounds`
  are reused unchanged except the prompt-construction fix (Step 5).

## Case decision table — (column, surfaceArticle) → case, blankable per tag

column = gender m/f/n OR 'pl'. Genitive is OUT OF SCOPE.

- (m, der) → nom        | genus:y  akk:n  dat:n
- (m, den) → akk        | akk:y    (akk-only for masc)
- (m, dem) → dat        | dat:y    (dem is dat-only)
- (m, des) → gen        | NEVER (des not even tokenized as an article)
- (f, die) → {nom,akk}  | genus:y ; akk:y ONLY w/ akk trigger ; dat:n
- (f, der) → {dat,gen}→dat under no-gen rule | dat:y ; genus:n ; akk:n
- (n, das) → {nom,akk}  | genus:y ; akk:y ONLY w/ akk trigger ; dat:n
- (n, dem) → dat        | dat:y
- (n, des) → gen        | NEVER
- (pl, die) → {nom,akk} | genus:n (genus is sg drill) ; akk:n
- (pl, den) → dat-pl    | dat:y (number-aware: NOT misread as masc-akk-sg)
- (pl, der) → gen-pl    | NEVER

Per tag: **genus** blanks ANY resolved *singular* spot (answer
`articleFor(gender,'nom','sg')`, options der/die/das FIXED order). **kasus-dat**
blanks dem-pairs (m/n), der+fem, den+plural. **kasus-akk** blanks den+masc
unconditionally; die+fem / das+neut ONLY with an akk trigger. Non-blankable spots
render as plain prose (documented limit, not a bug).

## Build order (pure-logic first, each independently testable + committable)

1. **declension.ts** — `caseForSurface(genderOrPl: Gender|'pl', article): Case | Case[] | null`
   from the existing DEFINITE table. Test: m/den→akk, m/dem→dat, m/der→nom,
   f/die→[nom,akk], f/der→[dat,gen], n/dem→dat, pl/den→dat, des→gen, null for
   impossible pairs.
2. **data.ts** — `buildByPlural(): Map<string, PracticeItem>` from
   generateItems()+pluralForm. Test: every plural surface maps back; no
   collisions.
3. **chapters.ts (new)** — `parseChapter(tag, lines: string[]): Segment[][]`.
   Tokenize (preserve whitespace + punctuation in text runs); detect
   {der,die,das,dem,den}+Capitalized-noun; resolve noun byWord → weak-masc single
   `-n` strip gated by WEAK_MASCULINE → byPlural (number-aware); `caseForSurface`;
   per-tag blankability + akk-trigger detection (reuse sentences.ts prepositions).
   Emit existing `Segment[]`. Blankable article → `{kind:'blank', word: noun-as-written}`
   + following `{kind:'text'}` carrying the noun + its own leading space.
   Non-blankable → whole "article noun" as one text segment.
4. **stories.ts** — `resolveGenusBlank(item)` (answer nom-sg article, FIXED
   der/die/das, nounAfter:'') and `resolveKasusBlank(item, surfaceArticle,
   caseName, trigger)` (answer=surfaceArticle, options=shuffle(optionsForCase),
   nounAfter:''). Mirror resolvePluralBlank (stories.ts:142).
5. **stories.ts** — `trailingTextAfterBlank(viewLine, globalBlank)` (same-line
   text AFTER the blank up to next blank/EOL). Wire prompt fix:
   `promptText = \`${lead} ___${trail}\`.trim()` → "Ich sehe ___ Hund". Extend
   Story.mode union to genus|kasus-dat|kasus-akk; branch resolve() fork
   (stories.ts:262-270) to the new resolvers. Do NOT touch leadInBeforeBlank's
   break-at-blank semantics (other call sites rely on it).
6. **useGameState.ts** — feed story `speakOnShow` from noun-inclusive lead+trail
   WITHOUT the article (replace the '___' token, don't strip-to-end at line 70).
   Prefer riding the existing 'story' mode (no new GameMode) — extraction over
   abstraction. Article never spoken before answering (no-leak rule).
7. **StoryCard** — verify renders unchanged (expected ZERO code). Then
   `npm run check && npm test && npm run build`.

## v1 limits (log in NIGHT.md / morning report)

- Ambiguous fem/neut {nom,akk} without an akk trigger → left as prose (not blanked).
- Genitive fully out of scope; 'des' not tokenized; authors must write NO genitive
  prose in case chapters (unverifiable author obligation — add a doc note + cheap
  lint flagging a literal 'des ' in case-chapter prose).
- Weak-masc strip handles only single trailing -n over WEAK_MASCULINE (all -e-final).
- Plural-only nouns excluded from case/genus drilling.
- akk-trigger detection heuristic (reuses sentences.ts prep set); a miss only
  narrows (→prose), never a wrong answer.
- No Phase-2 ditransitive (single blanked article per spot).

## Then: Chapter 1 prose + map wiring

- Author Ch1 "The Call to Adventure" as RawChapter prose (genus → plural → kasus),
  natural German with correct surface articles. Verify with grammar-reviewer.
- map.ts: chapterId on MapNode + Ch1 nodes/edges (or reuse storyId path). Thread
  through MapScreen.onStart → App → useGameState. Update map.test.ts guards
  (VALID_MODES is a 5-entry list on line 9; node-id assertion uses arrayContaining
  so appending nodes is fine).
