# Dot-Port Kolam Grammar Summary

## Context

This note summarizes the side discussion around replacing a Nagata-style intersection encoding with a dot-centered motif grammar for kolam representation.

The proposed name for the representation is:

**Dot-Port Kolam Grammar**

## State Model

The representation is **ordered and stateful** in two ways:

- each dot stores its own local motif state (per-dot motif state)
- the kolam definition stores the drawing order as an ordered sequence of motif moves

The source-of-truth is:

- the motif state at each dot (what shape, ports, connections)
- the stored traversal order (which edge is drawn when)

This means:

- the definition itself is a traversal trace, not an unordered bag of motifs
- replay renders the stored order directly, no traversal extraction needed
- the validator checks that the stored order is a legal Eulerian circuit

## Main Verdict

For this project, a well-defined dot-centered motif grammar can be better than Nagata's original binary crossing/uncrossing encoding.

Why:

- more intuitive for dot-based kolam construction
- easier for interactive UI authoring
- easier for direct rendering and smooth preview
- more scalable to other kolam-like pattern families

But this is only true if the grammar is made formal enough to support:

- deterministic graph derivation
- canonical storage
- validation
- traversal extraction

If it stays as loose direction labels only, it will encode okay but decode badly.

## Core Finding

The previous dot-centered attempt failed mainly because the representation captured **connectivity hints** but not enough **decode constraints**.

The renderer had to guess too much.

In short:

- if the renderer has to invent shape, the encoding is incomplete

## Correct Representation Layers

The dot-centered grammar should be split into layers.

### 1. Local motif layer

Each dot stores a motif instance with:

- active external ports
- internal connections
- optional internal nodes such as `C`
- optional shape class
- optional style / geometry parameters

Minimum useful structural form:

```yaml
ports: [N, W]
connections:
  - [N, W]
```

Decode-friendly form:

```yaml
ports: [N, W]
connections:
  - [N, W]
shape: quarter_turn
style: round
```

If a motif needs a center junction, model it explicitly:

```yaml
ports: [N, NW, E]
internal_nodes: [C]
connections:
  - [N, C]
  - [NW, C]
  - [E, C]
shape: tri_junction
```

Here `C` is an **internal node**, not a neighbor-facing port.

### 2. Graph layer

The graph is **derived** from motif declarations.

- local ports are treated as half-edges
- matching half-edges between neighboring dots are merged into one global edge
- validation and traversal run on the derived graph

### 3. Traversal layer

The definition itself stores the drawing order as an ordered sequence.

This means:

- replay follows the stored order directly
- no traversal extraction is needed for rendering or animation
- the validator checks that the stored order is a legal Eulerian circuit

Canonical traversal (Hierholzer) is only needed later for deduplication and dataset normalization, not for core authoring or replay.

## Important Design Choice

The base motif representation **is** ordered.

The definition stores the drawing sequence directly. This means:

- the kolam definition is a traversal trace, not a declarative layout
- replay renders the stored order without needing to derive it
- the validator confirms the stored order is a legal Eulerian circuit

The intended flow is:

`ordered motif sequence -> graph derivation -> validate sequence is legal -> render in stored order`

Canonical traversal (Hierholzer) is only needed for dedup/datasets:

`graph -> Hierholzer with canonical choice function -> canonical sequence`

## Chosen Local Encoding

The preferred local encoding is to keep one grouped motif record per dot.

This convention can be referred to as:

- **grouped per-dot motif notation**
- short form: **dot-grouped notation**

Preferred:

```yaml
a:
  ports: [N, NW, E]
b:
  ports: [W]
```

Avoid splitting one dot into multiple fragments such as:

```yaml
a: [N]
a: [NW]
a: [E]
b: [W]
```

The fragmented form is shorter, but it is worse as a grammar because it loses the fact that the ports at `a` belong to the same local motif.

That grouping is exactly what makes:

- predefined shape lookup possible
- validation easier
- rendering deterministic
- topology reconstruction reliable

So the compact fragmented form may be easier to emit, but it is harder to decode correctly.

## Why Direction Labels Alone Are Not Enough

A raw direction-set style representation like:

- `NW`
- `N,W`
- `N,W,E`

is usually too weak.

It tells you which directions are active, but not:

- which ports are internally connected
- whether the motif branches
- what canonical geometric primitive should be rendered

That is why a direction-set representation can preserve intent poorly during decode.

## Shape Library Strategy

One major reason to choose grouped per-dot motifs is that it supports predefined motif blocks.

Example:

```yaml
dot: a
ports: [N, E]
connections:
  - [N, E]
shape: quarter_turn
```

This makes it possible to build a motif library such as:

