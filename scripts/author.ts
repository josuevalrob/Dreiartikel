// ─── DeepSeek chapter author (offline, author-time only) ─────────────────────
//
// Run with: npm run author
//
// What it does: asks DeepSeek to WRITE grammatical German prose chapters, then
// validates each one through the SAME parser the app uses (parseChapter), and —
// only if a chapter yields enough resolvable blanks — writes it into
// src/chapters/content/ as a numbered .md file. Existing chapters are wiped first
// (per the iteration plan: "remove the previous content and add the new one").
//
// The LLM's ONLY job is prose. It never produces blanks, answers, options, or
// tipps — those are DERIVED by the engine from the surface articles it writes.
// So the only thing that can be wrong in a way the learner sees is the German
// grammar, which the gate (parseChapter) and the blank-count threshold guard.
//
// The DeepSeek API key lives in .env (DEEPSEEK_API_KEY) and is git-ignored. This
// script runs at AUTHOR time on your machine; nothing here ships to the browser.
//
// Node 24 runs this .ts file directly via --experimental-strip-types (see the
// npm script); no tsx/ts-node needed.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseChapter, type ChapterTopic } from '../src/chapters/parse';
import { generateItems, getCategories, type PracticeItem } from '../src/data';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'src', 'chapters', 'content');
const MAP_PATH = join(ROOT, 'src', 'map.json');

// ─── Config ──────────────────────────────────────────────────────────────────

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';
const MIN_BLANKS = 4;          // a chapter must drill at least this many spots
const MAX_ATTEMPTS = 3;        // regenerate a chapter up to this many times

/** The chapters to generate this run, in quest order. Each plan entry names a
 *  topic the parser drills and a narrative scene; the chapters form one continuous
 *  story (waking → market → buying → setting off) so the grammar arc reads as a
 *  journey. The number prefix is the quest order (filename = TOC); the engine
 *  expects exactly this topic sequence (genus → plural → kasus-akk → kasus-dat). */
const PLAN: { file: string; id: string; topic: ChapterTopic; title: string; scene: string }[] = [
    {
        file: '01-ch1-genus',
        id: 'ch1-genus',
        topic: 'genus',
        title: 'Kapitel 1 · Der Aufbruch',
        scene: 'A young traveller wakes at dawn and packs for a journey. Everyday objects around the house.',
    },
    {
        file: '02-ch1-plural',
        id: 'ch1-plural',
        topic: 'plural',
        title: 'Kapitel 1 · Der Markt',
        scene: 'The traveller reaches a busy market square full of stalls — many of everything: fruits, breads, animals, people.',
    },
    {
        file: '03-ch1-akkusativ',
        id: 'ch1-akkusativ',
        topic: 'kasus-akk',
        title: 'Kapitel 1 · Der Einkauf',
        scene: 'At the market the traveller buys provisions for the road — food and supplies he picks up and pays for.',
    },
    {
        file: '04-ch1-dativ',
        id: 'ch1-dativ',
        topic: 'kasus-dat',
        title: 'Kapitel 1 · Die Reise',
        scene: 'The traveller sets off, accompanied by family, friends and his dog along the way.',
    },
];

// ─── Per-topic prompt guidance ───────────────────────────────────────────────
// The parser detects blanks by reading the SURFACE article. So each topic must
// steer DeepSeek toward sentences whose article+noun spots the parser can detect
// and unambiguously case. These instructions mirror parse.ts exactly.

