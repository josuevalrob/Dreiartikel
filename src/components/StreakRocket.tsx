import { useEffect, useState } from 'react';

interface StreakRocketProps {
    streak: number;
    feedback: 'correct' | 'incorrect' | null;
}

export function StreakRocket({ streak, feedback }: StreakRocketProps) {
    const [crashed, setCrashed] = useState(false);

    useEffect(() => {
        if (feedback === 'incorrect') {
            setCrashed(true);
            const t = setTimeout(() => setCrashed(false), 2000);
            return () => clearTimeout(t);
        } else {
            setCrashed(false);
        }
    }, [feedback]);

    // Calculate position. Max out around 80% to keep it on screen.
    const positionPercent = Math.min(streak * 10, 80);
    const isOnFire = streak >= 5;

    let rocketClasses = "rocket-svg";
    if (crashed) rocketClasses += " crashing";
    else if (isOnFire) rocketClasses += " flying-fast";
    else if (streak > 0) rocketClasses += " flying";

    return (
        <div className="rocket-track">
            <div 
                className="rocket-container" 
                style={{ transform: `translateX(${crashed ? positionPercent : positionPercent}vw)` }}
            >
                <svg className={rocketClasses} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.13 22.19L11.5 18.36C13.07 17.78 14.54 17 15.9 16.09L13.13 22.19M5.64 12.5L1.81 10.87L7.91 8.1C7 9.46 6.22 10.93 5.64 12.5M21.61 2.39C21.61 2.39 16.66 .269 11 5.94C8.81 8.13 7.32 10.83 6.65 13.61L2.36 15.54C2.15 15.63 2 15.84 2 16.06C2 16.29 2.15 16.5 2.36 16.59L6.64 18.52C7.3 21.29 8.8 24 11 26.19C15.82 31.02 21.61 26.39 21.61 26.39L20.25 19.82L21.61 18.46L20.25 17.1L21.61 15.74L20.25 14.38L21.61 13.02L20.25 11.66L21.61 10.3L20.25 8.94L21.61 7.58L20.25 6.22L21.61 4.86Z" />
                    {/* Simplified rocket path: standard material icon "rocket" */}
                    <path d="M14 8.5C14 7.12 15.12 6 16.5 6C17.88 6 19 7.12 19 8.5C19 9.88 17.88 11 16.5 11C15.12 11 14 9.88 14 8.5M2.2 17.06L4.24 19.1L5.65 17.69L4.24 16.27L2.2 17.06M20.27 1.25C20.27 1.25 10.37 1.05 4.5 6.92C2.18 9.24 1 12.5 1 15.8V17L6.5 22.5H7.7C11 22.5 14.26 21.32 16.58 19C22.45 13.13 22.25 3.23 22.25 3.23L20.27 1.25Z" />
                </svg>
                {isOnFire && !crashed && (
                    <div className="fire-trail"></div>
                )}
            </div>
            
            <div className="track-line"></div>
        </div>
    );
}
