import type { GameMode } from '../hooks/useGameState';

// The "place" a lesson happens in. Derived from the game mode (data stays clean,
// exactly like mapScene's buildingFor) so adding a mode = adding one entry here.
// Each place reuses the map's building identity: castle / tower / house / tent.
interface Place {
    name: string;
    building: 'castle' | 'tower' | 'house' | 'tent';
}

const PLACE: Record<GameMode, Place> = {
    'article': { name: 'The Article Keep', building: 'castle' },
    'plural': { name: 'The Counting Tower', building: 'tower' },
    'case-single': { name: "The Scholar's House", building: 'house' },
    'case-detect': { name: "The Ranger's Camp", building: 'tent' },
    'story': { name: 'The Letter Cottage', building: 'house' },
};

// A pixel building drawn as a CSS grid of colored cells. Each string row is one
// pixel row; a char is a palette key (space = transparent). Small + crisp.
const SPRITES: Record<Place['building'], string[]> = {
    // 9 wide
    castle: [
        's s   s s',
        'sssfsssss',
        'sssssssss',
        'sssssssss',
        'sssDDDsss',
        'sssDDDsss',
    ],
    tower: [
        '  rrr  ',
        ' sssss ',
        ' s g s ',
        ' sssss ',
        ' s   s ',
        ' sDDDs ',
    ],
    house: [
        '  rrrrr  ',
        ' rrrrrrr ',
        '  wwwww  ',
        '  w w w  ',
        '  wwDww  ',
        '  wwDww  ',
    ],
    tent: [
        '    f    ',
        '   ttt   ',
        '  ttttt  ',
        ' ttttttt ',
        'ttttDtttt',
        'ttttDtttt',
    ],
};

const COLORS: Record<string, string> = {
    s: '#b0b0b8', // stone
    f: '#3c78dc', // flag
    r: '#b0403c', // roof
    w: '#785230', // wood wall
    t: '#b0403c', // tent canvas
    g: '#f0c450', // glowing window
    D: '#2a1f10', // door / dark
};

function Sprite({ rows }: { rows: string[] }) {
    const cols = Math.max(...rows.map(r => r.length));
    return (
        <div
            className="place-sprite"
            style={{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows.length}, 1fr)`,
            }}
            aria-hidden="true"
        >
            {rows.flatMap((row, y) =>
                Array.from({ length: cols }, (_, x) => {
                    const ch = row[x] ?? ' ';
                    const c = COLORS[ch];
                    return (
                        <span
                            key={`${x}-${y}`}
                            style={c ? { background: c } : undefined}
                        />
                    );
                }),
            )}
        </div>
    );
}

/** A pixel-art header strip showing the lesson's place (reuses the map's
 *  building identity), so the game feels like it happens *somewhere*. */
export function PlaceBanner({ mode }: { mode: GameMode }) {
    const place = PLACE[mode];
    return (
        <div className="place-banner">
            <Sprite rows={SPRITES[place.building]} />
            <span className="place-name">{place.name}</span>
        </div>
    );
}
