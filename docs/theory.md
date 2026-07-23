# Kolam Theory

Formal foundations underlying the engine. Not implemented directly but informs the design.

---

## T1. Kolam as a Cultural Art Form

A kolam is a traditional floor-drawn art form from Tamil Nadu, South India. Drawn at dawn using rice flour on the threshold of homes and temples. The closed-loop variety (*pulli kolam* / *kambi kolam*) is drawn around a grid of anchor dots without lifting the hand.

Key cultural properties that map to formal constraints:
- **Closed loop** — the path returns to its start (Eulerian circuit)
- **All dots enclosed** — every anchor dot must be surrounded by the path
- **No retracing** — each segment drawn exactly once
- **Smooth curves** — no sharp corners, the line flows continuously

---

## T2. Lattice Spec (Formal)

For an **m × n** kolam:

- Lattice size: **(2m+1) × (2n+1)** points
- Total lattice points: `(2m+1)(2n+1)`
- Total anchor dots: `m × n`
- Anchor positions: `li = 2i+1, lj = 2j+1` for `i ∈ [0,m-1], j ∈ [0,n-1]`

The lattice is the coordinate system. Anchors are a sparse subset. Everything else is space for curves.

---

## T3. Spline Definition (Formal)

Each segment of the kolam path is a **quadratic Bézier spline**:

```
B(t) = (1-t)² P0 + 2(1-t)t P1 + t² P2,   t ∈ [0,1]
```

Where:
- `P0` = start point (midpoint between previous and current lattice point)
- `P1` = control point (current lattice point)
- `P2` = end point (midpoint between current and next lattice point)

The midpoint-chaining guarantees **C1 continuity** at every joint — the tangent direction is shared going in and out of each lattice point.

---

## T4. Isomorphism Theory

Two kolam sequences represent the **same pattern** if their abstract graph structures are identical regardless of:
- Position on the grid (translation)
- Which direction the path was drawn (direction invariance)
- Which stroke was drawn first (stroke-order invariance)

**Graph construction from sequence:**
- Each visited `[li,lj]` → node
- Each consecutive pair → undirected edge
- Node degree = number of times visited × 2 (each visit contributes 2 edge endpoints)

**Weisfeiler-Leman (WL) graph certificate:**

The WL algorithm computes a canonical fingerprint of the graph topology in iterative rounds:

```
Round 0:  label(v) = degree(v)
Round k:  label(v) = hash(label(v), sorted(label(u) for u in neighbours(v)))
```

After 3 rounds, the certificate is the sorted concatenation of all node labels:

```
cert = "|".join(sorted(all node labels))
```

Two graphs are WL-isomorphic ↔ their certificates match.

**Limitations:** WL cannot distinguish all non-isomorphic graphs (it fails on certain regular graphs). For kolam patterns in practice — which are sparse, irregular, and grid-constrained — WL is sufficient.

**Translational invariance:** WL discards coordinates after Round 0. A figure-8 at `(1,1)` and the same figure-8 at `(5,3)` get identical certificates.

---

## T5. Sequence as Eulerian Circuit

A valid single-stroke kolam is an **Eulerian circuit** on the graph it traces:

- **Eulerian circuit exists** iff: graph is connected AND every node has even degree
- Each lattice point visited by the path must be entered and exited equally — so every node has even degree
- The path returning to its start satisfies the circuit condition

A multi-stroke kolam is a set of Eulerian circuits on disjoint subgraphs of the lattice.

This is why the validator checks:
1. Every edge traversed exactly once
2. No gaps between consecutive moves
3. Sequence returns to start

---

## T6. Tokenization for Model Training

For training a sequence model, `[li, lj]` coordinates are flattened to integers:

```
token = li * (2n+1) + lj
```

Where `2n+1` is the number of lattice columns. This encodes position uniquely within a grid of known size.

Special tokens needed:
- `SEP` — stroke separator (replaces `---`)
- `BOS` / `EOS` — begin/end of sequence
- `PAD` — padding

Vocabulary size for an m×n grid: `(2m+1)(2n+1) + special tokens`

For a 3×3 grid: `7×7 = 49` position tokens + specials.

The flat token representation is grid-size-dependent. For variable-size training, coordinate pairs `[li, lj]` as two-token tuples may generalise better across grid sizes.
