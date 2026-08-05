// Story Mode: the learner reads a short German letter sentence by sentence and
// fills each blank with the correct plural, using the 3-option selector. It is a
// narrative wrapper around the existing engine: each blank is ONE PracticeRound
// (built by reusing plurals.ts), and the surrounding text rides along as
// `storyContext` so the UI can render the "cumulative letter".
//
// Stored vs derived (the project's recurring rule): the letter TEXT and which
// word fills each blank are STORED here; each blank's answer, decoys, options,
// hint and Tipp are DERIVED by the plural machinery — never duplicated.

import { generateItems, type PracticeItem } from './data';
import { buildPluralRound } from './plurals';
import { buildArticleRound } from './articles';
import { articleFor, optionsForCase, declineNoun, caseForSurface, CASE_LABELS, type Case } from './declension';
import { genderHint, type Hint } from './hints';
import { shuffle } from './utils/random';
import type { PracticeRound } from './round';

// ── Story data shape ────────────────────────────────────────────────────────

/** A run of a line: literal text, or a blank for `word`. What the blank asks
 *  depends on the story's mode:
 *   - plural story → the answer is the noun's PLURAL form (the blank IS the noun)
 *   - dativ story  → the answer is the ARTICLE in that case (dem/der); the
 *                    declined noun is shown right after the blank automatically. */
export type Segment =
    | { kind: 'text'; text: string }
    | {
        kind: 'blank';
        word: string;
        /** Case stories/chapters only: why this blank is in its case, phrased for
         *  the Tipp ("the preposition 'bei'"). Ignored by plural stories. */
        trigger?: string;
        /** Chapter case blanks only: the surface definite article the author
         *  wrote (der/die/das/dem/den). It IS the correct answer, and the case is
         *  read off it. Absent in plural/genus blanks and hand-authored stories. */
        article?: string;
    };

/** The grammar a story or chapter drills. The first two power the hand-authored
 *  letters; the rest power prose-parsed chapters (the answer is read off the
 *  surface article, so they share one chapter-case resolver). */
export type StoryMode = 'plural' | 'dativ' | 'genus' | 'kasus-dat' | 'kasus-akk';

/** A story is an ordered list of lines; each line is a list of segments. Lines
 *  are the reading unit (we read/reveal line by line). */
export interface Story {
    id: string;
    title: string;
    /** Which grammar the blanks drill — selects how each blank's answer/options
     *  are built (plural form vs gender vs case article). */
    mode: StoryMode;
    lines: Segment[][];
}

/** An answer-free view of one segment, for rendering the letter. Blanks carry
 *  their global index so the UI can mark them done / current / future and fill
 *  the answer once revealed. */
export interface StorySegmentView {
    kind: 'text' | 'blank';
    /** Plain text for `text` segments; '' for blanks. */
    text: string;
    /** 0-based index among ALL blanks in the story (blanks only). */
    blankIndex?: number;
    /** The correct fill for a blank (blanks only). The UI shows it only once the
     *  blank has been answered, so it's not a spoiler — it lets answered blanks
     *  render the real word ("Bücher") instead of a marker. */
    answer?: string;
}

/** The narrative frame a story round sits in. The `lines` view is shared by
 *  reference across all of a story's rounds; only `blankIndex`/`answer` differ. */
export interface StoryContext {
    storyId: string;
    title: string;
    /** The whole letter, answer-free, as view-lines. */
    lines: StorySegmentView[][];
    /** Which blank THIS round fills. */
    blankIndex: number;
    /** Total blanks N, for the end-of-story "X / N" tally. */
    blankCount: number;
    /** The correct fill for this blank (so the UI can show answered blanks). */
    answer: string;
}

// ── The first story: "Liebe Lisa" (plural) ──────────────────────────────────
// Every blank word is a real dataset noun with a known plural, so answers and
// decoys come straight from plurals.ts. stories.test.ts guards this.

