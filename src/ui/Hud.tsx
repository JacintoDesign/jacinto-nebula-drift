import { useEffect, useRef, useState } from 'react'
import { projectById } from '../data/projects'
import { LANDMARKS, PLANETS, WORLD } from '../data/world'
import { useGame } from '../store/useGame'
import { input, ship, useShip } from '../store/useShip'

const RANGE = 150

/** Top-down sector scope, ship-up. Drawn at a low rate on a small canvas. */
function Radar() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const S = 168
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = cv.height = S * dpr
    const c = cv.getContext('2d')!
    const draw = () => {
      const g = useGame.getState()
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      c.clearRect(0, 0, S, S)
      const R = S / 2 - 6
      c.save()
      c.translate(S / 2, S / 2)
      c.beginPath()
      c.arc(0, 0, R, 0, Math.PI * 2)
      c.fillStyle = 'rgba(6,9,20,0.55)'
      c.fill()
      c.clip()
      c.strokeStyle = 'rgba(255,255,255,0.1)'
      c.lineWidth = 1
      for (const k of [0.33, 0.66]) {
        c.beginPath()
        c.arc(0, 0, R * k, 0, Math.PI * 2)
        c.stroke()
      }
      c.beginPath()
      c.moveTo(-R, 0)
      c.lineTo(R, 0)
      c.moveTo(0, -R)
      c.lineTo(0, R)
      c.stroke()
      // Rotate the world so the ship's nose is up.
      const cos = Math.cos(ship.yaw)
      const sin = Math.sin(ship.yaw)
      const plot = (x: number, z: number) => {
        const dx = x - ship.pos.x
        const dz = z - ship.pos.z
        let px = (dx * cos - dz * sin) / RANGE
        let py = (dx * sin + dz * cos) / RANGE
        const len = Math.hypot(px, py)
        const edge = len > 0.94
        if (edge) {
          px = (px / len) * 0.94
          py = (py / len) * 0.94
        }
        return [px * R, py * R, edge] as const
      }
      if (g.zone === 'nebula') {
        for (const l of LANDMARKS) {
          const [x, y, edge] = plot(l.position[0], l.position[2])
          c.fillStyle = l.color
          c.globalAlpha = edge ? 0.55 : 1
          c.beginPath()
          c.arc(x, y, g.autopilot === l.id ? 5 : 3.5, 0, Math.PI * 2)
          c.fill()
          if (g.visited.includes(l.id)) {
            c.strokeStyle = l.color
            c.beginPath()
            c.arc(x, y, 6.5, 0, Math.PI * 2)
            c.stroke()
          }
        }
      }
      c.globalAlpha = 1
      const [gx, gy] = plot(WORLD.gateway.position[0], WORLD.gateway.position[2])
      c.strokeStyle = '#c9d6ff'
      c.lineWidth = 2
      c.beginPath()
      c.ellipse(gx, gy, 9, 4, ship.yaw, 0, Math.PI * 2)
      c.stroke()
      // Ship.
      c.fillStyle = '#ffffff'
      c.beginPath()
      c.moveTo(0, -7)
      c.lineTo(5, 6)
      c.lineTo(0, 3)
      c.lineTo(-5, 6)
      c.closePath()
      c.fill()
      c.restore()
      c.strokeStyle = 'rgba(255,255,255,0.28)'
      c.lineWidth = 1
      c.beginPath()
      c.arc(S / 2, S / 2, R, 0, Math.PI * 2)
      c.stroke()
    }
    draw()
    const id = window.setInterval(draw, 66)
    return () => window.clearInterval(id)
  }, [])
  return <canvas ref={ref} className="radar" aria-hidden />
}

const fmtTime = (t: number) => {
  const s = Math.max(0, Math.ceil(t))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** First-flight control hints; fade once the pilot has actually flown. */
function Hints() {
  const [gone, setGone] = useState(false)
  useEffect(() => {
    let moved = 0
    const id = window.setInterval(() => {
      if (input.thrust) moved += 0.25
      if (moved > 2.5) setGone(true)
    }, 250)
    const t = window.setTimeout(() => setGone(true), 30000)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(t)
    }
  }, [])
  if (gone) return null
  return (
    <div className="hints">
      <span>
        <kbd>W</kbd> thrust
      </span>
      <span>
        <kbd>A</kbd>
        <kbd>D</kbd> turn
      </span>
      <span>
        <kbd>↑</kbd>
        <kbd>↓</kbd> pitch
      </span>
      <span>
        <kbd>Shift</kbd> boost
      </span>
      <span>Drag to look · click a station or planet to travel</span>
    </div>
  )
}

