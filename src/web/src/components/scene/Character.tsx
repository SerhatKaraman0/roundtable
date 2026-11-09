'use client';

import { useRef, useMemo, useEffect, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { CharacterConfig } from '@/types';
import { useChatStore } from '@/store/useChatStore';
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
  accentColor,
  speakingMessage,
  isThinking,
  portraitSrc,
  portraitCrop,
}: {
  color: string;
  accentColor?: string;
  speakingMessage?: string;
  isThinking?: boolean;
  portraitSrc: string;
  portraitCrop: CharacterConfig['portraitCrop'];
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

  // Subtle warm body emissive boost during speech
  useEffect(() => {
    if (speakingMessage) {
      mat.emissive.set('#8f4e1f');
      mat.emissiveIntensity = 0.28;
    } else {
      mat.emissive.set('#000000');
      mat.emissiveIntensity = 0.0;
    }
  }, [speakingMessage, mat]);

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

    const headY = modelPosition[1] + CHARACTER_TARGET_HEIGHT * CHARACTER_HEAD_Y_FRACTION;
    const headRadius = CHARACTER_TARGET_HEIGHT * CHARACTER_HEAD_RADIUS_FRACTION;

    return { scale, modelPosition, headY, headRadius, rawSize: size.clone() };
  }, [cloned]);

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
        <CharacterFace
          headRadius={layout.headRadius}
          portraitSrc={portraitSrc}
          portraitCrop={portraitCrop}
        />
      </group>

      <SpeechBubble
        message={speakingMessage}
        isThinking={isThinking}
        yOffset={bubbleY}
        accentColor={accentColor}
      />
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
 * face plane, ground speaker halo, and speech bubble as one unit, seated at the config's seat angle.
 */
export default function Character({ config, speakingMessage }: CharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const isThinking = useChatStore((s) => s.thinkingCharacterIds.includes(config.id));

  const swayPhase = useRef(Math.random() * Math.PI * 2);
  const targetRotationY = useRef(0);
  const currentRotationY = useRef(0);

  const [px, , pz] = seatPosition(config.seatAngleDeg);
  const facingRad = seatFacingAngle(config.seatAngleDeg);

  // Calculate target rotation when speaking (turn toward user at 0°)
  useEffect(() => {
    if (speakingMessage) {
      let turnAmount = 0;
      if (config.seatAngleDeg === 180) {
        turnAmount = 0.1;
      } else if (config.seatAngleDeg === 90) {
        turnAmount = 0.69;
      } else if (config.seatAngleDeg === 270) {
        turnAmount = -0.69;
      }
      targetRotationY.current = turnAmount;
    } else {
      targetRotationY.current = 0;
    }
  }, [speakingMessage, config.seatAngleDeg]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Gentle sway animation (subtle breathing/alive motion)
    swayPhase.current += delta * 0.8;
    const swayAmount = Math.sin(swayPhase.current) * 0.02;
    groupRef.current.rotation.z = swayAmount;

    // Smoothly interpolate Y rotation toward target (turn toward user when speaking)
    const lerpSpeed = 3.0;
    currentRotationY.current += (targetRotationY.current - currentRotationY.current) * lerpSpeed * delta;
    groupRef.current.rotation.y = facingRad + currentRotationY.current;

    // Smoothly lerp speaking halo opacity at the character's feet
    if (haloMatRef.current) {
      const targetOpacity = speakingMessage ? 0.62 : 0.0;
      haloMatRef.current.opacity += (targetOpacity - haloMatRef.current.opacity) * 6.0 * delta;
    }
  });

  return (
    <group ref={groupRef} position={[px, CHAIR_SEAT_HEIGHT, pz]}>
      {/* 3D Active speaker halo ring at chair base / rug level */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -CHAIR_SEAT_HEIGHT + 0.006, 0]}>
        <ringGeometry args={[0.42, 0.7, 36]} />
        <meshBasicMaterial
          ref={haloMatRef}
          color="#f2be6b"
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <Suspense fallback={<BuddyFallback color={config.color} />}>
        <CharacterBody
          color={config.color}
          accentColor={
            config.id === 'marx'
              ? '#8B1E2B'
              : config.id === 'bakunin'
              ? '#38302B'
              : config.id === 'mill'
              ? '#A0751A'
              : '#8C6D46'
          }
          speakingMessage={speakingMessage}
          isThinking={isThinking}
          portraitSrc={config.portraitSrc}
          portraitCrop={config.portraitCrop}
        />
      </Suspense>
    </group>
  );
}
