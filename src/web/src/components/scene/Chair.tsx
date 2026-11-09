'use client';

import { seatPosition, seatFacingAngle, CHAIR_SEAT_HEIGHT } from '@/lib/constants';

interface ChairProps {
  /** Seat angle in degrees (use SEAT_ANGLES_DEG constants) */
  seatAngleDeg: number;
}

/**
 * Simple low-poly dining chair with seat, backrest, and four legs.
 * Designed to be cheap to render (simple primitives, low segment counts)
 * while maintaining visual consistency with the room's aesthetic.
 */
export default function Chair({ seatAngleDeg }: ChairProps) {
  const [px, , pz] = seatPosition(seatAngleDeg);
  const facingRad = seatFacingAngle(seatAngleDeg);

  // Chair dimensions
  const seatWidth = 0.45;
  const seatDepth = 0.42;
  const seatThickness = 0.04;
  const seatHeight = CHAIR_SEAT_HEIGHT; // Height of seat surface from floor

  const backrestHeight = 0.38;
  const backrestThickness = 0.03;
  const backrestWidth = seatWidth * 0.85;

  const legHeight = seatHeight;
  const legThickness = 0.025;

  // Wood material - warm medium brown
  const woodMat = (
    <meshStandardMaterial
      color="#8B6914"
      roughness={0.7}
      metalness={0.02}
    />
  );

  return (
    <group position={[px, 0, pz]} rotation={[0, facingRad, 0]}>
      {/* ── Seat ── */}
      <mesh position={[0, seatHeight, 0]} castShadow receiveShadow>
        <boxGeometry args={[seatWidth, seatThickness, seatDepth]} />
        {woodMat}
      </mesh>

      {/* ── Backrest ── */}
      <mesh
        position={[0, seatHeight + backrestHeight / 2, -seatDepth / 2 + backrestThickness / 2]}
        castShadow
      >
        <boxGeometry args={[backrestWidth, backrestHeight, backrestThickness]} />
        {woodMat}
      </mesh>

      {/* ── Front legs ── */}
      {[
        [-seatWidth / 2 + legThickness / 2, seatDepth / 2 - legThickness / 2],
        [seatWidth / 2 - legThickness / 2, seatDepth / 2 - legThickness / 2],
      ].map(([x, z], i) => (
        <mesh
          key={`front-leg-${i}`}
          position={[x, legHeight / 2, z]}
          castShadow
        >
          <boxGeometry args={[legThickness, legHeight, legThickness]} />
          {woodMat}
        </mesh>
      ))}

      {/* ── Back legs ── */}
      {[
        [-seatWidth / 2 + legThickness / 2, -seatDepth / 2 + legThickness / 2],
        [seatWidth / 2 - legThickness / 2, -seatDepth / 2 + legThickness / 2],
      ].map(([x, z], i) => (
        <mesh
          key={`back-leg-${i}`}
          position={[x, legHeight / 2, z]}
          castShadow
        >
          <boxGeometry args={[legThickness, legHeight, legThickness]} />
          {woodMat}
        </mesh>
      ))}
    </group>
  );
}
