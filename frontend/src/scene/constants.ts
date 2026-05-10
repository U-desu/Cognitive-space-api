/**
 * 3D scene geometry constants.
 * Changing these values scales every node uniformly.
 */

/** Radius of the white circular backdrop behind each avatar */
export const AGENT_CIRCLE_RADIUS = 2.6

/** Radius of the sun / center sphere */
export const CENTER_CIRCLE_RADIUS = 3.0

/** Avatar image plane dimensions [width, height]
 *  Must match the image aspect ratio (300/240 = 1.25)
 */
export const AVATAR_PLANE_WIDTH = 4.0
export const AVATAR_PLANE_HEIGHT = 3.2

/** Stance-colored border ring [innerRadius, outerRadius] */
export const BORDER_RING_INNER = 2.5
export const BORDER_RING_OUTER = 2.75

/** Selection torus ring [radius, tubeRadius] */
export const SELECTION_RING_RADIUS = 3.2
export const SELECTION_RING_TUBE = 0.07

/** Child-indicator torus ring [radius, tubeRadius] */
export const CHILD_RING_RADIUS = 2.9
export const CHILD_RING_TUBE = 0.09

/** Label offset below the node */
export const LABEL_OFFSET_Y = 3.2

/** Child count badge offset from node center */
export const BADGE_OFFSET_X = 2.3
export const BADGE_OFFSET_Y = 1.6

/** Expand button offset from node center */
export const EXPAND_OFFSET_X = 2.8

/** Scale factors for hover / selection */
export const SCALE_SELECTED = 1.6
export const SCALE_HOVERED = 1.3
export const SCALE_DEFAULT = 1.0
