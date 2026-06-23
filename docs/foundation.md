# Canvas encoder

## Formal deinition

1. Lattice Points
A lattice point is any point on the grid. It is a place where a curve can bend or pass through, but it is not a dot you draw yourself.
Think of lattice points as the invisible grid lines on graph paper. They are there to help you space things evenly.
2. Anchor Dots
An anchor dot is a special lattice point where you actually place a dot. It is where your pattern starts, turns, or meets another line.
Anchor dots sit on top of lattice points, but only on every other one. They are spaced apart so curves have room to bend between them.

## drawing a initial grid :
For an m × n kolam, draw a (2m+1) × (2n+1) grid of lattice points.
Place your anchor dots at every other lattice point, starting from the second one.
Skip the first lattice point, place an anchor, skip one, place an anchor, and so on.
The anchor dots are where your pattern lives. The in-between lattice points are just space for your curves to bend smoothly.

## Kolam Splines

The path between anchor dots is drawn with curved lines called splines. Each spline is a quadratic Bézier curve that starts at one anchor dot and ends at the next. Between every pair of neighboring anchor dots lies exactly one lattice point. This midpoint serves as the control point that pulls the curve outward, giving it a smooth bend. The curve never touches the control point itself; it only bends in its direction.

When one spline meets another at an anchor dot, they form a joint. Because the control points before and after any anchor dot lie on the same straight grid line, the two curves share the same direction as they pass through the dot. This makes every joint smooth and continuous, with no sharp corners. The path is a chain of these splines that visits anchor dots in order and closes back on itself to form a complete loop.

For clarity during drawing, the joints and control points should be displayed on the canvas. Joints appear as small marks at every anchor dot where two curves meet, and control points appear as faint guides at the lattice points between anchors. Showing these elements helps verify that the curves connect cleanly and that the control points sit at the correct midpoints. Once the pattern is confirmed, the guides may be hidden to reveal only the finished kolam.

## Sequence Representation

A kolam is stored as an ordered sequence of lattice point coordinates `[li, lj]`. Consecutive pairs of points define curve segments. Multiple strokes are separated by `---`. This is the ground-truth format — position-aware, grid-size independent, and directly renderable.

For model training, coordinates are tokenized as flat integers: `token = row * (2n+1) + col`.

## Isomorphism and Graph Signature

Two kolam sequences are isomorphic if they produce the same abstract graph structure, regardless of position on the grid, drawing direction, or stroke order.

**Building the graph:**
- Each lattice point in the sequence → node
- Each consecutive pair of points → undirected edge
- Node degree = number of edges connected to it

**Weisfeiler-Leman (WL) Certificate:**

The certificate is a string that fingerprints the graph's topology. It is computed in 3 rounds:

Round 0 — label each node with its degree:
```
center point (visited 4 times) → "4"
loop points (visited 2 times)  → "2"
```

Round 1 — each node absorbs its neighbors' labels (sorted):
```
center     → "4[2,2,2,2]"   degree-4, four degree-2 neighbors
lobe end   → "2[2,4]"        degree-2, one deg-2 + one deg-4 neighbor
lobe mid   → "2[2,2]"        degree-2, two deg-2 neighbors
```

Round 2 and 3 — repeat, encoding progressively wider neighborhoods.

Certificate = sort all final node labels alphabetically → join with `|`.

Two kolams are isomorphic ↔ their certificates are equal.

**Why degree sequence alone is not enough:**

Degree sequence (e.g. `[4,2,2,2,2,2,2]`) is necessary but not sufficient. Two different graphs can share the same degree sequence but connect differently. WL additionally checks what each node's *neighbors'* degrees are — catching structural differences that pure degree counting misses.

**Translational invariance:**

WL never uses coordinates. Node names (`"3,2"`, `"7,6"`) are discarded after the first round and replaced by degree labels. A figure-8 drawn at `(3,2)` and the same figure-8 drawn at `(7,6)` produce identical certificates. Translation, rotation, and reflection invariance all fall out naturally.

**Graph layout for visualization:**

Nodes are displayed with highest-degree nodes (hubs) at center, lower-degree nodes evenly spaced in a circle around them. This makes the hub-and-spoke structure of kolam patterns visually obvious. The layout is for display only — it does not affect the certificate.