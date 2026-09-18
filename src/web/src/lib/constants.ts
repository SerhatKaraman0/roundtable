import * as THREE from 'three';

// ─── Room dimensions ─────────────────────────────────────────────────────────
export const ROOM_WIDTH = 12;
export const ROOM_HEIGHT = 4;
export const ROOM_DEPTH = 12;

// ─── Table ───────────────────────────────────────────────────────────────────
/** Radius of the round table top surface */
export const TABLE_RADIUS = 1.5;
/** Height of the table surface from the floor */
export const TABLE_HEIGHT = 0.78;
/** Table cylinder height (thickness) */
export const TABLE_THICKNESS = 0.07;
/** Pedestal radius */
export const TABLE_PEDESTAL_RADIUS = 0.18;

// ─── Seat layout ─────────────────────────────────────────────────────────────
/**
 * Four seats at exactly 90° intervals.
 * Convention: angle measured in degrees from positive-Z axis (clockwise when
 * viewed from above, consistent with Three.js Y-up right-hand rule).
 *
 *   0°   → user  (south, positive Z — camera sits here)
 *   90°  → left  character (east in world space = user's left)
 *   180° → front character (north, directly opposite user)
 *   270° → right character (west in world space = user's right)
 *
 * Sanity check: every adjacent pair is exactly 90° apart. ✓
 */
export const SEAT_ANGLES_DEG = {
  user: 0,
  left: 90,
  front: 180,
  right: 270,
} as const;

/** Distance from table centre to any seat (same for all four seats). */
export const SEAT_RADIUS = TABLE_RADIUS + 0.72;

/** Height of chair seat surface from the floor */
export const CHAIR_SEAT_HEIGHT = 0.48;

/**
 * Place-setting radii — both derived from TABLE_RADIUS and used with the SAME
 * seat angle constants as characters/camera, so every plate/glass sits on the
 * exact radial line between its seat and the table centre (never placed by eye).
 *
 * PLATE_RADIUS  — closer to the centre.
 * GLASS_RADIUS  — slightly larger radius (closer to the seat) than the plate,
 *                 same angle, so the glass sits just beyond the plate from the
 *                 diner's perspective.
 */
export const PLATE_RADIUS = TABLE_RADIUS * 0.75;
export const GLASS_RADIUS = TABLE_RADIUS * 0.88;

/**
 * Compute the 3D [x, y, z] world position of a seat.
 * Y is always 0 (floor level — characters and camera are placed at floor Y,
 * then their height is handled by their own vertical offset).
 *
 * @param angleDeg  Seat angle in degrees (use SEAT_ANGLES_DEG constants)
 * @param radius    Distance from table centre (defaults to SEAT_RADIUS)
 */
export function seatPosition(
  angleDeg: number,
  radius: number = SEAT_RADIUS,
): [number, number, number] {
  const rad = THREE.MathUtils.degToRad(angleDeg);
  return [radius * Math.sin(rad), 0, radius * Math.cos(rad)];
}

/**
 * Y-axis rotation (radians) so an object at `angleDeg` faces the table centre.
 * facing = angleDeg + 180°, converted to radians.
 */
export function seatFacingAngle(angleDeg: number): number {
  return THREE.MathUtils.degToRad(angleDeg + 180);
}

// ─── GLTF character model ─────────────────────────────────────────────────────
/**
 * IMPORTANT: we do NOT hand-compute the GLTF model's scale/offset from the
 * raw accessor min/max values printed in the .gltf file. The model's root node
 * carries a coordinate-swap matrix (Sketchfab's Z-up → Y-up conversion) AND the
 * raw mesh is not centred on its own local origin — hand-deriving position/scale
 * from the wrong axis (and ignoring the horizontal offset) was the root cause of
 * the three characters rendering at wildly different apparent sizes/positions in
 * earlier attempts (rotating an off-centre mesh around a pivot swings it to a
 * different world position depending on the seat angle).
 *
 * Instead, Character.tsx measures each model's ACTUAL world-space bounding box
 * at runtime with `THREE.Box3().setFromObject()`, re-centres it horizontally on
 * its own local origin, and derives scale from that measurement. Every character
 * instance runs the exact same measurement + formula against the exact same
 * source geometry, so all three are guaranteed to be numerically identical in
 * size and correctly pivoted — verified via a dev-console log in Character.tsx.
 *
 * The constants below are just the TARGET proportions that the runtime
 * measurement is normalized to. They are shared by all characters — there is
 * no per-character override anywhere in the codebase.
 */

/** Target rendered height (metres) for every character — identical for all three. */
export const CHARACTER_TARGET_HEIGHT = 1.45;

/**
 * Head centre height as a fraction of CHARACTER_TARGET_HEIGHT (0 = feet, 1 = top).
 * Lowered from 0.86 → 0.78 (round 5): 0.86 placed the face plane above the
 * actual head, reading as "floating over the head" rather than over the face.
 * 0.78 lands closer to the head's vertical centre / eye level.
 */
export const CHARACTER_HEAD_Y_FRACTION = 0.78;

/** Head radius as a fraction of CHARACTER_TARGET_HEIGHT. */
export const CHARACTER_HEAD_RADIUS_FRACTION = 0.17;

/**
 * World-space height of character head center from the floor.
 * Derived from chair seat height + character body height + head center offset.
 * Used to set camera Y to match character face level.
 */
export const CHARACTER_HEAD_WORLD_Y = CHAIR_SEAT_HEIGHT + (CHARACTER_TARGET_HEIGHT * CHARACTER_HEAD_Y_FRACTION);

// ─── Camera / user seat ──────────────────────────────────────────────────────
/**
 * Eye height for a seated adult (above floor).
 * Derived from character head height to match face level.
 * Set slightly below character head center to be at eye level rather than above the eyes.
 */
export const CAMERA_Y = CHARACTER_HEAD_WORLD_Y - 0.06;

/**
 * Camera Z is derived from the user's seat position, not hardcoded separately,
 * so the camera is provably on the same circle as the character seats.
 * seatPosition(SEAT_ANGLES_DEG.user)[2] = SEAT_RADIUS * cos(0°) = SEAT_RADIUS
 */
export const CAMERA_Z = SEAT_RADIUS;

// ─── Speech bubbles ──────────────────────────────────────────────────────────
/** How long (ms) a speech bubble stays visible */
export const BUBBLE_DURATION_MS = 6000;

// ─── Misc ────────────────────────────────────────────────────────────────────
/** Max user messages kept in transcript */
export const MAX_MESSAGES = 80;
