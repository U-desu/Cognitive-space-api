import type { Vec3 } from '../utils/vectors'

/**
 * Layout algorithm configuration.
 *
 * The 3D space is organised as concentric spherical layers:
 *   Layer 0 (roots)         → radius 20  → max 6 nodes
 *   Layer 1 (children)      → radius 38  → max ~18 nodes (3 per root)
 *   Layer 2 (grandchildren) → radius 48  → max ~36 nodes (2 per child)
 *
 * Roots sit on the vertices of a regular octahedron so that the angle
 * between any two neighbouring roots is exactly 90°.
 *
 * Children are placed inside a cone aligned with their parent's direction.
 * The cone half-angle is arctan(SPREAD) ≈ 20.8°, so the full cone is
 * ~41.6°.  Two neighbouring root cones therefore leave a ~48° gap.
 */

/** Fixed positions for root agents: vertices of a regular octahedron */
export const ROOT_POSITIONS: Vec3[] = [
  [20, 0, 0],
  [-20, 0, 0],
  [0, 20, 0],
  [0, -20, 0],
  [0, 0, 20],
  [0, 0, -20],
]

/** Radius of the sphere shell where children live */
export const CHILD_RADIUS = 38

/** Radius of the sphere shell where grandchildren live */
export const GRANDCHILD_RADIUS = 48

/**
 * Spread factor for the perpendicular offset of child nodes.
 * offsetMag = radius * SPREAD.
 * Larger SPREAD makes children scatter more widely around the parent direction.
 */
export const LAYER_SPREAD = 0.38

/** After placement, any pair closer than this gets nudged apart */
export const MIN_NODE_DISTANCE = 10
