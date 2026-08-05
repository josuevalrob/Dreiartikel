// App settings — the small set of player-facing preferences a Settings menu
// exposes. Held in React state in App (in-memory only for now; no persistence —
// they reset on reload). Kept as a plain typed shape + defaults so the menu, the
// game loop, and the audio layer all agree on one source of truth.

/** A supported native language for translations/hints. Wired into the UI now;
 *  the actual translation behaviour is a later iteration. */
export type NativeLanguage = 'en' | 'es' | 'fr' | 'tr' | 'ar';

export interface Settings {
    /** Seconds allowed per word (the chess-clock per-word budget). */
    durationSec: number;
    /** Whether spoken audio (TTS) plays. */
    audioEnabled: boolean;
    /** The player's native language (for future translated hints). */
    nativeLang: NativeLanguage;
}

/** Bounds for the duration stepper (seconds per word). */
export const MIN_DURATION_SEC = 1;
export const MAX_DURATION_SEC = 8;

export const DEFAULT_SETTINGS: Settings = {
    durationSec: 3,        // matches the engine's historical 3s per word
    audioEnabled: true,
    nativeLang: 'en',
};

/** Display names for the native-language picker. */
export const NATIVE_LANGUAGES: { value: NativeLanguage; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'tr', label: 'Türkçe' },
    { value: 'ar', label: 'العربية' },
];

/** Clamp a duration into the allowed range (used by the stepper). */
export function clampDuration(sec: number): number {
    return Math.max(MIN_DURATION_SEC, Math.min(MAX_DURATION_SEC, Math.round(sec)));
}
