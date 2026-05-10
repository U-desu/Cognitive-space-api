import type { Vec3 } from '../utils/vectors'

/**
 * Layout algorithm configuration.
 *
 * The 3D space is organised as concentric spherical layers:
 *   Layer 0 (roots)    → radius 30  → max 6 nodes
 *   Layer 1 (children) → radius 50  → max ~18 nodes (3 per root)
 *   Layer 2 (grandchildren) → radius 65 → max ~36 nodes (2 per child)
 *
 * Roots sit on the vertices of a regular octahedron so that the angle
 * between any two neighbouring roots is exactly 90°.
 *
 * Children are placed inside a cone aligned with their parent's direction.
 * The cone half-angle is arctan(SPREAD) ≈ 15.6°, so the full cone is
 * ~31°.  Two neighbouring root cones therefore leave a ~59° gap,
 * guaranteeing they never overlap.
 */

/** Fixed positions for root agents: vertices of a regular octahedron */
export const ROOT_POSITIONS: Vec3[] = [
  [30, 0, 0],
  [-30, 0, 0],
  [0, 30, 0],
  [0, -30, 0],
  [0, 0, 30],
  [0, 0, -30],
]

/** Radius of the sphere shell where children live */
export const CHILD_RADIUS = 50

/** Radius of the sphere shell where grandchildren live */
export const GRANDCHILD_RADIUS = 65

/**
 * Spread factor for the perpendicular offset of child nodes.
 * offsetMag = radius * SPREAD.
 * SPREAD = 0.28 gives a comfortable cone that is visible but not too sharp.
 */
export const LAYER_SPREAD = 0.28

/** After placement, any pair closer than this gets nudged apart */
export const MIN_NODE_DISTANCE = 12
