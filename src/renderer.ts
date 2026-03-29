import type { CharParticle } from './physics'
import type { Bomb } from './bomb'
import { drawBomb } from './bomb'

const CHAR_COLORS = {
  rest: '#2a2420',
  shrapnel: '#c0440a',
  reassembling: '#6b7c5e',
}

const BG_COLOR = '#f5f0e8'
const BG_PAPER_LINES = '#ebe5d8'

// Cached background with bomb watermarks
let bgCanvas: OffscreenCanvas | null = null
let bgCtx: OffscreenCanvasRenderingContext2D | null = null
let bgWidth = 0
let bgHeight = 0

// Bomb image for watermarks
let bombImg: HTMLImageElement | null = null
let bombImgLoaded = false

function loadBombImage(): void {
  if (bombImg) return
  bombImg = new Image()
  bombImg.onload = () => {
    bombImgLoaded = true
    bgWidth = 0
    bgHeight = 0
  }
  bombImg.src = import.meta.env.BASE_URL + 'bomb.png'
}

loadBombImage()

function renderBackground(canvasW: number, canvasH: number, dpr: number): void {
  if (bgCanvas && bgWidth === canvasW && bgHeight === canvasH) return

  bgCanvas = new OffscreenCanvas(canvasW, canvasH)
  bgCtx = bgCanvas.getContext('2d')!
  bgWidth = canvasW
  bgHeight = canvasH

  const bc = bgCtx

  // Base color
  bc.fillStyle = BG_COLOR
  bc.fillRect(0, 0, canvasW, canvasH)

  // Subtle paper texture — horizontal lines
  bc.strokeStyle = BG_PAPER_LINES
  bc.lineWidth = 1
  const lineSpacing = 28 * dpr
  for (let y = lineSpacing; y < canvasH; y += lineSpacing) {
    bc.beginPath()
    bc.moveTo(0, y)
    bc.lineTo(canvasW, y)
    bc.stroke()
  }

  // Scattered bomb image watermarks
  if (bombImgLoaded && bombImg) {
    const placements = [
      { x: 0.08, y: 0.15, size: 200, rot: -0.2, opacity: 0.8 },
      { x: 0.90, y: 0.45, size: 250, rot: 0.4, opacity: 0.8 },
      { x: 0.12, y: 0.78, size: 220, rot: -0.6, opacity: 0.8 },
    ]

    for (const b of placements) {
      const s = b.size * dpr
      bc.save()
      bc.translate(b.x * canvasW, b.y * canvasH)
      bc.rotate(b.rot)
      bc.globalAlpha = b.opacity
      bc.drawImage(bombImg, -s / 2, -s / 2, s, s)
      bc.restore()
    }
  }

  // Vignette — subtle darkening at edges
  const vGrad = bc.createRadialGradient(
    canvasW / 2, canvasH / 2, Math.min(canvasW, canvasH) * 0.3,
    canvasW / 2, canvasH / 2, Math.max(canvasW, canvasH) * 0.7,
  )
  vGrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vGrad.addColorStop(1, 'rgba(0, 0, 0, 0.06)')
  bc.fillStyle = vGrad
  bc.fillRect(0, 0, canvasW, canvasH)
}

export type ScreenShake = {
  startTime: number
  duration: number
  intensity: number
}

export type Spark = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  alive: boolean
}

const SPARK_COLORS = ['#ffcc00', '#ff8800', '#ff4400', '#ffffff', '#ffaa22']

export function pushDetonationSparks(sparks: Spark[], bombX: number, bombY: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 100 + Math.random() * 400
    const life = 300 + Math.random() * 700
    sparks.push({
      x: bombX,
      y: bombY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 50,
      life,
      maxLife: life,
      size: 1.5 + Math.random() * 3,
      color: SPARK_COLORS[(i % 5)]!,
      alive: true,
    })
  }
}

export function pushFuseSparks(sparks: Spark[], x: number, y: number): void {
  const count = 2 + Math.floor(Math.random() * 3)
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 20 + Math.random() * 60
    sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      life: 150 + Math.random() * 200,
      maxLife: 350,
      size: 1 + Math.random() * 2,
      color: Math.random() > 0.5 ? '#ffcc00' : '#ff8800',
      alive: true,
    })
  }
}

export function updateSparks(sparks: Spark[], dt: number): void {
  let write = 0
  for (let i = 0; i < sparks.length; i++) {
    const s = sparks[i]!
    s.x += s.vx * dt
    s.y += s.vy * dt
    s.vy += 300 * dt
    s.vx *= 0.98
    s.life -= dt * 1000
    if (s.life > 0) {
      sparks[write] = s
      write++
    }
  }
  sparks.length = write
}

// --- Offscreen rest text cache ---
let restCanvas: OffscreenCanvas | null = null
let restCtx: OffscreenCanvasRenderingContext2D | null = null
let restDirty = true
let restWidth = 0
let restHeight = 0

export function invalidateRestCache(): void {
  restDirty = true
}

export function invalidateAllCaches(): void {
  restDirty = true
  bgWidth = 0
  bgHeight = 0
}

