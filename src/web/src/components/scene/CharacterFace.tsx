'use client';

import * as THREE from 'three';

// ─── Size constants ──────────────────────────────────────────────────────────────────────
// Face width/height are DERIVED from headRadius (not fixed absolute values) so
// they always scale correctly with the head, and cover a large majority of
// the face rather than reading as a small floating card.

/** Face plane width as a multiple of headRadius (≈ covers 80-90% of the head's front). */
const FACE_WIDTH_FACTOR = 2.25;
/** Face plane height as a multiple of headRadius (≈ covers 80-90% of the head's front). */
const FACE_HEIGHT_FACTOR = 2;
/**
 * How far in front of the head centre the plane sits.
 * Increased to 2.0 to prevent clipping with the larger face plane size (1.75x width, 1.8x height).
 * A flat plane sitting in front of a curved sphere only clears the sphere's
 * surface if its distance from the sphere's center is large enough relative to
 * its own size — because the sphere curves away as you move outward from the
 * center of the face, a larger flat plane's edges are effectively closer to
 * the curved surface at the same central offset distance than a smaller plane's
 * edges were.
 */
const FACE_Z_FACTOR = 1.5;

// ─── Props ────────────────────────────────────────────────────────────────────

interface CharacterFaceProps {
  /**
   * The radius of the head sphere in local group units.
   * The plane is placed at headRadius * FACE_Z_FACTOR along the group's +Z axis,
   * which — after the character's rotation — faces toward the table/camera.
   */
  headRadius: number;
  /**
   * Optional texture to display on the face plane.
   * Passing a THREE.Texture here is the ONLY change needed to show a real photo.
   *
   * To use later:
   *   import { useTexture } from '@react-three/drei';
   *   const tex = useTexture('/photos/aria.jpg');
   *   <CharacterFace headRadius={r} map={tex} />
   */
  map?: THREE.Texture;
  /** Width override (defaults to headRadius * FACE_WIDTH_FACTOR) */
  faceWidth?: number;
  /** Height override (defaults to headRadius * FACE_HEIGHT_FACTOR) */
  faceHeight?: number;
}

/**
 * CharacterFace — a flat white placeholder plane positioned in front of the
 * character's head, ready to receive a photo texture with zero refactoring.
 *
 * The plane is a CHILD of the character group, so it inherits the character's
 * rotation automatically — no manual world-space orientation needed.
 *
 * The plane is non-interactive (raycast is disabled) to keep pointer events
 * clean for other scene objects.
 *
 * To add a texture later, pass the `map` prop. Nothing else changes.
 */
export default function CharacterFace({
  headRadius,
  map,
  faceWidth = headRadius * FACE_WIDTH_FACTOR,
  faceHeight = headRadius * FACE_HEIGHT_FACTOR,
}: CharacterFaceProps) {
  const faceZ = headRadius * FACE_Z_FACTOR;
  // Move the plane down slightly from head center to cover more of the lower face
  const faceY = -headRadius * 0.7;

  return (
    <mesh
      // Placed at the front face of the head (+Z in character-local space).
      // x=0 keeps it perfectly centred horizontally; faceY moves it down slightly
      // to cover more of the lower face area. No independent rotation is set here,
      // so this mesh inherits the parent group's rotation exactly.
      position={[0, faceY, faceZ]}
      // Disable raycasting — plane is purely visual
      raycast={() => null}
    >
      <planeGeometry args={[faceWidth, faceHeight]} />
      {/*
       * Dedicated material instance for this mesh only (JSX materials are never
       * shared across elements) — fully opaque, solid white placeholder card.
       * transparent/opacity are hardcoded (not conditional) so the plane never
       * reads as translucent/frosted, regardless of whether `map` is set.
       */}
      <meshStandardMaterial
        color="white"
        map={map ?? null}
        side={THREE.FrontSide}
        roughness={0.6}
        metalness={0}
        transparent={false}
        opacity={1}
      />
    </mesh>
  );
}
