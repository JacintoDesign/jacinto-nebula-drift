import { create } from 'zustand'
import { LANDMARKS } from '../data/world'
import { playBack, playConfirm, setMuted, startAmbience } from '../audio/ambience'

export type Phase = 'loading' | 'intro' | 'flying'
export type Zone = 'nebula' | 'void'
export type VoidMode = 'warp' | 'combat' | 'results'
export type Cinematic = 'about' | 'contact' | null

/** Length of one asteroid round, seconds. */
export const ROUND_SECONDS = 60
const SCORE_KEY = 'nebula-drift-scores'

function loadScores(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SCORE_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((n) => typeof n === 'number').slice(0, 3) : []
  } catch {
    return []
  }
}

interface GameState {
  phase: Phase
  zone: Zone
  voidMode: VoidMode
  /** Open project card (project id). */
  overlay: string | null
  cinematic: Cinematic
  /** Autopilot destination: a landmark id or 'gateway'. */
  autopilot: string | null
  /** Station the ship is hovering in front of, controls locked. */
  hold: string | null
  /** Station currently within dock range. */
  near: string | null
  hovered: string | null
  visited: string[]
  photo: boolean
  sound: boolean
  reducedMotion: boolean
  touch: boolean
  /** Bumped to trigger the warp flash. */
  flash: number
  score: number
  timeLeft: number
  lastScore: number
  highScores: number[]

  launch: () => void
  setPhase: (p: Phase) => void
  setZone: (z: Zone) => void
  travelTo: (id: string) => void
  cancelAutopilot: () => void
  arrive: (id: string) => void
  dock: (id: string) => void
  closeOverlay: () => void
  release: () => void
  openCinematic: (c: Exclude<Cinematic, null>) => void
  closeCinematic: () => void
  setNear: (id: string | null) => void
  setHovered: (id: string | null) => void
  togglePhoto: () => void
  toggleSound: () => void
  triggerFlash: () => void
  startRound: () => void
  addScore: (n: number) => void
  tickRound: (dt: number) => void
  endRound: () => void
  exitCombat: () => void
  escape: () => void
}

/** Next station worth visiting: first unvisited in roster order, else the first. */
export function nextStation(visited: string[]): string {
  return (LANDMARKS.find((l) => !visited.includes(l.id)) ?? LANDMARKS[0]).id
}

export const useGame = create<GameState>()((set, get) => ({
  phase: 'loading',
  zone: 'nebula',
  voidMode: 'warp',
  overlay: null,
  cinematic: null,
  autopilot: null,
  hold: null,
  near: null,
  hovered: null,
  visited: [],
  photo: false,
  sound: false,
  reducedMotion:
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  touch: typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  flash: 0,
  score: 0,
  timeLeft: ROUND_SECONDS,
  lastScore: 0,
  highScores: loadScores(),

  launch: () => set({ phase: get().reducedMotion ? 'flying' : 'intro' }),
  setPhase: (phase) => set({ phase }),
  setZone: (zone) => set({ zone, voidMode: 'warp' }),

  travelTo: (id) => {
    const s = get()
    if (s.phase !== 'flying') set({ phase: 'flying' })
    set({ overlay: null, cinematic: null, hold: null, autopilot: id, photo: false })
  },
  cancelAutopilot: () => set({ autopilot: null }),
  arrive: (id) => set({ autopilot: null, hold: id }),
  dock: (id) => {
    playConfirm()
    navigator.vibrate?.(18)
    set((s) => ({
      overlay: id,
      hold: id,
      autopilot: null,
      visited: s.visited.includes(id) ? s.visited : [...s.visited, id],
    }))
  },
  closeOverlay: () => {
    if (!get().overlay) return
    playBack()
    set({ overlay: null })
  },
  release: () => set({ hold: null, overlay: null, autopilot: null }),

  openCinematic: (cinematic) => {
    if (get().phase !== 'flying') set({ phase: 'flying' })
    set({ cinematic, overlay: null, hold: null, autopilot: null, photo: false })
  },
  closeCinematic: () => {
    if (!get().cinematic) return
    playBack()
    get().travelTo(nextStation(get().visited))
  },

  setNear: (near) => set({ near }),
  setHovered: (hovered) => set({ hovered }),
  togglePhoto: () => set((s) => ({ photo: !s.photo })),
  toggleSound: () => {
    const sound = !get().sound
    if (sound) startAmbience()
    setMuted(!sound)
    set({ sound })
  },
  triggerFlash: () => set((s) => ({ flash: s.flash + 1 })),

  startRound: () => set({ voidMode: 'combat', score: 0, timeLeft: ROUND_SECONDS }),
  addScore: (n) => set((s) => ({ score: s.score + n })),
  tickRound: (dt) => {
    const t = get().timeLeft - dt
    if (t <= 0) get().endRound()
    else set({ timeLeft: t })
  },
  endRound: () => {
    const { score, highScores } = get()
    const next = [...highScores, score]
      .filter((n) => n > 0)
      .sort((a, b) => b - a)
      .slice(0, 3)
    try {
      localStorage.setItem(SCORE_KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable */
    }
    set({ voidMode: 'results', lastScore: score, highScores: next, timeLeft: 0 })
  },
  exitCombat: () => set({ voidMode: 'warp' }),

  /** Esc: back out of whatever is frontmost. */
  escape: () => {
    const s = get()
    if (s.photo) set({ photo: false })
    else if (s.overlay) s.closeOverlay()
    else if (s.cinematic) s.closeCinematic()
    else if (s.voidMode === 'results') s.exitCombat()
    else if (s.hold) s.release()
    else if (s.autopilot) s.cancelAutopilot()
  },
}))

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __game: typeof useGame }).__game = useGame
}
