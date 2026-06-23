// Encoding Schema — source-of-truth types for the Kolam engine

// 8-direction port vocabulary
export const PORTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
export type Port = typeof PORTS[number]

// Port direction vectors (unit offsets on the lattice)
export const PORT_VECTORS: Record<Port, [number, number]> = {
  N:  [ 0, -1], NE: [ 1, -1], E:  [ 1,  0], SE: [ 1,  1],
  S:  [ 0,  1], SW: [-1,  1], W:  [-1,  0], NW: [-1, -1],
}

// Opposite port for neighbor matching (A.E <-> B.W)
export const OPPOSITE_PORT: Record<Port, Port> = {
  N: 'S', NE: 'SW', E: 'W', SE: 'NW',
  S: 'N', SW: 'NE', W: 'E', NW: 'SE',
}

// Shape classes derived from port + connection topology
export type ShapeClass =
  | 'straight'       // 2 opposite ports (e.g. N-S, E-W)
  | 'quarter_turn'   // 2 adjacent ports (e.g. N-E)
  | 'diagonal_turn'  // 2 diagonal ports (e.g. N-NE)
  | 'crossing'       // 4 ports, two pairs crossing (e.g. N-S + E-W)
  | 'junction'       // 3+ ports meeting

// A single connection within a motif: from port to port, optionally through center
export interface Connection {
  from: Port
  to: Port
  throughCenter?: boolean  // passes through internal node C
}

// Per-dot motif record — the core encoding unit
export interface MotifRecord {
  activePorts: Port[]
  connections: Connection[]
  shapeClass: ShapeClass
}

// Dot coordinate on the grid
export interface DotCoord {
  row: number
  col: number
}

export function dotId(d: DotCoord): string {
  return `${d.row},${d.col}`
}

export function parseDotId(id: string): DotCoord {
  const [row, col] = id.split(',').map(Number)
  return { row, col }
}

// Full kolam data model
export interface KolamData {
  rows: number
  cols: number
  motifs: Map<string, MotifRecord>  // keyed by dotId
  sequence: DotCoord[]              // stored drawing order
  // Stored traversal: list of strokes, each stroke is ordered (dot, port) steps
  traversal: { dot: DotCoord; port: Port }[][]
}

// Classify shape from connections
export function classifyShape(conns: Connection[]): ShapeClass {
  const ports = new Set<Port>()
  for (const c of conns) { ports.add(c.from); ports.add(c.to) }
  const n = ports.size

  if (n >= 4 && conns.length >= 2) {
    // check if pairs are crossing (opposite ports)
    const hasCross = conns.some((a, i) =>
      conns.some((b, j) => i < j &&
        OPPOSITE_PORT[a.from] === a.to &&
        OPPOSITE_PORT[b.from] === b.to
      )
    )
    if (hasCross) return 'crossing'
    return 'junction'
  }
  if (n >= 3) return 'junction'
  if (conns.length === 1) {
    const c = conns[0]
    if (OPPOSITE_PORT[c.from] === c.to) return 'straight'
    // adjacent = 1 step apart in PORTS array
    const fi = PORTS.indexOf(c.from), ti = PORTS.indexOf(c.to)
    const diff = Math.min(Math.abs(fi - ti), 8 - Math.abs(fi - ti))
    if (diff === 1) return 'diagonal_turn'
    return 'quarter_turn'
  }
  return 'straight'
}

// Build a motif record from connections
export function makeMotif(conns: Connection[]): MotifRecord {
  const ports = new Set<Port>()
  for (const c of conns) { ports.add(c.from); ports.add(c.to) }
  return { activePorts: [...ports], connections: conns, shapeClass: classifyShape(conns) }
}

// Neighbor dot coordinate given a port direction
export function neighborCoord(dot: DotCoord, port: Port): DotCoord {
  const [dc, dr] = PORT_VECTORS[port]
  return { row: dot.row + dr, col: dot.col + dc }
}

// Create empty kolam
export function createKolam(rows: number, cols: number): KolamData {
  return { rows, cols, motifs: new Map(), sequence: [], traversal: [] }
}
