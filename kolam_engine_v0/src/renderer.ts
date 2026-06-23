// Replay Renderer — render and animate kolam from stored drawing order

import paper from 'paper'
import type { KolamData, DotCoord, Port } from './schema'
import { PORT_VECTORS } from './schema'

export interface RenderConfig {
  dotSpacing: number
  origin: paper.Point
  strokeColor: string
  strokeWidth: number
}

// Convert dot grid coord + port to canvas point
export function portPosition(dot: DotCoord, port: Port, cfg: RenderConfig): paper.Point {
  const cx = cfg.origin.x + dot.col * cfg.dotSpacing
  const cy = cfg.origin.y + dot.row * cfg.dotSpacing
  const [dx, dy] = PORT_VECTORS[port]
  const half = cfg.dotSpacing / 2
  return new paper.Point(cx + dx * half, cy + dy * half)
}

export function dotPosition(dot: DotCoord, cfg: RenderConfig): paper.Point {
  return new paper.Point(
    cfg.origin.x + dot.col * cfg.dotSpacing,
    cfg.origin.y + dot.row * cfg.dotSpacing,
  )
}

// Build the full sequence of canvas points from stored drawing order
export function sequenceToPoints(kolam: KolamData, cfg: RenderConfig): paper.Point[] {
  const pts: paper.Point[] = []
  for (const [id, motif] of kolam.motifs) {
    const dot = parseDot(id)
    for (const conn of motif.connections) {
      pts.push(portPosition(dot, conn.from, cfg))
      if (conn.throughCenter) pts.push(dotPosition(dot, cfg))
      pts.push(portPosition(dot, conn.to, cfg))
    }
  }
  return pts
}

// Cubic Bézier path from point sequence — dots act as attractors, curve flows around them
export function buildCurvePath(pts: paper.Point[]): paper.Path {
  const path = new paper.Path()
  if (pts.length < 2) return path
  path.addSegments(pts.map(p => new paper.Segment(p)))
  path.smooth({ type: 'continuous' })
  return path
}

// Midpoint quadratic Bézier — original approach for comparison
export function buildQuadraticPath(pts: paper.Point[]): paper.Path {
  const path = new paper.Path()
  if (pts.length < 2) return path
  const mid = (a: paper.Point, b: paper.Point) => a.add(b).divide(2)
  path.moveTo(pts[0])
  path.lineTo(mid(pts[0], pts[1]))
  for (let i = 1; i < pts.length - 1; i++) {
    path.quadraticCurveTo(pts[i], mid(pts[i], pts[i + 1]))
  }
  path.lineTo(pts[pts.length - 1])
  return path
}

// Catmull-Rom spline — curve passes through every port point
export function buildCatmullPath(pts: paper.Point[]): paper.Path {
  const path = new paper.Path()
  if (pts.length < 2) return path
  path.addSegments(pts.map(p => new paper.Segment(p)))
  path.smooth({ type: 'catmull-rom', factor: 0.5 })
  return path
}

// Render full kolam instantly
export function renderKolam(kolam: KolamData, cfg: RenderConfig): paper.Path {
  const pts = sequenceToPoints(kolam, cfg)
  const path = buildCurvePath(pts)
  path.strokeColor = new paper.Color(cfg.strokeColor)
  path.strokeWidth = cfg.strokeWidth
  path.strokeCap = 'round'
  path.strokeJoin = 'round'
  return path
}

// Animated replay: progressively reveals the path
export function replayKolam(
  kolam: KolamData,
  cfg: RenderConfig,
  durationMs: number,
  onDone?: () => void,
): { stop: () => void } {
  const pts = sequenceToPoints(kolam, cfg)
  const fullPath = buildCurvePath(pts)
  fullPath.strokeColor = new paper.Color(cfg.strokeColor)
  fullPath.strokeWidth = cfg.strokeWidth
  fullPath.strokeCap = 'round'
  fullPath.strokeJoin = 'round'
  fullPath.visible = false

  const totalLen = fullPath.length
  const display = new paper.Path({
    strokeColor: new paper.Color(cfg.strokeColor),
    strokeWidth: cfg.strokeWidth,
    strokeCap: 'round',
    strokeJoin: 'round',
  })

  const start = Date.now()
  let stopped = false
  let lastOffset = 0

  function tick() {
    if (stopped) return
    const t = Math.min((Date.now() - start) / durationMs, 1)
    const offset = t * totalLen
    // Add points along the path from lastOffset to current offset
    const step = 2
    for (let d = lastOffset; d <= offset; d += step) {
      display.add(fullPath.getPointAt(d))
    }
    lastOffset = offset
    display.smooth({ type: 'continuous' })

    if (t < 1) {
      requestAnimationFrame(tick)
    } else {
      // Replace with clean final path
      display.remove()
      fullPath.visible = true
      onDone?.()
    }
  }

  requestAnimationFrame(tick)
  return { stop: () => { stopped = true; display.remove(); fullPath.remove() } }
}

function parseDot(id: string): DotCoord {
  const [row, col] = id.split(',').map(Number)
  return { row, col }
}
