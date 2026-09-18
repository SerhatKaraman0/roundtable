'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import {
  TABLE_RADIUS,
  TABLE_HEIGHT,
  TABLE_THICKNESS,
  TABLE_PEDESTAL_RADIUS,
  SEAT_ANGLES_DEG,
  PLATE_RADIUS,
  GLASS_RADIUS,
  seatPosition,
} from '@/lib/constants';
import { CHARACTERS } from '@/lib/characters';

// ─── Shared materials ────────────────────────────────────────────────────────

function useTableMat() {
  return useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#2a1f14',
        roughness: 0.25,
        metalness: 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      }),
    [],
  );
}

function usePlateMat() {
  return useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#f5f0e8',
        roughness: 0.3,
        metalness: 0.0,
        clearcoat: 0.5,
        clearcoatRoughness: 0.2,
      }),
    [],
  );
}

/**
 * Glass material — CHEAP transparent approximation, NOT real-time transmission.
 *
 * `transmission > 0` on MeshPhysicalMaterial forces Three.js to render an
 * extra full-scene transmission pass every frame (to sample what's behind the
 * glass for refraction). With four glasses on the table simultaneously, this
 * was the primary cause of an 8-12fps collapse. A plain semi-transparent
 * material with low roughness gets ~90% of the visual read of "glass" at a
 * tiny fraction of the GPU cost — no transmission, no ior, no thickness.
 */
function useGlassMat() {
  return useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#daf4fc',
        roughness: 0.06,
        metalness: 0,
        transparent: true,
        opacity: 0.5,
        envMapIntensity: 2.0,
        side: THREE.DoubleSide,
      }),
    [],
  );
}

// ─── Wine glass via LatheGeometry ────────────────────────────────────────────

/**
 * Builds a wine glass silhouette using THREE.LatheGeometry.
 * Points trace: base → stem → bowl bottom → bowl top, in the XY plane.
 * The lathe rotates around Y to generate the full glass.
 */
function useGlassPoints(): THREE.Vector2[] {
  return useMemo(
    () => [
      // Base foot (flat disc)
      new THREE.Vector2(0.000, 0.000),
      new THREE.Vector2(0.048, 0.000),
      new THREE.Vector2(0.048, 0.006),
      new THREE.Vector2(0.008, 0.010),
      // Stem
      new THREE.Vector2(0.007, 0.010),
      new THREE.Vector2(0.007, 0.095),
      // Knop (slight bulge where stem meets bowl)
      new THREE.Vector2(0.014, 0.105),
      new THREE.Vector2(0.008, 0.115),
      // Bowl — curves outward
      new THREE.Vector2(0.022, 0.130),
      new THREE.Vector2(0.048, 0.165),
      new THREE.Vector2(0.062, 0.205),
      new THREE.Vector2(0.065, 0.240),
      // Rim — slight inward taper
      new THREE.Vector2(0.060, 0.265),
    ],
    [],
  );
}

// ─── Place setting ────────────────────────────────────────────────────────────

/**
 * One plate + one wine glass, positioned on the table surface.
 *
 * Both the plate and the glass use the SAME `angleDeg` as the seat itself
 * (passed straight from SEAT_ANGLES_DEG / CharacterConfig.seatAngleDeg — the
 * exact same angle used for the character/camera at that seat), so they
 * always land on the radial line between that seat and the table centre.
 * Only the radius differs: PLATE_RADIUS (closer to centre) vs GLASS_RADIUS
 * (slightly larger — closer to the seat, "beyond" the plate).
 */
