import confetti from 'canvas-confetti';

/**
 * Fires confetti with escalating intensity based on how many times
 * the current streak has surpassed the previous best streak.
 *
 * hypeLevel 1 = first time beating best (e.g. streak 5 with best 5) → mild
 * hypeLevel 2 = double (e.g. streak 10 with best 5) → medium
 * hypeLevel 3+ = triple+ → insane
 *
 * The function is called programmatically at milestone thresholds.
 */

export function getHypeLevel(streak: number, bestStreak: number): number {
    if (bestStreak <= 0) {
        // First run — use absolute milestones
        if (streak >= 20) return 4;
        if (streak >= 10) return 3;
        if (streak >= 5) return 2;
        if (streak >= 3) return 1;
        return 0;
    }

    const ratio = streak / bestStreak;
    if (ratio >= 4) return 5;
    if (ratio >= 3) return 4;
    if (ratio >= 2) return 3;
    if (ratio >= 1.5) return 2;
    if (ratio >= 1) return 1;
    return 0;
}

export function fireConfetti(hypeLevel: number) {
    if (hypeLevel <= 0) return;

    const base = {
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        zIndex: 9999,
    };

    if (hypeLevel === 1) {
        // Mild burst
        confetti({
            ...base,
            particleCount: 30,
            origin: { x: 0.5, y: 0.6 },
            colors: ['#3b82f6', '#60a5fa', '#93c5fd'],
        });
    } else if (hypeLevel === 2) {
        // Medium burst — two sides
        confetti({
            ...base,
            particleCount: 60,
            origin: { x: 0.3, y: 0.5 },
            colors: ['#10b981', '#34d399', '#6ee7b7'],
        });
        confetti({
            ...base,
            particleCount: 60,
            origin: { x: 0.7, y: 0.5 },
            colors: ['#10b981', '#34d399', '#6ee7b7'],
        });
    } else if (hypeLevel === 3) {
        // Hot burst — three sources
        confetti({
            ...base,
            particleCount: 100,
            origin: { x: 0.2, y: 0.4 },
            colors: ['#f59e0b', '#fbbf24', '#fcd34d'],
            startVelocity: 45,
        });
        confetti({
            ...base,
            particleCount: 100,
            origin: { x: 0.5, y: 0.3 },
            colors: ['#ef4444', '#f87171', '#fca5a5'],
            startVelocity: 50,
        });
        confetti({
            ...base,
            particleCount: 100,
            origin: { x: 0.8, y: 0.4 },
            colors: ['#f59e0b', '#fbbf24', '#fcd34d'],
            startVelocity: 45,
        });
    } else {
        // INSANE — full cannon from everywhere
        const duration = 2000;
        const end = Date.now() + duration;

        const frame = () => {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'],
                zIndex: 9999,
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'],
                zIndex: 9999,
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };
        frame();
    }
}

/**
 * Returns a CSS color for the streak display.
 * Cold (blue/grey) when rebuilding, warm when approaching best, hot when surpassing.
 */
export function getStreakColor(streak: number, bestStreak: number): string {
    if (streak === 0) return '#64748b';        // slate — neutral
    if (bestStreak <= 0) {
        // First run
        if (streak >= 10) return '#ef4444';     // red hot
        if (streak >= 5) return '#f59e0b';      // amber
        if (streak >= 3) return '#3b82f6';      // blue warm
        return '#94a3b8';                       // cool grey
    }

    const ratio = streak / bestStreak;
    if (ratio >= 2) return '#ef4444';           // red — on fire
    if (ratio >= 1) return '#f59e0b';           // amber — beat your best
    if (ratio >= 0.6) return '#3b82f6';         // blue — getting warm
    return '#94a3b8';                           // cool grey — rebuilding
}
