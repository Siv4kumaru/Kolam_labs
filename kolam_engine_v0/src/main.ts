import './style.css'
import paper from 'paper'
import {
  PORTS, OPPOSITE_PORT, PORT_VECTORS,
  type Port, type DotCoord, type KolamData, type Connection,
  dotId, neighborCoord, makeMotif, createKolam,
} from './schema'
import { quickValidate } from './validator'
import { buildCurvePath, buildQuadraticPath, buildCatmullPath } from './renderer'

// --- DOM ---
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="layout">
    <div class="canvas-col">
      <div class="canvas-label">Encoder</div>
      <canvas id="enc-canvas"></canvas>
    </div>
    <div class="canvas-col">
      <div class="canvas-label">Quadratic</div>
      <canvas id="quad-canvas"></canvas>
    </div>
    <div class="canvas-col">
      <div class="canvas-label">Cubic</div>
      <canvas id="cubic-canvas"></canvas>
    </div>
    <div class="canvas-col">
      <div class="canvas-label">Catmull-Rom</div>
      <canvas id="catmull-canvas"></canvas>
    </div>
    <div class="panel">
      <h2>Kolam Engine</h2>
      <p class="hint">Click port to start. Hover to draw. Click to finish.</p>
      <div class="seq-label">Sequence</div>
      <textarea id="seq" spellcheck="false"></textarea>
      <div id="status" class="status ok">Ready</div>
      <div class="btn-row">
        <button id="btn-undo">Undo</button>
        <button id="btn-reset">Reset</button>
        <button id="btn-trace">Trace</button>
      </div>
    </div>
  </div>
