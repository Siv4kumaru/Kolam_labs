// Graph Builder — derives canonical edge graph from motif declarations

import type { KolamData, Port, DotCoord } from './schema'
import { OPPOSITE_PORT, neighborCoord, dotId } from './schema'

// A half-edge: one side of a potential full edge
export interface HalfEdge {
  dot: DotCoord
  port: Port
}

// A full edge: two matched half-edges merged
export interface Edge {
  id: string
  a: HalfEdge  // canonical owner (lexicographically smaller dotId)
  b: HalfEdge
}

// The derived graph
export interface KolamGraph {
  edges: Edge[]
  adjacency: Map<string, string[]>  // dotId -> list of neighbor dotIds
  degree: Map<string, number>       // dotId -> degree count
  unmatched: HalfEdge[]             // half-edges with no neighbor match
}

// Canonical edge id: smaller dotId owns it
function edgeKey(da: DotCoord, pa: Port, db: DotCoord, pb: Port): string {
  const idA = dotId(da), idB = dotId(db)
  return idA < idB ? `${idA}:${pa}-${idB}:${pb}` : `${idB}:${pb}-${idA}:${pa}`
}

export function buildGraph(kolam: KolamData): KolamGraph {
  const edges: Edge[] = []
  const edgeSeen = new Set<string>()
  const unmatched: HalfEdge[] = []
  const adjacency = new Map<string, string[]>()
  const degree = new Map<string, number>()

  const addAdj = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, [])
    adjacency.get(a)!.push(b)
    degree.set(a, (degree.get(a) ?? 0) + 1)
  }

  for (const [id, motif] of kolam.motifs) {
    const dot = parseDotCoord(id)
    for (const port of motif.activePorts) {
      const nb = neighborCoord(dot, port)
      const nbId = dotId(nb)
      const nbMotif = kolam.motifs.get(nbId)

      // Check if neighbor has matching opposite port
      if (nbMotif && nbMotif.activePorts.includes(OPPOSITE_PORT[port])) {
        const key = edgeKey(dot, port, nb, OPPOSITE_PORT[port])
        if (!edgeSeen.has(key)) {
          edgeSeen.add(key)
          const idA = dotId(dot), idB = nbId
          const [a, b] = idA < idB
            ? [{ dot, port }, { dot: nb, port: OPPOSITE_PORT[port] }]
            : [{ dot: nb, port: OPPOSITE_PORT[port] }, { dot, port }]
          edges.push({ id: key, a, b })
          addAdj(idA, idB)
          addAdj(idB, idA)
        }
      } else {
        unmatched.push({ dot, port })
      }
    }
  }

  return { edges, adjacency, degree, unmatched }
}

function parseDotCoord(id: string): DotCoord {
  const [row, col] = id.split(',').map(Number)
  return { row, col }
}