const t = (text: string): Segment => ({ kind: 'text', text });
const b = (word: string): Segment => ({ kind: 'blank', word });
/** A Dativ blank: `word` + the trigger phrase that forces the case (for the Tipp). */
const bd = (word: string, trigger: string): Segment => ({ kind: 'blank', word, trigger });

const LIEBE_LISA: Story = {
    id: 'liebe-lisa',
    title: 'Liebe Lisa',
    mode: 'plural',
    lines: [
        [t('Liebe Lisa, wie geht es dir?')],
        [t('Hier an der Uni ist viel los — wir lesen viele '), b('Buch'), t(' und lernen jeden Tag.')],
        [t('Nur um Max mache ich mir Gedanken.')],
        [t('Statt zu lernen sitzt er ständig in den '), b('Café'), t(' der Stadt.')],
        [t('Dort plaudert er mit anderen '), b('Kind'), t(' und seinen '), b('Freundin'), t('.')],
        [t('Abends macht er nur '), b('Foto'), t(' und tanzt in allen '), b('Disco'), t(' der Stadt.')],
        [t('Das kann doch nicht gut gehen! Ruf ihn mal an.')],
        [t('Alles Liebe, deine Elisabeth.')],
    ],
};

// ── The second story: "Ein Tag mit der Familie" (Dativ) ─────────────────────
// Every blank's answer is the ARTICLE in the Dativ (dem/der); the declined noun
// is shown right after it. The trigger (a Dativ preposition) is given per blank
// so the Tipp can explain *why* it's Dativ. A clear case-based fork.

const FAMILIENTAG: Story = {
    id: 'familientag',
    title: 'Ein Tag mit der Familie',
    mode: 'dativ',
    lines: [
        [t('Hallo Tom! Gestern war ein schöner Tag.')],
        [t('Am Morgen bin ich mit '), bd('Hund', "the preposition 'mit'"), t(' im Park spazieren gegangen.')],
        [t('Dann habe ich '), bd('Mutter', "the dative verb 'helfen'"), t(' beim Kochen geholfen.')],
        [t('Nach dem Essen sind wir zu '), bd('Bruder', "the preposition 'zu'"), t(' gefahren.')],
        [t('Er wohnt jetzt mit '), bd('Freundin', "the preposition 'mit'"), t(' in der Stadt.')],
        [t('Am Abend habe ich noch von '), bd('Vater', "the preposition 'von'"), t(' ein Buch bekommen.')],
        [t('Und du? Was hast du mit '), bd('Kind', "the preposition 'mit'"), t(' gemacht?')],
        [t('Schreib bald! Dein Felix.')],
    ],
};

export const STORIES: Story[] = [LIEBE_LISA, FAMILIENTAG];

// ── Per-blank resolution (mode-aware) ────────────────────────────────────────

/** Everything one blank needs, computed once and shared between the view and the
 *  round. Plural and Dativ stories produce this same shape, so the view/audio
 *  logic downstream is mode-agnostic. */
interface ResolvedBlank {
    item: PracticeItem;
    /** The string that fills the blank (a plural form, or an article). */
    answer: string;
    /** The shuffled options for the 3-way selector. */
    options: string[];
    /** Text shown immediately AFTER the blank (the declined noun in Dativ; '' in
     *  plural mode, where the blank itself is the noun). */
    nounAfter: string;
    tipp: string;
    hints: Hint[];
}

function resolvePluralBlank(item: PracticeItem): ResolvedBlank {
    const base = buildPluralRound(item);
    return { item, answer: base.answer, options: base.options, nounAfter: '', tipp: base.tipp, hints: base.hints };
}