export function Hud() {
  const zone = useGame((s) => s.zone)
  const voidMode = useGame((s) => s.voidMode)
  const autopilot = useGame((s) => s.autopilot)
  const hold = useGame((s) => s.hold)
  const overlay = useGame((s) => s.overlay)
  const near = useGame((s) => s.near)
  const cinematic = useGame((s) => s.cinematic)
  const score = useGame((s) => s.score)
  const timeLeft = useGame((s) => s.timeLeft)
  const touch = useGame((s) => s.touch)
  const speed = useShip((s) => s.speed)
  const boost = useShip((s) => s.boost)
  const assist = useShip((s) => s.assist)
  const { dock, release, startRound, exitCombat, cancelAutopilot } = useGame.getState()

  if (cinematic) return null
  const holdProject = hold ? projectById(hold) : undefined
  const nearProject = near ? projectById(near) : undefined
  const target =
    autopilot === 'gateway'
      ? 'Gateway'
      : autopilot
        ? (projectById(autopilot)?.title ?? PLANETS.find((p) => p.id === autopilot)?.name)
        : null

  return (
    <div className="hud" data-dim={!!overlay}>
      {!touch && !hold && !autopilot && zone === 'nebula' && <Hints />}

      <div className="hud__left">
        <Radar />
        <p className="hud__zone">{zone === 'nebula' ? 'Nebula sector' : 'The void'}</p>
      </div>

      <div className="hud__right">
        <div className="hud__status">
          {target && (
            <button className="chip chip--live" onClick={cancelAutopilot}>
              Autopilot → {target} <i>✕</i>
            </button>
          )}
          {assist && <span className="chip">Attitude assist</span>}
          {boost && <span className="chip chip--hot">Boost</span>}
        </div>
        <div className="hud__speed">
          <b>{String(speed).padStart(2, '0')}</b>
          <span>m/s</span>
        </div>
        <div className="hud__bar">
          <i style={{ transform: `scaleX(${Math.min(1, speed / 52)})` }} />
        </div>
      </div>

      {/* Void: warp prompt and the round scoreboard */}
      {zone === 'void' && voidMode === 'warp' && !autopilot && (
        <div className="hud__top">
          <button className="chip chip--action" onClick={startRound}>
            {!touch && <kbd>B</kbd>} Drop out of warp · shoot asteroids
          </button>
        </div>
      )}
      {zone === 'void' && voidMode === 'combat' && (
        <div className="hud__top">
          <div className="score panel">
            <div>
              <small>Score</small>
              <b>{score}</b>
            </div>
            <div data-low={timeLeft < 10}>
              <small>Time</small>
              <b>{fmtTime(timeLeft)}</b>
            </div>
            <button className="score__quit" onClick={exitCombat} aria-label="End round and return to warp">
              ✕
            </button>
          </div>
          {!touch && (
            <p className="hud__tip">
              <kbd>Space</kbd> fire
            </p>
          )}
        </div>
      )}

      {/* Station prompts */}
      {holdProject && !overlay && (
        <div className="prompt panel" style={{ ['--c' as string]: holdProject.color }}>
          <div className="prompt__text">
            <p className="eyebrow">Holding at station</p>
            <h2>{holdProject.title}</h2>
            <p>{holdProject.tagline}</p>
          </div>
          <div className="prompt__actions">
            <button className="btn btn--primary" onClick={() => dock(holdProject.id)}>
              Dock {!touch && <kbd>E</kbd>}
            </button>
            <button className="btn" onClick={release}>
              Return to free roam {!touch && <kbd>Esc</kbd>}
            </button>
          </div>
        </div>
      )}
      {nearProject && !hold && !autopilot && !overlay && (
        <div className="hud__near" style={{ ['--c' as string]: nearProject.color }}>
          <button className="chip chip--action" onClick={() => dock(nearProject.id)}>
            {!touch && <kbd>E</kbd>} Dock at {nearProject.title}
          </button>
        </div>
      )}
    </div>
  )
}
