import * as THREE from 'three'

/**
 * Shared hull materials. One tiling panel texture drives colour variation,
 * roughness and bump so every structure reads as plated metal without
 * per-model textures.
 */
function panelTextures() {
  const s = 512
  const color = document.createElement('canvas')
  const bump = document.createElement('canvas')
  color.width = color.height = bump.width = bump.height = s
  const c = color.getContext('2d')!
  const b = bump.getContext('2d')!
  c.fillStyle = '#9a9a9a'
  c.fillRect(0, 0, s, s)
  b.fillStyle = '#808080'
  b.fillRect(0, 0, s, s)
  let seed = 7
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  // Recursive split into plates of uneven size.
  const split = (x: number, y: number, w: number, h: number, depth: number) => {
    if (depth > 0 && (w > 150 || h > 150 || rnd() > 0.35) && Math.min(w, h) > 44) {
      if (w > h) {
        const k = Math.round((w * (0.35 + rnd() * 0.3)) / 8) * 8
        split(x, y, k, h, depth - 1)
        split(x + k, y, w - k, h, depth - 1)
      } else {
        const k = Math.round((h * (0.35 + rnd() * 0.3)) / 8) * 8
        split(x, y, w, k, depth - 1)
        split(x, y + k, w, h - k, depth - 1)
      }
      return
    }
    const v = 120 + Math.floor(rnd() * 80)
    c.fillStyle = `rgb(${v},${v},${v + 4})`
    c.fillRect(x, y, w, h)
    const lift = 118 + Math.floor(rnd() * 40)
    b.fillStyle = `rgb(${lift},${lift},${lift})`
    b.fillRect(x, y, w, h)
    c.strokeStyle = 'rgba(0,0,0,0.75)'
    c.lineWidth = 2
    c.strokeRect(x + 1, y + 1, w - 2, h - 2)
    b.strokeStyle = '#101010'
    b.lineWidth = 3
    b.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3)
    // Occasional vents and rivet rows.
    if (rnd() > 0.6 && w > 50 && h > 30) {
      for (let i = 0; i < 4; i++) {
        c.fillStyle = 'rgba(0,0,0,0.55)'
        c.fillRect(x + 10, y + 9 + i * 6, Math.min(w - 20, 46), 2)
        b.fillStyle = '#303030'
        b.fillRect(x + 10, y + 9 + i * 6, Math.min(w - 20, 46), 2)
      }
    }
  }
  split(0, 0, s, s, 6)
  const make = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  return { map: make(color, true), bump: make(bump, false) }
}

let cached: ReturnType<typeof build> | null = null

function build() {
  const { map, bump } = panelTextures()
  const hull = (color: string, metalness: number, roughness: number) =>
    new THREE.MeshStandardMaterial({
      color,
      map,
      bumpMap: bump,
      bumpScale: 1.4,
      roughnessMap: map,
      metalness,
      roughness,
    })
  return {
    /** Dark gunmetal structure. */
    dark: hull('#3a4152', 0.85, 0.5),
    /** Mid grey plating. */
    mid: hull('#7c8698', 0.75, 0.55),
    /** Ceramic white accent panels. */
    light: hull('#e9edf5', 0.35, 0.6),
    /** Near-black trusses, frames and small hardware (untextured). */
    frame: new THREE.MeshStandardMaterial({ color: '#12151d', metalness: 0.9, roughness: 0.35 }),
    /** Blue-black photovoltaic cells. */
    solar: new THREE.MeshStandardMaterial({
      color: '#0b1d4a',
      metalness: 0.9,
      roughness: 0.22,
      emissive: '#0a2a80',
      emissiveIntensity: 0.25,
    }),
    /** Gold foil insulation. */
    foil: new THREE.MeshStandardMaterial({ color: '#c99a3c', metalness: 1, roughness: 0.32 }),
    /** Warm lit windows. */
    window: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 1.2), toneMapped: false }),
  }
}

export function hullMaterials() {
  return (cached ??= build())
}

/** Copy of a hull material whose panel texture repeats, for very large surfaces. */
export function tiled(base: THREE.MeshStandardMaterial, x: number, y: number) {
  const m = base.clone()
  for (const key of ['map', 'bumpMap', 'roughnessMap'] as const) {
    const t = base[key]?.clone()
    if (!t) continue
    t.repeat.set(x, y)
    t.needsUpdate = true
    m[key] = t
  }
  return m
}

const glowCache = new Map<string, THREE.MeshBasicMaterial>()

/** Unlit HDR colour that blooms. `gain` above 1 pushes it past the bloom threshold. */
export function glow(color: string, gain = 2.4) {
  const key = `${color}:${gain}`
  let m = glowCache.get(key)
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(gain),
      toneMapped: false,
    })
    glowCache.set(key, m)
  }
  return m
}

const glassCache = new Map<string, THREE.MeshPhysicalMaterial>()

/** Tinted frosted glass: transparent, glossy, lightly self-lit. */
export function glass(color: string, opacity = 0.32) {
  const key = `${color}:${opacity}`
  let m = glassCache.get(key)
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.1,
      roughness: 0.12,
      transparent: true,
      opacity,
      emissive: color,
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 2,
    })
    glassCache.set(key, m)
  }
  return m
}