function PlaceSetting({
  angleDeg,
  plateMat,
  glassMat,
  glassPoints,
  surfaceY,
}: {
  angleDeg: number;
  plateMat: THREE.MeshPhysicalMaterial;
  glassMat: THREE.MeshPhysicalMaterial;
  glassPoints: THREE.Vector2[];
  surfaceY: number;
}) {
  // Plate centre — same angle as the seat, pulled toward the table centre
  const [px, , pz] = seatPosition(angleDeg, PLATE_RADIUS);

  // Glass — same angle as the plate/seat, slightly larger radius
  const [gx, , gz] = seatPosition(angleDeg, GLASS_RADIUS);

  // Utensil positions - fork and knife on either side of the plate
  const angleRad = THREE.MathUtils.degToRad(angleDeg);
  const utensilOffset = 0.16;
  // Fork on left side (person's left when facing table center)
  const fx = px + Math.sin(angleRad + Math.PI / 2) * utensilOffset;
  const fz = pz + Math.cos(angleRad + Math.PI / 2) * utensilOffset;
  // Knife on right side (person's right when facing table center)
  const kx = px + Math.sin(angleRad - Math.PI / 2) * utensilOffset;
  const kz = pz + Math.cos(angleRad - Math.PI / 2) * utensilOffset;

  // Bread position - upper right from plate
  const breadX = px + Math.sin(angleRad - Math.PI / 4) * 0.1;
  const breadZ = pz + Math.cos(angleRad - Math.PI / 4) * 0.1;

  // Utensil rotation - point toward table center
  const utensilRotation = angleRad + Math.PI;

  return (
    <group>
      {/*
       * ── Plate ── a simple flat disk, per explicit spec: NO torus/ring/arch
       * geometry (those previously rendered as a broken arch/rainbow shape).
       * A plain CircleGeometry laid flat on the table surface.
       */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[px, surfaceY, pz]}
        receiveShadow
        castShadow
      >
        <circleGeometry args={[0.17, 24]} />
        <primitive object={plateMat} />
      </mesh>
      {/* Subtle inner-well accent — also a flat disk, slightly smaller and higher */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[px, surfaceY + 0.0015, pz]}
      >
        <circleGeometry args={[0.12, 24]} />
        <meshPhysicalMaterial color="#e8e0d0" roughness={0.35} clearcoat={0.4} />
      </mesh>

      {/* ── Bread roll ── */}
      <group position={[breadX, surfaceY + 0.02, breadZ]} rotation={[0, angleRad, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.04, 0.035, 0.12, 12]} />
          <meshStandardMaterial color="#d4a574" roughness={0.8} />
        </mesh>
        {/* Bread scoring lines */}
        <mesh position={[0, 0.041, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.08, 0.002, 0.002]} />
          <meshStandardMaterial color="#c49564" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.041, 0]} rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.08, 0.002, 0.002]} />
          <meshStandardMaterial color="#c49564" roughness={0.9} />
        </mesh>
      </group>

      {/* ── Fork ── */}
      <group position={[fx, surfaceY + 0.01, fz]} rotation={[0, utensilRotation, 0]}>
        {/* Fork handle */}
        <mesh castShadow>
          <boxGeometry args={[0.008, 0.002, 0.14]} />
          <meshStandardMaterial color="#c0c0c0" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Fork tines */}
        <group position={[0, 0.001, 0.07]}>
          {[[-0.012, 0], [0, 0], [0.012, 0]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.001, z]} castShadow>
              <boxGeometry args={[0.006, 0.002, 0.04]} />
              <meshStandardMaterial color="#c0c0c0" roughness={0.3} metalness={0.8} />
            </mesh>
          ))}
        </group>
      </group>

      {/* ── Knife ── */}
      <group position={[kx, surfaceY + 0.01, kz]} rotation={[0, utensilRotation, 0]}>
        {/* Knife handle */}
        <mesh castShadow>
          <boxGeometry args={[0.008, 0.002, 0.1]} />
          <meshStandardMaterial color="#c0c0c0" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Knife blade */}
        <mesh position={[0, 0.001, 0.06]} castShadow>
          <boxGeometry args={[0.015, 0.0015, 0.06]} />
          <meshStandardMaterial color="#d0d0d0" roughness={0.2} metalness={0.9} />
        </mesh>
      </group>

      {/* ── Wine glass — LatheGeometry silhouette ── */}
      <group position={[gx, surfaceY, gz]}>
        {/* Glass body */}
        <mesh castShadow>
          <latheGeometry args={[glassPoints, 24]} />
          <primitive object={glassMat} />
        </mesh>
        {/* A small amount of red wine sitting in the bowl */}
        <mesh position={[0, 0.138, 0]}>
          <cylinderGeometry args={[0.042, 0.028, 0.022, 16]} />
          <meshStandardMaterial
            color="#6b0e1e"
            roughness={0.08}
            metalness={0.0}
            transparent
            opacity={0.92}
          />
        </mesh>
      </group>
    </group>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Round table with four place settings at exactly 90° intervals.
 *
 *   0°   → user's place  (south)
 *   90°  → Rex's place   (east / user's left)
 *   180° → Aria's place  (north / directly opposite)
 *   270° → Sol's place   (west / user's right)
 */
