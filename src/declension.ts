// German case morphology — the definite-article declension table.
//
// Article forms are fully rule-based from (case × gender × number); no per-word
// data is needed. This module is the generalisation of rules.ts's
// `articleForGender`, which is simply `articleFor(gender, 'nom', 'sg')`.

import type { Gender } from './rules';

export type Case = 'nom' | 'akk' | 'dat' | 'gen';
export type GrammaticalNumber = 'sg' | 'pl';

export const CASE_LABELS: Record<Case, string> = {
    nom: 'Nominativ',
    akk: 'Akkusativ',
    dat: 'Dativ',
    gen: 'Genitiv',
};

// Full definite-article table (Standard Hochdeutsch). Rows = case,
// columns = gender (singular) plus a shared plural column.
const DEFINITE: Record<Case, Record<Gender | 'pl', string>> = {
    nom: { m: 'der', f: 'die', n: 'das', pl: 'die' },
    akk: { m: 'den', f: 'die', n: 'das', pl: 'die' },
    dat: { m: 'dem', f: 'der', n: 'dem', pl: 'den' },
    gen: { m: 'des', f: 'der', n: 'des', pl: 'der' },
};

/** The definite article for any gender/case/number. */
export function articleFor(gender: Gender, caseName: Case, number: GrammaticalNumber = 'sg'): string {
    return number === 'pl' ? DEFINITE[caseName].pl : DEFINITE[caseName][gender];
}

/** The distinct article forms a learner can choose between for a given case.
 *  Always includes every gender's correct answer, so no round is unanswerable.
 *  e.g. akk → [den, die, das] (3); dat → [dem, der] (2). */
export function optionsForCase(caseName: Case, number: GrammaticalNumber = 'sg'): string[] {
    const row = DEFINITE[caseName];
    const forms = number === 'pl' ? [row.pl] : [row.m, row.f, row.n];
    return Array.from(new Set(forms));
}

/** The reverse of the DEFINITE table: given a column (a gender, or 'pl' for
 *  plural) and a surface definite article the author actually wrote, which
 *  case(es) could it be? This is what lets the chapter parser read the case
 *  straight off the prose ("mit dem Hund" → dat) instead of guessing.
 *
 *  Returns a single `Case` when the (column, article) pair is unambiguous
 *  (masc is fully unambiguous: der→nom, den→akk, dem→dat, des→gen), an array of
 *  cases when ambiguous (fem 'die' → [nom, akk]; fem 'der' → [dat, gen]; neut
 *  'das' → [nom, akk]; plural 'die' → [nom, akk]), or `null` when the article
 *  never appears in that column (e.g. 'dem' for a feminine noun).
 *
 *  Note Genitiv is in the table but out of scope for chapter drilling; callers
 *  drop the 'gen' member (collapsing fem 'der' to dat under the no-genitive
 *  authoring rule) rather than this function hiding it. */
export function caseForSurface(column: Gender | 'pl', article: string): Case | Case[] | null {
    const cases = (Object.keys(DEFINITE) as Case[]).filter(c => DEFINITE[c][column] === article);
    if (cases.length === 0) return null;
    return cases.length === 1 ? cases[0] : cases;
}

/** The noun's surface form for a case. Weak masculine nouns (n-Deklination)
 *  take -n/-en outside the nominative singular: "der Junge" → "den Jungen",
 *  "mit dem Franzosen". -n if the word already ends in -e, else -en. Today only
 *  singular weak masculines are modelled; other nouns are returned unchanged. */
export function declineNoun(
    word: string,
    isWeakMasculine: boolean,
    caseName: Case,
    number: GrammaticalNumber = 'sg',
): string {
    if (!isWeakMasculine || number !== 'sg' || caseName === 'nom') return word;
    return word.endsWith('e') ? `${word}n` : `${word}en`;
}
