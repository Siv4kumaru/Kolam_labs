# Kolam Labs

**Goal:** Build a dataset of kolam patterns and train an image-to-sequence model that can read a kolam image and output its structural encoding.

## What is a Kolam?

A kolam is a closed loop drawn around a grid of anchor dots on a `(2m+1) × (2n+1)` lattice. Each curve segment is a quadratic Bézier spline — smooth, continuous, no sharp corners. The pattern can be fully described as an ordered sequence of lattice point coordinates.

## The Pipeline

```
Canvas Encoder  →  Sequence  →  Isomorphism Validator  →  Training Data  →  Image-to-Seq Model
```

## Project Structure

```
kolam_Labs/
├── kolam_engine/           # Interactive encoder + challenge app (TypeScript + Paper.js)
│   ├── src/
│   │   ├── main.ts          # Encoder page
│   │   ├── challenge.ts     # Challenge page
│   │   └── modules/
│   │       ├── canvas.ts        # Grid math, rendering, layout
│   │       ├── draw.ts          # Paper.js drawing tool with snapping
│   │       ├── decoder.ts       # Animated chalk trace + sequence highlighting
│   │       ├── isomorphism.ts   # WL graph certificate for pattern matching
│   │       ├── seq-parser.ts    # Parse [li,lj] sequence text
│   │       └── renderer.ts      # Chalk brush renderer
├── docs/
│   ├── foundation.md            # Lattice spec, spline definition, isomorphism theory
│   ├── graph_theory_for_kolam_grammar.md
│   └── dot_port_grammar_summary.md
└── ref_papers/              # Local reference PDFs (not tracked)
```

## Running Locally

```bash
cd kolam_engine
npm install
npm run dev
```

## Pages

**Encoder** (`/`) — Draw kolam patterns on the left canvas. The sequence of lattice coordinates appears in the middle panel live as you draw. The right canvas decodes and animates the path in blue chalk. Sequence is editable — paste or type `[li,lj]` coordinates directly.

**Challenge** (`/challenge.html`) — A target kolam is shown on the left. Draw it on the right. The bottom row shows both graph signatures (WL certificate visualized as a node graph) updating live. Status shows ✓ Correct / ✗ Not yet in real time.

## Sequence Format

```
[1,1] → [1,2] → [2,2] → [2,1] → [1,1]
---
[3,1] → [3,2] → [4,2]
```

Each `[li,lj]` is a lattice point coordinate. `---` separates strokes. For model training, tokenized as `row * (2n+1) + col`.

## Isomorphism

Two sequences are structurally isomorphic if their **Weisfeiler-Leman graph certificates** match — position, direction, and stroke order invariant. See `docs/foundation.md` for full theory.

## Roadmap

**Phase 1 — Canvas Engine** ✅
- [x] Smooth Bézier spline rendering with chalk effect
- [x] Live sequence output and animated decoder
- [x] Editable sequence textarea with real-time rendering

**Phase 2 — Isomorphic Validator** ✅
- [x] WL graph certificate (position, direction, stroke-order invariant)
- [x] Canonical sequence normalization via WL certificate
- [x] Challenge mode with live graph signature visualization
- [x] Multi-stroke isomorphism validation

**Phase 3 — vLLM Baseline & Kolam Harness**
- [ ] Prompt engineering: image + grid spec → sequence (zero-shot / few-shot)
- [ ] Kolam evaluation harness: run model output through WL isomorphism checker
- [ ] Baseline accuracy benchmarks across challenge levels

**Phase 4 — Training Data Generation**
- [ ] L-system inspired synthetic generator
- [ ] Data augmentation pipeline

**Phase 5 — Image-to-Sequence Model**
- [ ] Fine-tune vision-language model (image → lattice sequence)
- [ ] Model deployment
