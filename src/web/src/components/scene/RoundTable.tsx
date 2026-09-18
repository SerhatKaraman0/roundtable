'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
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
      new THREE.MeshStandardMaterial({
        color: '#52341d', // rich warm walnut brown
        roughness: 0.58,
        metalness: 0.04,
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
        <meshStandardMaterial color="#2c1a0e" roughness={0.7} />
      </mesh>

      {/* ── Base ── */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <cylinderGeometry
          args={[TABLE_PEDESTAL_RADIUS * 2.6, TABLE_PEDESTAL_RADIUS * 2.6, 0.08, 24]}
        />
        <meshStandardMaterial color="#2c1a0e" roughness={0.6} />
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
      <group position={[0.32, surfaceY + 0.12, 0.22]} rotation={[0, 0.4, 0]}>
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

      {/* ── Antique Candle Centerpiece with gentle flame flicker ── */}
      <CandleCenterpiece surfaceY={surfaceY} />
    </group>
  );
}

/**
 * Antique brass candlestick with animated flame flicker.
 */
function CandleCenterpiece({ surfaceY }: { surfaceY: number }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const flameRef = useRef<THREE.Mesh>(null);
  const time = useRef(0);

  useFrame((_, delta) => {
    time.current += delta;
    if (lightRef.current) {
      // Gentle natural candlelight flicker
      const flicker =
        Math.sin(time.current * 7.2) * 0.15 +
        Math.sin(time.current * 13.8) * 0.1 +
        (Math.random() - 0.5) * 0.08;
      lightRef.current.intensity = 1.7 + flicker;
    }
    if (flameRef.current) {
      const scaleY = 1 + Math.sin(time.current * 8.5) * 0.09;
      flameRef.current.scale.set(1, scaleY, 1);
    }
  });

  return (
    <group position={[0, surfaceY, 0]}>
      {/* Brass base */}
      <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.085, 0.11, 0.024, 16]} />
        <meshStandardMaterial color="#8a6c38" roughness={0.35} metalness={0.7} />
      </mesh>
      {/* Brass stem */}
      <mesh position={[0, 0.055, 0]} castShadow>
        <cylinderGeometry args={[0.024, 0.036, 0.07, 12]} />
        <meshStandardMaterial color="#8a6c38" roughness={0.35} metalness={0.7} />
      </mesh>
      {/* Candle wax stick */}
      <mesh position={[0, 0.145, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.12, 12]} />
        <meshStandardMaterial color="#f2e8d5" roughness={0.75} />
      </mesh>
      {/* Candle wick */}
      <mesh position={[0, 0.21, 0]}>
        <cylinderGeometry args={[0.002, 0.002, 0.012, 6]} />
        <meshBasicMaterial color="#1a1208" />
      </mesh>
      {/* Candle flame */}
      <mesh ref={flameRef} position={[0, 0.225, 0]}>
        <sphereGeometry args={[0.014, 8, 8]} />
        <meshBasicMaterial color="#ff9e3b" />
      </mesh>
      {/* Flame point light with gentle flicker */}
      <pointLight
        ref={lightRef}
        position={[0, 0.24, 0]}
        color="#ffaa44"
        intensity={1.7}
        distance={4.0}
        decay={2}
      />
    </group>
  );
}

