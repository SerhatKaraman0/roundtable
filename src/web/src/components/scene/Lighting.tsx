'use client';

import { Environment } from '@react-three/drei';
import { TABLE_HEIGHT } from '@/lib/constants';

/**
 * Soft, warm orange-tinted dining-room lighting.
 *
 * Sources:
 *   1. HemisphereLight  — warm orange/amber sky/ground fill
 *   2. PointLight       — the pendant lamp over the table (dimmer, warmer, shadows)
 *   3. DirectionalLight — soft fill from user's side
 *   4. DirectionalLight — back fill so the far wall doesn't go dark
 *   5. Environment      — apartment preset for reflections on glossy materials
 *
 * Overall lighting is dimmer and warmer with orange/amber tones for a cozy
 * atmosphere. The pendant lamp is the key light but with reduced intensity
 * and warmer color temperature.
 */
export default function Lighting() {
  const pendantY = TABLE_HEIGHT + 2.1; // hangs above the table surface

  return (
    <>
      {/* ── Sky/ground hemisphere fill ── */}
      <hemisphereLight
        args={['#ffcc80', '#d4a574', 0.8]}
      />

      {/*
       * ── Pendant key light over the table ──
       * Dimmer intensity and warmer orange color for cozy atmosphere.
       * shadow-mapSize 1024 (not 2048) — halves shadow-pass GPU cost with no
       * visible quality loss at this room's scale; 2048 was measurable overkill.
       */}
      <pointLight
        position={[0, pendantY, 0]}
        intensity={20}
        color="#ffaa60"
        distance={8}
        decay={2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-radius={6}
        shadow-bias={-0.0005}
      />

      {/* ── Soft fill from the user's side (front-lights character faces) ── */}
      <directionalLight
        position={[0, 2.5, 4]}
        intensity={0.6}
        color="#ffd090"
      />

      {/* ── Side fills so left/right walls aren't shadowed dark ── */}
      <directionalLight position={[4, 2, 0]} intensity={0.3} color="#ffcc80" />
      <directionalLight position={[-4, 2, 0]} intensity={0.3} color="#ffcc80" />

      {/* ── Back fill — back wall stays readable ── */}
      <directionalLight
        position={[0, 2, -5]}
        intensity={0.4}
        color="#ffb870"
      />

      {/*
       * ── Environment map for glossy material reflections ──
       * Changed to sunset preset for warmer orange tones to match the lighting.
       * resolution reduced to 64 for better performance. The PMREM this
       * generates is only used for soft reflections on small glossy objects,
       * so a lower-res map is visually indistinguishable here and cheaper to
       * generate/sample. This is a one-time cost at scene start, not a
       * per-frame cost, but reduced anyway per the performance checklist.
       */}
      <Environment preset="sunset" resolution={64} />
    </>
  );
}
