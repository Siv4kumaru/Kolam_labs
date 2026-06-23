// Validator — checks stored sequence is a legal Eulerian circuit

import type { KolamData } from './schema'
import { PORTS, OPPOSITE_PORT, neighborCoord, dotId } from './schema'
import { buildGraph, type KolamGraph } from './graph'

export interface ValidationError {
  type: 'schema' | 'neighbor' | 'traversal'
  dot?: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  graph: KolamGraph | null
}

function validateSchema(kolam: KolamData): ValidationError[] {
  const errs: ValidationError[] = []
  const portSet = new Set<string>(PORTS)
  for (const [id, motif] of kolam.motifs) {
    if (motif.activePorts.length === 0)
      errs.push({ type: 'schema', dot: id, message: `Dot ${id}: no active ports` })
    for (const p of motif.activePorts)
      if (!portSet.has(p))
        errs.push({ type: 'schema', dot: id, message: `Dot ${id}: invalid port "${p}"` })
    if (motif.connections.length === 0)
      errs.push({ type: 'schema', dot: id, message: `Dot ${id}: no connections` })
    const active = new Set(motif.activePorts)
    for (const c of motif.connections) {
      if (!active.has(c.from)) errs.push({ type: 'schema', dot: id, message: `Dot ${id}: connection uses inactive port "${c.from}"` })
      if (!active.has(c.to))   errs.push({ type: 'schema', dot: id, message: `Dot ${id}: connection uses inactive port "${c.to}"` })
    }
  }
  return errs
}

function validateNeighbors(kolam: KolamData): ValidationError[] {
  const errs: ValidationError[] = []
  for (const [id, motif] of kolam.motifs) {
    const [row, col] = id.split(',').map(Number)
    const dot = { row, col }
    for (const port of motif.activePorts) {
      const nb = neighborCoord(dot, port)
      const nbId = dotId(nb)
      const nbMotif = kolam.motifs.get(nbId)
      const opp = OPPOSITE_PORT[port]
      if (!nbMotif)
        errs.push({ type: 'neighbor', dot: id, message: `Dot ${id} port ${port}: no neighbor at ${nbId}` })
      else if (!nbMotif.activePorts.includes(opp))
        errs.push({ type: 'neighbor', dot: id, message: `Dot ${id} port ${port}: neighbor ${nbId} missing port ${opp}` })
    }
  }
  return errs
}

// Check the stored traversal is a legal Eulerian circuit:
// - each inter-dot edge traversed exactly once
// - consecutive steps are connected (end port of step i neighbors start port of step i+1)
// - sequence is closed (last step ends where first step starts)
function validateTraversal(kolam: KolamData): ValidationError[] {
  const errs: ValidationError[] = []
  const allSteps = kolam.traversal.flat()
  if (allSteps.length < 2) return errs

  // Build expected edge multiset from motifs
  const edgeCounts = new Map<string, number>()
  for (const [id, motif] of kolam.motifs) {
    const [row, col] = id.split(',').map(Number)
    const dot = { row, col }
    for (const port of motif.activePorts) {
      const nb = neighborCoord(dot, port)
      const nbId = dotId(nb)
      // canonical key: smaller dotId first
      const key = id < nbId ? `${id}:${port}-${nbId}:${OPPOSITE_PORT[port]}` : `${nbId}:${OPPOSITE_PORT[port]}-${id}:${port}`
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1)
    }
  }
  // Each canonical edge appears twice in edgeCounts (once per side), normalize to 1
  for (const [k, v] of edgeCounts) edgeCounts.set(k, v / 2)

  // Walk the traversal checking gapless connectivity and counting edge traversals
  const traversed = new Map<string, number>()
  for (let i = 0; i < allSteps.length - 1; i++) {
    const a = allSteps[i], b = allSteps[i + 1]
    const aId = dotId(a.dot), bId = dotId(b.dot)

    if (aId === bId) {
      // intra-dot step: a.port -> b.port must be a declared connection
      const motif = kolam.motifs.get(aId)
      if (motif && !motif.connections.some(c =>
        (c.from === a.port && c.to === b.port) || (c.from === b.port && c.to === a.port)
      )) {
        errs.push({ type: 'traversal', dot: aId, message: `Step ${i}: no connection ${a.port}-${b.port} at dot ${aId}` })
      }
    } else {
      // inter-dot step: a.port must neighbor b.dot at b.port
      const expected = neighborCoord(a.dot, a.port)
      if (dotId(expected) !== bId || OPPOSITE_PORT[a.port] !== b.port) {
        errs.push({ type: 'traversal', message: `Step ${i}: discontinuous — ${aId}:${a.port} does not reach ${bId}:${b.port}` })
      } else {
        const key = aId < bId
          ? `${aId}:${a.port}-${bId}:${b.port}`
          : `${bId}:${b.port}-${aId}:${a.port}`
        traversed.set(key, (traversed.get(key) ?? 0) + 1)
      }
    }
  }

  // Every edge must be traversed exactly once
  for (const [key, expected] of edgeCounts) {
    const actual = traversed.get(key) ?? 0
    if (actual !== expected)
      errs.push({ type: 'traversal', message: `Edge ${key}: traversed ${actual}×, expected ${expected}×` })
  }

  // Closed: last step must neighbor back to first step
  const first = allSteps[0], last = allSteps[allSteps.length - 1]
  const firstId = dotId(first.dot), lastId = dotId(last.dot)
  if (firstId !== lastId || first.port !== last.port) {
    const nb = neighborCoord(last.dot, last.port)
    if (dotId(nb) !== firstId || OPPOSITE_PORT[last.port] !== first.port) {
      errs.push({ type: 'traversal', message: `Traversal not closed: ends at ${lastId}:${last.port}, starts at ${firstId}:${first.port}` })
    }
  }

  return errs
}

export function validate(kolam: KolamData): ValidationResult {
  const schemaErrs = validateSchema(kolam)
  if (schemaErrs.length) return { valid: false, errors: schemaErrs, graph: null }

  const graph = buildGraph(kolam)
  const errors = [...validateNeighbors(kolam), ...validateTraversal(kolam)]
  return { valid: errors.length === 0, errors, graph }
}

// Live feedback: schema + neighbor checks only (traversal check needs complete sequence)
export function quickValidate(kolam: KolamData): ValidationError[] {
  return [...validateSchema(kolam), ...validateNeighbors(kolam)]
}
