import type { GameMode, CaseFilter, FilterType } from './hooks/useGameState';
import mapData from './map.json';

// ─── The map is DATA, and the data lives in JSON ────────────────────────────
//
// The renderer (MapScreen / mapScene) knows nothing about Articles/Plural/Cases.
// It draws whatever the graph describes. That graph is authored in `map.json`,
// NOT here — adding a lesson, a fork, or rerouting the whole path is editing
// that file, no code change and no TS syntax to get wrong. This module only:
//   1. gives the JSON its types (MapNode / MapEdge),
//   2. validates it once at load so a bad hand-edit fails loudly, not silently,
//   3. re-exports the typed arrays + nodeById, the stable API everything uses.
//
// Why JSON over a .ts const: same reason chapter prose lives in .md — content
// you edit often should be plain data a non-dev can touch, decoupled from code.

/** A lesson on the map: a launch point for one game mode (+ optional preset). */
export interface MapNode {
    /** Stable key referenced by edges, e.g. 'cases-produce'. */
    id: string;
    /** Short title shown under the node, e.g. 'Cases · Produce'. */
    label: string;
    /** Emoji marker drawn on the node. */
    icon: string;
    /** Which game this node launches. */
    mode: GameMode;
    /** Optional case preset. If set, the node skips the in-panel case filter and
     *  drills only that case (a future "Dativ only" node). If unset, the panel
     *  shows the All/Nom/Akk/Dat filter. */
    caseFilter?: CaseFilter;
    /** Optional vocabulary scope. A category name (e.g. 'Animals') narrows the
     *  noun pool to that theme, so a side quest labelled "Tiere" actually drills
     *  animals. Unset = the whole pool ('all'). */
    filter?: FilterType;
    /** Story-mode nodes only: which story to play (a Story.id). Lets several
     *  story nodes share mode:'story' but each launch a different letter. */
    storyId?: string;
    /** Main-quest chapter nodes only: which chapter to play (a RawChapter.id).
     *  A chapter rides mode:'story' (its rounds come from authored prose) but
     *  launches a quest chapter instead of a letter. */
    chapterId?: string;
    /** Position on the canvas, both in [0,100]. x runs left→right along the
     *  journey (the world scrolls horizontally); y is a compact band so nodes
     *  wiggle just above/below the trail rather than scattering. */
    x: number;
    y: number;
}

/** A drawn connector between two nodes. 'main' = solid road (suggested order),
 *  'fork' = dashed sidequest. Not special-cased anywhere — a fork is simply an
 *  edge with kind:'fork', and a node may have any number of in/out edges. */
export interface MapEdge {
    from: string;
    to: string;
    kind: 'main' | 'fork';
}

interface MapData {
    nodes: MapNode[];
    edges: MapEdge[];
}

// ─── Load + validate the authored JSON ──────────────────────────────────────
// The JSON carries a leading `_comment`; structurally it's { nodes, edges }.
// Vite imports it as a parsed object. We assert the shape once here so a typo in
// map.json (a duplicate id, an edge to a missing node, an x out of range) throws
// at startup with a clear message — far better than a dead node at runtime.

const data = mapData as unknown as MapData;

function validate({ nodes, edges }: MapData): void {
    const ids = new Set<string>();
    for (const n of nodes) {
        if (ids.has(n.id)) throw new Error(`map.json: duplicate node id "${n.id}"`);
        ids.add(n.id);
        if (typeof n.x !== 'number' || n.x < 0 || n.x > 100 || typeof n.y !== 'number' || n.y < 0 || n.y > 100) {
            throw new Error(`map.json: node "${n.id}" x/y must be numbers in [0,100]`);
        }
    }
    for (const e of edges) {
        if (!ids.has(e.from)) throw new Error(`map.json: edge.from "${e.from}" is not a node id`);
        if (!ids.has(e.to)) throw new Error(`map.json: edge.to "${e.to}" is not a node id`);
        if (e.kind !== 'main' && e.kind !== 'fork') {
            throw new Error(`map.json: edge ${e.from}→${e.to} has invalid kind "${e.kind}"`);
        }
    }
}

validate(data);

export const MAP_NODES: MapNode[] = data.nodes;
export const MAP_EDGES: MapEdge[] = data.edges;

/** Look up a node by id (renderer + App use this to resolve edge endpoints). */
export function nodeById(id: string): MapNode | undefined {
    return MAP_NODES.find(n => n.id === id);
}