function resolveDativBlank(item: PracticeItem, trigger: string): ResolvedBlank {
    const caseName: Case = 'dat';
    const answer = articleFor(item.gender, caseName, 'sg');
    const options = shuffle(optionsForCase(caseName, 'sg'));
    const noun = declineNoun(item.word, !!item.isWeakMasculine, caseName, 'sg');
    const tipp = `${trigger} takes the ${CASE_LABELS[caseName]}: "${answer} ${noun}".`;
    const hints: Hint[] = [
        { kind: 'rule', text: `${trigger} forces the ${CASE_LABELS[caseName]} — ask "wem?".` },
        genderHint(item.word, item.gender),
    ];
    return { item, answer, options, nounAfter: noun, tipp, hints };
}

// ── Chapter resolvers (article blanked; noun stays in the authored prose) ────
// These power chapters parsed from prose. Unlike the hand-authored stories above,
// a chapter writes the (already-declined) noun directly in its text, so these set
// nounAfter:'' — the noun must NOT be re-injected or it would render twice.

/** Genus blank: pick the Nominativ-singular article (der/die/das) for a bare
 *  noun. Options stay in FIXED der/die/das order — never shuffled — to preserve
 *  the article-mode muscle memory (CLAUDE.md). */
export function resolveGenusBlank(item: PracticeItem): ResolvedBlank {
    const base = buildArticleRound(item);   // answer = nom-sg article, fixed options
    return { item, answer: base.answer, options: base.options, nounAfter: '', tipp: base.tipp, hints: base.hints };
}

/** Kasus blank inside a chapter: the answer is the surface article the author
 *  wrote (already case-correct), with decoys from optionsForCase. The noun is
 *  visible in the prose, so nounAfter:''. `caseName` is read off the surface
 *  article by the parser; `trigger` (when present) explains why. */
export function resolveChapterCaseBlank(
    item: PracticeItem,
    answer: string,
    caseName: Case,
    trigger?: string,
): ResolvedBlank {
    const options = shuffle(optionsForCase(caseName, 'sg'));
    const why = trigger ?? `this ${CASE_LABELS[caseName]} context`;
    const question = caseName === 'dat' ? 'wem?' : caseName === 'akk' ? 'wen?' : 'wer?';
    const tipp = `${why} takes the ${CASE_LABELS[caseName]}: "${answer} ${item.word}".`;
    const hints: Hint[] = [
        { kind: 'rule', text: `${why} forces the ${CASE_LABELS[caseName]} — ask "${question}".` },
        genderHint(item.word, item.gender),
    ];
    return { item, answer, options, nounAfter: '', tipp, hints };
}

// ── Generation: each blank → one PracticeRound, with narrative context ───────

/** Flatten a story's lines into the view shared across its rounds, numbering
 *  blanks globally in reading order and resolving each blank (mode-aware). For a
 *  Dativ blank the declined noun is inserted as a text segment right after the
 *  blank, so the cumulative letter + audio render "bei dem Studio" naturally. */
function buildView(
    story: Story,
    resolve: (seg: Extract<Segment, { kind: 'blank' }>) => ResolvedBlank | null,
): { lines: StorySegmentView[][]; resolved: (ResolvedBlank | null)[] } {
    const resolved: (ResolvedBlank | null)[] = [];
    const lines: StorySegmentView[][] = story.lines.map(line => {
        const out: StorySegmentView[] = [];
        for (const seg of line) {
            if (seg.kind === 'text') { out.push({ kind: 'text', text: seg.text }); continue; }
            const blankIndex = resolved.length;
            const rb = resolve(seg);
            resolved.push(rb);
            out.push({ kind: 'blank', text: '', blankIndex, answer: rb ? rb.answer : seg.word });
            // Dativ: show the declined noun right after the article blank.
            if (rb && rb.nounAfter) out.push({ kind: 'text', text: ` ${rb.nounAfter}` });
        }
        return out;
    });
    return { lines, resolved };
}

/** The text shown/read up to (and excluding) the blank `globalBlank` — the
 *  "lead-in" spoken on show. If an EARLIER blank sits on the same line, the
 *  connecting text ("…schläft, und ") was already spoken as the tail of THAT
 *  blank's post-answer read (continuationAfterBlank reads up to the next blank).
 *  Re-reading it on show would repeat it, so a blank that follows another on its
 *  line has an EMPTY lead-in. Only the first blank of a line carries a lead-in —
 *  the text from the line start up to it. */
