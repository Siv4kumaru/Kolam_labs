import './styles/main.css'
import paper from 'paper'
import { type GridConfig } from './modules/schema'
import { HTML, sizeCanvas, setupResizeObserver, drawGrid } from './modules/canvas'
import { initDraw, resetDraw } from './modules/draw'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = HTML

const encCanvas = document.getElementById('enc-canvas') as HTMLCanvasElement
const decCanvas = document.getElementById('dec-canvas') as HTMLCanvasElement
const encScope = new paper.PaperScope()
const decScope = new paper.PaperScope()

let cfg: GridConfig = { rows: 3, cols: 3, spacing: 40 }

function redraw() {
  drawGrid(encScope, encCanvas, cfg, 'draw')
  drawGrid(decScope, decCanvas, cfg, 'decode')
  resetDraw(cfg)
}

requestAnimationFrame(() => {
  sizeCanvas(encCanvas)
  sizeCanvas(decCanvas)
  encScope.setup(encCanvas)
  decScope.setup(decCanvas)
  drawGrid(encScope, encCanvas, cfg, 'draw')
  drawGrid(decScope, decCanvas, cfg, 'decode')
  initDraw(encScope, encCanvas, cfg)
  setupResizeObserver(encCanvas, decCanvas, encScope, decScope, redraw)
})

document.getElementById('inp-rows')!.addEventListener('input', (e) => {
  const v = parseInt((e.target as HTMLInputElement).value)
  if (v > 0) { cfg = { ...cfg, rows: v }; redraw() }
})
document.getElementById('inp-cols')!.addEventListener('input', (e) => {
  const v = parseInt((e.target as HTMLInputElement).value)
  if (v > 0) { cfg = { ...cfg, cols: v }; redraw() }
})
