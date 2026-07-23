# Kolam Engine — Foundation

Everything actually implemented in `kolam_engine`. This is the ground truth for `kolam_press`.

---

## 1. The Lattice

A kolam of size **m × n** is drawn on a **(2m+1) × (2n+1)** grid of lattice points.

Every point has a coordinate `[li, lj]` where:
- `li` = row index, `0 .. 2m`
- `lj` = col index, `0 .. 2n`

Two types of lattice points:

| Type | Condition | Role |
|---|---|---|
| **Anchor dot** | `li` odd AND `lj` odd | The visible dots the kolam is drawn around |
| **Midpoint** | anything else | Invisible grid — curve control points live here |

```
isAnchor(li, lj) = li % 2 === 1 && lj % 2 === 1
```

Example — 3×3 kolam → 7×7 lattice:
- Anchors at: `(1,1),(1,3),(1,5),(3,1),(3,3),(3,5),(5,1),(5,3),(5,5)` → 9 dots
- All other points are midpoints used as spline control points

Anchor grid indices map to lattice indices as:
```
li = 2 * row + 1
lj = 2 * col + 1
```

---

## 2. The Sequence Format

A kolam is stored as an **ordered list of `[li, lj]` lattice coordinates**.

```
[2,1] → [1,0] → [0,1] → [1,2] → [2,2] → ...
```

Rules:
- Each `[li, lj]` is a lattice point (anchor or midpoint)
- Consecutive points define one spline segment
- The path **never passes through an anchor** — anchors are curved *around*
- Multiple strokes are separated by `---`
- A closed stroke starts and ends at the same point

For model training, coordinates are tokenized as flat integers:
```
token = li * (2n+1) + lj
```

The sequence is the **ground-truth representation** — position-aware, grid-size-tagged, directly renderable.

---

## 3. Spline Rendering

The path is drawn as **chained quadratic Bézier curves**.

Algorithm (mirrors Paper.js and canvas 2D):

1. Start at `coords[0]`
2. For each point `coords[i]` (i = 1 .. n-2):
   - Compute midpoint: `mid = (coords[i] + coords[i+1]) / 2`
   - Draw `quadraticCurveTo(coords[i], mid)` — `coords[i]` is the **control point**, `mid` is the endpoint
3. Final segment: `lineTo(coords[n-1])`

This produces smooth, continuous curves with no sharp corners at joints. The curve bends *toward* each lattice point but never passes through it — which is why the path gracefully arcs around anchor dots.

**Key property:** Control points at midpoints between anchors share the same tangent direction going in and out of each anchor → perfectly smooth joints.

---

## 4. Chalk Renderer

Implemented in `renderer.ts`. No canvas stroke API used — the chalk effect is point-sampled.

Algorithm:
1. Sample the Paper.js path at every ~1.5px along its length
2. At each sample point, stamp a jittered circle:
   - Random offset: `±width * 0.45`
   - Random radius: `(width/2) * (0.6 .. 1.2)`
   - Random alpha: `0.5 .. 0.9`
3. Use a **seeded PRNG** (LCG: `s = s * 16807 % 2147483647`) so the same geometry always produces the same grain

```
seededRand(seed) → () → float in [0,1)
```

The seed is derived from the first point's coordinates, so the chalk texture is deterministic per stroke.

---

## 5. Drawing Tool

Implemented in `draw.ts`. The user draws by moving the mouse/finger across the lattice.

**Snapping:** At every mouse move, find the nearest **non-anchor** lattice point within `spacing/2` pixels. Only non-anchor midpoints are valid snap targets — the path visits midpoints, not anchors.

**Stroke lifecycle:**
1. `mousedown` → start new stroke at snapped point
2. `mousemove` → extend stroke as cursor crosses new lattice points
3. `mousedown` again (or touch lift) → commit stroke, start next

**Two callbacks:**
- `onLive` — fires on every point added (for real-time decoder preview)
- `onCommit` — fires when a stroke is finished (for isomorphism check)

---

## 6. Decoder & Animated Trace

Implemented in `decoder.ts`. Takes a `[li,lj][][]` sequence and animates it.

Two modes:
- **`decodeLive`** — draws all current strokes statically in cyan (live preview while drawing)
- **`decodeLoop`** — animates a moving head along the path, highlighting the corresponding token in the textarea in sync

The animated head advances frame by frame along the sampled spline points. Token highlighting uses char offset lookup so the textarea scrolls to the current segment.

---

## 7. Isomorphism — WL Certificate

Implemented in `isomorphism.ts`. Two kolam sequences are **structurally isomorphic** if they produce the same abstract graph regardless of position, drawing direction, or stroke order.

**Step 1 — Build graph from sequence:**
- Each `[li,lj]` point → node (keyed by `"li,lj"`)
- Each consecutive pair of points → undirected edge
- Parallel edges and self-loops are ignored

**Step 2 — 3-round Weisfeiler-Leman refinement:**

Round 0: label each node with its degree
```
label(n) = degree(n)
```

Round 1–3: each node absorbs its neighbours' labels
```
label(n) = "degree[sorted_neighbour_labels]"
e.g. "4[2,2,2,2]"
```

**Step 3 — Certificate:**
```
certificate = sorted list of all final node labels, joined by "|"
```

Two kolams are isomorphic ↔ `certificate(A) === certificate(B)`

**Why WL and not just degree sequence:**
Degree sequence alone can't distinguish graphs that have the same degrees but different connectivity. WL catches structural differences that pure degree counting misses.

**Invariances built in:**
- Translation — WL discards coordinates after Round 0
- Rotation / reflection — sorted neighbour labels are direction-agnostic
- Stroke order — graph is undirected, stroke direction doesn't matter

---

## 8. Sequence Parser

Implemented in `seq-parser.ts`. Parses the textarea text format.

Input:
```
[1,1] → [1,2] → [2,2] → [2,1] → [1,1]
---
[3,1] → [3,2] → [4,2]
```

Output: `[number, number][][]` — array of strokes, each stroke is array of `[li, lj]` pairs.

- Splits on `---` to get strokes
- Regex `\[(\d+),(\d+)\]` extracts each coordinate
- Drops strokes with fewer than 2 points
- Invalid tokens silently skipped

The textarea is **editable** — typing or pasting a sequence directly updates the decoder canvas in real time.

---

## 9. Challenge Mode

Implemented in `challenge.ts`. Shows a target kolam on the left, user draws on the right.

- Both canvases run independent encoder/decoder instances
- WL certificates computed live on both sides
- Status updates in real time: `✓ Correct` when certificates match, `✗ Not yet` otherwise
- Graph signature visualized as a node graph — hubs (high-degree nodes) at centre, others in a ring

---

## 10. Grid Config

```typescript
interface GridConfig {
  rows: number   // m — anchor rows
  cols: number   // n — anchor cols
  spacing: number // pixels between lattice points
}
```

Spacing is auto-fitted to fill 80% of the canvas. Label reserve of 44px at the top is baked in so the chalk label never overlaps the grid.

Canvas-to-lattice mapping:
```
x = origin.x + lj * spacing
y = origin.y + li * spacing
```

Origin is computed to centre the grid on the canvas accounting for the label band.



