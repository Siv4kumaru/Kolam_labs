// draw.ts — mousedown to start drag, mousemove snaps, mouseup commits spline

import { type LatticePoint, type GridConfig, isAnchor } from './schema'
import { buildLattice, gridOrigin, latticeToCanvas } from './canvas'
import { chalkStroke } from './renderer'
import { theme } from '../styles/theme'

const SNAP_RADIUS = 30

let _cfg: GridConfig
let _scope: any
let _canvas: HTMLCanvasElement

let currentPts: LatticePoint[] = []   // in-progress stroke
let finished: LatticePoint[][] = []   // committed splines
let drawing = false

// ── Public API ─────────────────────────────────────────────────────────────

export function initDraw(scope: any, canvas: HTMLCanvasElement, cfg: GridConfig) {
  _scope = scope; _canvas = canvas; _cfg = cfg
  canvas.addEventListener('click', onClick)
  canvas.addEventListener('mousemove', onMove)
}

export function resetDraw(cfg: GridConfig) {
  _cfg = cfg
  currentPts = []; finished = []; drawing = false
  renderAll()
}

// ── Handlers ───────────────────────────────────────────────────────────────

function onClick(e: MouseEvent) {
  const snap = nearest(evtPt(e))
  if (!snap) return
  if (!drawing) {
    drawing = true
    currentPts = [snap]
  } else {
    drawing = false
    if (currentPts.length >= 2) finished = [...finished, currentPts]
    currentPts = []
  }
  renderAll()
}

function onMove(e: MouseEvent) {
  const snap = nearest(evtPt(e))
  if (drawing && snap) {
    const last = currentPts[currentPts.length - 1]
    if (!last || last.li !== snap.li || last.lj !== snap.lj) {
      currentPts = [...currentPts, snap]
      renderAll()
      return
    }
  }
  renderAll(snap ?? undefined)
}

// ── Render ─────────────────────────────────────────────────────────────────

function renderAll(hover?: LatticePoint) {
  _scope.activate()
  const existing = _scope.project.layers.find((l: any) => l.name === 'draw')
  if (existing) existing.remove()
  const layer = new _scope.Layer({ name: 'draw' })
  layer.activate()

  const origin = gridOrigin(_cfg, _canvas.clientWidth, _canvas.clientHeight)

  // Draw all committed splines
  for (const pts of finished) renderSpline(pts, origin)

  // Draw current in-progress stroke
  if (currentPts.length >= 2) renderSpline(currentPts, origin)

  // Hover highlight
  if (hover && !drawing) {
    const hc = new _scope.Path.Circle(lp(hover, origin), 8)
    hc.fillColor = new _scope.Color(0.4, 1, 0.4, 0.45)
  }
}

function renderSpline(pts: LatticePoint[], origin: { x: number; y: number }) {
  const coords = pts.map(p => lp(p, origin))
  const path = new _scope.Path()
  path.moveTo(coords[0])
  for (let i = 1; i < coords.length - 1; i++)
    path.quadraticCurveTo(coords[i], mid(coords[i], coords[i + 1]))
  path.lineTo(coords[coords.length - 1])

  const sampled: any[] = []
  for (let d = 0; d <= path.length; d += 2) {
    const p = path.getPointAt(d); if (p) sampled.push(p)
  }
  path.remove()
  if (sampled.length >= 2)
    chalkStroke(_scope, sampled, theme.chalk.main, 3)

  for (const p of pts) {
    const dot = new _scope.Path.Circle(lp(p, origin), isAnchor(p.li, p.lj) ? 4 : 2.5)
    dot.fillColor = new _scope.Color(isAnchor(p.li, p.lj) ? theme.chalk.highlight : theme.chalk.guide)
    dot.opacity = 0.85
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function lp(p: LatticePoint, origin: { x: number; y: number }) {
  const { x, y } = latticeToCanvas(p.li, p.lj, _cfg, origin)
  return new _scope.Point(x, y)
}

function mid(a: any, b: any) {
  return new _scope.Point((a.x + b.x) / 2, (a.y + b.y) / 2)
}

function evtPt(e: MouseEvent): { x: number; y: number } {
  const rect = _canvas.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function nearest(pt: { x: number; y: number }): LatticePoint | null {
  const origin = gridOrigin(_cfg, _canvas.clientWidth, _canvas.clientHeight)
  let best: LatticePoint | null = null, bestD = SNAP_RADIUS
  for (const p of buildLattice(_cfg)) {
    const { x, y } = latticeToCanvas(p.li, p.lj, _cfg, origin)
    let d = Math.hypot(pt.x - x, pt.y - y)
    // Shrink effective snap radius for non-anchor (midpoint) lattice points
    // so anchors win when equidistant during diagonal movement
    if (!isAnchor(p.li, p.lj)) d *= 1.4
    if (d < bestD) { bestD = d; best = p }
  }
  return best
}