function leadInBeforeBlank(viewLine: StorySegmentView[], globalBlank: number): string {
    let out = '';
    for (const seg of viewLine) {
        if (seg.kind === 'text') { out += seg.text; continue; }
        if (seg.blankIndex === globalBlank) break;     // reached our blank
        return '';                                     // an earlier blank → no lead-in
    }
    return out.replace(/\s+/g, ' ').trim();
}

/** The same-line text that FOLLOWS the blank, up to the next blank or end of
 *  line — e.g. the noun in "Ich sehe ___ Hund" (genus/kasus, where the article is
 *  blanked and the noun rides on as text). Lets the prompt show the noun the
 *  learner is judging. Stops at the next blank so it never reveals a later answer.
 *  Plural blanks have no following noun, so this is just trailing punctuation. */
function trailingTextAfterBlank(viewLine: StorySegmentView[], globalBlank: number): string {
    let out = '';
    let passed = false;
    for (const seg of viewLine) {
        if (seg.kind === 'blank') {
            if (seg.blankIndex === globalBlank) { passed = true; continue; }
            if (passed) break;                  // next blank — stop before it
            continue;
        }
        if (passed) out += seg.text;            // text after our blank
    }
    return out.replace(/\s+/g, ' ').trimEnd();
}

/** The read spoken AFTER a blank is answered: the rest of THIS blank's own
 *  sentence, with the just-answered blank (and any earlier blanks on the line)
 *  filled in — then it STOPS at the end of the line. It does NOT glide into the
 *  next sentence; that sentence's lead-in is spoken when the next round shows (on
 *  Next), so nothing is read twice. Answering "der ___ Junge auf." reads "der
 *  Junge auf." and stops.
 *
 *  Two refinements:
 *   - if a LATER blank sits on the same line, the read stops right before it (its
 *     slot is still unanswered, so it stays silent);
 *   - if this is the FINAL blank of the whole story, the read continues to the end
 *     so the closing lines (a letter's sign-off, a chapter's last sentence) are
 *     heard — there is no next round to read them. */
function continuationAfterBlank(lines: StorySegmentView[][], globalBlank: number): string {
    const totalBlanks = lines.flat().filter(s => s.kind === 'blank').length;
    const isFinalBlank = globalBlank === totalBlanks - 1;
    const li = viewLineOfBlank(lines, globalBlank);
    let out = '';
    let passedCurrent = false;

    for (let l = li; l < lines.length; l++) {
        for (const seg of lines[l]) {
            if (seg.kind === 'text') {
                if (passedCurrent) out += seg.text;
                continue;
            }
            const bi = seg.blankIndex!;
            if (bi < globalBlank) continue;      // earlier blank: already read
            if (bi === globalBlank) {
                out += seg.answer ?? '';         // fill the just-answered blank
                passedCurrent = true;
                continue;
            }
            return out.replace(/\s+/g, ' ').trim();  // a later blank — stop before it
        }
        // End of a line. Stop here unless this is the final blank, in which case
        // keep reading the remaining closing lines to the end.
        if (!isFinalBlank) break;
        if (passedCurrent) out += ' ';
    }
    return out.replace(/\s+/g, ' ').trim();
}

/** Find the line index (in the VIEW) containing the blank with a given index. */
function viewLineOfBlank(lines: StorySegmentView[][], blankIndex: number): number {
    for (let li = 0; li < lines.length; li++) {
        if (lines[li].some(s => s.kind === 'blank' && s.blankIndex === blankIndex)) return li;
    }
    return 0;
}

/** Build the rounds for one story: one PracticeRound per blank, in reading
 *  order. Each blank is resolved mode-aware (plural form vs Dativ article); the
 *  prompt/audio are rewritten to the narrative and storyContext is attached. */