const TOPIC_GUIDE: Record<ChapterTopic, string> = {
    genus: [
        'Every sentence must contain at least one "<definite article> <Noun>" phrase',
        'in the NOMINATIVE singular, i.e. using der / die / das with the noun as the',
        'sentence subject (e.g. "Der Hund bellt.", "Auf dem Tisch liegt das Buch.").',
        'These der/die/das spots are what the learner will drill.',
    ].join(' '),
    'kasus-akk': [
        'Build sentences in the ACCUSATIVE. Use the accusative prepositions',
        'für, durch, ohne, gegen, um before a "<article> <Noun>" phrase',
        '(e.g. "Für den Apfel bezahlt er.", "Ohne den Kaffee geht er nicht."),',
        'OR a transitive verb taking a masculine object so it shows "den"',
        '(e.g. "Er kauft den Käse."). Prefer masculine nouns (den …) — they are',
        'unambiguously accusative; feminine/neuter (die/das) are only drilled when',
        'an accusative preposition precedes them.',
    ].join(' '),
    'kasus-dat': [
        'Build sentences in the DATIVE. Use the dative prepositions',
        'mit, zu, von, bei, aus, nach, seit before a "<article> <Noun>" phrase',
        '(e.g. "Er wandert mit dem Hund.", "Sie fährt zu der Tante."), so the',
        'article appears as dem (m/n) or der (f). These dem/der spots are drilled.',
        'CRITICAL: use AT MOST ONE dative preposition per sentence — never stack two or',
        'three location phrases ("von dem Fenster aus dem Schlafzimmer" is wrong). Each',
        'sentence must describe one clear, real situation. Do NOT use "nach" with a city',
        'or place noun (that takes no article); use "nach" only for time ("nach dem',
        'Essen") or "in/zu" for destinations.',
    ].join(' '),
    plural: [
        'Every sentence must contain at least one PLURAL noun in its plural surface',
        'form (e.g. "Bücher", "Äpfel", "Kinder", "Frauen") — the plural form ITSELF is',
        'what the learner drills, so make the nouns plural and visible. Use quantity',
        'words to motivate plurals (viele, drei, zwei, einige, alle: "Auf dem Markt',
        'liegen viele Äpfel.", "Drei Kinder spielen."). The plural noun does NOT need',
        'a definite article. Use the singular nouns from the list but write their',
        'CORRECT German plural; if you are unsure of a noun\'s plural, choose another.',
    ].join(' '),
};

// ─── Vocabulary the LLM may use ──────────────────────────────────────────────
// The parser can only blank words that exist in nouns.json, so we hand DeepSeek
// the allowed list (optionally narrowed by level) to maximise blank density. A
// word it uses that ISN'T in the dataset simply stays prose — no crash, just a
// missed drill — but giving it the list keeps chapters dense and on-vocabulary.

function vocabularyFor(maxLevel: number): PracticeItem[] {
    return generateItems().filter(i => i.level <= maxLevel && !i.pluralOnly);
}

/** A compact "der Hund, die Katze, das Buch" line so DeepSeek sees gender too. */
function vocabularyPrompt(items: PracticeItem[]): string {
    return items.map(i => `${i.answer} ${i.word}`).join(', ');
}

// ─── DeepSeek call ───────────────────────────────────────────────────────────

function buildMessages(
    plan: typeof PLAN[number],
    vocab: string,
): { role: string; content: string }[] {
    const system = [
        'You are a German storyteller writing the opening of an illustrated adventure',
        'novel for language learners. Your prose is VIVID, ATMOSPHERIC and FLOWS like a',
        'real story — sentences connect with cause and effect and time (dann, deshalb,',
        'am Morgen, plötzlich), building a scene the reader can picture. Yet the German',
        'stays accessible (roughly A1–A2) and GRAMMATICALLY PERFECT: a wrong article',
        'teaches the learner the wrong answer, so every article and case must be correct.',
    ].join(' ');

    const user = [
        `Write the opening of a German chapter titled "${plan.title}".`,
        `Scene: ${plan.scene}`,
        '',
        `Grammar focus: ${TOPIC_GUIDE[plan.topic]}`,
        '',
        'Use ONLY these nouns (with exactly these genders):',
        vocab,
        '',
        'Write it like a STORY, not a list:',
        '- 10 to 14 sentences, ONE sentence per line (each line is a reveal unit).',
        '- Make it FLOW and feel IMMERSIVE: connect sentences with time and cause words',
        '  (dann, danach, deshalb, am Morgen, plötzlich, endlich) so it reads as a scene,',
        '  not isolated facts. Vary sentence openings and rhythm.',
        '- Keep the German clear and mostly A1–A2 — readable, evocative, never a textbook drill.',
        '',
        'Hard constraints (the exercise breaks without these):',
        '- EVERY sentence must contain at least one drillable "<article> <Noun>" spot as',
        '  described in the grammar focus — a DEFINITE article (der/die/das/dem/den)',
        '  directly followed by ONE noun from the list, with NO adjective between them',
        '  (write "der Rucksack", never "der schwere Rucksack"; the noun must sit right',
        '  after the article). You may use adjectives elsewhere, just never between the',
        '  drilled article and its noun.',
        '- The sentence must make REAL-WORLD SENSE. NEVER force an inanimate noun to act',
        '  like a person to hit the constraint: a head cannot sit, rice cannot eat, a',
        '  rucksack cannot carry a jacket. If a sentence needs a do-er (the subject of',
        '  verbs like sitzen, essen, packen, nehmen, gehen), the do-er must be a PERSON',
        '  or ANIMAL ("der Junge", "der Reisende", "der Hund"). Put OBJECTS where objects',
        '  belong — as the thing acted upon ("der Junge isst das Brot") or as the subject',
        '  ONLY of verbs that fit objects (liegen, stehen, glänzen: "das Brot liegt auf',
        '  dem Tisch"). The drill spot can be the subject OR the object — not every spot',
        '  needs to be the sentence subject.',
        '- Prepositions must be physically true: bread lies IN a bowl (in der Schüssel),',
        '  not on it. Prefer well-known person/animal nouns from the list as the actors.',
        '- Do NOT invent nouns outside the list above.',
        '- Output ONLY the German sentences: NO markdown, NO numbering, NO blank lines,',
        '  NO title, NO commentary.',
    ].join('\n');

    return [
        { role: 'system', content: system },
        { role: 'user', content: user },
    ];
}

