import type { CharInfo } from './text-layout'

export type CharState = 'rest' | 'shrapnel' | 'reassembling'

export type CharParticle = {
  info: CharInfo
  state: CharState
  // Current position
  cx: number
  cy: number
  // Velocity
  vx: number
  vy: number
  // Rotation
  rotation: number
  angularVel: number
  // Opacity
  opacity: number
  // Shrapnel timing
  shrapnelStart: number
  // Reassembly
  reassembleStart: number
  reassembleDuration: number
  // Snapshot position when reassembly begins
  reassembleFromX: number
  reassembleFromY: number
  reassembleFromRotation: number
}

const GRAVITY = 600
const AIR_RESISTANCE = 0.98
const SHRAPNEL_DURATION = 1200
const REASSEMBLE_DURATION = 600
const FORCE_MULTIPLIER = 40000

export function createParticle(info: CharInfo): CharParticle {
  return {
    info,
    state: 'rest',
    cx: info.x,
    cy: info.y,
    vx: 0,
    vy: 0,
    rotation: 0,
    angularVel: 0,
    opacity: 1,
    shrapnelStart: 0,
    reassembleStart: 0,
    reassembleDuration: REASSEMBLE_DURATION,
    reassembleFromX: 0,
    reassembleFromY: 0,
    reassembleFromRotation: 0,
  }
}

export function detonateChar(
  p: CharParticle,
  bombX: number,
  bombY: number,
  blastRadius: number,
  now: number,
): void {
  const charCenterX = p.info.x + p.info.width / 2
  const charCenterY = p.info.y
  const dx = charCenterX - bombX
  const dy = charCenterY - bombY
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist > blastRadius) return
  if (p.state === 'shrapnel') return // Already exploded by another bomb

  const normalizedDist = Math.max(dist, 30) // Minimum distance to avoid infinite force
  const force = FORCE_MULTIPLIER / (normalizedDist * normalizedDist) * blastRadius

  const angle = Math.atan2(dy, dx)
  // Add some randomness
  const spread = (Math.random() - 0.5) * 0.8
  const finalAngle = angle + spread

  p.state = 'shrapnel'
  p.shrapnelStart = now
  p.vx = Math.cos(finalAngle) * force
  p.vy = Math.sin(finalAngle) * force - 100 - Math.random() * 150 // Upward kick
  p.angularVel = (Math.random() - 0.5) * 15
  p.opacity = 1
  p.cx = p.info.x
  p.cy = p.info.y
}

export function updateParticle(p: CharParticle, dt: number, now: number): void {
  if (p.state === 'shrapnel') {
    const elapsed = now - p.shrapnelStart

    // Physics
    p.vx *= AIR_RESISTANCE
    p.vy *= AIR_RESISTANCE
    p.vy += GRAVITY * dt
    p.cx += p.vx * dt
    p.cy += p.vy * dt
    p.rotation += p.angularVel * dt

    // Fade out over time
    const fadeStart = SHRAPNEL_DURATION * 0.5
    if (elapsed > fadeStart) {
      p.opacity = Math.max(0, 1 - (elapsed - fadeStart) / (SHRAPNEL_DURATION - fadeStart))
    }

    // Transition to reassembly
    if (elapsed >= SHRAPNEL_DURATION) {
      p.state = 'reassembling'
      p.reassembleStart = now
      p.reassembleFromX = p.cx
      p.reassembleFromY = p.cy
      p.reassembleFromRotation = p.rotation
      // Stagger based on distance from original position
      const dx = p.cx - p.info.x
      const dy = p.cy - p.info.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      p.reassembleDuration = REASSEMBLE_DURATION + Math.min(dist * 0.2, 300)
    }
  } else if (p.state === 'reassembling') {
    const elapsed = now - p.reassembleStart
    let t = Math.min(1, elapsed / p.reassembleDuration)

    // Elastic ease-out
    t = elasticEaseOut(t)

    p.cx = lerp(p.reassembleFromX, p.info.x, t)
    p.cy = lerp(p.reassembleFromY, p.info.y, t)
    p.rotation = lerp(p.reassembleFromRotation, 0, t)
    p.opacity = Math.min(1, 0.2 + t * 0.8)

    if (elapsed >= p.reassembleDuration) {
      p.state = 'rest'
      p.cx = p.info.x
      p.cy = p.info.y
      p.rotation = 0
      p.opacity = 1
      p.vx = 0
      p.vy = 0
      p.angularVel = 0
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function elasticEaseOut(t: number): number {
  if (t === 0 || t === 1) return t
  const p = 0.8
  return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1
}
