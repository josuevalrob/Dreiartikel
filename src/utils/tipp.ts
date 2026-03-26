export function getTipp(word: string, article: 'der' | 'die' | 'das'): string {
    const lowerWord = word.toLowerCase();

    const feminineSuffixes = ['ung', 'heit', 'keit', 'schaft', 'tion', 'tät', 'ik', 'ei', 'ie', 'ur', 'enz'];
    for (const suffix of feminineSuffixes) {
        if (lowerWord.endsWith(suffix) && article === 'die') {
            return `Nouns ending in -${suffix} are feminine.`;
        }
    }

    const neuterSuffixes = ['chen', 'lein', 'ment', 'um', 'ma'];
    for (const suffix of neuterSuffixes) {
        if (lowerWord.endsWith(suffix) && article === 'das') {
            if (['chen', 'lein'].includes(suffix)) {
                return `Diminutives ending in -${suffix} are always neuter, regardless of the base word.`;
            }
            return `Nouns ending in -${suffix} are typically neuter.`;
        }
    }

    const masculineSuffixes = ['ling', 'ismus', 'or', 'ig', 'ich', 'ant', 'ast', 'us'];
    for (const suffix of masculineSuffixes) {
        if (lowerWord.endsWith(suffix) && article === 'der') {
            return `Nouns ending in -${suffix} are typically masculine.`;
        }
    }

    if (lowerWord.startsWith('ge') && article === 'das') {
        return `Many nouns starting with the prefix Ge- are neuter.`;
    }

    if (lowerWord.endsWith('e') && article === 'die') {
        return `Nouns ending in -e are very often feminine (about 90%).`;
    }

    if (lowerWord.endsWith('en') && article === 'der') {
        return `Nouns ending in -en are often masculine.`;
    }
    
    if (lowerWord.endsWith('er') && article === 'der') {
        return `Nouns ending in -er are often masculine.`;
    }

    if (article === 'der') {
        return `This one is best memorized — no strong pattern applies to this masculine noun.`;
    } else if (article === 'die') {
        return `This one is best memorized — no strong pattern applies to this feminine noun.`;
    } else {
        return `This one is best memorized — no strong pattern applies to this neuter noun.`;
    }
}
