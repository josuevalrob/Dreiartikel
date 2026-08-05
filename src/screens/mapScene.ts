import kaplay, { type KAPLAYCtx, type GameObj, type TweenController } from 'kaplay';
import { MAP_NODES, MAP_EDGES, nodeById, type MapNode } from '../map';
import type { GameMode } from '../hooks/useGameState';

// ─── Pixel-art overworld renderer (Kaplay) ──────────────────────────────────
//
// Draws the lesson graph as a classic SNES-style overworld: a tiled terrain of
// grass / forest / water / mountains, a dirt road tracing MAP_EDGES, a sprite
// building per node, and a little hero that walks the road. NO image assets —
// everything is procedural rect/pixel art so it stays asset-free and themeable.
//
// The data layer (MAP_NODES/MAP_EDGES) is the single source of truth; this file
// only *renders* it. Adding a node/edge later needs no change here.

// Virtual resolution. Low on purpose — every "pixel" is a chunky scaled-up
// block, which is what gives the retro look. The canvas renders at this true
// (wide) aspect and the MapScreen scrolls it HORIZONTALLY: the journey runs
// left→right like a side-scroller, so the world is WIDE and SHORT. Height is
// fixed (one screen tall); width is generous so the path has room to breathe
// and the terrain isn't cramped.
const VW = 440;
const VH = 176;
const TILE = 8; // px per terrain tile in virtual space
const COLS = VW / TILE; // 55
const ROWS = VH / TILE; // 22

// Palette — a warm SNES-overworld feel (grass greens, dirt road, blue water).
const PAL = {
    grass: [86, 142, 64],
    grassDark: [70, 122, 52],
    forest: [44, 96, 50],
    forestDark: [32, 78, 40],
    water: [64, 120, 196],
    waterDark: [52, 104, 178],
    mountain: [120, 110, 102],
    mountainDark: [96, 88, 82],
    road: [188, 156, 102],
    roadEdge: [150, 120, 76],
    stone: [176, 176, 184],
    stoneDark: [120, 122, 132],
    roof: [176, 64, 60],
    roofDark: [140, 46, 44],
    wood: [120, 82, 48],
    gold: [240, 196, 80],
    flag: [60, 120, 220],
    heroBody: [60, 96, 200],
    heroSkin: [232, 196, 156],
    shadow: [0, 0, 0],
    label: [40, 32, 24],
    labelBg: [244, 232, 200],
} as const;

type RGB = readonly [number, number, number];

