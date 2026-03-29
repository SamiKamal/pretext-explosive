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

/**
 * Detonate characters within blast radius. Uses AABB pre-filter to skip
 * expensive sqrt/atan2 for distant particles. Returns count of newly detonated.
 */
export function detonateChars(
  particles: CharParticle[],
  activeIndices: number[],
  bombX: number,
  bombY: number,
  blastRadius: number,
  now: number,
): number {
  let newlyDetonated = 0
  const blastRadiusSq = blastRadius * blastRadius

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]!
    if (p.state === 'shrapnel') continue // Already exploded

    const charCenterX = p.info.x + p.info.width / 2
    const charCenterY = p.info.y
    const dx = charCenterX - bombX
    const dy = charCenterY - bombY

    // AABB pre-filter — skip particles clearly outside blast radius
    // Uses Manhattan-style check which is cheaper than sqrt
    if (dx > blastRadius || dx < -blastRadius || dy > blastRadius || dy < -blastRadius) continue

    // Squared distance check — avoids sqrt for particles in AABB but outside circle
    const distSq = dx * dx + dy * dy
    if (distSq > blastRadiusSq) continue

    const dist = Math.sqrt(distSq)
    const normalizedDist = Math.max(dist, 30)
    const force = FORCE_MULTIPLIER / (normalizedDist * normalizedDist) * blastRadius

    const angle = Math.atan2(dy, dx)
    const spread = (Math.random() - 0.5) * 0.8
    const finalAngle = angle + spread

    const wasRest = p.state === 'rest'
    p.state = 'shrapnel'
    p.shrapnelStart = now
    p.vx = Math.cos(finalAngle) * force
    p.vy = Math.sin(finalAngle) * force - 100 - Math.random() * 150
    p.angularVel = (Math.random() - 0.5) * 15
    p.opacity = 1
    p.cx = p.info.x
    p.cy = p.info.y

    if (wasRest) {
      activeIndices.push(i)
    }
    newlyDetonated++
  }

  return newlyDetonated
}

/**
 * Update only active particles. Returns true if any particle transitioned to rest.
 */
export function updateActiveParticles(
  particles: CharParticle[],
  activeIndices: number[],
  dt: number,
  now: number,
): boolean {
  let anyReturnedToRest = false
  let write = 0

  for (let i = 0; i < activeIndices.length; i++) {
    const idx = activeIndices[i]!
    const p = particles[idx]!

    if (p.state === 'shrapnel') {
      const elapsed = now - p.shrapnelStart

      p.vx *= AIR_RESISTANCE
      p.vy *= AIR_RESISTANCE
      p.vy += GRAVITY * dt
      p.cx += p.vx * dt
      p.cy += p.vy * dt
      p.rotation += p.angularVel * dt

      const fadeStart = SHRAPNEL_DURATION * 0.5
      if (elapsed > fadeStart) {
        p.opacity = Math.max(0, 1 - (elapsed - fadeStart) / (SHRAPNEL_DURATION - fadeStart))
      }

      if (elapsed >= SHRAPNEL_DURATION) {
        p.state = 'reassembling'
        p.reassembleStart = now
        p.reassembleFromX = p.cx
        p.reassembleFromY = p.cy
        p.reassembleFromRotation = p.rotation
        const rdx = p.cx - p.info.x
        const rdy = p.cy - p.info.y
        const dist = Math.sqrt(rdx * rdx + rdy * rdy)
        p.reassembleDuration = REASSEMBLE_DURATION + Math.min(dist * 0.2, 300)
      }

      activeIndices[write++] = idx
    } else if (p.state === 'reassembling') {
      const elapsed = now - p.reassembleStart
      let t = Math.min(1, elapsed / p.reassembleDuration)

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
        anyReturnedToRest = true
        // Don't write to activeIndices — particle is no longer active
      } else {
        activeIndices[write++] = idx
      }
    }
    // rest state: should not be in activeIndices, but just in case — skip
  }

  activeIndices.length = write
  return anyReturnedToRest
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function elasticEaseOut(t: number): number {
  if (t === 0 || t === 1) return t
  const p = 0.8
  return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1
}