export function buildStoryRounds(story: Story, pool: PracticeItem[]): PracticeRound[] {
    const byWord = new Map(pool.map(i => [i.word, i]));

    const resolve = (seg: Extract<Segment, { kind: 'blank' }>): ResolvedBlank | null => {
        const item = byWord.get(seg.word);
        if (!item) return null;               // missing word — test catches it
        switch (story.mode) {
            case 'plural':
                return resolvePluralBlank(item);
            case 'dativ':
                return resolveDativBlank(item, seg.trigger ?? 'this preposition');
            case 'genus':
                return resolveGenusBlank(item);
            case 'kasus-dat':
            case 'kasus-akk': {
                // The surface article the author wrote IS the answer, and the case
                // is read off it (number-aware via the item's plural detection is
                // done in the parser, which set seg.article). Fall back to deriving
                // from gender if a chapter somehow omitted the article.
                const article = seg.article ?? articleFor(item.gender, story.mode === 'kasus-dat' ? 'dat' : 'akk', 'sg');
                const inferred = caseForSurface(item.gender, article);
                const caseName: Case = (Array.isArray(inferred) ? inferred[0] : inferred)
                    ?? (story.mode === 'kasus-dat' ? 'dat' : 'akk');
                return resolveChapterCaseBlank(item, article, caseName, seg.trigger);
            }
        }
    };

    const { lines, resolved } = buildView(story, resolve);
    const blankCount = resolved.length;

    const rounds: PracticeRound[] = [];
    for (let bi = 0; bi < resolved.length; bi++) {
        const rb = resolved[bi];
        if (!rb) continue;                    // unresolved blank: skip the round

        const li = viewLineOfBlank(lines, bi);
        const lead = leadInBeforeBlank(lines[li], bi);
        const trail = trailingTextAfterBlank(lines[li], bi);   // e.g. " Hund." for genus/kasus
        const promptText = `${lead} ___${trail}`.replace(/\s+/g, ' ').trim();

        const context: StoryContext = {
            storyId: story.id,
            title: story.title,
            lines,
            blankIndex: bi,
            blankCount,
            answer: rb.answer,
        };

        rounds.push({
            item: rb.item,
            promptText,
            // Audio: on show, speak ONLY the lead-in (text before the blank) — the
            // noun after the blank stays visible but silent, and the article is
            // never voiced. On answer, the continuous read fills the blank and
            // glides to the next blank.
            speakOnShow: lead,
            spokenText: continuationAfterBlank(lines, bi),
            speakOnShowSafe: true,
            answer: rb.answer,
            options: rb.options,
            tipp: rb.tipp,
            hints: rb.hints,
            storyContext: context,
        });
    }

    return rounds;
}

/** All items, used to resolve story blank words regardless of the active noun
 *  filter (a story is a fixed text, not narrowed by the pool). */
function storyItemPool(pool: PracticeItem[]): PracticeItem[] {
    const byWord = new Map<string, PracticeItem>();
    for (const item of [...generateItems(), ...pool]) byWord.set(item.word, item);
    return [...byWord.values()];
}

/** Rounds for ONE story, selected by id. Falls back to the first story if the id
 *  is unknown (shouldn't happen — map nodes set a valid storyId). */
export function generateStoryRoundsFor(storyId: string | undefined, pool: PracticeItem[]): PracticeRound[] {
    const story = STORIES.find(s => s.id === storyId) ?? STORIES[0];
    return buildStoryRounds(story, storyItemPool(pool));
}

/** Story-mode RoundGenerator (plays every story; used when no specific story is
 *  selected). Individual map nodes use generateStoryRoundsFor via buildQueue. */
export function generateStoryRounds(pool: PracticeItem[]): PracticeRound[] {
    const items = storyItemPool(pool);
    return STORIES.flatMap(story => buildStoryRounds(story, items));
}
