import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LANDMARKS, PLANETS, WORLD } from '../data/world'
import { useGame } from '../store/useGame'
import { ship } from '../store/useShip'

interface Target {
  id: string
  label: string
  color: string
  pos: THREE.Vector3
  gateway?: boolean
  /** Planet radius: planets only show a tag while on screen and far enough to need one. */
  planet?: number
}

const TARGETS: Target[] = [
  ...LANDMARKS.map((l) => ({
    id: l.id,
    label: l.sign,
    color: l.color,
    pos: new THREE.Vector3(l.position[0], l.position[1] + 4, l.position[2]),
  })),
  {
    id: 'gateway',
    label: 'GATEWAY',
    color: '#9db4ff',
    pos: new THREE.Vector3(...WORLD.gateway.position),
    gateway: true,
  },
  ...PLANETS.map((p) => ({
    id: p.id,
    label: p.name,
    color: p.atmosphere,
    pos: new THREE.Vector3(p.position[0], p.position[1] + p.radius * 1.05, p.position[2]),
    planet: p.radius,
  })),
]

const els = new Map<string, HTMLButtonElement>()
const v = new THREE.Vector3()
const placed: { x: number; y: number }[] = []

/**
 * Runs inside the canvas: projects every station and the gateway to the
 * screen and positions its DOM marker. Off-screen targets clamp to the edge
 * as arrows; distant on-screen ones get a small tag.
 */
export function Markers() {
  useFrame((state) => {
    const g = useGame.getState()
    const { width, height } = state.size
    const show = g.phase === 'flying' && !g.cinematic && !g.photo && !(g.overlay && width < 900)
    const mx = Math.min(64, width * 0.09)
    // Keep markers clear of the project card on wide screens.
    const right = g.overlay && width >= 900 ? Math.min(520, width * 0.4) : mx
    placed.length = 0
    const narrow = width < 900
    const top = narrow ? 186 : 84
    const bottom = narrow ? (g.hold ? 300 : 200) : g.hold ? 150 : 70
    for (const t of TARGETS) {
      const el = els.get(t.id)
      if (!el) continue
      const hidden = !show || (!t.gateway && g.zone !== 'nebula') || g.hold === t.id || (!!t.planet && !!g.hold)
      if (hidden) {
        el.style.display = 'none'
        continue
      }
      v.copy(t.pos).project(state.camera)
      const behind = v.z > 1
      let x = (v.x * 0.5 + 0.5) * width
      let y = (-v.y * 0.5 + 0.5) * height
      const on = !behind && x > mx && x < width - right && y > top && y < height - bottom
      const dist = ship.pos.distanceTo(t.pos)
      if (t.planet && (!on || dist < t.planet * 2.2)) {
        el.style.display = 'none'
        continue
      }
      if (on) {
        // Near stations speak for themselves through their sign and hologram.
        if (dist < (t.gateway ? 150 : 70)) {
          el.style.display = 'none'
          continue
        }
        el.dataset.mode = 'tag'
      } else {
        // Clamp along the ray from screen centre to the target.
        let dx = x - width / 2
        let dy = y - height / 2
        if (behind) {
          dx = -dx
          dy = -dy
        }
        if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) dy = 1
        const hx = dx < 0 ? width / 2 - mx : width / 2 - right
        const hyTop = height / 2 - top
        const hyBot = height / 2 - bottom
        const k = Math.min(hx / Math.max(Math.abs(dx), 1e-3), (dy < 0 ? hyTop : hyBot) / Math.max(Math.abs(dy), 1e-3))
        x = width / 2 + dx * k
        y = height / 2 + dy * k
        // Nudge down past any marker already sitting at this spot on the edge.
        for (const p of placed) {
          if (Math.abs(p.x - x) < 70 && Math.abs(p.y - y) < 50) y = p.y + 50
        }
        placed.push({ x, y })
        el.dataset.mode = 'edge'
        el.style.setProperty('--rot', `${Math.atan2(dy, dx)}rad`)
      }
      el.style.display = ''
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      el.dataset.active = g.autopilot === t.id ? 'true' : 'false'
      const d = el.lastElementChild as HTMLElement | null
      if (d) d.textContent = `${Math.round(dist)} m`
    }
  })
  return null
}

/** DOM half of the markers: one clickable button per target. */
export function Waypoints() {
  const travelTo = useGame((s) => s.travelTo)
  const visited = useGame((s) => s.visited)
  return (
    <div className="waypoints">
      {TARGETS.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            if (el) els.set(t.id, el)
            else els.delete(t.id)
          }}
          className="waypoint"
          style={{ ['--c' as string]: t.color, display: 'none' }}
          data-visited={visited.includes(t.id)}
          data-planet={!!t.planet}
          onClick={() => travelTo(t.id)}
          aria-label={`Fly to ${t.label}`}
        >
          <span className="waypoint__arrow" aria-hidden />
          <span className="waypoint__name">{t.label}</span>
          <span className="waypoint__dist" />
        </button>
      ))}
    </div>
  )
}