/** Stage 2: the critic. DeepSeek reads its own draft and rewrites ONLY the
 *  sentences that are semantically wrong (an inanimate noun acting like a person,
 *  an impossible preposition, a grammatical slip), keeping every der/die/das+noun
 *  drill spot intact. The grammar gate validates the result afterwards, so this
 *  pass only has to fix MEANING — the thing the parser cannot see. */
function buildCriticMessages(
    plan: typeof PLAN[number],
    draft: string[],
    vocab: string,
): { role: string; content: string }[] {
    const system = [
        'You are a meticulous German editor proofing a language-learning chapter.',
        'You fix prose so every sentence is REAL, NATURAL German that makes sense in',
        'the real world, while preserving the article+noun drill spots the exercise',
        'depends on. You change as little as possible.',
    ].join(' ');

    const user = [
        'Here is a draft German chapter (one sentence per line):',
        '',
        draft.join('\n'),
        '',
        'Find and FIX every sentence that has any of these problems:',
        '- An inanimate noun doing a human/animate action (e.g. "das Messer schneidet"',
        '  → a knife cannot cut by itself; "der Apfel legt" → an apple cannot lay).',
        '  The do-er of an action verb must be a PERSON or ANIMAL.',
        '- A physically impossible or odd statement (e.g. bread lying ON a bowl).',
        '- ANY grammatical error: wrong article/case, or a transitive verb missing its',
        '  object (e.g. "legt" with no accusative object).',
        '',
        'Rules for your rewrite:',
        '- Keep EVERY sentence containing at least one "<definite article> <Noun>" spot',
        '  (a der/die/das/dem/den directly followed by ONE noun, no adjective between).',
        `- This is a "${plan.topic}" chapter — preserve its grammar focus.`,
        '- Use ONLY nouns from this list:',
        vocab,
        '- Keep the narrative flow and the sentence COUNT roughly the same.',
        '- Leave already-correct sentences UNCHANGED.',
        '- Output ONLY the full corrected chapter, one sentence per line. NO commentary,',
        '  NO markdown, NO numbering, NO blank lines.',
    ].join('\n');

    return [
        { role: 'system', content: system },
        { role: 'user', content: user },
    ];
}

async function callDeepSeek(messages: { role: string; content: string }[], apiKey: string): Promise<string> {
    const res = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: MODEL,
            messages,
            temperature: 0.9,    // more variety/voice between runs, still on-task
            max_tokens: 1000,    // room for a 10–14 sentence scene
        }),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`DeepSeek HTTP ${res.status}: ${body.slice(0, 400)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('DeepSeek: no message content in response.');
    return content;
}

// ─── The gate: validate prose through the REAL parser ────────────────────────
// A candidate is accepted only if the same parseChapter the app uses turns it
// into at least MIN_BLANKS resolvable blanks. This catches off-topic prose, prose
// that uses unknown nouns, and prose where the parser can't detect the case.

function proseToLines(raw: string): string[] {
    return raw
        .replace(/```[a-z]*\n?/gi, '')   // strip any stray code fences
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('---'));
}

function countBlanks(topic: ChapterTopic, lines: string[]): number {
    const segments = parseChapter(topic, lines);
    return segments.flat().filter(s => s.kind === 'blank').length;
}

// ─── Write the .md ───────────────────────────────────────────────────────────

