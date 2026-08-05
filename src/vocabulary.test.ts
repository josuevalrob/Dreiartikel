import { describe, it, expect } from 'vitest';
import {
    createEntry,
    addWord,
    updateScore,
    clampScore,
    parseVocabulary,
    serializeVocabulary,
    MIN_SCORE,
    MAX_SCORE,
    VOCAB_ATTRIBUTES,
    type VocabularyEntry,
} from './vocabulary';

// The Vocabulary List is player-owned persistent state, so the tests focus on
// the two ways it can rot: duplicate/reset entries corrupting scores, and
// corrupt storage bricking the load. The localStorage wrappers are thin
// try/catch shells over the pure functions tested here (repo convention:
// no mocks, no jsdom).

describe('createEntry', () => {
    it('starts every Learning Score at 0 (a new word to learn)', () => {
        const entry = createEntry('Hund', 'm', 'Hunde');
        for (const attr of VOCAB_ATTRIBUTES) {
            expect(entry.scores[attr]).toBe(0);
        }
    });

    it('defaults plural to null when the dataset has none', () => {
        expect(createEntry('Wurst', 'f').plural).toBeNull();
    });
});

describe('addWord', () => {
    it('appends a new word without mutating the original list', () => {
        const list: VocabularyEntry[] = [];
        const next = addWord(list, createEntry('Hund', 'm'));
        expect(next).toHaveLength(1);
        expect(list).toHaveLength(0);
    });

    it('re-adding a known word does NOT reset its scores', () => {
        let list = addWord([], createEntry('Hund', 'm'));
        list = updateScore(list, 'Hund', 'gender', 45);
        const next = addWord(list, createEntry('Hund', 'm'));
        expect(next).toBe(list);
        expect(next[0].scores.gender).toBe(45);
    });
});

describe('updateScore', () => {
    const list = addWord([], createEntry('Hund', 'm'));

    it('sets exactly the targeted attribute, leaving the others alone', () => {
        const next = updateScore(list, 'Hund', 'plural', 30);
        expect(next[0].scores.plural).toBe(30);
        expect(next[0].scores.word).toBe(0);
        expect(next[0].scores.gender).toBe(0);
    });

    it('clamps into [MIN_SCORE, MAX_SCORE]', () => {
        expect(updateScore(list, 'Hund', 'word', 999)[0].scores.word).toBe(MAX_SCORE);
        expect(updateScore(list, 'Hund', 'word', -15)[0].scores.word).toBe(MIN_SCORE);
    });

    it('is a no-op for an unknown word', () => {
        const next = updateScore(list, 'Katze', 'word', 50);
        expect(next).toEqual(list);
    });

    it('does not mutate the input list or its entries', () => {
        updateScore(list, 'Hund', 'word', 50);
        expect(list[0].scores.word).toBe(0);
    });
});

describe('clampScore', () => {
    it('passes in-range values through and pins out-of-range ones', () => {
        expect(clampScore(50)).toBe(50);
        expect(clampScore(-1)).toBe(MIN_SCORE);
        expect(clampScore(101)).toBe(MAX_SCORE);
    });
});

describe('parse/serialize round-trip', () => {
    it('serializes and parses back to the same list', () => {
        let list = addWord([], createEntry('Hund', 'm', 'Hunde'));
        list = addWord(list, createEntry('Wurst', 'f'));
        list = updateScore(list, 'Hund', 'gender', 60);
        expect(parseVocabulary(serializeVocabulary(list))).toEqual(list);
    });

    it('yields [] for missing or garbage storage', () => {
        expect(parseVocabulary(null)).toEqual([]);
        expect(parseVocabulary('')).toEqual([]);
        expect(parseVocabulary('not json {')).toEqual([]);
        expect(parseVocabulary('{"a":1}')).toEqual([]);
    });

    it('drops invalid entries but keeps the valid ones', () => {
        const good = createEntry('Hund', 'm');
        const stored = JSON.stringify([
            good,
            { word: 'Katze', gender: 'x', plural: null, scores: { word: 0, gender: 0, plural: 0 } },
            { word: '', gender: 'f', plural: null, scores: { word: 0, gender: 0, plural: 0 } },
            { word: 'Maus', gender: 'f', plural: null, scores: { word: 0, gender: 0 } },
            { word: 'Igel', gender: 'm', plural: null, scores: { word: 0, gender: 0, plural: 500 } },
            42,
        ]);
        expect(parseVocabulary(stored)).toEqual([good]);
    });
});