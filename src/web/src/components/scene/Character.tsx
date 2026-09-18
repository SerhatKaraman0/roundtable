'use client';

import { useRef, useMemo, useEffect, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { CharacterConfig } from '@/types';
import {
  CHARACTER_TARGET_HEIGHT,
  CHARACTER_HEAD_Y_FRACTION,
  CHARACTER_HEAD_RADIUS_FRACTION,
  seatPosition,
  seatFacingAngle,
  CHAIR_SEAT_HEIGHT,
} from '@/lib/constants';
import CharacterFace from './CharacterFace';
import SpeechBubble from './SpeechBubble';

// Pre-load the model so all three instances share the same geometry/material cache
useGLTF.preload('/models/scene.gltf');

interface CharacterProps {
  /**
   * Character config drives color + seat angle only. There is intentionally
   * NO scale/size prop anywhere in this component — all three character
   * instances render at an identical measured size (see CharacterBody below).
   */
  config: CharacterConfig;
  speakingMessage?: string;
}

// ─── CharacterBody — the ONE canonical character renderer ─────────────────────

/**
 * Loads the MSN Buddy GLTF, colors it, and measures its ACTUAL rendered
 * bounding box at runtime to derive scale/position — rather than hand-typed
 * magic numbers, which were proven wrong in earlier attempts (see constants.ts).
 *
 * This is the ONLY place model geometry is scaled/positioned. It is used
 * identically for all three characters via <Character>, with no per-instance
 * size override possible.
 */
function CharacterBody({
  color,
  speakingMessage,
}: {
  color: string;
  speakingMessage?: string;
}) {
  const { scene } = useGLTF('/models/scene.gltf');

  // Independent scene graph per character instance
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // Using MeshStandardMaterial instead of MeshPhysicalMaterial for better
  // performance and a matte appearance. Removed clearcoat which is expensive
  // and made characters too glossy. Increased roughness for matte look.
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.6,
        metalness: 0.08,
      }),
    [color],
  );

  // Apply the colored material to every mesh in the clone
  useMemo(() => {
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = mat;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [cloned, mat]);

  /**
   * Measure the clone's REAL bounding box (at its default identity transform)
   * and derive:
   *   - a uniform scale that normalizes height to CHARACTER_TARGET_HEIGHT
   *   - a position that both (a) lifts the model so its feet sit on Y=0, and
   *     (b) RE-CENTRES it horizontally (X/Z) on the group's local origin.
   *
   * (b) is critical: the raw GLTF mesh is NOT centred on its own local origin.
   * Without re-centring, rotating the character group to face the table
   * (different rotation per seat) swings the off-centre mesh to a different
   * world position for every seat angle — which is what previously made the
   * three characters look wildly different in size/position (an artifact of
   * perspective distance, not actual geometry differences).
   */
  const layout = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const rawHeight = size.y > 0 ? size.y : 1;
    const scale = CHARACTER_TARGET_HEIGHT / rawHeight;

    const modelPosition: [number, number, number] = [
      -center.x * scale, // re-centre X on local origin
      -box.min.y * scale, // feet on the floor
      -center.z * scale, // re-centre Z on local origin
    ];

    // headY/headRadius are pure functions of the shared target constants, so
    // they are — by construction — identical across every character instance.
    const headY = modelPosition[1] + CHARACTER_TARGET_HEIGHT * CHARACTER_HEAD_Y_FRACTION;
    const headRadius = CHARACTER_TARGET_HEIGHT * CHARACTER_HEAD_RADIUS_FRACTION;

    return { scale, modelPosition, headY, headRadius, rawSize: size.clone() };
  }, [cloned]);

  // Dev-only verification: confirms all three characters measure identically.
  // Open the browser console and compare the `scale` value across the three
  // "aria" / "rex" / "sol" log lines — they must match (within rounding error).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    // eslint-disable-next-line no-console
    console.log('[Character bbox check]', {
      color,
      rawSize: layout.rawSize.toArray().map((n) => Number(n.toFixed(4))),
      scale: Number(layout.scale.toFixed(4)),
      modelPosition: layout.modelPosition.map((n) => Number(n.toFixed(4))),
      headY: Number(layout.headY.toFixed(4)),
      headRadius: Number(layout.headRadius.toFixed(4)),
    });
  }, [color, layout]);

  const bubbleY = layout.headY + layout.headRadius + 0.32;

  return (
    <>
      <primitive object={cloned} position={layout.modelPosition} scale={layout.scale} />

      {/*
       * ── Face plane ──
       * Direct child of this same render tree, positioned from the SAME
       * measured head data used to draw the model — never a hardcoded or
       * copied world-space coordinate.
       */}
      <group position={[0, layout.headY, 0]}>
        <CharacterFace headRadius={layout.headRadius} />
      </group>

      {speakingMessage && <SpeechBubble message={speakingMessage} yOffset={bubbleY} />}
    </>
  );
}

// ─── Fallback (shown while model loads) ──────────────────────────────────────

function BuddyFallback({ color }: { color: string }) {
  return (
    <mesh position={[0, CHARACTER_TARGET_HEIGHT * 0.45 + CHAIR_SEAT_HEIGHT, 0]} castShadow>
      <capsuleGeometry args={[0.22, CHARACTER_TARGET_HEIGHT * 0.55, 8, 12]} />
      <meshStandardMaterial color={color} roughness={0.4} />
    </mesh>
  );
}

// ─── Character — the single public entry point for rendering a character ─────

/**
 * The one and only Character component in the codebase.
 * Takes a CharacterConfig (color + seat angle) and renders the buddy model,
 * face plane, and speech bubble as one unit, seated at the config's seat angle.
 *
 * No size/scale prop exists here or anywhere downstream — CharacterBody derives
 * identical sizing for every instance from a shared runtime measurement.
 */
export default function Character({ config, speakingMessage }: CharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const swayPhase = useRef(Math.random() * Math.PI * 2);

  const [px, , pz] = seatPosition(config.seatAngleDeg);
  const facingRad = seatFacingAngle(config.seatAngleDeg);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    swayPhase.current += delta * 0.65;
    groupRef.current.rotation.z = Math.sin(swayPhase.current) * 0.016;
  });

  return (
    <group ref={groupRef} position={[px, CHAIR_SEAT_HEIGHT, pz]} rotation={[0, facingRad, 0]}>
      <Suspense fallback={<BuddyFallback color={config.color} />}>
        <CharacterBody color={config.color} speakingMessage={speakingMessage} />
      </Suspense>
    </group>
  );
}