function chapterMarkdown(plan: typeof PLAN[number], intro: string, lines: string[]): string {
    return [
        '---',
        `title: ${plan.title}`,
        `topic: ${plan.topic}`,
        `intro: ${intro}`,
        '---',
        ...lines,
        '',
    ].join('\n');
}

// ─── Build the map (path JSON) from what we generated ────────────────────────
// The map is DATA the renderer reads (src/map.json): chapter nodes (mode:'story'
// + chapterId) wired in TOC order by 'main' edges, plus optional side-quest forks.
// We generate it to MATCH the chapters this run produced, then let DeepSeek decide
// whether to hang ONE side quest off the chapter. The result is validated against
// the same shape map.ts enforces (unique ids, edges reference real nodes, x/y in
// range, valid mode) so a bad map fails here, not at app startup.

/** A side quest is a deterministic drill (no prose) over a vocabulary slice. These
 *  are the modes the engine can launch from a node without any authored content. */
const SIDE_QUEST_MODES = ['article', 'plural', 'case-single', 'case-detect'] as const;
type SideQuestMode = typeof SIDE_QUEST_MODES[number];

/** A side quest scopes its vocabulary to ONE dataset category (the `filter` the
 *  game loop applies), and its label + icon are DERIVED from that category so the
 *  marker can never drift from its content (a "Tiere" node always drills Animals).
 *  CATEGORY_META is the single source of that mapping; the category string IS the
 *  filter the engine matches on (PracticeItem.category === filter). */
const CATEGORY_META: Record<string, { label: string; icon: string }> = {
    Animals: { label: 'Tiere', icon: '🐾' },
    Beverages: { label: 'Getränke', icon: '🥤' },
    Body: { label: 'Körper', icon: '✋' },
    Calendar: { label: 'Kalender', icon: '📅' },
    Clothing: { label: 'Kleidung', icon: '👕' },
    Countries: { label: 'Länder', icon: '🌍' },
    Entertainment: { label: 'Freizeit', icon: '🎬' },
    Family: { label: 'Familie', icon: '👪' },
    'Food & Drink': { label: 'Essen', icon: '🍽️' },
    Hobbies: { label: 'Hobbys', icon: '⚽' },
    House: { label: 'Haus', icon: '🏠' },
};

interface SideQuest {
    id: string;
    /** Which lesson (chapter id) this quest forks off. */
    anchorId: string;
    /** Dataset category — the vocabulary scope, written to node.filter. */
    category: string;
    /** German marker text, derived from the category. */
    label: string;
    /** Emoji, derived from the category. */
    icon: string;
    mode: SideQuestMode;
}

/** Upper bound on generated side quests — a safety cap so a runaway reply can't
 *  flood the map. DeepSeek chooses how many (0..MAX) and where each anchors. */
const MAX_SIDE_QUESTS = 6;

/** A node as it sits in map.json. Mirrors MapNode in src/map.ts (kept local so the
 *  script has no runtime dependency on the React types). */
interface MapNodeData {
    id: string;
    label: string;
    icon: string;
    mode: string;
    chapterId?: string;
    /** Side-quest vocabulary scope (a dataset category). Maps to MapNode.filter. */
    filter?: string;
    x: number;
    y: number;
}
interface MapEdgeData { from: string; to: string; kind: 'main' | 'fork'; }

/** Ask DeepSeek to design the side quests for the WHOLE map: how many (0..MAX),
 *  which lesson each forks off, and each one's theme + drill. Returns the validated
 *  list (possibly empty). Each quest is scoped to a real category; its label/icon
 *  are derived from that category so the marker can never drift from its content. */
