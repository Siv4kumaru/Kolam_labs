// canvas.ts — grid math, board rendering, and layout lifecycle

import { type GridConfig, type LatticePoint, type AnchorDot, isAnchor } from './schema'
import { theme } from '../styles/theme'
import { drawBoardTexture, seededRand } from './renderer'
import { drawKolamLoop, buildDemoLoop } from './spline'

// ── Grid math ──────────────────────────────────────────────────────────────

export function latticeSize(cfg: GridConfig) {
  return { rows: 2 * cfg.rows + 1, cols: 2 * cfg.cols + 1 }
}

export function buildLattice(cfg: GridConfig): LatticePoint[] {
  const { rows, cols } = latticeSize(cfg)
  const pts: LatticePoint[] = []
  for (let li = 0; li < rows; li++)
    for (let lj = 0; lj < cols; lj++)
      pts.push({ li, lj })
  return pts
}

export function buildAnchors(cfg: GridConfig): AnchorDot[] {
  const anchors: AnchorDot[] = []
  for (let row = 0; row < cfg.rows; row++)
    for (let col = 0; col < cfg.cols; col++)
      anchors.push({ li: 2 * row + 1, lj: 2 * col + 1, row, col })
  return anchors
}

export function latticeToCanvas(
  li: number, lj: number, cfg: GridConfig, origin: { x: number; y: number },
) {
  return { x: origin.x + lj * cfg.spacing, y: origin.y + li * cfg.spacing }
}

export function gridOrigin(cfg: GridConfig, canvasW: number, canvasH: number) {
  const { rows, cols } = latticeSize(cfg)
  return {
    x: (canvasW - (cols - 1) * cfg.spacing) / 2,
    y: (canvasH - (rows - 1) * cfg.spacing) / 2,
  }
}

// ── Board rendering ────────────────────────────────────────────────────────

export function drawGrid(scope: any, canvas: HTMLCanvasElement, cfg: GridConfig, label: string) {
  scope.activate()
  scope.project.clear()

  const { width, height } = scope.view.size
  drawBoardTexture(scope, width, height)

  const origin = gridOrigin(cfg, canvas.clientWidth, canvas.clientHeight)
  for (const { li, lj } of buildLattice(cfg)) {
    const { x, y } = latticeToCanvas(li, lj, cfg, origin)
    new scope.Path.Circle({
      center: new scope.Point(x, y),
      radius: isAnchor(li, lj) ? 5 : 1.5,
      fillColor: isAnchor(li, lj) ? theme.chalk.main : theme.dots,
    })
  }

  drawChalkLabel(scope, width, label)
}

function drawChalkLabel(scope: any, width: number, label: string) {
  const offscreen = document.createElement('canvas')
  offscreen.width = Math.round(width)
  offscreen.height = 70
  const ctx = offscreen.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, offscreen.width, offscreen.height)
  ctx.fillStyle = '#fff'
  ctx.font = `700 42px 'Schoolbell', cursive`
  ctx.letterSpacing = '6px'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label.toUpperCase(), offscreen.width / 2, 35)

  const { data } = ctx.getImageData(0, 0, offscreen.width, 70)
  const rand = seededRand(label.charCodeAt(0) * 7 + 99)
  const group = new scope.Group()

  for (let y = 0; y < 70; y++) {
    for (let x = 0; x < offscreen.width; x++) {
      const brightness = data[(y * offscreen.width + x) * 4]
      if (brightness < 80 || rand() > 0.75) continue
      const dot = new scope.Path.Circle(
        new scope.Point(x + (rand() - 0.5) * 0.6, 8 + y + (rand() - 0.5) * 0.6),
        0.5 + rand() * 0.6,
      )
      const c = new scope.Color(theme.chalk.main)
      c.alpha = 0.45 + rand() * 0.45 * (brightness / 255)
      dot.fillColor = c
      group.addChild(dot)
    }
  }
}

export function drawKolamDemo(scope: any, canvas: HTMLCanvasElement, cfg: GridConfig, showGuides = true) {
  scope.activate()
  const origin = gridOrigin(cfg, canvas.clientWidth, canvas.clientHeight)
  const anchors = buildAnchors(cfg)
  const loop = buildDemoLoop(anchors)
  drawKolamLoop(scope, loop, cfg, origin, showGuides)
}

// ── Layout lifecycle ───────────────────────────────────────────────────────

const ARROW_SVG = `
  <svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 24 Q12 22 24 24" stroke="#FACC15" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.85"/>
    <path d="M24 24 L17 17" stroke="#FACC15" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.85"/>
    <path d="M24 24 L17 31" stroke="#FACC15" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.85"/>
  </svg>`

export const HTML = `
  <div class="layout">
    <div class="boards" id="boards">
      <div class="panels">
        <canvas id="enc-canvas"></canvas>
        <div class="flow-arrow">${ARROW_SVG}</div>
        <div class="seq-panel">
          <div class="grid-input">
            <label>N <input id="inp-rows" type="number" value="3" min="1" max="12" /></label>
            <label>M <input id="inp-cols" type="number" value="3" min="1" max="12" /></label>
          </div>
          <div class="seq-label">Sequence</div>
          <textarea id="seq" spellcheck="false" readonly></textarea>
        </div>
        <div class="flow-arrow">${ARROW_SVG}</div>
        <canvas id="dec-canvas"></canvas>
      </div>
    </div>
  </div>
`

export function sizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1
  // Let flex:1 determine width — read what browser computed
  const w = canvas.offsetWidth || canvas.parentElement!.clientWidth / 2
  const h = (canvas.parentElement!.clientHeight) - 20
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
}

export function setupResizeObserver(
  encCanvas: HTMLCanvasElement, decCanvas: HTMLCanvasElement,
  encScope: any, decScope: any, onResize: () => void,
) {
  const ro = new ResizeObserver(() => {
    sizeCanvas(encCanvas)
    sizeCanvas(decCanvas)
    encScope.view.viewSize = new encScope.Size(encCanvas.clientWidth, encCanvas.clientHeight)
    decScope.view.viewSize = new decScope.Size(decCanvas.clientWidth, decCanvas.clientHeight)
    onResize()
  })
  ro.observe(document.getElementById('boards')!)
}