`

// Size canvases to match their CSS layout dimensions before Paper.js setup
function sizeCanvas(id: string) {
  const canvas = document.getElementById(id) as HTMLCanvasElement
  const col = canvas.parentElement!
  const w = col.clientWidth
  const h = Math.round(window.innerHeight * 0.82)
  const dpr = window.devicePixelRatio || 1
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
}
sizeCanvas('enc-canvas')
sizeCanvas('quad-canvas')
sizeCanvas('cubic-canvas')
sizeCanvas('catmull-canvas')

// --- Two scopes ---
const encScope = new paper.PaperScope()
const quadScope = new paper.PaperScope()
const cubicScope = new paper.PaperScope()
const catmullScope = new paper.PaperScope()
encScope.setup(document.getElementById('enc-canvas') as HTMLCanvasElement)
quadScope.setup(document.getElementById('quad-canvas') as HTMLCanvasElement)
cubicScope.setup(document.getElementById('cubic-canvas') as HTMLCanvasElement)
catmullScope.setup(document.getElementById('catmull-canvas') as HTMLCanvasElement)

// --- Config ---
const ROWS = 5, COLS = 5
const DOT_SPACING = 80
const PORT_DIST = DOT_SPACING / 2
const SNAP_RADIUS = 18

// ===================== ENCODER (left) =====================
encScope.activate()

const bgLayer = new encScope.Layer()
const curveLayer = new encScope.Layer()
const previewLayer = new encScope.Layer()
const uiLayer = new encScope.Layer()

interface PortPoint { dot: DotCoord; port: Port | 'C'; point: paper.Point }
const portPoints: PortPoint[] = []

function encOrigin(): paper.Point {
  const s = encScope.view.size
  return new encScope.Point(
    (s.width - (COLS - 1) * DOT_SPACING) / 2,
    (s.height - (ROWS - 1) * DOT_SPACING) / 2,
  )
}

function dotPos(d: DotCoord): paper.Point {
  const o = encOrigin()
  return new encScope.Point(o.x + d.col * DOT_SPACING, o.y + d.row * DOT_SPACING)
}

function portPos(d: DotCoord, p: Port): paper.Point {
  const c = dotPos(d)
  const [dx, dy] = PORT_VECTORS[p]
  return new encScope.Point(c.x + dx * PORT_DIST, c.y + dy * PORT_DIST)
}

function drawEncGrid() {
  bgLayer.activate()
  bgLayer.removeChildren()
  portPoints.length = 0
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const d: DotCoord = { row: r, col: c }
      const center = dotPos(d)
      new encScope.Path.Circle({ center, radius: 5, fillColor: '#e0e0e0' })
      // dot center as snap target
      portPoints.push({ dot: d, port: 'C', point: center })
      for (const p of PORTS) {
        const pp = portPos(d, p)
        new encScope.Path.Circle({ center: pp, radius: 2.5, fillColor: '#555' })
        portPoints.push({ dot: d, port: p, point: pp })
      }
    }
  }
}

function snapToPort(pt: paper.Point): PortPoint | null {
  let best: PortPoint | null = null, bestD = SNAP_RADIUS
  for (const pp of portPoints) {
    const d = pt.getDistance(pp.point)
    if (d < bestD) { bestD = d; best = pp }
  }
  return best
}

// --- Encoder state ---
let kolam: KolamData = createKolam(ROWS, COLS)
const allStrokes: PortPoint[][] = []  // finished strokes
let currentStroke: PortPoint[] = []
const finishedPaths: paper.Path[] = []
let drawing = false
let lastSnap: PortPoint | null = null
let previewPath: paper.Path | null = null

const seqEl = document.getElementById('seq')! as HTMLTextAreaElement
const statusEl = document.getElementById('status')!

// Format: each stroke is "row,col:PORT row,col:PORT ..." joined with " | "
// Consecutive steps on the same dot are compacted: "0,0:N E" means dot 0,0 ports N then E
function seqString(): string {
  const strokes = [...allStrokes, ...(currentStroke.length > 0 ? [currentStroke] : [])]
  return strokes.map(stroke => {
    const parts: string[] = []
    let lastId = ''
    for (const pp of stroke) {
      const id = dotId(pp.dot)
      if (id !== lastId) { parts.push(`${id}:${pp.port}`); lastId = id }
      else { parts.push(pp.port) }
    }
    return parts.join(' ')
  }).join(' | ')
}

// Parse "row,col:PORT PORT | row,col:PORT ..." back into traversal strokes
function parseSequence(text: string): { dot: DotCoord; port: Port }[][] {
  const portSet = new Set<string>(PORTS)
  const strokes: { dot: DotCoord; port: Port }[][] = []
  const strokeTexts = text.split('|').map(s => s.trim()).filter(Boolean)
  for (const st of strokeTexts) {
    const tokens = st.split(/\s+/).filter(Boolean)
    const stroke: { dot: DotCoord; port: Port }[] = []
    let currentDot: DotCoord | null = null
    for (const tok of tokens) {
      if (tok.includes(':')) {
        // "row,col:PORT"
        const colon = tok.indexOf(':')
        const coords = tok.slice(0, colon).split(',').map(Number)
        const port = tok.slice(colon + 1).toUpperCase()
        if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]) && portSet.has(port)) {
          currentDot = { row: coords[0], col: coords[1] }
          stroke.push({ dot: currentDot, port: port as Port })
        }
      } else if (portSet.has(tok.toUpperCase()) && currentDot) {
        // bare PORT continuing last dot
        stroke.push({ dot: currentDot, port: tok.toUpperCase() as Port })
      }
    }
    if (stroke.length > 0) strokes.push(stroke)
  }
  return strokes
}

seqEl.addEventListener('input', () => {
  const strokes = parseSequence(seqEl.value)
  kolam.traversal = strokes
  renderDecoder()
})

function rebuildMotifs() {
  kolam = createKolam(ROWS, COLS)
  const all = [...allStrokes.flat(), ...currentStroke]
  // Keep 'C' in traversal as a special marker
  kolam.traversal = allStrokes.map(s => s.map(pp => ({ dot: pp.dot, port: pp.port as Port })))
  if (currentStroke.length > 0) {
    kolam.traversal.push(currentStroke.map(pp => ({ dot: pp.dot, port: pp.port as Port })))
  }

  let i = 0
  while (i < all.length - 1) {
    const a = all[i]
    if (a.port === 'C') { i++; continue }

    // throughCenter triplet: port → C (same dot) → port (same dot)
    if (
      i + 2 < all.length &&
      all[i + 1].port === 'C' && dotId(all[i + 1].dot) === dotId(a.dot) &&
      all[i + 2].port !== 'C' && dotId(all[i + 2].dot) === dotId(a.dot)
    ) {
      addConnection(a.dot, { from: a.port as Port, to: all[i + 2].port as Port, throughCenter: true })
      i += 2
      continue
    }

    const b = all[i + 1]
    if (b.port === 'C') { i++; continue }

    const aId = dotId(a.dot), bId = dotId(b.dot)
    if (aId === bId) {
      addConnection(a.dot, { from: a.port as Port, to: b.port as Port })
    } else {
      addPort(a.dot, a.port as Port)
      addPort(b.dot, b.port as Port)
    }
    i++
  }
}

function addConnection(dot: DotCoord, conn: Connection) {
  const id = dotId(dot)
  const existing = kolam.motifs.get(id)
  if (existing) {
    if (!existing.activePorts.includes(conn.from)) existing.activePorts.push(conn.from)
    if (!existing.activePorts.includes(conn.to)) existing.activePorts.push(conn.to)
    existing.connections.push(conn)
    existing.shapeClass = makeMotif(existing.connections).shapeClass
  } else {
    kolam.motifs.set(id, makeMotif([conn]))
  }
}

function addPort(dot: DotCoord, port: Port) {
  const id = dotId(dot)
  const existing = kolam.motifs.get(id)
  if (existing) {
    if (!existing.activePorts.includes(port)) existing.activePorts.push(port)
  } else {
    kolam.motifs.set(id, { activePorts: [port], connections: [], shapeClass: 'straight' })
  }
}

function updateUI() {
  seqEl.value = seqString() || '(empty)'
  const errs = quickValidate(kolam)
  if (kolam.motifs.size === 0) {
    statusEl.textContent = 'Ready'
    statusEl.className = 'status ok'
  } else if (errs.length === 0) {
    statusEl.textContent = '✓ Valid Eulerian'
    statusEl.className = 'status ok'
  } else {
    statusEl.textContent = errs.map(e => e.message).join('\n')
    statusEl.className = 'status err'
  }
}

function updateEncPreview() {
  encScope.activate()
  previewLayer.activate()
  previewPath?.remove()
  previewPath = null
  if (currentStroke.length < 2) {
    if (currentStroke.length === 1) {
      previewPath = new encScope.Path.Circle({ center: currentStroke[0].point, radius: 5, fillColor: '#6ba3ff' })
    }
    return
  }
  const pts = currentStroke.map(pp => pp.point)
  previewPath = new encScope.Path(pts)
  previewPath.strokeColor = new encScope.Color('#6ba3ff')
  previewPath.strokeWidth = 2.5
  previewPath.strokeCap = 'round'
  previewPath.strokeJoin = 'round'
}

function finalizeStroke() {
  if (currentStroke.length < 2) return
  encScope.activate()
  curveLayer.activate()
  const pts = currentStroke.map(pp => pp.point)
  const path = new encScope.Path(pts)
  path.strokeColor = new encScope.Color('#c084fc')
  path.strokeWidth = 2.5
  path.strokeCap = 'round'
  path.strokeJoin = 'round'
  finishedPaths.push(path)

  previewLayer.activate()
  previewPath?.remove()
  previewPath = null

  allStrokes.push([...currentStroke])
  currentStroke = []
  drawing = false
  lastSnap = null

  rebuildMotifs()
  updateUI()
  renderDecoder()
}

// --- Encoder tool ---
encScope.activate()
const tool = new encScope.Tool()

tool.onMouseMove = (event: paper.ToolEvent) => {
  encScope.activate()
  uiLayer.activate()
  uiLayer.removeChildren()

  const snap = snapToPort(event.point)
  if (snap) {
    new encScope.Path.Circle({ center: snap.point, radius: 7, fillColor: new encScope.Color(0.4, 1, 0.4, 0.5) })
    if (drawing && (!lastSnap || snap.point.getDistance(lastSnap.point) > 1)) {
      lastSnap = snap
      currentStroke.push(snap)
      rebuildMotifs()
      updateEncPreview()
      updateUI()
      renderDecoder()
    }
  }

  if (drawing && currentStroke.length > 0) {
    const cur = currentStroke[currentStroke.length - 1]
    if (cur.port !== 'C') {
      // Green: entry port on the neighbor this port faces
      const nb = neighborCoord(cur.dot, cur.port)
      if (nb.row >= 0 && nb.row < ROWS && nb.col >= 0 && nb.col < COLS) {
        new encScope.Path.Circle({ center: portPos(nb, OPPOSITE_PORT[cur.port]), radius: 8, fillColor: new encScope.Color(0.4, 1, 0.4, 0.3) })
      }
      // Blue: other exit ports on current dot, excluding the port we arrived from
      const arrivedFrom = currentStroke.length >= 2 ? currentStroke[currentStroke.length - 2].port : null
      for (const p of PORTS) {
        if (p !== cur.port && p !== arrivedFrom) {
          new encScope.Path.Circle({ center: portPos(cur.dot, p), radius: 6, fillColor: new encScope.Color(0.3, 0.6, 1, 0.2) })
        }
      }
    }
  }
}

tool.onMouseDown = (event: paper.ToolEvent) => {
  encScope.activate()
  const snap = snapToPort(event.point)
  if (!snap) return
  if (drawing) {
    finalizeStroke()
  } else {
    drawing = true
    lastSnap = snap
    currentStroke = [snap]
    updateEncPreview()
  }
}

tool.onKeyDown = (event: paper.KeyEvent) => {
  if (event.key === 'escape') {
    encScope.activate()
    drawing = false
    lastSnap = null
    currentStroke = []
    previewLayer.activate()
    previewPath?.remove()
    previewPath = null
    uiLayer.removeChildren()
    rebuildMotifs()
    updateUI()
    renderDecoder()
  }
  if (event.key === 'z') {
    encScope.activate()
    if (finishedPaths.length === 0) return
    finishedPaths.pop()?.remove()
    allStrokes.pop()
    rebuildMotifs()
    updateUI()
    renderDecoder()
  }
}

// ===================== DECODERS (quadratic + cubic) =====================

let quadPaths: paper.Path[] = []
let cubicPaths: paper.Path[] = []
let catmullPaths: paper.Path[] = []

function decoderOrigin(scope: paper.PaperScope): paper.Point {
  const s = scope.view.size
  return new scope.Point(
    (s.width - (COLS - 1) * DOT_SPACING) / 2,
    (s.height - (ROWS - 1) * DOT_SPACING) / 2,
  )
}

function drawDecoderGrid(scope: paper.PaperScope) {
  scope.activate()
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const o = decoderOrigin(scope)
      const x = o.x + c * DOT_SPACING
      const y = o.y + r * DOT_SPACING
      new scope.Path.Circle({ center: new scope.Point(x, y), radius: 5, fillColor: '#e0e0e0' })
      for (const p of PORTS) {
        const [dx, dy] = PORT_VECTORS[p]
        new scope.Path.Circle({
          center: new scope.Point(x + dx * PORT_DIST, y + dy * PORT_DIST),
          radius: 2.5, fillColor: '#444',
        })
      }
    }
  }
}

function strokesToPts(scope: paper.PaperScope): paper.Point[][] {
  const o = decoderOrigin(scope)
  const toPoint = (dot: DotCoord, port: Port) => {
    const cx = o.x + dot.col * DOT_SPACING
    const cy = o.y + dot.row * DOT_SPACING
    const [dx, dy] = PORT_VECTORS[port]
    return new scope.Point(cx + dx * PORT_DIST, cy + dy * PORT_DIST)
  }
  const centerPoint = (dot: DotCoord) =>
    new scope.Point(o.x + dot.col * DOT_SPACING, o.y + dot.row * DOT_SPACING)

  return kolam.traversal
    .filter(s => s.length >= 2)
    .map(stroke => stroke.map(step =>
      step.port === ('C' as unknown as Port)
        ? centerPoint(step.dot)
        : toPoint(step.dot, step.port)
    ))
}

function renderDecoder() {
  // Quadratic
  quadScope.activate()
  quadPaths.forEach(p => p.remove())
  quadPaths = []
  for (const pts of strokesToPts(quadScope)) {
    const path = buildQuadraticPath(pts)
    path.strokeColor = new quadScope.Color('#f97316')
    path.strokeWidth = 2.5
    path.strokeCap = 'round'
    path.strokeJoin = 'round'
    quadPaths.push(path)
  }

  // Cubic
  cubicScope.activate()
  cubicPaths.forEach(p => p.remove())
  cubicPaths = []
  for (const pts of strokesToPts(cubicScope)) {
    const path = buildCurvePath(pts)
    path.strokeColor = new cubicScope.Color('#34d399')
    path.strokeWidth = 2.5
    path.strokeCap = 'round'
    path.strokeJoin = 'round'
    cubicPaths.push(path)
  }

  // Catmull-Rom
  catmullScope.activate()
  catmullPaths.forEach(p => p.remove())
  catmullPaths = []
  for (const pts of strokesToPts(catmullScope)) {
    const path = buildCatmullPath(pts)
    path.strokeColor = new catmullScope.Color('#fb7185')
    path.strokeWidth = 2.5
    path.strokeCap = 'round'
    path.strokeJoin = 'round'
    catmullPaths.push(path)
  }

  encScope.activate()
}

// --- Trace animation on both decoders ---
let tracing = false
function traceDecoder() {
  if (tracing || (quadPaths.length === 0 && cubicPaths.length === 0)) return
  tracing = true

  function tracePaths(scope: paper.PaperScope, paths: paper.Path[], onDone: () => void) {
    scope.activate()
    const origPaths = paths.map(p => { p.visible = false; return p })
    let i = 0
    function traceNext() {
      if (i >= origPaths.length) { onDone(); return }
      const p = origPaths[i]
      const len = p.length
      if (len === 0) { p.visible = true; i++; traceNext(); return }
      const tracer = p.clone()
      tracer.visible = true
      tracer.dashArray = [len, len]
      tracer.dashOffset = len
      const start = Date.now()
      const dur = Math.max(400, len * 4)
      function tick() {
        scope.activate()
        const t = Math.min((Date.now() - start) / dur, 1)
        tracer.dashOffset = len * (1 - t)
        if (t < 1) { requestAnimationFrame(tick) }
        else { tracer.remove(); p.visible = true; i++; traceNext() }
      }
      requestAnimationFrame(tick)
    }
    traceNext()
  }

  let done = 0
  const finish = () => { if (++done === 3) { tracing = false } }
  tracePaths(quadScope, quadPaths, finish)
  tracePaths(cubicScope, cubicPaths, finish)
  tracePaths(catmullScope, catmullPaths, finish)
}

// --- Buttons ---
document.getElementById('btn-undo')!.onclick = () => {
  encScope.activate()
  if (finishedPaths.length === 0) return
  finishedPaths.pop()?.remove()
  allStrokes.pop()
  rebuildMotifs()
  updateUI()
  renderDecoder()
}

document.getElementById('btn-reset')!.onclick = () => {
  encScope.activate()
  drawing = false
  lastSnap = null
  currentStroke = []
  kolam = createKolam(ROWS, COLS)
  curveLayer.removeChildren()
  previewLayer.removeChildren()
  uiLayer.removeChildren()
  finishedPaths.length = 0
  allStrokes.length = 0
  previewPath = null
  updateUI()
  renderDecoder()
}
document.getElementById('btn-trace')!.onclick = traceDecoder

// --- Init ---
encScope.activate()
drawEncGrid()
drawDecoderGrid(quadScope)
drawDecoderGrid(cubicScope)
drawDecoderGrid(catmullScope)
updateUI()