async function decideSideQuests(
    plans: typeof PLAN,
    apiKey: string,
): Promise<SideQuest[]> {
    // Only offer categories we have a label+icon for (so the marker is derivable).
    const available = getCategories().filter(c => CATEGORY_META[c]);
    const lessonList = plans.map(p => `  - id "${p.id}": "${p.title}" (grammar: ${p.topic})`).join('\n');

    const system = 'You design the practice map for a German learning game. You answer ONLY with JSON.';
    const user = [
        'The map has these story lessons along the main path:',
        lessonList,
        '',
        'A SIDE QUEST is an optional extra practice node that drills ONE theme of',
        'vocabulary — it has NO story text. It hangs off a lesson as a fork. Design the',
        `side quests for the whole map: choose HOW MANY (0 to ${MAX_SIDE_QUESTS}) and,`,
        'for each, which lesson it forks off, its vocabulary CATEGORY, and a drill MODE.',
        'Spread them sensibly across the lessons; a lesson may have more than one, or none.',
        '',
        `Allowed categories (each quest drills ONLY its theme): ${available.join(', ')}`,
        '',
        `Allowed modes: ${SIDE_QUEST_MODES.join(', ')}`,
        '  - article     : pick der/die/das for a bare noun',
        '  - plural       : pick the plural form of a noun',
        '  - case-single  : pick the article a noun takes in a sentence (produce)',
        '  - case-detect  : spot the case in a sentence (detect)',
        '',
        'Respond with EXACTLY one JSON object and nothing else, of the form:',
        '  {"quests": [',
        '    {"anchor": "<lesson id>", "category": "Animals", "mode": "article"},',
        '    {"anchor": "<lesson id>", "category": "Food & Drink", "mode": "plural"}',
        '  ]}',
        'For no side quests at all, return {"quests": []}.',
        'Each "anchor" MUST be one of the lesson ids above; each "category" MUST be one',
        'of the allowed categories (exact English string). Pick a mode/category that',
        "pairs well with the anchor lesson's grammar.",
    ].join('\n');

    let raw: string;
    try {
        raw = await callDeepSeek([
            { role: 'system', content: system },
            { role: 'user', content: user },
        ], apiKey);
    } catch (e) {
        console.log(`  side quests: API error — ${(e as Error).message}; none added`);
        return [];
    }

    // Pull the first {...} block out of the reply (tolerates code fences / prose).
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) { console.log('  side quests: no JSON in reply; none added'); return []; }
    let parsed: { quests?: Array<{ anchor?: string; category?: string; mode?: string }> };
    try {
        parsed = JSON.parse(match[0]);
    } catch {
        console.log('  side quests: unparseable JSON; none added');
        return [];
    }

    const lessonIds = new Set(plans.map(p => p.id));
    const requested = Array.isArray(parsed.quests) ? parsed.quests : [];
    const out: SideQuest[] = [];
    const usedIds = new Set<string>();

    for (const q of requested) {
        if (out.length >= MAX_SIDE_QUESTS) break;
        const anchor = q.anchor ?? '';
        if (!lessonIds.has(anchor)) { console.log(`  side quest: unknown anchor "${anchor}"; skipping`); continue; }
        if (!q.mode || !SIDE_QUEST_MODES.includes(q.mode as SideQuestMode)) {
            console.log(`  side quest: invalid mode "${q.mode}"; skipping`); continue;
        }
        const category = q.category ?? '';
        const meta = CATEGORY_META[category];
        if (!meta || !available.includes(category)) {
            console.log(`  side quest: invalid category "${category}"; skipping`); continue;
        }
        // Stable, unique id. Label + icon DERIVED from the category (no drift).
        const base = `side-${q.mode}-${category.toLowerCase().replace(/[^a-z]+/g, '-')}`;
        let id = base, n = 2;
        while (usedIds.has(id)) id = `${base}-${n++}`;
        usedIds.add(id);
        out.push({ id, anchorId: anchor, category, label: meta.label, icon: meta.icon, mode: q.mode as SideQuestMode });
    }

    return out;
}

/** Compose the full map.json from the produced chapters + the side quests.
 *  Chapters sit along a horizontal trail (x left→right) linked by 'main' edges;
 *  each side quest hangs below ITS anchor lesson as a 'fork'. Multiple forks off
 *  the same lesson fan out (alternating bands + horizontal offset) so they don't
 *  overlap. */