// Deterministic PRNG so the terrain is stable across renders (no flicker).
function mulberry(seed: number) {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

type Terrain = 'grass' | 'forest' | 'water' | 'mountain';

/** Map a node's [0,100] position to a tile cell, kept inside a safe margin so
 *  buildings never clip the edge. A wider inset on x leaves road run-in/run-out
 *  room at both ends of the long horizontal world; a tighter band on y keeps the
 *  trail compact (nodes wiggle just above/below it, they don't scatter). */
function nodeCell(node: MapNode): { col: number; row: number } {
    const col = Math.round((node.x / 100) * (COLS - 7)) + 3;
    const row = Math.round((node.y / 100) * (ROWS - 6)) + 3;
    return { col, row };
}

/** Trace a road (list of cells) between two cells: an L-path (horizontal then
 *  vertical) so it reads as deliberate roads, not straight diagonals. */
function tracePath(a: { col: number; row: number }, b: { col: number; row: number }) {
    const cells: { col: number; row: number }[] = [];
    const stepC = Math.sign(b.col - a.col);
    let c = a.col;
    for (; c !== b.col; c += stepC) cells.push({ col: c, row: a.row });
    const stepR = Math.sign(b.row - a.row);
    let r = a.row;
    for (; r !== b.row; r += stepR) cells.push({ col: b.col, row: r });
    cells.push({ col: b.col, row: b.row });
    return cells;
}

/** Which building sprite a node shows, derived from its mode (data stays clean). */
function buildingFor(mode: GameMode): 'castle' | 'tower' | 'house' | 'camp' {
    switch (mode) {
        case 'article': return 'castle';
        case 'plural': return 'tower';
        case 'case-single': return 'house';
        case 'case-detect': return 'camp';
        case 'story': return 'house';   // a cosy place to read a letter
    }
}

/** The virtual canvas aspect (width:height), so the wrap can match it and avoid
 *  letterboxing — making the HTML-overlay label math a trivial percentage. */
export const MAP_ASPECT = VW / VH;

/** A node's label anchor, as a percentage of the virtual canvas (0–100). */
export interface LabelPos {
    id: string;
    label: string;
    xPct: number;
    yPct: number;
}

export interface MapScene {
    /** Move the hero to a node and visually select it. */
    select: (nodeId: string) => void;
    /** Where to place each node's HTML label, in canvas-% coordinates. */
    labelPositions: LabelPos[];
    /** Tear down Kaplay + the canvas. */
    destroy: () => void;
}

/** Mount the pixel map into `canvas`. `onSelect` fires when a building is tapped. */
export function createMapScene(canvas: HTMLCanvasElement, onSelect: (id: string) => void): MapScene {
    const k = kaplay({
        canvas,
        width: VW,
        height: VH,
        // stretch + letterbox: keep the fixed VWxVH virtual coordinate space and
        // scale it to fill the container at ANY size / device-pixel-ratio. Without
        // stretch, Kaplay resizes its buffer to the element (×DPR) while world
        // objects stay at VWxVH, cramming everything into a corner on Retina.
        stretch: true,
        letterbox: true,
        crisp: true,            // nearest-neighbour scaling → crisp pixels
        background: [38, 92, 56],
        global: false,
        pixelDensity: 1,
    });

    const col = (c: RGB) => k.rgb(c[0], c[1], c[2]);
    const px = (x: number, y: number, w: number, h: number, c: RGB, z = 0) =>
        k.add([
            k.rect(w, h),
            k.pos(x, y),
            k.color(col(c)),
            k.z(z),
        ]);

    // ── Terrain ──────────────────────────────────────────────────────────
    // Seeded so the world is identical every mount. The scenery (lakes, mountain
    // ridges, forests) is procedural DECORATION — it fills the world around the
    // authored path; it isn't part of map.json. Across the wide horizontal world
    // we scatter a few lakes and a couple of mountain ridges along the length so
    // it doesn't clump in one corner, then sprinkle forest in the gaps.
    const rnd = mulberry(1337);
    const grid: Terrain[][] = [];
    for (let r = 0; r < ROWS; r++) {
        grid[r] = [];
        for (let c = 0; c < COLS; c++) grid[r][c] = 'grass';
    }
    // Lakes distributed along the bottom band of the long world.
    const lakes = [
        { col: Math.round(COLS * 0.18), row: ROWS - 4, rc: 2.4 },
        { col: Math.round(COLS * 0.5), row: ROWS - 3, rc: 1.8 },
        { col: Math.round(COLS * 0.82), row: ROWS - 4, rc: 2.2 },
    ];
    // Mountain ridges hugging the top edge at a couple of points along the length.
    const ridges = [
        { col: Math.round(COLS * 0.34), halfW: 4 },
        { col: Math.round(COLS * 0.7), halfW: 5 },
    ];
    const inRidge = (c: number) => ridges.some(g => Math.abs(c - g.col) <= g.halfW);
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            // Inside ANY lake's radius (each carries its own rc) → water.
            const inLake = lakes.some(l => Math.hypot(c - l.col, r - l.row) < l.rc + rnd() * 0.8);
            if (inLake) grid[r][c] = 'water';
            else if (r < 3 && inRidge(c) && rnd() > 0.3) grid[r][c] = 'mountain';
            else if (rnd() > 0.86) grid[r][c] = 'forest';
        }
    }

    const TERRAIN: Record<Terrain, [RGB, RGB]> = {
        grass: [PAL.grass, PAL.grassDark],
        forest: [PAL.forest, PAL.forestDark],
        water: [PAL.water, PAL.waterDark],
        mountain: [PAL.mountain, PAL.mountainDark],
    };

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const t = grid[r][c];
            const [base, dark] = TERRAIN[t];
            const x = c * TILE, y = r * TILE;
            px(x, y, TILE, TILE, base, 0);
            // a couple of darker pixels for texture (deterministic by cell)
            const speck = mulberry(r * 31 + c * 7);
            if (speck() > 0.5) px(x + 4, y + 4, 2, 2, dark, 1);
            if (t === 'forest') {
                // little tree: trunk + canopy
                px(x + 3, y + 4, 2, 3, PAL.wood, 2);
                px(x + 1, y, 6, 5, PAL.forestDark, 2);
                px(x + 2, y + 1, 4, 3, PAL.forest, 3);
            }
            if (t === 'mountain') {
                px(x, y + 4, TILE, 4, PAL.mountainDark, 2);
                px(x + 2, y + 1, 4, 4, PAL.stone, 2);
                px(x + 3, y + 1, 2, 2, PAL.stoneDark, 3);
            }
        }
    }

    // ── Roads (trace edges) ────────────────────────────────────────────────
    const cellOf = new Map<string, { col: number; row: number }>();
    for (const n of MAP_NODES) cellOf.set(n.id, nodeCell(n));

    for (const edge of MAP_EDGES) {
        const a = cellOf.get(edge.from);
        const b = cellOf.get(edge.to);
        if (!a || !b) continue;
        const path = tracePath(a, b);
        for (let i = 0; i < path.length; i++) {
            const cell = path[i];
            // forks are dashed: skip every other tile
            if (edge.kind === 'fork' && i % 2 === 1) continue;
            const x = cell.col * TILE, y = cell.row * TILE;
            px(x + 1, y + 1, TILE - 2, TILE - 2, PAL.roadEdge, 4);
            px(x + 2, y + 2, TILE - 4, TILE - 4, PAL.road, 5);
        }
    }

    // ── Buildings (one per node) + click targets ──────────────────────────
    function drawCastle(cx: number, cy: number, kctx: KAPLAYCtx, parent: GameObj) {
        const add = (x: number, y: number, w: number, h: number, c: RGB) =>
            parent.add([kctx.rect(w, h), kctx.pos(x, y), kctx.color(col(c))]);
        add(cx - 7, cy - 2, 14, 9, PAL.stone);       // keep
        add(cx - 7, cy - 2, 14, 2, PAL.stoneDark);
        add(cx - 8, cy - 5, 3, 4, PAL.stone);        // left tower
        add(cx + 5, cy - 5, 3, 4, PAL.stone);        // right tower
        add(cx - 1, cy - 7, 2, 5, PAL.wood);         // flagpole
        add(cx + 1, cy - 7, 4, 3, PAL.flag);         // flag
        add(cx - 2, cy + 2, 4, 5, PAL.stoneDark);    // gate
    }
    function drawTower(cx: number, cy: number, kctx: KAPLAYCtx, parent: GameObj) {
        const add = (x: number, y: number, w: number, h: number, c: RGB) =>
            parent.add([kctx.rect(w, h), kctx.pos(x, y), kctx.color(col(c))]);
        add(cx - 4, cy - 8, 8, 15, PAL.stone);
        add(cx - 4, cy - 8, 8, 2, PAL.stoneDark);
        add(cx - 5, cy - 10, 10, 3, PAL.roof);
        add(cx - 2, cy - 4, 4, 4, PAL.gold);         // glowing window (numbers vibe)
        add(cx - 2, cy + 2, 4, 5, PAL.stoneDark);
    }
    function drawHouse(cx: number, cy: number, kctx: KAPLAYCtx, parent: GameObj) {
        const add = (x: number, y: number, w: number, h: number, c: RGB) =>
            parent.add([kctx.rect(w, h), kctx.pos(x, y), kctx.color(col(c))]);
        add(cx - 6, cy - 1, 12, 8, PAL.wood);
        add(cx - 7, cy - 5, 14, 5, PAL.roof);
        add(cx - 7, cy - 5, 14, 2, PAL.roofDark);
        add(cx - 2, cy + 2, 4, 5, PAL.roofDark);     // door
    }
    function drawCamp(cx: number, cy: number, kctx: KAPLAYCtx, parent: GameObj) {
        const add = (x: number, y: number, w: number, h: number, c: RGB) =>
            parent.add([kctx.rect(w, h), kctx.pos(x, y), kctx.color(col(c))]);
        // a tent (sidequest)
        add(cx - 6, cy + 1, 12, 6, PAL.roof);
        add(cx - 1, cy + 1, 2, 6, PAL.roofDark);
        add(cx, cy - 6, 1, 7, PAL.wood);             // pole
        add(cx + 2, cy - 6, 3, 2, PAL.gold);         // pennant
    }

    const labelPositions: LabelPos[] = [];

    for (const node of MAP_NODES) {
        const cell = cellOf.get(node.id)!;
        const cx = cell.col * TILE + TILE / 2;
        const cy = cell.row * TILE + TILE / 2;

        // Label anchor, just below the building, as a % of the virtual canvas.
        labelPositions.push({
            id: node.id,
            label: node.label,
            xPct: (cx / VW) * 100,
            yPct: ((cy + 9) / VH) * 100,
        });

        const group = k.add([k.pos(0, 0), k.z(10)]);
        // soft shadow
        group.add([k.rect(14, 3), k.pos(cx - 7, cy + 7), k.color(col(PAL.shadow)), k.opacity(0.25)]);

        const kind = buildingFor(node.mode);
        if (kind === 'castle') drawCastle(cx, cy, k, group);
        else if (kind === 'tower') drawTower(cx, cy, k, group);
        else if (kind === 'house') drawHouse(cx, cy, k, group);
        else drawCamp(cx, cy, k, group);

        // Labels are rendered as crisp HTML overlays by MapScreen (Kaplay text on
        // a `crisp` WebGL canvas rasterises to a mangled block at this size). The
        // scene exposes each node's position as a % of the virtual canvas so the
        // overlay can place labels with a plain CSS percentage — no letterbox math,
        // because the wrap is locked to the canvas aspect ratio.

        // Invisible, generously-sized click target over the whole marker.
        const hit = k.add([
            k.rect(22, 26),
            k.pos(cx - 11, cy - 12),
            k.area(),
            k.color(col(PAL.shadow)),
            k.opacity(0),
            k.z(20),
            'marker',
            { nodeId: node.id },
        ]);
        hit.onClick(() => onSelect(node.id));
    }

    // ── Selection ring (drawn around the active node) ──────────────────────
    let ring: GameObj | null = null;
    function placeRing(nodeId: string) {
        const cell = cellOf.get(nodeId);
        if (!cell) return;
        const cx = cell.col * TILE + TILE / 2;
        const cy = cell.row * TILE + TILE / 2;
        if (ring) ring.destroy();
        ring = k.add([
            k.circle(13),
            k.pos(cx, cy),
            k.anchor('center'),
            k.outline(2, col(PAL.gold)),
            k.color(col(PAL.gold)),
            k.opacity(0),       // fill transparent, just the outline
            k.z(9),
            k.scale(1),
        ]);
        const r = ring;
        // gentle pulse
        r.onUpdate(() => {
            const s = 1 + Math.sin(k.time() * 4) * 0.08;
            r.scale = k.vec2(s, s);
        });
    }

    // ── Node graph (for routing the hero ALONG the roads) ──────────────────
    // Undirected adjacency from the edges: the hero can travel either direction.
    const adj = new Map<string, string[]>();
    for (const n of MAP_NODES) adj.set(n.id, []);
    for (const e of MAP_EDGES) {
        adj.get(e.from)?.push(e.to);
        adj.get(e.to)?.push(e.from);
    }

    /** BFS shortest node path between two node ids (inclusive of both ends). */
    function nodePath(from: string, to: string): string[] {
        if (from === to) return [from];
        const prev = new Map<string, string>();
        const queue = [from];
        const seen = new Set([from]);
        while (queue.length) {
            const cur = queue.shift()!;
            for (const next of adj.get(cur) ?? []) {
                if (seen.has(next)) continue;
                seen.add(next);
                prev.set(next, cur);
                if (next === to) {
                    const path = [to];
                    let p = to;
                    while (prev.has(p)) { p = prev.get(p)!; path.unshift(p); }
                    return path;
                }
                queue.push(next);
            }
        }
        return [from, to]; // disconnected fallback: straight hop
    }

    const cellCenter = (cell: { col: number; row: number }) =>
        k.vec2(cell.col * TILE + TILE / 2, cell.row * TILE + TILE / 2 + 2);

    // ── Hero ───────────────────────────────────────────────────────────────
    let heroNodeId = MAP_NODES[0].id;
    const heroStart = cellOf.get(heroNodeId)!;
    const hero = k.add([
        k.pos(cellCenter(heroStart)),
        k.anchor('center'),
        k.z(15),
        k.scale(1),
    ]);
    hero.add([k.rect(4, 5), k.pos(-2, -2), k.color(col(PAL.heroBody))]);   // body
    hero.add([k.rect(3, 3), k.pos(-1.5, -6), k.color(col(PAL.heroSkin))]); // head
    hero.add([k.rect(5, 2), k.pos(-2.5, -7), k.color(col(PAL.gold))]);     // hat
    let heroBob = 0;
    hero.onUpdate(() => {
        heroBob += k.dt() * 6;
        hero.pos.y += Math.sin(heroBob) * 0.05;
    });

    // Walk the hero ALONG the roads to a node: build the full list of road cells
    // (the same L-shaped tracePath the roads are drawn from) for every edge on the
    // route, then tween through those waypoints in sequence so the hero turns the
    // 90° corners instead of cutting across them diagonally.
    let walkTween: TweenController | null = null;
    let walkGen = 0;             // bumped per walk; stale onEnd callbacks no-op
    function moveHeroTo(nodeId: string) {
        if (!cellOf.has(nodeId)) return;
        walkTween?.cancel();
        const myGen = ++walkGen;  // any in-flight chain now has an older gen

        const route = nodePath(heroNodeId, nodeId);
        heroNodeId = nodeId;

        // Concatenate the road cells for each hop along the route into one path.
        // CRUCIAL: trace each hop in the SAME orientation the road was drawn with
        // (edge.from → edge.to), then reverse if the hero travels the other way —
        // otherwise an L-shaped road would corner differently going backwards and
        // the hero would leave the road.
        const waypoints: ReturnType<typeof cellCenter>[] = [];
        for (let i = 0; i < route.length - 1; i++) {
            const u = route[i];
            const v = route[i + 1];
            const edge = MAP_EDGES.find(
                e => (e.from === u && e.to === v) || (e.from === v && e.to === u),
            );
            // Trace as the road was drawn (from→to), reverse if walking to→from.
            const fromId = edge ? edge.from : u;
            const toId = edge ? edge.to : v;
            let cells = tracePath(cellOf.get(fromId)!, cellOf.get(toId)!);
            if (fromId !== u) cells = cells.slice().reverse();
            // skip the first cell of each hop after the first (it's the previous
            // hop's last cell) to avoid a zero-length pause
            for (let j = i === 0 ? 0 : 1; j < cells.length; j++) {
                waypoints.push(cellCenter(cells[j]));
            }
        }
        if (waypoints.length === 0) return;

        const SECONDS_PER_TILE = 0.12;
        let idx = 0;
        const step = () => {
            if (myGen !== walkGen || idx >= waypoints.length) return;
            const target = waypoints[idx++];
            walkTween = k.tween(
                hero.pos,
                target,
                SECONDS_PER_TILE,
                (v) => { hero.pos = v; },
                k.easings.linear,
            );
            walkTween.onEnd(() => step());
        };
        step();
    }

    // Initial selection on the first node.
    placeRing(MAP_NODES[0].id);

    return {
        select(nodeId: string) {
            if (!nodeById(nodeId)) return;
            placeRing(nodeId);
            moveHeroTo(nodeId);
        },
        labelPositions,
        destroy() {
            walkTween?.cancel();
            k.quit();
        },
    };
}
