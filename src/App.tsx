import { Suspense, lazy, useCallback, useEffect } from 'react'
import { projectById } from './data/projects'
import { Experience } from './scene/Experience'
import { useGame } from './store/useGame'
import { input, placeAtStation } from './store/useShip'
import { Fallback, SceneBoundary } from './ui/SceneBoundary'
import { UI } from './ui/UI'

const params = new URLSearchParams(window.location.search)
const STATION_LAB = import.meta.env.DEV && params.has('station-lab')
const COMBAT_LAB = import.meta.env.DEV && params.has('combat-lab')
const StationLab = import.meta.env.DEV ? lazy(() => import('./dev/StationLab')) : null

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/** Open whatever the URL hash names. Returns true if it named something. */
function applyHash(id = window.location.hash.slice(1)): boolean {
  const g = useGame.getState()
  if (id === 'about' || id === 'contact') {
    if (g.cinematic !== id) g.openCinematic(id)
    return true
  }
  if (projectById(id)) {
    if (g.overlay === id) return true
    if (g.zone !== 'nebula') g.setZone('nebula')
    useGame.setState({ cinematic: null, autopilot: null })
    placeAtStation(id)
    g.setPhase('flying')
    g.dock(id)
    return true
  }
  return false
}

const KEYS: Record<string, () => void> = {
  KeyE: () => {
    const g = useGame.getState()
    const id = g.hold ?? g.near
    if (id && !g.overlay && !g.cinematic) g.dock(id)
  },
  KeyP: () => useGame.getState().togglePhoto(),
  KeyB: () => {
    const g = useGame.getState()
    if (g.zone !== 'void' || g.cinematic || g.autopilot) return
    if (g.voidMode === 'combat') g.exitCombat()
    else g.startRound()
  },
  Escape: () => useGame.getState().escape(),
}

function useKeyboard() {
  useEffect(() => {
    const held = new Set<string>()
    const sync = () => {
      input.thrust = held.has('KeyW')
      input.brake = held.has('KeyS')
      input.boost = held.has('ShiftLeft') || held.has('ShiftRight')
      input.fire = held.has('Space')
      input.yaw = (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0) - (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0)
      input.pitch = (held.has('ArrowUp') ? 1 : 0) - (held.has('ArrowDown') ? 1 : 0)
    }
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
    }
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        KEYS.Escape()
        return
      }
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return
      if (useGame.getState().phase !== 'flying') return
      if (e.code === 'Enter' && (e.target as HTMLElement)?.tagName === 'BUTTON') return
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault()
      if (!e.repeat) (e.code === 'Enter' ? KEYS.KeyE : KEYS[e.code])?.()
      held.add(e.code)
      sync()
    }
    const up = (e: KeyboardEvent) => {
      held.delete(e.code)
      sync()
    }
    const clear = () => {
      held.clear()
      sync()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])
}

/** Keep the URL hash in step with the open project or cinematic, and follow manual hash edits. */
function useHashSync() {
  useEffect(() => {
    const unsub = useGame.subscribe((s) => {
      if (s.phase !== 'flying') return
      const want = s.overlay ?? s.cinematic ?? ''
      if (want === window.location.hash.slice(1)) return
      const url = want ? `#${want}` : window.location.pathname + window.location.search
      window.history.replaceState(null, '', url)
    })
    const onHash = () => {
      if (useGame.getState().phase === 'flying') applyHash()
    }
    window.addEventListener('hashchange', onHash)
    return () => {
      unsub()
      window.removeEventListener('hashchange', onHash)
    }
  }, [])
}

function Game() {
  useKeyboard()
  useHashSync()

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => useGame.setState({ reducedMotion: mq.matches })
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // Hybrid devices: the first real touch switches the interface to touch controls.
  useEffect(() => {
    const on = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && !useGame.getState().touch) useGame.setState({ touch: true })
    }
    window.addEventListener('pointerdown', on)
    return () => window.removeEventListener('pointerdown', on)
  }, [])

  useEffect(() => {
    if (!COMBAT_LAB) return
    // Dev: start straight in an untimed asteroid round.
    const g = useGame.getState()
    g.setPhase('flying')
    g.setZone('void')
    g.startRound()
  }, [])

  const launch = useCallback(() => {
    const g = useGame.getState()
    // A deep link skips the fly-in and opens straight onto its target.
    const id = window.location.hash.slice(1)
    if (id && (id === 'about' || id === 'contact' || projectById(id))) {
      g.setPhase('flying')
      applyHash(id)
      return
    }
    g.launch()
  }, [])

  return (
    <SceneBoundary>
      <Experience endlessCombat={COMBAT_LAB} />
      <UI onLaunch={launch} />
    </SceneBoundary>
  )
}

export default function App() {
  if (STATION_LAB && StationLab) {
    return (
      <Suspense fallback={null}>
        <StationLab />
      </Suspense>
    )
  }
  if (!hasWebGL()) return <Fallback />
  return <Game />
}
