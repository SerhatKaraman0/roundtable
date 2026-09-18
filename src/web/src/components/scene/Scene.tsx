'use client';

import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { memo, useEffect, useState } from 'react';
import { CHARACTERS } from '@/lib/characters';
import { useChatStore } from '@/store/useChatStore';
import { SEAT_ANGLES_DEG, SEAT_RADIUS, seatPosition } from '@/lib/constants';
import Lighting from './Lighting';
import Room from './Room';
import RoundTable from './RoundTable';
import Character from './Character';
import CameraRig from './CameraRig';
import PlayerHands from './PlayerHands';
import Chair from './Chair';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Dev-only sanity check (per explicit request): logs the user's + all three
 * characters' seat positions, confirms every one is the same radius from the
 * table centre, and confirms every adjacent pair around the circle is exactly
 * 90° apart. Runs once on mount, no-ops in production.
 */
function useSeatLayoutVerification() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    const seats = [
      { id: 'user', angleDeg: SEAT_ANGLES_DEG.user },
      ...CHARACTERS.map((c) => ({ id: c.id, angleDeg: c.seatAngleDeg })),
    ];

    const withPositions = seats.map((s) => ({
      ...s,
      position: seatPosition(s.angleDeg),
    }));

    // eslint-disable-next-line no-console
    console.log('[Seat check] positions', withPositions);

    // Radius check — every seat must be SEAT_RADIUS from the table centre
    withPositions.forEach(({ id, position }) => {
      const radius = Math.hypot(position[0], position[2]);
      // eslint-disable-next-line no-console
      console.log(
        `[Seat check] ${id}: radius=${radius.toFixed(4)} (expected ${SEAT_RADIUS.toFixed(4)})`,
      );
    });

    // Pairwise adjacency check — sort by angle, confirm each gap is 90°
    const sorted = [...seats].sort((a, b) => a.angleDeg - b.angleDeg);
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      const b = sorted[(i + 1) % sorted.length];
      const gap = ((b.angleDeg - a.angleDeg) + 360) % 360;
      // eslint-disable-next-line no-console
      console.log(`[Seat check] ${a.id} → ${b.id}: ${gap}°`);
    }
  }, []);
}

/**
 * Root of the 3D scene.
 */
const Scene = memo(function Scene() {
  const speakingEntries = useChatStore((s) => s.speakingEntries);
  const [showStats, setShowStats] = useState(false);

  useSeatLayoutVerification();

  useEffect(() => {
    if (!isDev) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle stats on backtick (`) or F2
      if (e.key === '`' || e.key === 'F2') {
        setShowStats((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Canvas
      camera={{ fov: 72, near: 0.05, far: 100 }}
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      style={{ width: '100%', height: '100%', background: '#0a0a14' }}
    >
      {/* Dev-only FPS/ms/MB overlay — gated behind dev mode and toggled via ` or F2 */}
      {isDev && showStats && <Stats />}

      <CameraRig />
      <Lighting />
      <Room />
      <RoundTable />

      {/* ── Chairs for all four seats ── */}
      <Chair seatAngleDeg={SEAT_ANGLES_DEG.user} />
      {CHARACTERS.map((char) => (
        <Chair key={`chair-${char.id}`} seatAngleDeg={char.seatAngleDeg} />
      ))}

      {CHARACTERS.map((char) => {
        const speaking = speakingEntries.find((e) => e.characterId === char.id);
        return (
          <Character
            key={char.id}
            config={char}
            speakingMessage={speaking?.message}
          />
        );
      })}

      {/* Player hands — parented to camera each frame, always in view */}
      <PlayerHands />
    </Canvas>
  );
});

export default Scene;
