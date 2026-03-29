import { computeCharPositions } from './text-layout'
import { createBomb, updateBomb, type Bomb } from './bomb'
import { createParticle, detonateChar, updateParticle, type CharParticle } from './physics'
import {
  createDetonationSparks,
  createFuseSparks,
  invalidateRestCache,
  render,
  updateSparks,
  type ScreenShake,
  type Spark,
} from './renderer'

const DEMO_TEXT = `In the beginning was the Word, and the Word was with the bomb, and the Word was explosive. The characters lived peacefully on the screen, blissfully unaware of the destruction that awaited them. Each letter, each punctuation mark, existed in perfect harmony — until someone clicked.

Click anywhere to place a sticky bomb. Watch the fuse tick down. Then witness the beautiful chaos as characters scatter like shrapnel, tumbling through space with physics that would make Newton proud. But don't worry — they always find their way home.

Typography has always been an act of quiet defiance against entropy. Every line of text is a fragile arrangement, letters suspended in formation like birds mid-flight. The kerning, the leading, the careful dance of ascenders and descenders — all conspiring to create the illusion of order. But order is a temporary state. Chaos is patient. Chaos waits for a click.

Consider the letter 'g'. That descender loop, dangling below the baseline like a trapeze artist frozen in time. Now imagine it ripped from its moorings, spinning wildly through digital space, trailing sparks. That's what happens here. Every glyph gets its moment of violent liberation before being gently recalled to duty.

The physics engine treats each character as a rigid body with mass, velocity, and angular momentum. When the blast wave hits, force is applied inversely proportional to the square of the distance — just like a real explosion. Characters closer to the detonation point receive devastating force, while those at the periphery merely shudder and drift.

Reassembly is its own kind of magic. Each character remembers where it belongs. After the chaos subsides, they begin their journey home — not in a straight line, but with an elastic overshoot, like a spring snapping back into place. The further they flew, the longer the return trip. Patience is a virtue, even for punctuation.

This demo uses Pretext by Cheng Lou for text measurement and layout. Every character position is computed without a single DOM reflow. The library segments text, measures each segment via the Canvas API, and then performs pure arithmetic to determine line breaks and positions. No getBoundingClientRect. No offsetHeight. No layout thrashing. Just math.

Go ahead. Click again. The text can take it.`

const FONT_SIZE = 20
const LINE_HEIGHT = 32
const FONT = `${FONT_SIZE}px "Georgia", "Times New Roman", serif`
const PADDING = 60

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

let particles: CharParticle[] = []
let bombs: Bomb[] = []
let sparks: Spark[] = []
let shake: ScreenShake | null = null
let lastTime = 0
let canvasHeight = 0

function setupCanvas(): void {
  const dpr = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * dpr
  canvas.height = canvasHeight * dpr
  canvas.style.width = window.innerWidth + 'px'
  canvas.style.height = canvasHeight + 'px'
  ctx.font = `${FONT_SIZE * dpr}px "Georgia", "Times New Roman", serif`
}

function layoutText(): void {
  const maxWidth = Math.min(window.innerWidth - PADDING * 2, 700)
  const offsetX = (window.innerWidth - maxWidth) / 2
  const offsetY = PADDING

  const { chars, totalHeight } = computeCharPositions(DEMO_TEXT, FONT, maxWidth, LINE_HEIGHT, offsetX, offsetY)

  // Size canvas to fit all text + padding
  canvasHeight = Math.max(window.innerHeight, totalHeight + offsetY + PADDING)
  setupCanvas()
  invalidateRestCache()

  // Preserve state of existing particles if relayout
  const oldParticleMap = new Map<string, CharParticle>()
  for (const p of particles) {
    const key = `${p.info.lineIndex}:${p.info.x.toFixed(1)}:${p.info.char}`
    oldParticleMap.set(key, p)
  }

  particles = chars.map(info => {
    const key = `${info.lineIndex}:${info.x.toFixed(1)}:${info.char}`
    const existing = oldParticleMap.get(key)
    if (existing) {
      existing.info = info
      return existing
    }
    return createParticle(info)
  })
}

function handleClick(e: MouseEvent): void {
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const now = performance.now()
  bombs.push(createBomb(x, y, now))
}

function gameLoop(timestamp: number): void {
  const dt = lastTime === 0 ? 0.016 : Math.min((timestamp - lastTime) / 1000, 0.05)
  lastTime = timestamp
  const now = performance.now()

  let animatingCount = 0

  // Update bombs
  for (let i = bombs.length - 1; i >= 0; i--) {
    const bomb = bombs[i]!
    const prevState = bomb.state
    updateBomb(bomb, now)

    // On detonation trigger
    if (prevState === 'fuse' && bomb.state === 'detonating') {
      for (const p of particles) {
        detonateChar(p, bomb.x, bomb.y, bomb.blastRadius, now)
      }
      shake = { startTime: now, duration: 400, intensity: 12 }
      sparks.push(...createDetonationSparks(bomb.x, bomb.y, 80))
      invalidateRestCache()
    }

    // Fuse sparks
    if (bomb.state === 'fuse') {
      const elapsed = now - bomb.fuseStart
      const progress = elapsed / bomb.fuseDuration
      const pulse = 1 + 0.3 * Math.sin(elapsed * 0.02)
      const radius = 14 * pulse
      const fuseLen = 20 * (1 - progress)
      const fuseAngle = -Math.PI / 4
      const fx = bomb.x + Math.cos(fuseAngle) * radius
      const fy = bomb.y + Math.sin(fuseAngle) * radius
      const fex = fx + Math.cos(fuseAngle) * fuseLen
      const fey = fy + Math.sin(fuseAngle) * fuseLen
      if (Math.random() < 0.3) {
        sparks.push(...createFuseSparks(fex, fey))
      }
    }

    if (bomb.state === 'done') {
      bombs.splice(i, 1)
    }
  }

  // Update particles — track how many are animating
  for (const p of particles) {
    const prevState = p.state
    updateParticle(p, dt, now)
    if (p.state !== 'rest') {
      animatingCount++
    }
    // Char just returned to rest — rest cache needs update
    if (prevState !== 'rest' && p.state === 'rest') {
      invalidateRestCache()
    }
  }

  updateSparks(sparks, dt)

  const shakeActive = shake !== null && now - shake.startTime < shake.duration
  const hasActivity = animatingCount > 0 || bombs.length > 0 || sparks.length > 0 || shakeActive

  const dpr = window.devicePixelRatio || 1
  const scaledFont = `${FONT_SIZE * dpr}px "Georgia", "Times New Roman", serif`
  render(ctx, canvas, particles, bombs, sparks, shake, scaledFont, LINE_HEIGHT, now, hasActivity)

  requestAnimationFrame(gameLoop)
}

// Init
canvasHeight = window.innerHeight
setupCanvas()
layoutText()
canvas.addEventListener('click', handleClick)
window.addEventListener('resize', () => {
  layoutText()
})

requestAnimationFrame(gameLoop)
