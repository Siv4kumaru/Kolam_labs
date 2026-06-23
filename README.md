# Kolam Labs

**Goal:** Build a dataset of kolam patterns and train an image-to-sequence model that can read a kolam image and output its structural encoding.

## What is a Kolam?

A kolam is a closed loop drawn around a grid of anchor dots on a `(2m+1) × (2n+1)` lattice. Each curve segment is a quadratic Bézier spline — smooth, continuous, no sharp corners. The pattern can be fully described as an ordered sequence of lattice points.

## The Pipeline

```
Canvas Encoder  →  Sequence Representation  →  Training Data  →  Image-to-Seq Model
```

1. **Encode** — draw kolam patterns on the canvas, output a lattice point sequence
2. **Validate** — isomorphism checker ensures structurally equivalent patterns share the same canonical sequence
3. **Generate** — L-system inspired generator produces large-scale synthetic training data
4. **Train** — fine-tune a vision model to map kolam images → sequences
5. **Deploy** — inference API: given a kolam image, return its sequence

## Project Structure

```
kolam_Labs/
├── kolam_engine/       # Interactive encoder/decoder canvas (TypeScript + Paper.js)
├── kolam_engine_v0/    # Earlier prototype
├── docs/               # Formal spec, grammar notes, todo
│   ├── foundation.md   # Lattice, anchor dot, and Bézier spline definition
│   ├── graph_theory_for_kolam_grammar.md
│   └── dot_port_grammar_summary.md
└── ref_papers/         # Local reference PDFs (not tracked)
```

## Running the Canvas Engine

```bash
cd kolam_engine
npm install
npm run dev
```

## Roadmap

**Phase 1 — Canvas Encoder/Decoder**
- [x] Smooth Bézier spline rendering
- [ ] Motif construction + ownership constraints
- [ ] Sequential canvas decoder

**Phase 2 — Isomorphic Validator**
- [ ] Motif → hypergraph conversion
- [ ] Hypergraph isomorphism checker

**Phase 3 — Training Data Generation**
- [ ] L-system inspired synthetic generator
- [ ] Data augmentation pipeline
- [ ] Manual data collection via canvas tool

**Phase 4 — Image-to-Sequence Model**
- [ ] Fine-tune vision-language model (image → lattice sequence)
- [ ] Evaluation + model deployment