- straight
- quarter_turn
- diagonal_turn
- crossing
- double_turn
- junction

Important:

- do not define shape from active ports alone if multiple topologies can share the same port set
- define shape from the combination of port set and internal connection pattern

If needed, keep `shape` explicit even when it could be derived, so decoding stays deterministic.

## Port Vocabulary

The clean recommendation is to give every dot the same symmetric port vocabulary.

Example:

```yaml
port_system: [N, NE, E, SE, S, SW, W, NW]
```

Do **not** remove `W` or `N` from interior dots just to avoid duplication.

That would make the grammar asymmetric and harder to reason about.

## Shared Connections Between Adjacent Dots

Adjacent dots refer to the same channel from opposite sides.

Example:

Dot A at `(0,0)`:

```yaml
ports: [E, S]
connections:
  - [E, S]
```

Dot B at `(0,1)`:

```yaml
ports: [W, S]
connections:
  - [W, S]
```

Here:

- `A.E`
- `B.W`

refer to the same shared local corridor between the two dots.

This duplication is acceptable in the **local motif layer**.

It must be resolved in the **graph layer**.

Shared adjacency such as `A.E <-> B.W` is useful for:

- half-edge matching
- canonical edge ownership
- graph construction

But shared adjacency alone does **not** define:

- concavity
- convexity
- internal pairing at the dot

Those come from the local motif topology, not from neighbor duplication alone.

## Canonical Ownership Rule

To avoid storing duplicate global edges, the graph builder should apply a canonical ownership rule.

Recommended rule:

- the lexicographically smaller dot coordinate owns the shared edge

So if:

- A = `(0,0)`
- B = `(0,1)`

then `(0,0)` owns the edge.

This gives:

- symmetric local motif declarations
- canonical global edge storage

This was the preferred option.

## Internal Center Node

If a motif needs a center connection, using `C` is reasonable.

But `C` should be treated as:

- an internal node
- local to the motif
- not part of the external port vocabulary

Avoid using `null` as a fake port.

Why `null` is a poor choice:

- it is not a real outward-facing interface
- it breaks the meaning of what a port is
- it makes neighbor compatibility rules unclear
- it mixes external connectivity with internal topology

So the clean rule is:

- ports are external interfaces
- `C` is internal topology
- internal topology should not pretend to be an external port

## Validation

The dot-port system can still be validated mathematically.

Validation happens after graph derivation.

Required validation layers:

- schema validity
- port compatibility
- graph connectivity
- unmatched half-edge detection
- stored sequence legality (every edge once, no gaps, returns to start)

For the new motif strategy, the minimum practical validator should check:

- one grouped motif record per dot
- valid port vocabulary
- valid internal node references
- legal internal connection pairs
- neighbor port compatibility such as `A.E <-> B.W`
- stored sequence is a legal Eulerian circuit

Important:

- canonicalization is not a validation concern
- same kolam can have multiple valid drawing orders
- canonical form is only needed for dedup/datasets, not for correctness

## Traversal

The drawing order is stored directly in the definition. No traversal extraction is needed for authoring or replay.

Validation checks that the stored order is legal:

- every edge traversed exactly once
- no gaps between consecutive moves
- sequence returns to start

Canonical traversal is only needed for dedup/datasets:

- derive graph from motifs
- run Hierholzer with canonical choice function (fixed start node, fixed direction preference)
- serialize canonical sequence for comparison

Multiple valid drawing orders for the same kolam are acceptable. Canonicalization normalizes them to one form when needed.

## Final Recommendation

Use the following architecture:

`ordered Dot-Port motif sequence -> half-edge matching -> canonical edge graph -> validate sequence legality -> render stored order`

Optional canonicalization path:

`canonical edge graph -> Hierholzer with canonical choice -> canonical sequence (for dedup/datasets)`

This gives:

- a natural dot-centered encoding with built-in drawing order
- a formal graph backbone for validation
- direct replay from stored order (no traversal extraction)
- easier authoring and UI rendering than a pure Nagata-style encoding
- optional canonical form when deduplication is needed

## Bottom Line

The best current direction is:

- keep a **symmetric local motif grammar** at the dot level
- keep one **grouped motif record per dot**
- store the **drawing order directly** in the definition as an ordered motif sequence
- treat "stateful" as **per-dot motif state plus stored traversal order**
- use a **canonical ownership rule** when constructing the global graph
- use predefined shapes from **port combinations plus connection topology**
- use `C` only as an **internal node**, not as a fake external port
- **validate** that the stored order is a legal Eulerian circuit
- **render and replay** directly from stored order (no traversal extraction)
- use **Hierholzer only for canonicalization** when dedup/datasets need it