function buildMap(
    chapters: { plan: typeof PLAN[number] }[],
    sideQuests: SideQuest[],
): { nodes: MapNodeData[]; edges: MapEdgeData[] } {
    const nodes: MapNodeData[] = [];
    const edges: MapEdgeData[] = [];
    const anchorPos = new Map<string, { x: number; y: number }>();

    // Chapter nodes spread along the trail. With a single chapter this just places
    // it near the left; with more, they step rightward.
    const n = chapters.length;
    chapters.forEach((c, i) => {
        const x = n === 1 ? 28 : 10 + (80 * i) / (n - 1);
        const y = 40 + (i % 2 === 0 ? -6 : 6);   // gentle wiggle above/below the band
        nodes.push({
            id: c.plan.id,
            label: c.plan.title.replace(/^Kapitel\s*/i, 'Ch.'),
            icon: '📖',
            mode: 'story',
            chapterId: c.plan.id,
            x,
            y,
        });
        anchorPos.set(c.plan.id, { x, y });
        if (i > 0) edges.push({ from: chapters[i - 1].plan.id, to: c.plan.id, kind: 'main' });
    });

    // How many quests already hang off each lesson — used to fan out siblings.
    const perAnchor = new Map<string, number>();
    for (const sq of sideQuests) {
        const anchor = anchorPos.get(sq.anchorId);
        if (!anchor) continue;   // anchor was validated, but guard anyway
        const k = perAnchor.get(sq.anchorId) ?? 0;
        perAnchor.set(sq.anchorId, k + 1);
        // Fan siblings: each extra quest off the same lesson steps right and the
        // band alternates a little so labels don't stack.
        const x = clampPct(anchor.x + 8 + k * 12);
        const y = k % 2 === 0 ? 78 : 90;
        nodes.push({
            id: sq.id,
            label: sq.label,
            icon: sq.icon,
            mode: sq.mode,
            filter: sq.category,   // scopes the drill to this theme
            x,
            y,
        });
        edges.push({ from: sq.anchorId, to: sq.id, kind: 'fork' });
    }

    return { nodes, edges };
}

/** Keep a position inside the [0,100] canvas the map validator requires. */
function clampPct(v: number): number {
    return Math.max(2, Math.min(98, v));
}

function mapJson(map: { nodes: MapNodeData[]; edges: MapEdgeData[] }): string {
    const comment =
        'The lesson map as DATA, GENERATED by scripts/author.ts to match the chapters ' +
        'it produced. `nodes` are launch points; `edges` are drawn roads (main = quest ' +
        'road, fork = sidequest). x runs left→right (the world scrolls horizontally), ' +
        'y is a compact band. Re-run `npm run author` to regenerate. See map.ts for the ' +
        'field meanings and the load-time validation that guards this file.';
    return JSON.stringify({ _comment: comment, ...map }, null, 2) + '\n';
}

/** Re-validate the generated map with the SAME rules map.ts enforces at load, so a
 *  bad map throws here (with the chapter context) rather than at app startup. */
