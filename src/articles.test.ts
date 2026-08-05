import { describe, it, expect } from 'vitest';
import { buildArticleRound, generateArticleRounds } from './articles';
import type { PracticeItem } from './data';

function item(partial: Partial<PracticeItem> & { word: string }): PracticeItem {
    return {
        id: partial.id ?? 't',
        word: partial.word,
        gender: partial.gender ?? 'm',
        answer: partial.answer ?? 'der',
        hint: partial.hint ?? partial.word,
        options: partial.options ?? ['der', 'die', 'das'],
        category: 'Test',
        animacy: partial.animacy ?? 'thing',
        level: partial.level ?? 1,
        tags: partial.tags ?? [],
    };
}

describe('buildArticleRound', () => {
    const hund = item({ word: 'Hund', gender: 'm', answer: 'der' });

    it('shows the bare word and answers with its dictionary article', () => {
        const r = buildArticleRound(hund);
        expect(r.promptText).toBe('Hund');
        expect(r.answer).toBe('der');
    });

    it('keeps options in FIXED der/die/das order (muscle memory — never shuffled)', () => {
        const r = buildArticleRound(hund);
        expect(r.options).toEqual(['der', 'die', 'das']);
    });

    it('is safe to speak on show (a bare noun reveals no answer)', () => {
        expect(buildArticleRound(hund).speakOnShowSafe).toBe(true);
        // The reinforcement line is the same as the prompt — no post-answer audio.
        expect(buildArticleRound(hund).spokenText).toBe(buildArticleRound(hund).promptText);
    });

    it('hints name the rule and gender but never the article', () => {
        const r = buildArticleRound(hund);
        expect(r.hints.find(h => h.kind === 'gender')).toBeTruthy();
        expect(r.hints.find(h => h.kind === 'rule')).toBeTruthy();
        for (const h of r.hints) expect(h.text).not.toContain(r.answer);
    });
});

describe('generateArticleRounds', () => {
    it('builds one round per noun and always includes the answer in the options', () => {
        const pool = [
            item({ word: 'Hund', gender: 'm', answer: 'der' }),
            item({ word: 'Katze', gender: 'f', answer: 'die', options: ['der', 'die', 'das'] }),
            item({ word: 'Buch', gender: 'n', answer: 'das' }),
        ];
        const rounds = generateArticleRounds(pool);
        expect(rounds.length).toBe(3);
        for (const r of rounds) expect(r.options).toContain(r.answer);
    });
});
