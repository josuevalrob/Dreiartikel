// Markdown chapter loader. Chapters are authored as plain .md files under
// content/ — frontmatter for the metadata, prose for the body — and loaded into
// the RawChapter shape the engine already plays. The number prefix on each file
// (01-…, 02-…) is the quest order: glob returns paths alpha-sorted, so the
// filenames ARE the table of contents.
//
// Why .md and not .ts: the body is plain German prose, so it reads and edits like
// text, in any editor, with no TypeScript syntax in the way. Vite's
// import.meta.glob inlines each file's contents at BUILD time (no runtime fetch),
// and Vitest shares the same transform, so this works identically in tests.

import type { RawChapter } from './index';
import type { ChapterTopic } from './parse';

const TOPICS: ChapterTopic[] = ['genus', 'plural', 'kasus-dat', 'kasus-akk'];

/** Parse one chapter's raw Markdown into a RawChapter. The format is:
 *
 *     ---
 *     title: Kapitel 1 · Der Aufbruch
 *     topic: genus
 *     intro: One sentence of narrative framing.
 *     ---
 *     Am Morgen wacht der Junge auf.
 *     Vor dem Haus wartet der Hund.
 *
 *  Frontmatter is a tiny key: value block (no nesting, no quotes needed); the
 *  body is prose, one sentence per line. `id` is supplied by the caller (derived
 *  from the filename) so it stays stable and unique without the author repeating
 *  it. Throws on a missing/invalid title or topic — a chapter that can't be built
 *  should fail loudly at load, not silently drop.
 */
export function parseChapterMarkdown(id: string, raw: string): RawChapter {
    const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const fm = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!fm) throw new Error(`Chapter "${id}": missing frontmatter (--- title/topic --- prose).`);

    const meta: Record<string, string> = {};
    for (const line of fm[1].split('\n')) {
        if (!line.trim()) continue;
        const sep = line.indexOf(':');
        if (sep === -1) throw new Error(`Chapter "${id}": bad frontmatter line "${line}".`);
        meta[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
    }

    const title = meta.title;
    const topic = meta.topic as ChapterTopic;
    if (!title) throw new Error(`Chapter "${id}": frontmatter needs a "title".`);
    if (!TOPICS.includes(topic)) {
        throw new Error(`Chapter "${id}": topic "${meta.topic}" must be one of ${TOPICS.join(', ')}.`);
    }

    // Body: prose lines. Blank lines are dropped (the parser ignores them too, but
    // dropping here keeps the lines array clean).
    const lines = fm[2].split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const chapter: RawChapter = { id, title, topic, lines };
    if (meta.intro) chapter.intro = meta.intro;
    return chapter;
}

/** Derive a stable chapter id from its file path: the basename, minus the `.md`
 *  extension and the leading `NN-` ordering prefix. The number prefix only
 *  controls quest order (via filename sort); the id is the descriptive slug after
 *  it, so "…/content/01-ch1-genus.md" → "ch1-genus". Keeping the slug as the id
 *  means renumbering chapters never changes an id (and never breaks a map node's
 *  chapterId reference). */
export function chapterIdFromPath(path: string): string {
    const base = (path.split('/').pop() ?? path).replace(/\.md$/, '');
    return base.replace(/^\d+-/, '');
}

/** Load + sort all chapter .md files into RawChapter[] in filename order. The
 *  `modules` map is import.meta.glob's eager `{ path: rawString }` result, passed
 *  in so this function stays pure and unit-testable (the glob call itself lives in
 *  index.ts, which can't be exercised without Vite). */
export function chaptersFromModules(modules: Record<string, string>): RawChapter[] {
    return Object.keys(modules)
        .sort()                                  // alpha == numeric prefix == TOC order
        .map(path => parseChapterMarkdown(chapterIdFromPath(path), modules[path]));
}
