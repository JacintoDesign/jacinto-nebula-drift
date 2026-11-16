import type { PointerEvent as RPointerEvent, ReactNode } from 'react'
import { useGame } from '../store/useGame'
import { input } from '../store/useShip'

function Hold({
  className,
  label,
  on,
  off,
  children,
}: {
  className: string
  label: string
  on: () => void
  off: () => void
  children: ReactNode
}) {
  const down = (e: RPointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.dataset.down = 'true'
    on()
  }
  const up = (e: RPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.dataset.down = 'false'
    off()
  }
  return (
    <button
      className={className}
      aria-label={label}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  )
}

const Arrow = ({ r }: { r: number }) => (
  <svg viewBox="0 0 24 24" style={{ transform: `rotate(${r}deg)` }} aria-hidden>
    <path d="M12 6l7 10H5z" fill="currentColor" />
  </svg>
)

/** Touch flight controls: d-pad to steer, THRUST and BOOST to drive, FIRE in a round. */
export function MobileControls() {
  const touch = useGame((s) => s.touch)
  const locked = useGame((s) => !!s.hold || !!s.overlay || !!s.cinematic)
  const combat = useGame((s) => s.zone === 'void' && s.voidMode === 'combat')
  if (!touch || locked) return null
  return (
    <div className="pad">
      <div className="pad__dpad">
        <Hold className="pad__btn pad__up" label="Pitch up" on={() => (input.pitch = 1)} off={() => (input.pitch = 0)}>
          <Arrow r={0} />
        </Hold>
        <Hold className="pad__btn pad__left" label="Turn left" on={() => (input.yaw = 1)} off={() => (input.yaw = 0)}>
          <Arrow r={-90} />
        </Hold>
        <Hold className="pad__btn pad__right" label="Turn right" on={() => (input.yaw = -1)} off={() => (input.yaw = 0)}>
          <Arrow r={90} />
        </Hold>
        <Hold className="pad__btn pad__down" label="Pitch down" on={() => (input.pitch = -1)} off={() => (input.pitch = 0)}>
          <Arrow r={180} />
        </Hold>
      </div>
      <div className="pad__actions">
        {combat && (
          <Hold className="pad__btn pad__fire" label="Fire" on={() => (input.fire = true)} off={() => (input.fire = false)}>
            FIRE
          </Hold>
        )}
        <Hold className="pad__btn pad__brake" label="Brake" on={() => (input.brake = true)} off={() => (input.brake = false)}>
          BRAKE
        </Hold>
        <Hold
          className="pad__btn pad__boost"
          label="Boost"
          on={() => {
            input.thrust = true
            input.boost = true
          }}
          off={() => {
            input.thrust = false
            input.boost = false
          }}
        >
          BOOST
        </Hold>
        <Hold className="pad__btn pad__thrust" label="Thrust" on={() => (input.thrust = true)} off={() => (input.thrust = false)}>
          THRUST
        </Hold>
      </div>
    </div>
  )
}
