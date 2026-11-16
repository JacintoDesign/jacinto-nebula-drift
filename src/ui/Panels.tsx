import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PROJECTS, projectById } from '../data/projects'
import { FORMSUBMIT_ENDPOINT, STUDIO } from '../data/studio'
import { asset } from '../data/asset'
import { useGame } from '../store/useGame'

const pad = (n: number) => String(n).padStart(2, '0')

function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="close" onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <kbd>Esc</kbd>
    </button>
  )
}

/** Move focus into a panel when it opens, for keyboard and screen-reader users. */
function useFocusOnOpen<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [key])
  return ref
}

/** Project card, shown beside the docked station. */
export function ProjectOverlay() {
  const id = useGame((s) => s.overlay)
  const project = id ? projectById(id) : undefined
  const ref = useFocusOnOpen<HTMLElement>(id)
  if (!project) return null
  const { closeOverlay, travelTo } = useGame.getState()
  const index = PROJECTS.findIndex((p) => p.id === project.id)
  const next = PROJECTS[(index + 1) % PROJECTS.length]
  const prev = PROJECTS[(index - 1 + PROJECTS.length) % PROJECTS.length]

  return (
    <aside
      className="card panel"
      ref={ref}
      tabIndex={-1}
      aria-label={project.title}
      style={{ ['--c' as string]: project.color }}
      key={project.id}
    >
      <CloseButton onClick={closeOverlay} label="Close project" />
      <div className="card__scroll">
        <p className="eyebrow">
          <i className="dot" />
          {pad(index + 1)} / {pad(PROJECTS.length)} · {project.meta}
        </p>
        <h2 className="card__title">{project.title}</h2>
        <p className="card__tagline">{project.tagline}</p>
        <div className="card__media">
          {project.video ? (
            <video src={asset(project.video)} poster={project.image && asset(project.image)} autoPlay muted loop playsInline />
          ) : (
            project.image && <img src={asset(project.image)} alt={`${project.title} screenshot`} />
          )}
        </div>
        <p className="card__body">{project.description}</p>
        <ul className="tags" aria-label="Tech">
          {project.tech.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className="card__links">
          {project.links.map((l, i) => (
            <a key={l.href} className={i === 0 ? 'btn btn--primary' : 'btn'} href={l.href} target="_blank" rel="noreferrer">
              {l.label}
              <span aria-hidden>↗</span>
            </a>
          ))}
        </div>
      </div>
      <footer className="card__nav">
        <button onClick={() => travelTo(prev.id)}>
          <span aria-hidden>←</span> {prev.title}
        </button>
        <button onClick={() => travelTo(next.id)}>
          {next.title} <span aria-hidden>→</span>
        </button>
      </footer>
    </aside>
  )
}

/** About: copy on the left while the ship hangs in warp on the right. */
export function AboutCinematic() {
  const open = useGame((s) => s.cinematic === 'about')
  const ref = useFocusOnOpen<HTMLElement>(open)
  if (!open) return null
  const { about } = STUDIO
  return (
    <section className="cine cine--left panel" ref={ref} tabIndex={-1} aria-label="About">
      <CloseButton onClick={useGame.getState().closeCinematic} label="Close and return to the nebula" />
      <div className="cine__scroll">
        <p className="eyebrow">About me · {STUDIO.location}</p>
        <h2 className="cine__title">{about.heading}</h2>
        <p className="cine__role">Senior Developer at CBC · Instructor at Zero to Mastery</p>
        {about.body.map((p) => (
          <p key={p.slice(0, 24)} className="cine__body">
            {p}
          </p>
        ))}
        <dl className="stats">
          {about.stats.map((s) => (
            <div key={s.label}>
              <dt>{s.value}</dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
        <div className="courses">
          {about.courses.map((c) => (
            <a key={c.url} className="course" href={c.url} target="_blank" rel="noreferrer">
              <span className="eyebrow">{c.label}</span>
              <strong>{c.title}</strong>
              <span>{c.blurb}</span>
              <em>
                {c.linkLabel} <span aria-hidden>↗</span>
              </em>
            </a>
          ))}
        </div>
        <Socials />
      </div>
    </section>
  )
}

function Socials() {
  return (
    <ul className="socials">
      <li>
        <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a>
      </li>
      {STUDIO.socials.map((s) => (
        <li key={s.href}>
          <a href={s.href} target="_blank" rel="noreferrer">
            {s.label} <span aria-hidden>↗</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

type SendState = 'idle' | 'sending' | 'sent' | 'error'

/** Contact: the form on the right, ship on the left. */
export function ContactCinematic() {
  const open = useGame((s) => s.cinematic === 'contact')
  const ref = useFocusOnOpen<HTMLElement>(open)
  const [state, setState] = useState<SendState>('idle')
  if (!open) return null
  const { contact } = STUDIO

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>
    // Honeypot: bots fill it, people never see it.
    if (data._honey) return
    setState('sending')
    try {
      const res = await fetch(FORMSUBMIT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...data, _subject: `Nebula Drift: message from ${data.name}` }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setState('sent')
      form.reset()
    } catch {
      setState('error')
    }
  }

  return (
    <section className="cine cine--right panel" ref={ref} tabIndex={-1} aria-label="Contact">
      <CloseButton onClick={useGame.getState().closeCinematic} label="Close and return to the nebula" />
      <div className="cine__scroll">
        <p className="eyebrow">Contact · {STUDIO.location}</p>
        <h2 className="cine__title">{contact.heading}</h2>
        <p className="cine__body">{contact.body}</p>
        {state === 'sent' ? (
          <div className="form__done" role="status">
            <strong>Message sent.</strong>
            <span>Thanks for reaching out. I'll reply by email.</span>
            <button className="btn" onClick={() => setState('idle')}>
              Send another
            </button>
          </div>
        ) : (
          <form className="form" onSubmit={submit}>
            <input type="text" name="_honey" tabIndex={-1} autoComplete="off" className="form__honey" aria-hidden />
            <label>
              <span>Name</span>
              <input name="name" required autoComplete="name" />
            </label>
            <label>
              <span>Email</span>
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              <span>Message</span>
              <textarea name="message" rows={5} required />
            </label>
            <button className="btn btn--primary" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Send message'}
            </button>
            {state === 'error' && (
              <p className="form__error" role="alert">
                That didn't send. Try again, or email me at{' '}
                <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a>.
              </p>
            )}
          </form>
        )}
        <Socials />
      </div>
    </section>
  )
}

/** End of an asteroid round: score and the local top three. */
export function VoidResults() {
  const show = useGame((s) => s.zone === 'void' && s.voidMode === 'results' && !s.cinematic)
  const last = useGame((s) => s.lastScore)
  const scores = useGame((s) => s.highScores)
  const visited = useGame((s) => s.visited)
  if (!show) return null
  const { startRound, exitCombat, travelTo } = useGame.getState()
  const best = last > 0 && scores[0] === last
  const home = PROJECTS.find((p) => !visited.includes(p.id)) ?? PROJECTS[0]
  return (
    <div className="results panel" role="dialog" aria-label="Round results">
      <p className="eyebrow">{best ? 'New best' : 'Round over'}</p>
      <p className="results__score">{last}</p>
      <ol className="results__list">
        {[0, 1, 2].map((i) => (
          <li key={i} data-you={scores[i] === last && last > 0 && scores.indexOf(last) === i}>
            <span>{pad(i + 1)}</span>
            <b>{scores[i] ?? '—'}</b>
          </li>
        ))}
      </ol>
      <div className="results__actions">
        <button className="btn btn--primary" onClick={startRound}>
          Play again
        </button>
        <button className="btn" onClick={exitCombat}>
          Back to warp
        </button>
        <button className="btn" onClick={() => travelTo(home.id)}>
          Return to {home.title}
        </button>
      </div>
    </div>
  )
}
