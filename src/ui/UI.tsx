import { useGame } from '../store/useGame'
import { Hud } from './Hud'
import { Loader } from './Loader'
import { MobileControls } from './MobileControls'
import { NavMenu } from './NavMenu'
import { AboutCinematic, ContactCinematic, ProjectOverlay, VoidResults } from './Panels'
import { Waypoints } from './Waypoints'

/** Warp flash on gateway transit; a soft dip instead under reduced motion. */
function Flash() {
  const flash = useGame((s) => s.flash)
  const calm = useGame((s) => s.reducedMotion)
  if (!flash) return null
  return <div key={flash} className="flash" data-calm={calm} aria-hidden />
}

/** All DOM chrome over the canvas. Photo mode hides everything but its own hint. */
export function UI({ onLaunch }: { onLaunch: () => void }) {
  const phase = useGame((s) => s.phase)
  const photo = useGame((s) => s.photo)
  const touch = useGame((s) => s.touch)
  return (
    <div className="ui" data-touch={touch}>
      <Flash />
      {phase === 'loading' && <Loader onLaunch={onLaunch} />}
      {phase === 'flying' && !photo && (
        <>
          <NavMenu />
          <Waypoints />
          <Hud />
          <MobileControls />
          <ProjectOverlay />
          <AboutCinematic />
          <ContactCinematic />
          <VoidResults />
        </>
      )}
      {photo && (
        <button className="photo-hint" onClick={() => useGame.getState().togglePhoto()}>
          {touch ? 'Photo mode · drag to frame · tap here to exit' : 'Photo mode · drag to frame · P, Esc or click here to exit'}
        </button>
      )}
    </div>
  )
}
