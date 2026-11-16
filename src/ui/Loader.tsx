import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { PROJECTS } from '../data/projects'
import { useGame } from '../store/useGame'

/**
 * Title screen over the live scene. Launching never starts audio: sound is an
 * explicit opt-in from the nav.
 */
export function Loader({ onLaunch }: { onLaunch: () => void }) {
  const { progress, active } = useProgress()
  const touch = useGame((s) => s.touch)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (active) return
    const id = window.setTimeout(() => setSettled(true), 500)
    return () => window.clearTimeout(id)
  }, [active])

  const ready = settled && !active
  const pct = ready ? 100 : Math.min(99, Math.round(progress))

  return (
    <div className="loader" data-ready={ready}>
      <div className="loader__inner">
        <p className="eyebrow">Jacinto Design · Playable portfolio</p>
        <h1 className="loader__title">
          Nebula <span>Drift</span>
        </h1>
        <p className="loader__lede">
          I build for the web. Fly a ship through the nebula and dock at {PROJECTS.length} stations, one for each
          project.
        </p>
        <div className="loader__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <div className="loader__row">
          <button className="btn btn--primary" disabled={!ready} onClick={onLaunch}>
            {ready ? 'Launch' : `Loading ${pct}%`}
          </button>
          <span className="loader__keys">
            {touch ? 'D-pad steers · THRUST to fly · tap a station to travel' : 'W thrust · A/D turn · ↑/↓ pitch · Shift boost · drag to look'}
          </span>
        </div>
      </div>
    </div>
  )
}
