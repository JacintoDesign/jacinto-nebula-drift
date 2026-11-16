import { useEffect, useRef, useState } from 'react'
import { PROJECTS } from '../data/projects'
import { useGame } from '../store/useGame'

const pad = (n: number) => String(n).padStart(2, '0')

/** Top navigation. Every project is reachable from here in two actions. */
export function NavMenu() {
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState(false)
  const root = useRef<HTMLElement>(null)
  const visited = useGame((s) => s.visited)
  const overlay = useGame((s) => s.overlay)
  const cinematic = useGame((s) => s.cinematic)
  const sound = useGame((s) => s.sound)
  const { travelTo, openCinematic, toggleSound, togglePhoto } = useGame.getState()

  // Any navigation (including autopilot arrivals and deep links) closes the menus.
  useEffect(() => {
    setOpen(false)
    setSheet(false)
  }, [overlay, cinematic])

  useEffect(() => {
    if (!open && !sheet) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false)
        setSheet(false)
      }
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setSheet(false)
      }
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', key)
    }
  }, [open, sheet])

  const go = (fn: () => void) => () => {
    setOpen(false)
    setSheet(false)
    fn()
  }

  const projectList = (
    <ul className="nav__projects" role="menu">
      {PROJECTS.map((p, i) => (
        <li key={p.id} role="none">
          <button
            role="menuitem"
            className="nav__project"
            style={{ ['--c' as string]: p.color }}
            data-current={overlay === p.id}
            onClick={go(() => travelTo(p.id))}
          >
            <span className="nav__num">{pad(i + 1)}</span>
            <span className="nav__ptitle">
              {p.title}
              <small>{p.meta}</small>
            </span>
            <span className="nav__state">{visited.includes(p.id) ? 'Visited' : 'Fly'}</span>
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <header className="nav" ref={root}>
      <a className="nav__brand" href="https://jacinto.design" target="_blank" rel="noreferrer">
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="3.2" fill="currentColor" />
          <ellipse cx="12" cy="12" rx="10.5" ry="4.2" fill="none" stroke="currentColor" strokeWidth="1.4" transform="rotate(-28 12 12)" />
        </svg>
        Jacinto Design
      </a>

      <nav className="nav__links" aria-label="Primary">
        <button data-current={cinematic === 'about'} onClick={go(() => openCinematic('about'))}>
          About
        </button>
        <div className="nav__drop">
          <button aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
            Projects
            <span className="nav__count">
              {visited.length}/{PROJECTS.length}
            </span>
          </button>
          {open && <div className="nav__menu panel">{projectList}</div>}
        </div>
        <button data-current={cinematic === 'contact'} onClick={go(() => openCinematic('contact'))}>
          Contact
        </button>
      </nav>

      <div className="nav__tools">
        <button className="icon-btn" aria-pressed={sound} onClick={toggleSound} title={sound ? 'Mute' : 'Turn sound on'}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
            {sound ? (
              <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="M15.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
          <span>{sound ? 'Sound on' : 'Sound off'}</span>
        </button>
        <button className="icon-btn nav__photo" onClick={togglePhoto} title="Photo mode (P)">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 8h3l1.5-2h7L17 8h3v10H4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <span>Photo</span>
        </button>
        <button className="icon-btn nav__burger" aria-expanded={sheet} aria-label="Menu" onClick={() => setSheet((s) => !s)}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d={sheet ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {sheet && (
        <div className="nav__sheet panel">
          <div className="nav__sheetrow">
            <button className="btn" onClick={go(() => openCinematic('about'))}>
              About
            </button>
            <button className="btn" onClick={go(() => openCinematic('contact'))}>
              Contact
            </button>
            <button className="btn nav__sheetwide" onClick={go(togglePhoto)}>
              Photo mode
            </button>
          </div>
          <p className="eyebrow">Projects</p>
          {projectList}
        </div>
      )}
    </header>
  )
}
