import { Component, type ReactNode } from 'react'
import { PROJECTS } from '../data/projects'
import { STUDIO } from '../data/studio'
import { asset } from '../data/asset'

/** Static mini-portfolio shown when the 3D scene cannot run. Never a blank screen. */
export function Fallback() {
  return (
    <main className="fallback">
      <header>
        <p className="eyebrow">Jacinto Design · Portfolio</p>
        <h1>{STUDIO.about.heading}</h1>
        <p>
          The playable 3D version needs WebGL, which isn't available in this browser. Everything it contains is
          below.
        </p>
      </header>
      <section aria-label="Projects" className="fallback__grid">
        {PROJECTS.map((p) => (
          <article key={p.id} style={{ ['--c' as string]: p.color }}>
            {p.image && <img src={asset(p.image)} alt="" loading="lazy" />}
            <p className="eyebrow">{p.meta}</p>
            <h2>{p.title}</h2>
            <p>{p.description}</p>
            <div className="card__links">
              {p.links.map((l) => (
                <a key={l.href} className="btn" href={l.href} target="_blank" rel="noreferrer">
                  {l.label} ↗
                </a>
              ))}
            </div>
          </article>
        ))}
      </section>
      <section aria-label="About" className="fallback__about">
        <h2>About</h2>
        {STUDIO.about.body.map((b) => (
          <p key={b.slice(0, 24)}>{b}</p>
        ))}
        <h2>Contact</h2>
        <ul className="socials">
          <li>
            <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a>
          </li>
          {STUDIO.socials.map((s) => (
            <li key={s.href}>
              <a href={s.href} target="_blank" rel="noreferrer">
                {s.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

/** Catches a scene crash (lost context, shader failure) and swaps in the fallback. */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error('Scene failed, showing the static portfolio.', error)
  }
  render() {
    return this.state.failed ? <Fallback /> : this.props.children
  }
}
