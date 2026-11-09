'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * First-person hands — a pair of forearms resting on the near table edge,
 * rendered as children of the camera so they always stay in view.
 *
 * Technique: the hands group is positioned in CAMERA LOCAL SPACE using
 * a separate Object3D that is parented to the camera each frame.
 * This keeps them locked to the camera regardless of look direction.
 *
 * Layout (in camera-local space, units relative to camera):
 *   - forward  = -Z
 *   - right    = +X
 *   - down     = -Y
 *
 * The forearms point forward-down so they look like hands resting on a table.
 */

const SKIN_COLOR = '#c68642';
const SLEEVE_COLOR = '#1a2540';

// Hand geometry constants (camera-local space)
const HAND_Y = -0.22;     // below centre of screen (raised for better visibility)
const HAND_Z = -0.32;     // in front of camera (closer for better visibility)
const HAND_SPREAD = 0.18; // X distance each hand is from centre (wider spread)

export default function PlayerHands() {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  // Attach the group to the camera so it moves with the view
  useFrame(() => {
    if (!groupRef.current) return;
    // Re-parent to camera every frame to stay in camera local space
    if (groupRef.current.parent !== camera) {
      camera.add(groupRef.current);
    }
  });

  return (
    <group ref={groupRef}>
      <Hand side="left" />
      <Hand side="right" />
    </group>
  );
}

function Hand({ side }: { side: 'left' | 'right' }) {
  const sign = side === 'left' ? -1 : 1;
  const x = sign * HAND_SPREAD;

  // Forearm tilts slightly downward and forward
  const forearmTiltX = 0.35; // radians — pointing down-forward
  const forearmTiltZ = sign * 0.05; // slight outward splay

  return (
    <group position={[x, HAND_Y, HAND_Z]} rotation={[forearmTiltX, 0, forearmTiltZ]}>
      {/* Simple forearm sleeve */}
      <mesh castShadow>
        <cylinderGeometry args={[0.04, 0.045, 0.25, 12]} />
        <meshStandardMaterial color={SLEEVE_COLOR} roughness={0.85} />
      </mesh>

      {/* Simple hand */}
      <mesh position={[0, -0.15, 0.02]} rotation={[0.1, 0, 0]}>
        <boxGeometry args={[0.07, 0.05, 0.12]} />
        <meshStandardMaterial color={SKIN_COLOR} roughness={0.65} />
      </mesh>

      {/* Simple thumb */}
      <mesh
        position={[sign * 0.04, -0.14, 0.04]}
        rotation={[0.1, 0, sign * 0.5]}
      >
        <capsuleGeometry args={[0.015, 0.05, 4, 8]} />
        <meshStandardMaterial color={SKIN_COLOR} roughness={0.65} />
      </mesh>

      {/* Simple fingers */}
      {[0, 1, 2, 3].map((i) => {
        const fx = (i - 1.5) * 0.02;
        return (
          <mesh key={i} position={[fx, -0.20, 0.05]} rotation={[0.15, 0, 0]}>
            <capsuleGeometry args={[0.012, 0.06, 4, 8]} />
            <meshStandardMaterial color={SKIN_COLOR} roughness={0.65} />
          </mesh>
        );
      })}
    </group>
  );
}
