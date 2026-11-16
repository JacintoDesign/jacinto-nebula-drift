import * as THREE from 'three'

export const SIGN_FONT_JP = '"Noto Sans JP", sans-serif'
export const SIGN_FONT_MONO = '"JetBrains Mono", ui-monospace, monospace'
export const SIGN_FONT_DISPLAY = '"Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif'

/** Resolve once the bundled sign fonts (including the needed JP glyph subsets) are usable in canvas. */
export async function loadSignFonts(text: string) {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.all([
      document.fonts.load(`700 96px ${SIGN_FONT_JP}`, text),
      document.fonts.load(`700 40px ${SIGN_FONT_DISPLAY}`, 'A'),
      document.fonts.load(`500 24px ${SIGN_FONT_MONO}`, 'A'),
    ])
  } catch {
    /* fall back to system fonts */
  }
}

/**
 * Vertical neon blade sign: stacked Japanese glyphs, the Latin name running
 * down the side, and the station class at the foot.
 */
export function drawBladeSign(
  canvas: HTMLCanvasElement,
  opts: { jp: string; name: string; sub: string; color: string },
) {
  const W = canvas.width
  const H = canvas.height
  const c = canvas.getContext('2d')!
  c.clearRect(0, 0, W, H)

  // Backing plate.
  c.fillStyle = 'rgba(3,5,12,0.82)'
  c.beginPath()
  c.roundRect(10, 10, W - 20, H - 20, 14)
  c.fill()
  c.strokeStyle = opts.color
  c.lineWidth = 5
  c.shadowColor = opts.color
  c.shadowBlur = 18
  c.stroke()
  c.shadowBlur = 0
  c.lineWidth = 1.5
  c.globalAlpha = 0.5
  c.beginPath()
  c.roundRect(22, 22, W - 44, H - 44, 8)
  c.stroke()
  c.globalAlpha = 1

  // Glyph stack.
  const glyphs = [...opts.jp]
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.font = `700 150px ${SIGN_FONT_JP}`
  glyphs.forEach((gph, i) => {
    const y = 128 + i * 168
    c.shadowColor = opts.color
    c.shadowBlur = 34
    c.fillStyle = opts.color
    c.fillText(gph, W / 2, y)
    c.shadowBlur = 0
    c.fillStyle = 'rgba(255,255,255,0.92)'
    c.fillText(gph, W / 2, y)
  })

  const divider = 128 + glyphs.length * 168 - 52
  c.fillStyle = opts.color
  c.fillRect(46, divider, W - 92, 4)

  // Latin name, rotated to read top-to-bottom.
  c.save()
  c.translate(W / 2, (divider + H - 96) / 2 + 8)
  c.rotate(Math.PI / 2)
  let size = 64
  c.font = `700 ${size}px ${SIGN_FONT_DISPLAY}`
  const room = H - 96 - divider - 40
  const spaced = opts.name.split('').join(' ')
  while (c.measureText(spaced).width > room && size > 24) {
    size -= 2
    c.font = `700 ${size}px ${SIGN_FONT_DISPLAY}`
  }
  c.shadowColor = opts.color
  c.shadowBlur = 16
  c.fillStyle = '#ffffff'
  c.fillText(spaced, 0, 0)
  c.restore()

  // Station class at the foot.
  c.shadowBlur = 0
  c.fillStyle = opts.color
  c.fillRect(46, H - 92, W - 92, 2)
  c.font = `500 19px ${SIGN_FONT_MONO}`
  c.fillStyle = 'rgba(255,255,255,0.85)'
  const latin = opts.sub.split('·').pop()?.trim() ?? opts.sub
  c.fillText(latin, W / 2, H - 58, W - 60)
}

/** Caption strip under a hologram: index, title and project meta. */
export function drawCaption(
  canvas: HTMLCanvasElement,
  opts: { index: string; title: string; meta: string; color: string },
) {
  const W = canvas.width
  const H = canvas.height
  const c = canvas.getContext('2d')!
  c.clearRect(0, 0, W, H)
  c.textBaseline = 'middle'
  c.fillStyle = opts.color
  c.fillRect(0, 12, 6, H - 24)
  c.font = `500 30px ${SIGN_FONT_MONO}`
  c.fillText(opts.index, 26, H / 2 + 2)
  c.font = `700 50px ${SIGN_FONT_DISPLAY}`
  c.fillStyle = '#ffffff'
  c.fillText(opts.title.toUpperCase(), 96, H / 2 + 3)
  const tw = c.measureText(opts.title.toUpperCase()).width
  c.font = `500 26px ${SIGN_FONT_MONO}`
  c.fillStyle = 'rgba(255,255,255,0.7)'
  c.textAlign = 'right'
  if (96 + tw + 40 < W - c.measureText(opts.meta).width) c.fillText(opts.meta, W - 8, H / 2 + 3)
  c.textAlign = 'left'
}

/** Create a canvas at its final size and wrap it; the size must never change after upload. */
export function canvasTexture(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return { canvas, texture: t }
}
