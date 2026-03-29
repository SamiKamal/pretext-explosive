export type BombState = 'fuse' | 'detonating' | 'done'

export type Bomb = {
  x: number
  y: number
  state: BombState
  fuseStart: number
  fuseDuration: number
  detonateTime: number
  blastRadius: number
  blastWaveRadius: number
  blastWaveMaxRadius: number
  blastWaveDuration: number
}

const FUSE_DURATION = 1500
const BLAST_RADIUS = 250
const BLAST_WAVE_MAX_RADIUS = 400
const BLAST_WAVE_DURATION = 500

export function createBomb(x: number, y: number, now: number): Bomb {
  return {
    x,
    y,
    state: 'fuse',
    fuseStart: now,
    fuseDuration: FUSE_DURATION,
    detonateTime: 0,
    blastRadius: BLAST_RADIUS,
    blastWaveRadius: 0,
    blastWaveMaxRadius: BLAST_WAVE_MAX_RADIUS,
    blastWaveDuration: BLAST_WAVE_DURATION,
  }
}

export function updateBomb(bomb: Bomb, now: number): void {
  if (bomb.state === 'fuse') {
    if (now - bomb.fuseStart >= bomb.fuseDuration) {
      bomb.state = 'detonating'
      bomb.detonateTime = now
    }
  } else if (bomb.state === 'detonating') {
    const elapsed = now - bomb.detonateTime
    bomb.blastWaveRadius = (elapsed / bomb.blastWaveDuration) * bomb.blastWaveMaxRadius
    if (elapsed >= bomb.blastWaveDuration) {
      bomb.state = 'done'
    }
  }
}

export function drawBomb(ctx: CanvasRenderingContext2D, bomb: Bomb, now: number): void {
  if (bomb.state === 'fuse') {
    const elapsed = now - bomb.fuseStart
    const progress = elapsed / bomb.fuseDuration
    const pulse = 1 + 0.3 * Math.sin(elapsed * 0.02)

    // Bomb body
    const radius = 14 * pulse
    ctx.beginPath()
    ctx.arc(bomb.x, bomb.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = '#1a1a1a'
    ctx.fill()
    ctx.strokeStyle = '#ff4400'
    ctx.lineWidth = 2.5
    ctx.stroke()

    // Fuse line
    const fuseLen = 20 * (1 - progress)
    const fuseAngle = -Math.PI / 4
    const fx = bomb.x + Math.cos(fuseAngle) * radius
    const fy = bomb.y + Math.sin(fuseAngle) * radius
    const fex = fx + Math.cos(fuseAngle) * fuseLen
    const fey = fy + Math.sin(fuseAngle) * fuseLen
    ctx.beginPath()
    ctx.moveTo(fx, fy)
    ctx.lineTo(fex, fey)
    ctx.strokeStyle = '#ff8800'
    ctx.lineWidth = 2
    ctx.stroke()

    // Fuse spark
    if (fuseLen > 1) {
      const sparkSize = 4 + Math.random() * 4
      ctx.beginPath()
      ctx.arc(fex, fey, sparkSize, 0, Math.PI * 2)
      const grad = ctx.createRadialGradient(fex, fey, 0, fex, fey, sparkSize)
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(0.4, '#ffcc00')
      grad.addColorStop(1, 'rgba(255, 68, 0, 0)')
      ctx.fillStyle = grad
      ctx.fill()
    }

    // Countdown glow
    const glowRadius = 30 * pulse
    const glow = ctx.createRadialGradient(bomb.x, bomb.y, radius, bomb.x, bomb.y, glowRadius)
    glow.addColorStop(0, `rgba(255, 68, 0, ${0.3 * pulse})`)
    glow.addColorStop(1, 'rgba(255, 68, 0, 0)')
    ctx.beginPath()
    ctx.arc(bomb.x, bomb.y, glowRadius, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()
  } else if (bomb.state === 'detonating') {
    const elapsed = now - bomb.detonateTime
    const progress = elapsed / bomb.blastWaveDuration

    // Flash at detonation start
    if (progress < 0.15) {
      const flashAlpha = 1 - progress / 0.15
      const flashRadius = 60 * (progress / 0.15)
      const flash = ctx.createRadialGradient(bomb.x, bomb.y, 0, bomb.x, bomb.y, flashRadius)
      flash.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`)
      flash.addColorStop(0.5, `rgba(255, 200, 50, ${flashAlpha * 0.7})`)
      flash.addColorStop(1, `rgba(255, 68, 0, 0)`)
      ctx.beginPath()
      ctx.arc(bomb.x, bomb.y, flashRadius, 0, Math.PI * 2)
      ctx.fillStyle = flash
      ctx.fill()
    }

    // Blast wave ring
    if (progress < 1) {
      const waveRadius = bomb.blastWaveRadius
      const ringWidth = 30 * (1 - progress * 0.5)
      const alpha = 0.6 * (1 - progress)

      ctx.beginPath()
      ctx.arc(bomb.x, bomb.y, waveRadius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255, 140, 0, ${alpha})`
      ctx.lineWidth = ringWidth
      ctx.stroke()

      // Inner glow
      const innerGlow = ctx.createRadialGradient(
        bomb.x, bomb.y, Math.max(0, waveRadius - ringWidth),
        bomb.x, bomb.y, waveRadius
      )
      innerGlow.addColorStop(0, 'rgba(255, 200, 50, 0)')
      innerGlow.addColorStop(0.5, `rgba(255, 140, 0, ${alpha * 0.3})`)
      innerGlow.addColorStop(1, 'rgba(255, 68, 0, 0)')
      ctx.beginPath()
      ctx.arc(bomb.x, bomb.y, waveRadius, 0, Math.PI * 2)
      ctx.fillStyle = innerGlow
      ctx.fill()
    }
  }
}
