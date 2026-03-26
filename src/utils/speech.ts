let bestVoice: SpeechSynthesisVoice | null = null;
let initialized = false;

function loadVoices() {
    const voices = window.speechSynthesis.getVoices();
    // Prioritize high-quality German voices (like Google Deutsch or native iOS German)
    const germanVoices = voices.filter(v => v.lang.startsWith('de-DE') || v.lang === 'de');
    if (germanVoices.length > 0) {
        // Try to find a premium voice or just take the first one
        bestVoice = germanVoices.find(v => v.name.includes('Premium') || v.name.includes('Google')) || germanVoices[0];
    }
    initialized = true;
}

// Set up the listener for voices changing (critical for Chrome and others on first load)
if (window.speechSynthesis) {
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    // Attempt an immediate load just in case voices are already available
    loadVoices();
}

export function playWord(word: string) {
    if (!window.speechSynthesis) return;

    // Retry finding voice if not found yet (sometimes voiceschanged does not fire properly)
    if (!bestVoice && !initialized) {
        loadVoices();
    }

    const utterance = new SpeechSynthesisUtterance(word);
    
    if (bestVoice) {
        utterance.voice = bestVoice;
        utterance.lang = bestVoice.lang;
    } else {
        // Fallback lang property directly if voice object not loaded
        utterance.lang = 'de-DE';
    }

    // Cancel any ongoing speech to make it snappy
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}
