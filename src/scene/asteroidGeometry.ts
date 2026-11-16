import * as THREE from 'three'

/** Unit-radius cratered rock. Three seeds give three distinct silhouettes. */
export function asteroidGeometry(seed: number) {
  const geo = new THREE.IcosahedronGeometry(1, 4)
  const pos = geo.attributes.position
  const v = new THREE.Vector3()
  let s = seed * 9973 + 1
  const rnd = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  const lumps = Array.from({ length: 7 }, () => ({
    dir: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
    amp: 0.12 + rnd() * 0.22,
  }))
  const craters = Array.from({ length: 6 }, () => ({
    dir: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
    size: 0.82 + rnd() * 0.12,
    depth: 0.08 + rnd() * 0.1,
  }))
  const squash = new THREE.Vector3(0.8 + rnd() * 0.4, 0.7 + rnd() * 0.35, 0.8 + rnd() * 0.4)
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    let r = 1
    for (const l of lumps) r += Math.max(0, v.dot(l.dir)) ** 2 * l.amp
    for (const c of craters) {
      const d = v.dot(c.dir)
      if (d > c.size) {
        const k = (d - c.size) / (1 - c.size)
        r -= c.depth * Math.sin(Math.min(1, k * 1.3) * Math.PI * 0.5)
        r += c.depth * 0.5 * Math.exp(-((k - 0.05) ** 2) * 300)
      }
    }
    r += Math.sin(v.x * 9 + seed) * Math.cos(v.y * 11 - seed) * Math.sin(v.z * 8) * 0.035
    v.multiplyScalar(r).multiply(squash)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  // Normalise so the bounding radius is 1: collision radii stay honest.
  geo.computeBoundingSphere()
  const k = 1 / (geo.boundingSphere?.radius || 1)
  geo.scale(k, k, k)
  geo.computeVertexNormals()
  return geo
}