function ensureRestCanvas(w: number, h: number): void {
  if (!restCanvas || restWidth !== w || restHeight !== h) {
    restCanvas = new OffscreenCanvas(w, h)
    restCtx = restCanvas.getContext('2d')!
    restWidth = w
    restHeight = h
    restDirty = true
  }
}

function renderRestText(
  particles: CharParticle[],
  font: string,
  dpr: number,
  canvasW: number,
  canvasH: number,
): void {
  ensureRestCanvas(canvasW, canvasH)
  if (!restDirty) return
  const rc = restCtx!

  rc.clearRect(0, 0, canvasW, canvasH)
  rc.font = font
  rc.textBaseline = 'top'
  rc.fillStyle = CHAR_COLORS.rest

  // Group rest chars by line into contiguous runs, flush as line strings
  let currentLine = -1
  let runChars = ''
  let runX = 0
  let runEndX = 0
  let lineY = 0

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]!
    if (p.state !== 'rest') continue

    const line = p.info.lineIndex
    const x = p.info.x * dpr
    const y = p.info.y * dpr

    if (line !== currentLine) {
      if (runChars.length > 0) rc.fillText(runChars, runX, lineY)
      currentLine = line
      runChars = p.info.char
      runX = x
      runEndX = x + p.info.width * dpr
      lineY = y
    } else {
      // Check contiguity using accumulated width (no measureText call)
      const gap = Math.abs(x - runEndX)
      if (gap < 2 * dpr) {
        runChars += p.info.char
        runEndX = x + p.info.width * dpr
      } else {
        if (runChars.length > 0) rc.fillText(runChars, runX, lineY)
        runChars = p.info.char
        runX = x
        runEndX = x + p.info.width * dpr
        lineY = y
      }
    }
  }
  if (runChars.length > 0) rc.fillText(runChars, runX, lineY)

  restDirty = false
}

export function render(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  particles: CharParticle[],
  activeIndices: number[],
  bombs: Bomb[],
  sparks: Spark[],
  shake: ScreenShake | null,
  font: string,
  lineHeight: number,
  now: number,
  hasActivity: boolean,
  dpr: number,
): void {
  // Skip full redraw if completely idle
  if (!hasActivity && !restDirty) return

  ctx.save()

  // Screen shake
  if (shake && now - shake.startTime < shake.duration) {
    const progress = (now - shake.startTime) / shake.duration
    const decay = 1 - progress
    const intensity = shake.intensity * decay
    const sx = (Math.random() - 0.5) * 2 * intensity
    const sy = (Math.random() - 0.5) * 2 * intensity
    ctx.translate(sx * dpr, sy * dpr)
  }

  // Draw background (cached — only re-renders on resize)
  renderBackground(canvas.width, canvas.height, dpr)
  if (bgCanvas) {
    ctx.drawImage(bgCanvas, 0, 0)
  }

  // Draw rest text from cache
  renderRestText(particles, font, dpr, canvas.width, canvas.height)
  if (restCanvas) {
    ctx.drawImage(restCanvas, 0, 0)
  }

  // Draw animated characters only — using activeIndices to skip rest particles
  if (activeIndices.length > 0) {
    ctx.font = font
    ctx.textBaseline = 'top'

    const halfLH = (lineHeight * dpr) / 2
    // Capture the current (possibly shaken) transform as our base
    const baseTransform = ctx.getTransform()

    for (let i = 0; i < activeIndices.length; i++) {
      const p = particles[activeIndices[i]!]!
      if (p.opacity <= 0.01) continue

      const hw = (p.info.width * dpr) / 2
      const centerX = p.cx * dpr + hw
      const centerY = p.cy * dpr + halfLH

      // Use setTransform to apply rotation directly — avoids save/restore per char
      const cos = Math.cos(p.rotation)
      const sin = Math.sin(p.rotation)
      ctx.setTransform(
        baseTransform.a * cos + baseTransform.c * sin,
        baseTransform.b * cos + baseTransform.d * sin,
        baseTransform.a * -sin + baseTransform.c * cos,
        baseTransform.b * -sin + baseTransform.d * cos,
        baseTransform.a * centerX + baseTransform.c * centerY + baseTransform.e,
        baseTransform.b * centerX + baseTransform.d * centerY + baseTransform.f,
      )

      ctx.globalAlpha = p.opacity
      ctx.fillStyle = p.state === 'shrapnel' ? CHAR_COLORS.shrapnel : CHAR_COLORS.reassembling
      ctx.fillText(p.info.char, -hw, -halfLH)
    }

    // Restore base transform
    ctx.setTransform(baseTransform)
    ctx.globalAlpha = 1
  }

  // Draw bombs
  if (bombs.length > 0) {
    ctx.save()
    ctx.scale(dpr, dpr)
    for (const bomb of bombs) {
      drawBomb(ctx, bomb, now)
    }
    ctx.restore()
  }

  // Draw sparks
  if (sparks.length > 0) {
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i]!
      const alpha = s.life / s.maxLife
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(s.x * dpr, s.y * dpr, s.size * dpr, 0, Math.PI * 2)
      ctx.fillStyle = s.color
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  ctx.restore()
}