function validateMap(map: { nodes: MapNodeData[]; edges: MapEdgeData[] }): void {
    const ids = new Set<string>();
    for (const node of map.nodes) {
        if (ids.has(node.id)) throw new Error(`map: duplicate node id "${node.id}"`);
        ids.add(node.id);
        if (node.x < 0 || node.x > 100 || node.y < 0 || node.y > 100) {
            throw new Error(`map: node "${node.id}" x/y out of [0,100]`);
        }
        if (!node.label || !node.icon) throw new Error(`map: node "${node.id}" needs label + icon`);
    }
    for (const e of map.edges) {
        if (!ids.has(e.from)) throw new Error(`map: edge.from "${e.from}" is not a node`);
        if (!ids.has(e.to)) throw new Error(`map: edge.to "${e.to}" is not a node`);
        if (e.from === e.to) throw new Error(`map: self-loop on "${e.from}"`);
    }
    if (map.nodes.length === 0) throw new Error('map: no nodes');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const apiKey = readEnvKey();
    const vocab = vocabularyPrompt(vocabularyFor(1));   // level-1 pool for chapter 1
    console.log(`Loaded ${vocabularyFor(1).length} level-1 nouns as the vocabulary pool.\n`);

    // CLI flags:
    //   `npm run author -- ch1-dativ`  regenerate ONLY that chapter (+ rebuild map)
    //   `npm run author -- --map-only`  rebuild the map only, touch no chapters
    //   (no arg)                        regenerate all chapters + map
    const flags = process.argv.slice(2).filter(a => a.startsWith('-'));
    const mapOnly = flags.includes('--map-only');
    const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
    const plans = mapOnly ? [] : (only.length ? PLAN.filter(p => only.includes(p.id)) : PLAN);
    if (only.length && plans.length === 0 && !mapOnly) {
        console.error(`No chapter matches ${only.join(', ')}. Known ids: ${PLAN.map(p => p.id).join(', ')}`);
        process.exit(1);
    }
    if (mapOnly) console.log('Rebuilding map only — chapters untouched.\n');
    else if (only.length) console.log(`Regenerating only: ${plans.map(p => p.id).join(', ')}\n`);

    const accepted: { plan: typeof PLAN[number]; intro: string; lines: string[] }[] = [];

    for (const plan of plans) {
        console.log(`▶ ${plan.title}  (topic: ${plan.topic})`);
        let chosen: string[] | null = null;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            const messages = buildMessages(plan, vocab);
            let raw: string;
            try {
                raw = await callDeepSeek(messages, apiKey);
            } catch (e) {
                console.log(`  attempt ${attempt}: API error — ${(e as Error).message}`);
                continue;
            }
            const draft = proseToLines(raw);
            const draftBlanks = countBlanks(plan.topic, draft);
            console.log(`  attempt ${attempt}: draft — ${draft.length} lines, ${draftBlanks} drillable blanks`);
            if (draftBlanks < MIN_BLANKS) {
                console.log(`    ↳ below threshold (${MIN_BLANKS}); regenerating…`);
                continue;
            }

            // Stage 2 — self-critique: DeepSeek fixes the semantic nonsense the
            // parser can't see (inanimate actors, impossible prepositions, missing
            // objects), keeping the drill spots. The revision must still pass the
            // blank gate; if it loses too many blanks we keep the draft instead.
            let final = draft;
            try {
                const critique = await callDeepSeek(buildCriticMessages(plan, draft, vocab), apiKey);
                const revised = proseToLines(critique);
                const revisedBlanks = countBlanks(plan.topic, revised);
                if (revisedBlanks >= MIN_BLANKS) {
                    console.log(`    ↳ critic pass — ${revised.length} lines, ${revisedBlanks} drillable blanks ✓`);
                    final = revised;
                } else {
                    console.log(`    ↳ critic pass dropped below threshold (${revisedBlanks}); keeping draft`);
                }
            } catch (e) {
                console.log(`    ↳ critic pass failed (${(e as Error).message}); keeping draft`);
            }

            chosen = final;
            break;
        }

        if (!chosen) {
            console.error(`✗ Could not generate a valid "${plan.title}" after ${MAX_ATTEMPTS} attempts. Aborting — content left untouched.`);
            process.exit(1);
        }

        // A short intro line: use the scene as a learner-facing German-ish frame.
        // Keep it simple — it's narrative framing, not drilled.
        const intro = plan.scene;
        accepted.push({ plan, intro, lines: chosen });
        console.log(`  ✓ accepted\n`);
    }

    // Validated — write only the generated file(s). Other chapters are left as-is
    // (no wipe): this tiny step overwrites one chapter, nothing else.
    for (const { plan, intro, lines } of accepted) {
        const path = join(CONTENT_DIR, `${plan.file}.md`);
        writeFileSync(path, chapterMarkdown(plan, intro, lines), 'utf8');
        console.log(`wrote ${plan.file}.md  (${lines.length} lines)`);
    }

    // ── Map: built from the FULL plan (every planned chapter exists on disk, in
    // TOC order) — not just the chapters regenerated this run — so a targeted
    // re-roll keeps the whole map intact. DeepSeek designs the side quests for the
    // whole map: how many, where each forks off, and each one's theme + drill.
    console.log('\n▶ Map');
    const sideQuests = await decideSideQuests(PLAN, apiKey);
    if (sideQuests.length === 0) console.log('  no side quests');
    for (const sq of sideQuests) {
        console.log(`  + ${sq.icon} ${sq.label} — ${sq.mode} drill scoped to "${sq.category}", off ${sq.anchorId}`);
    }
    const map = buildMap(PLAN.map(plan => ({ plan })), sideQuests);
    validateMap(map);
    writeFileSync(MAP_PATH, mapJson(map), 'utf8');
    console.log(`  wrote map.json — ${map.nodes.length} node(s), ${map.edges.length} edge(s)`);

    console.log('\nDone. Run `npm test` and `npm run dev` to play the new chapter.');
}

function readEnvKey(): string {
    // Minimal .env reader (no dotenv dependency): KEY=value lines.
    const envPath = join(ROOT, '.env');
    let key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
        try {
            const env = readFileSync(envPath, 'utf8');
            const m = env.match(/^DEEPSEEK_API_KEY=(.+)$/m);
            if (m) key = m[1].trim();
        } catch { /* no .env file */ }
    }
    if (!key) {
        console.error('Missing DEEPSEEK_API_KEY. Add it to .env (it is git-ignored).');
        process.exit(1);
    }
    return key;
}

main().catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
});