export default function RoundTable() {
  const tableMat  = useTableMat();
  const plateMat  = usePlateMat();
  const glassMat  = useGlassMat();
  const glassPoints = useGlassPoints();

  const pedestalHeight = TABLE_HEIGHT - 0.1;
  const surfaceY = TABLE_HEIGHT + TABLE_THICKNESS / 2 + 0.001;

  // All four seat angles — each PlaceSetting derives its own plate/glass radius
  // from PLATE_RADIUS / GLASS_RADIUS (see constants.ts), using this SAME angle.
  const seatAngles = [
    SEAT_ANGLES_DEG.user,
    ...CHARACTERS.map((c) => c.seatAngleDeg),
  ];

  return (
    <group>
      {/* ── Table top ── */}
      <mesh position={[0, TABLE_HEIGHT, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, TABLE_THICKNESS, 32]} />
        <primitive object={tableMat} />
      </mesh>

      {/* ── Pedestal ── */}
      <mesh position={[0, pedestalHeight / 2, 0]} castShadow>
        <cylinderGeometry
          args={[TABLE_PEDESTAL_RADIUS, TABLE_PEDESTAL_RADIUS * 1.2, pedestalHeight, 16]}
        />
        <meshStandardMaterial color="#1a1510" roughness={0.7} />
      </mesh>

      {/* ── Base ── */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <cylinderGeometry
          args={[TABLE_PEDESTAL_RADIUS * 2.6, TABLE_PEDESTAL_RADIUS * 2.6, 0.08, 24]}
        />
        <meshStandardMaterial color="#1a1510" roughness={0.6} />
      </mesh>

      {/* ── Place settings ── */}
      {seatAngles.map((angle, i) => (
        <PlaceSetting
          key={i}
          angleDeg={angle}
          plateMat={plateMat}
          glassMat={glassMat}
          glassPoints={glassPoints}
          surfaceY={surfaceY}
        />
      ))}

      {/* ── Wine bottle on the table ── */}
      <group position={[0.3, surfaceY + 0.12, 0.2]} rotation={[0, 0.4, 0]}>
        {/* Bottle body */}
        <mesh castShadow>
          <cylinderGeometry args={[0.04, 0.045, 0.28, 16]} />
          <meshStandardMaterial color="#2a1a0a" roughness={0.3} metalness={0.1} />
        </mesh>
        {/* Bottle neck */}
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.015, 0.02, 0.12, 12]} />
          <meshStandardMaterial color="#1a0a00" roughness={0.4} />
        </mesh>
        {/* Bottle shoulder */}
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.04, 0.04, 12]} />
          <meshStandardMaterial color="#2a1a0a" roughness={0.3} metalness={0.1} />
        </mesh>
        {/* Label */}
        <mesh position={[0, 0.02, 0.046]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.08, 0.12]} />
          <meshStandardMaterial color="#f5e6d3" roughness={0.8} />
        </mesh>
        {/* Cork */}
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.016, 0.016, 0.03, 8]} />
          <meshStandardMaterial color="#c4a060" roughness={0.9} />
        </mesh>
      </group>

      {/* ── Salad bowl in the center ── */}
      <group position={[0, surfaceY + 0.08, 0]}>
        {/* Bowl */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.25, 0.22, 0.12, 24]} />
          <meshStandardMaterial color="#8b7355" roughness={0.6} />
        </mesh>
        {/* Bowl interior (darker) */}
        <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.23, 0.20, 0.08, 24]} />
          <meshStandardMaterial color="#6b5344" roughness={0.7} />
        </mesh>
        {/* Salad leaves */}
        <group position={[0, 0.09, 0]}>
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const radius = 0.05 + Math.random() * 0.15;
            return (
              <mesh
                key={i}
                position={[
                  Math.cos(angle) * radius,
                  0.01 + Math.random() * 0.02,
                  Math.sin(angle) * radius,
                ]}
                rotation={[Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3]}
                castShadow
              >
                <sphereGeometry args={[0.03 + Math.random() * 0.02, 8, 8]} />
                <meshStandardMaterial
                  color={Math.random() > 0.3 ? '#4a7c23' : '#5a8c33'}
                  roughness={0.8}
                />
              </mesh>
            );
          })}
        </group>
        {/* Cherry tomatoes */}
        {Array.from({ length: 4 }, (_, i) => {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <mesh
              key={`tomato-${i}`}
              position={[
                Math.cos(angle) * 0.1,
                0.12,
                Math.sin(angle) * 0.1,
              ]}
              castShadow
            >
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial color="#cc3333" roughness={0.6} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
