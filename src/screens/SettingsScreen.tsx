import {
    type Settings,
    type NativeLanguage,
    NATIVE_LANGUAGES,
    MIN_DURATION_SEC,
    MAX_DURATION_SEC,
    clampDuration,
} from '../settings';

interface SettingsScreenProps {
    settings: Settings;
    onChange: (next: Settings) => void;
    onClose: () => void;
}

/** The Settings menu — a mobile-style preferences panel. Duration and audio are
 *  live; native language is shown but not yet applied (translation is a later
 *  iteration), so its row is marked "coming soon". */
export function SettingsScreen({ settings, onChange, onClose }: SettingsScreenProps) {
    const setDuration = (sec: number) =>
        onChange({ ...settings, durationSec: clampDuration(sec) });

    return (
        <div className="settings pixel">
            <div className="settings-panel">
                <header className="settings-header">
                    <h2 className="settings-title">Settings</h2>
                </header>

                {/* Time per word — stepper */}
                <div className="settings-row">
                    <div className="settings-row-text">
                        <span className="settings-row-label">Time per word</span>
                        <span className="settings-row-hint">Seconds you get to answer</span>
                    </div>
                    <div className="settings-stepper">
                        <button
                            type="button"
                            className="stepper-btn"
                            aria-label="Less time"
                            disabled={settings.durationSec <= MIN_DURATION_SEC}
                            onClick={() => setDuration(settings.durationSec - 1)}
                        >
                            −
                        </button>
                        <span className="stepper-value">{settings.durationSec}s</span>
                        <button
                            type="button"
                            className="stepper-btn"
                            aria-label="More time"
                            disabled={settings.durationSec >= MAX_DURATION_SEC}
                            onClick={() => setDuration(settings.durationSec + 1)}
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Audio — toggle */}
                <div className="settings-row">
                    <div className="settings-row-text">
                        <span className="settings-row-label">Audio</span>
                        <span className="settings-row-hint">Speak words and sentences</span>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={settings.audioEnabled}
                        className={`settings-toggle ${settings.audioEnabled ? 'on' : 'off'}`}
                        onClick={() => onChange({ ...settings, audioEnabled: !settings.audioEnabled })}
                    >
                        <span className="settings-toggle-knob" />
                    </button>
                </div>

                {/* Native language — shown, not yet applied */}
                <div className="settings-row">
                    <div className="settings-row-text">
                        <span className="settings-row-label">
                            Native language <span className="settings-soon">soon</span>
                        </span>
                        <span className="settings-row-hint">For translated hints (coming soon)</span>
                    </div>
                    <select
                        className="settings-select"
                        value={settings.nativeLang}
                        onChange={(e) =>
                            onChange({ ...settings, nativeLang: e.target.value as NativeLanguage })
                        }
                    >
                        {NATIVE_LANGUAGES.map((l) => (
                            <option key={l.value} value={l.value}>
                                {l.label}
                            </option>
                        ))}
                    </select>
                </div>

                <button className="start-btn settings-done" onClick={onClose}>
                    Done
                </button>
            </div>
        </div>
    );
}
