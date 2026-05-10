/** 3-element tuple representing a point or vector in world space */
export type Vec3 = [number, number, number]

/** Normalize a vector to unit length. Returns (0,1,0) for zero vectors to avoid NaN. */
export function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
  if (len === 0) return [0, 1, 0]
  return [v[0] / len, v[1] / len, v[2] / len]
}

/** Cross product of two 3D vectors */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

/** Euclidean distance between two points */
export function distance(a: Vec3, b: Vec3): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

/**
 * Move `point` toward `target` by `dist` units along the line connecting them.
 * Used to offset line endpoints so they start at a circle's edge rather than its center.
 */
export function offsetTowards(point: Vec3, target: Vec3, dist: number): Vec3 {
  const dx = target[0] - point[0]
  const dy = target[1] - point[1]
  const dz = target[2] - point[2]
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (len === 0) return point
  const t = dist / len
  return [point[0] + dx * t, point[1] + dy * t, point[2] + dz * t]
}
