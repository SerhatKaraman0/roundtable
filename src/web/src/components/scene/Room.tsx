'use client';

import { ContactShadows } from '@react-three/drei';
import { ROOM_WIDTH, ROOM_HEIGHT, ROOM_DEPTH, TABLE_RADIUS } from '@/lib/constants';

/**
 * Enclosed dining room with:
 *   - Warm off-white upper walls + darker wainscoting panels
 *   - Parquet-style warm wood floor
 *   - Ceiling with a central pendant light fixture (visual geometry)
 *   - A circular rug under the table
 *   - One picture frame placeholder on the north wall
 *   - Contact shadows on the floor
 */
export default function Room() {
  const hw = ROOM_WIDTH / 2;
  const hd = ROOM_DEPTH / 2;
  const rh = ROOM_HEIGHT;

  // ── Color palette ────────────────────────────────────────────────────────
  const upperWallColor  = '#e8dfd0';  // warm off-white
  const wainscotColor   = '#c9b99a';  // darker warm tan panel
  const floorColor      = '#8b6914';  // warm parquet wood
  const floorDarkColor  = '#6b4e10';  // alternate parquet strip
  const ceilingColor    = '#f0e8d8';  // slightly warm white
  const moldingColor    = '#d4c4aa';  // cornice / baseboard
  const rugColor        = '#7c3030';  // deep red rug

  const wainscotH = 0.9;   // height of the lower wall panel
  const wainscotY = wainscotH / 2;
  const upperH    = rh - wainscotH;
  const upperY    = wainscotH + upperH / 2;

  // ── Pendant fixture geometry ─────────────────────────────────────────────
  const pendantY = rh - 0.04; // just below ceiling

  return (
    <group>

      {/* ════ FLOOR ════ */}
      {/* Base warm wood */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial color={floorColor} roughness={0.75} metalness={0.05} />
      </mesh>
      {/* Parquet plank stripes — alternating darker strips along Z */}
      {Array.from({ length: 7 }, (_, i) => i - 3).map((i) => (
        <mesh
          key={`plank-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[i * 0.82, 0.001, 0]}
          receiveShadow
        >
          <planeGeometry args={[0.38, ROOM_DEPTH]} />
          <meshStandardMaterial color={floorDarkColor} roughness={0.78} metalness={0.04} />
        </mesh>
      ))}

      {/* ════ CIRCULAR RUG under the table ════ */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <circleGeometry args={[TABLE_RADIUS + 1.1, 32]} />
        <meshStandardMaterial color={rugColor} roughness={0.95} />
      </mesh>
      {/* Rug border ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[TABLE_RADIUS + 0.95, TABLE_RADIUS + 1.1, 32]} />
        <meshStandardMaterial color="#5a1f1f" roughness={0.95} />
      </mesh>

      {/* ════ CEILING ════ */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, rh, 0]}>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial color={ceilingColor} roughness={0.9} />
      </mesh>

      {/* ════ WALLS — each wall: lower wainscot panel + upper painted section ════ */}

      {/* ── North wall (back, behind the front/opposite character) ── */}
      {/* Upper */}
      <mesh position={[0, upperY, -hd + 0.001]}>
        <planeGeometry args={[ROOM_WIDTH, upperH]} />
        <meshStandardMaterial color={upperWallColor} roughness={0.88} />
      </mesh>
      {/* Wainscot */}
      <mesh position={[0, wainscotY, -hd + 0.002]}>
        <planeGeometry args={[ROOM_WIDTH, wainscotH]} />
        <meshStandardMaterial color={wainscotColor} roughness={0.9} />
      </mesh>
      {/* Wainscot cap rail (thin horizontal molding strip) */}
      <mesh position={[0, wainscotH + 0.025, -hd + 0.003]}>
        <boxGeometry args={[ROOM_WIDTH, 0.05, 0.04]} />
        <meshStandardMaterial color={moldingColor} roughness={0.7} />
      </mesh>
      {/* Baseboard */}
      <mesh position={[0, 0.045, -hd + 0.003]}>
        <boxGeometry args={[ROOM_WIDTH, 0.09, 0.04]} />
        <meshStandardMaterial color={moldingColor} roughness={0.7} />
      </mesh>

      {/* Picture frame on north wall */}
      <group position={[0, 1.8, -hd + 0.06]}>
        {/* Frame border */}
        <mesh>
          <boxGeometry args={[1.1, 0.75, 0.03]} />
          <meshStandardMaterial color="#5c3d1e" roughness={0.6} />
        </mesh>
        {/* Canvas inside */}
        <mesh position={[0, 0, 0.022]}>
          <planeGeometry args={[0.92, 0.58]} />
          <meshStandardMaterial color="#a8c4a2" roughness={0.95} />
        </mesh>
      </group>

      {/* Additional painting on north wall - left side */}
      <group position={[-3.5, 1.6, -hd + 0.06]}>
        <mesh>
          <boxGeometry args={[0.9, 1.2, 0.03]} />
          <meshStandardMaterial color="#4a3d2e" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.022]}>
          <planeGeometry args={[0.75, 1.05]} />
          <meshStandardMaterial color="#c4b8a8" roughness={0.95} />
        </mesh>
      </group>

      {/* Additional painting on north wall - right side */}
      <group position={[3.5, 1.6, -hd + 0.06]}>
        <mesh>
          <boxGeometry args={[0.9, 1.2, 0.03]} />
          <meshStandardMaterial color="#4a3d2e" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.022]}>
          <planeGeometry args={[0.75, 1.05]} />
          <meshStandardMaterial color="#d4c8b8" roughness={0.95} />
        </mesh>
      </group>

      {/* ── South wall (front, behind the user) ── */}
      <group rotation={[0, Math.PI, 0]} position={[0, 0, hd]}>
        <mesh position={[0, upperY, 0.001]}>
          <planeGeometry args={[ROOM_WIDTH, upperH]} />
          <meshStandardMaterial color={upperWallColor} roughness={0.88} />
        </mesh>
        <mesh position={[0, wainscotY, 0.002]}>
          <planeGeometry args={[ROOM_WIDTH, wainscotH]} />
          <meshStandardMaterial color={wainscotColor} roughness={0.9} />
        </mesh>
        <mesh position={[0, wainscotH + 0.025, 0.003]}>
          <boxGeometry args={[ROOM_WIDTH, 0.05, 0.04]} />
          <meshStandardMaterial color={moldingColor} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.045, 0.003]}>
          <boxGeometry args={[ROOM_WIDTH, 0.09, 0.04]} />
          <meshStandardMaterial color={moldingColor} roughness={0.7} />
        </mesh>

        {/* Painting on south wall */}
        <group position={[0, 1.7, 0.06]}>
          <mesh>
            <boxGeometry args={[1.2, 0.9, 0.03]} />
            <meshStandardMaterial color="#4a3d2e" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.022]}>
            <planeGeometry args={[1.05, 0.75]} />
            <meshStandardMaterial color="#d4c8b8" roughness={0.95} />
          </mesh>
        </group>
      </group>

      {/* ── West wall (left from user's view) ── */}
      <group rotation={[0, Math.PI / 2, 0]} position={[-hw, 0, 0]}>
        <mesh position={[0, upperY, 0.001]}>
          <planeGeometry args={[ROOM_DEPTH, upperH]} />
          <meshStandardMaterial color={upperWallColor} roughness={0.88} />
        </mesh>
        <mesh position={[0, wainscotY, 0.002]}>
          <planeGeometry args={[ROOM_DEPTH, wainscotH]} />
          <meshStandardMaterial color={wainscotColor} roughness={0.9} />
        </mesh>
        <mesh position={[0, wainscotH + 0.025, 0.003]}>
          <boxGeometry args={[ROOM_DEPTH, 0.05, 0.04]} />
          <meshStandardMaterial color={moldingColor} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.045, 0.003]}>
          <boxGeometry args={[ROOM_DEPTH, 0.09, 0.04]} />
          <meshStandardMaterial color={moldingColor} roughness={0.7} />
        </mesh>

        {/* Painting on west wall */}
        <group position={[0, 1.7, 0.06]}>
          <mesh>
            <boxGeometry args={[1.0, 0.8, 0.03]} />
            <meshStandardMaterial color="#5c4d3e" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.022]}>
            <planeGeometry args={[0.85, 0.65]} />
            <meshStandardMaterial color="#b8a898" roughness={0.95} />
          </mesh>
        </group>
      </group>

      {/* ── East wall (right from user's view) ── */}
      <group rotation={[0, -Math.PI / 2, 0]} position={[hw, 0, 0]}>
        <mesh position={[0, upperY, 0.001]}>
          <planeGeometry args={[ROOM_DEPTH, upperH]} />
          <meshStandardMaterial color={upperWallColor} roughness={0.88} />
        </mesh>
        <mesh position={[0, wainscotY, 0.002]}>
          <planeGeometry args={[ROOM_DEPTH, wainscotH]} />
          <meshStandardMaterial color={wainscotColor} roughness={0.9} />
        </mesh>
        <mesh position={[0, wainscotH + 0.025, 0.003]}>
          <boxGeometry args={[ROOM_DEPTH, 0.05, 0.04]} />
          <meshStandardMaterial color={moldingColor} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.045, 0.003]}>
          <boxGeometry args={[ROOM_DEPTH, 0.09, 0.04]} />
          <meshStandardMaterial color={moldingColor} roughness={0.7} />
        </mesh>

        {/* Painting on east wall */}
        <group position={[0, 1.7, 0.06]}>
          <mesh>
            <boxGeometry args={[1.0, 0.8, 0.03]} />
            <meshStandardMaterial color="#5c4d3e" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.022]}>
            <planeGeometry args={[0.85, 0.65]} />
            <meshStandardMaterial color="#c8b8a8" roughness={0.95} />
          </mesh>
        </group>
      </group>

      {/* ════ PENDANT LIGHT FIXTURE (visual only — actual light is in Lighting.tsx) ════ */}
      <group position={[0, pendantY, 0]}>
        {/* Ceiling canopy disc */}
        <mesh>
          <cylinderGeometry args={[0.12, 0.12, 0.04, 16]} />
          <meshStandardMaterial color="#b8a88a" roughness={0.5} metalness={0.3} />
        </mesh>
        {/* Cord */}
        <mesh position={[0, -0.55, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 1.0, 6]} />
          <meshStandardMaterial color="#5a4a2a" roughness={0.9} />
        </mesh>
        {/* Shade — open-bottom cone */}
        <mesh position={[0, -1.1, 0]}>
          <cylinderGeometry args={[0.28, 0.16, 0.28, 16, 1, true]} />
          <meshStandardMaterial
            color="#d4b483"
            roughness={0.4}
            metalness={0.15}
            side={2} /* DoubleSide */
          />
        </mesh>
        {/* Inner shade (emissive glow to mimic lit bulb warm wash) */}
        <mesh position={[0, -1.1, 0]}>
          <cylinderGeometry args={[0.27, 0.15, 0.27, 16, 1, true]} />
          <meshStandardMaterial
            color="#ffcc80"
            emissive="#ff8800"
            emissiveIntensity={0.7}
            roughness={1}
            side={2}
          />
        </mesh>
        {/* Bulb sphere */}
        <mesh position={[0, -1.0, 0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial
            color="#ffcc80"
            emissive="#ff6600"
            emissiveIntensity={2}
            roughness={0.1}
          />
        </mesh>
      </group>

      {/* ════ CEILING CORNICE around the perimeter ════ */}
      {/* North & South strips */}
      {([-1, 1] as const).map((sign) => (
        <mesh key={`cornice-ns-${sign}`} position={[0, rh - 0.08, sign * (hd - 0.02)]}>
          <boxGeometry args={[ROOM_WIDTH, 0.16, 0.1]} />
          <meshStandardMaterial color={moldingColor} roughness={0.7} />
        </mesh>
      ))}
      {/* East & West strips */}
      {([-1, 1] as const).map((sign) => (
        <mesh key={`cornice-ew-${sign}`} position={[sign * (hw - 0.02), rh - 0.08, 0]}>
          <boxGeometry args={[0.1, 0.16, ROOM_DEPTH]} />
          <meshStandardMaterial color={moldingColor} roughness={0.7} />
        </mesh>
      ))}

      {/*
       * ════ CONTACT SHADOWS on the floor ════
       * frames={1} renders the shadow pass ONCE and caches it, instead of the
       * default (every frame). ContactShadows does a full offscreen render +
       * blur pass, which is one of the more expensive things in this scene;
       * since the room/table are static and character sway is subtle, a
       * static cached shadow is visually indistinguishable but far cheaper.
       */}
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.55}
        scale={12}
        blur={2.0}
        far={4}
        color="#3a2800"
        frames={1}
      />

    </group>
  );
}
