import './styles/main.css'
import paper from 'paper'
import { type GridConfig } from './modules/schema'
import { HTML, sizeCanvas, setupResizeObserver, drawGrid } from './modules/canvas'
import { initDraw, resetDraw } from './modules/draw'
import { decodeLive, decodeLoop, stopDecode } from './modules/decoder'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = HTML

const encCanvas = document.getElementById('enc-canvas') as HTMLCanvasElement
const decCanvas = document.getElementById('dec-canvas') as HTMLCanvasElement
const seqEl = document.getElementById('seq') as HTMLTextAreaElement
const encScope = new paper.PaperScope()
const decScope = new paper.PaperScope()

let cfg: GridConfig = { rows: 3, cols: 3, spacing: 40 }
let initialized = false

function redraw() {
  sizeCanvas(encCanvas)
  sizeCanvas(decCanvas)
  encScope.view.viewSize = new encScope.Size(encCanvas.clientWidth, encCanvas.clientHeight)
  decScope.view.viewSize = new decScope.Size(decCanvas.clientWidth, decCanvas.clientHeight)
  drawGrid(encScope, encCanvas, cfg, 'draw')
  drawGrid(decScope, decCanvas, cfg, 'decode')
  stopDecode()
  resetDraw(cfg)
  seqEl.value = ''
}

// Use ResizeObserver for both initial setup and subsequent resizes
const ro = new ResizeObserver(() => {
  if (!initialized) {
    initialized = true
    encScope.setup(encCanvas)
    decScope.setup(decCanvas)
    initDraw(
      encScope, encCanvas, cfg,
      (seq) => decodeLive(decScope, decCanvas, cfg, seq, seqEl),
      (seq) => decodeLoop(decScope, decCanvas, cfg, seq, seqEl),
    )
  }
  redraw()
})
ro.observe(document.getElementById('boards')!)

document.getElementById('inp-rows')!.addEventListener('input', (e) => {
  const v = parseInt((e.target as HTMLInputElement).value)
  if (v > 0) { cfg = { ...cfg, rows: v }; redraw() }
})
document.getElementById('inp-cols')!.addEventListener('input', (e) => {
  const v = parseInt((e.target as HTMLInputElement).value)
  if (v > 0) { cfg = { ...cfg, cols: v }; redraw() }
})
