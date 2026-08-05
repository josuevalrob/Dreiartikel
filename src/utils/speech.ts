let bestVoice: SpeechSynthesisVoice | null = null;

// Global audio gate. The Settings menu flips this; every playWord call is gated
// by it, so muting is one switch rather than a prop threaded through the hook.
let audioEnabled = true;

/** Enable/disable spoken audio app-wide. When disabling, any in-progress speech
 *  is cut immediately so toggling off is instant. */
export function setAudioEnabled(enabled: boolean) {
    audioEnabled = enabled;
    if (!enabled) stopSpeech();
}

function loadVoices() {
    const voices = window.speechSynthesis.getVoices();
    // Prioritize high-quality German voices (like Google Deutsch or native iOS German)
    const germanVoices = voices.filter(v => v.lang.startsWith('de-DE') || v.lang === 'de');
    if (germanVoices.length > 0) {
        // Try to find a premium voice or just take the first one
        bestVoice = germanVoices.find(v => v.name.includes('Premium') || v.name.includes('Google')) || germanVoices[0];
    }
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
    if (!audioEnabled) return;
    if (!window.speechSynthesis) return;

    // Always retry finding a German voice if we don't have one yet
    if (!bestVoice) {
        loadVoices();
    }

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'de-DE';

    if (bestVoice) {
        utterance.voice = bestVoice;
    }

    // Cancel any ongoing speech to make it snappy
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

/** Immediately stop any speech in progress (e.g. when leaving the game). */
export function stopSpeech() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
}
