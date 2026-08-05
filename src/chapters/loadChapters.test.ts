import { describe, it, expect } from 'vitest';
import { parseChapterMarkdown, chapterIdFromPath, chaptersFromModules } from './loadChapters';

const GENUS_MD = `---
title: Kapitel 1 · Der Aufbruch
topic: genus
intro: Ein Junge träumt von einem Abenteuer.
---
Am Morgen wacht der Junge auf.
Vor dem Haus wartet der Hund.

Auf dem Tisch glänzt der Apfel.
`;

describe('parseChapterMarkdown', () => {
    it('parses frontmatter + prose body into a RawChapter', () => {
        const ch = parseChapterMarkdown('01-genus', GENUS_MD);
        expect(ch.id).toBe('01-genus');
        expect(ch.title).toBe('Kapitel 1 · Der Aufbruch');
        expect(ch.topic).toBe('genus');
        expect(ch.intro).toBe('Ein Junge träumt von einem Abenteuer.');
        // Blank lines dropped; each remaining line is one sentence.
        expect(ch.lines).toEqual([
            'Am Morgen wacht der Junge auf.',
            'Vor dem Haus wartet der Hund.',
            'Auf dem Tisch glänzt der Apfel.',
        ]);
    });

    it('omits intro when absent', () => {
        const md = `---\ntitle: T\ntopic: plural\n---\nViele Äpfel liegen hier.\n`;
        const ch = parseChapterMarkdown('x', md);
        expect(ch.intro).toBeUndefined();
        expect(ch.topic).toBe('plural');
    });

    it('tolerates CRLF line endings and a UTF-8 BOM', () => {
        const md = '﻿---\r\ntitle: T\r\ntopic: kasus-dat\r\n---\r\nIch fahre mit dem Hund.\r\n';
        const ch = parseChapterMarkdown('x', md);
        expect(ch.title).toBe('T');
        expect(ch.topic).toBe('kasus-dat');
        expect(ch.lines).toEqual(['Ich fahre mit dem Hund.']);
    });

    it('throws on missing frontmatter', () => {
        expect(() => parseChapterMarkdown('x', 'Just prose, no frontmatter.')).toThrow(/frontmatter/);
    });

    it('throws on a missing title', () => {
        expect(() => parseChapterMarkdown('x', `---\ntopic: genus\n---\nText.\n`)).toThrow(/title/);
    });

    it('throws on an invalid topic', () => {
        expect(() => parseChapterMarkdown('x', `---\ntitle: T\ntopic: wat\n---\nText.\n`)).toThrow(/topic/);
    });
});

describe('chapterIdFromPath', () => {
    it('strips the .md extension and the NN- ordering prefix, keeping the slug', () => {
        expect(chapterIdFromPath('/src/chapters/content/01-ch1-genus.md')).toBe('ch1-genus');
        expect(chapterIdFromPath('02-ch1-plural.md')).toBe('ch1-plural');
        expect(chapterIdFromPath('genus.md')).toBe('genus'); // no prefix is fine
    });
});

describe('chaptersFromModules', () => {
    it('returns chapters in filename order regardless of map order', () => {
        const modules: Record<string, string> = {
            '/content/02-ch1-plural.md': `---\ntitle: Two\ntopic: plural\n---\nViele Äpfel.\n`,
            '/content/01-ch1-genus.md': `---\ntitle: One\ntopic: genus\n---\nDer Hund bellt.\n`,
        };
        const chapters = chaptersFromModules(modules);
        expect(chapters.map(c => c.id)).toEqual(['ch1-genus', 'ch1-plural']);
        expect(chapters.map(c => c.title)).toEqual(['One', 'Two']);
    });
});
