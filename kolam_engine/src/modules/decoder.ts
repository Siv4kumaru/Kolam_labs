// decoder.ts — live trace while drawing, looping animation on commit

import { type GridConfig } from './schema'
import { gridOrigin, latticeToCanvas } from './canvas'
import { chalkStroke } from './renderer'
import { theme } from '../styles/theme'

let _animId: number | null = null

function buildSplinePts(scope: any, coords: any[], closed = false): any[] {
  if (coords.length < 2) return []
  const path = new scope.Path()
  path.moveTo(coords[0])
  for (let i = 1; i < coords.length - 1; i++) {
    const mx = (coords[i].x + coords[i + 1].x) / 2
    const my = (coords[i].y + coords[i + 1].y) / 2
    path.quadraticCurveTo(coords[i], new scope.Point(mx, my))
  }
  if (closed) path.quadraticCurveTo(coords[coords.length - 1], coords[0])
  else path.lineTo(coords[coords.length - 1])
  const pts: any[] = []
  for (let d = 0; d <= path.length; d += 2) { const p = path.getPointAt(d); if (p) pts.push(p) }
  path.remove()
  return pts
}

function clearLayer(scope: any) {
  scope.activate()
  const l = scope.project.layers.find((x: any) => x.name === 'decode-anim')
  if (l) l.remove()
}

function toCoords(scope: any, stroke: [number,number][], cfg: GridConfig, origin: any) {
  return stroke.map(([li, lj]) => {
    const { x, y } = latticeToCanvas(li, lj, cfg, origin)
    return new scope.Point(x, y)
  })
}

/** Live trace while drawing */
export function decodeLive(
  scope: any, canvas: HTMLCanvasElement, cfg: GridConfig,
  seq: [number, number][][], seqEl: HTMLTextAreaElement,
) {
  if (_animId !== null) { cancelAnimationFrame(_animId); _animId = null }
  clearLayer(scope)
  if (seq.length === 0) { seqEl.value = ''; return }

  scope.activate()
  const layer = new scope.Layer({ name: 'decode-anim' })
  layer.activate()
  const origin = gridOrigin(cfg, canvas.clientWidth, canvas.clientHeight)

  for (const stroke of seq) {
    if (stroke.length < 2) continue
    const pts = buildSplinePts(scope, toCoords(scope, stroke, cfg, origin))
    if (pts.length >= 2) chalkStroke(scope, pts, theme.chalk.guide, 3)
  }

  // Update textarea — strokes separated by ---
  const lines = seq.map(stroke => stroke.map(([li, lj]) => `[${li},${lj}]`).join(' → '))
  seqEl.value = lines.join('\n---\n')
  const lastLine = lines[lines.length - 1]
  const lastToken = lastLine.split(' → ').pop()!
  const idx = seqEl.value.lastIndexOf(lastToken)
  seqEl.focus()
  seqEl.setSelectionRange(idx, idx + lastToken.length)
}

/** Looping animation after stroke committed */
export function decodeLoop(
  scope: any, canvas: HTMLCanvasElement, cfg: GridConfig,
  seq: [number, number][][], seqEl: HTMLTextAreaElement,
) {
  if (_animId !== null) { cancelAnimationFrame(_animId); _animId = null }
  if (seq.length === 0) return

  // Build textarea with --- separators and pre-compute char offsets per token
  const strokeLines = seq.map(s => s.map(([li, lj]) => `[${li},${lj}]`).join(' → '))
  const joined = strokeLines.join('\n---\n')
  seqEl.value = joined

  // Char offset for every token across all strokes
  const allOffsets: { start: number; end: number }[] = []
  let pos = 0
  for (const line of strokeLines) {
    const tokens = line.split(' → ')
    for (const t of tokens) {
      const idx = joined.indexOf(t, pos)
      allOffsets.push({ start: idx, end: idx + t.length })
      pos = idx + t.length
    }
    pos++ // skip \n after line
  }

  const origin = gridOrigin(cfg, canvas.clientWidth, canvas.clientHeight)
  const SPEED = 1, TRAIL = 60

  // Build per-stroke spline pts + token mappings
  type StrokeData = { pts: any[]; tokenPtIdx: number[] }
  const strokes: StrokeData[] = []
  let tokenOffset = 0
  for (const stroke of seq) {
    if (stroke.length < 2) { tokenOffset += stroke.length; continue }
    const coords = toCoords(scope, stroke, cfg, origin)
    const first = stroke[0], last = stroke[stroke.length - 1]
    const closed = first[0] === last[0] && first[1] === last[1]
    const pts = buildSplinePts(scope, coords, closed)
    const tokenPtIdx = stroke.map((_, i) =>
      Math.floor((i / (stroke.length - 1)) * (pts.length - 1))
    ).map(pi => pi + tokenOffset) // offset into allOffsets
    // store absolute token indices
    const absTokenPtIdx = stroke.map((_, i) => ({
      ptIdx: Math.floor((i / (stroke.length - 1)) * (pts.length - 1)),
      tokIdx: tokenOffset + i,
    }))
    strokes.push({ pts, tokenPtIdx: absTokenPtIdx.map(x => x.ptIdx) })
    tokenOffset += stroke.length
  }

  // Flatten: animate stroke by stroke in a loop
  let si = 0   // current stroke index
  let head = 0 // pt index within current stroke

  // Accumulate all previous stroke pts as ghosts
  function frame() {
    clearLayer(scope)
    scope.activate()
    const layer = new scope.Layer({ name: 'decode-anim' })
    layer.activate()

    // Draw all strokes faintly
    for (const sd of strokes) {
      if (sd.pts.length >= 2) chalkStroke(scope, sd.pts, theme.chalk.guide, 1)
    }

    const sd = strokes[si]
    if (!sd) { _animId = requestAnimationFrame(frame); return }

    // Animated trail on current stroke
    const trail = sd.pts.slice(Math.max(0, head - TRAIL), head + 1)
    if (trail.length >= 2) chalkStroke(scope, trail, theme.chalk.guide, 3.5)

    // Head dot
    const dot = new scope.Path.Circle(sd.pts[head], 5)
    dot.fillColor = new scope.Color(theme.chalk.highlight)
    dot.opacity = 0.95

    // Highlight token — compute absolute token index
    const baseTokenIdx = seq.slice(0, si).reduce((s, st) => s + st.length, 0)
    const localTokIdx = sd.tokenPtIdx.findLastIndex((pi: number) => pi <= head)
    const absTokIdx = baseTokenIdx + (localTokIdx >= 0 ? localTokIdx : 0)
    if (allOffsets[absTokIdx]) {
      const { start, end } = allOffsets[absTokIdx]
      seqEl.focus()
      seqEl.setSelectionRange(start, end)
    }

    head++
    if (head >= sd.pts.length) {
      head = 0
      si = (si + 1) % strokes.length
    }
    _animId = requestAnimationFrame(frame)
  }

  _animId = requestAnimationFrame(frame)
}

export function stopDecode() {
  if (_animId !== null) { cancelAnimationFrame(_animId); _animId = null }
}
