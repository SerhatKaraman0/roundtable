import { CharacterConfig } from '@/types';
import { SEAT_ANGLES_DEG, seatPosition, seatFacingAngle } from './constants';

/**
 * Three characters, each with a distinct political/ideological aesthetic.
 * Seats are at exactly 90° from the user (and from each other).
 *
 * Layout (bird's-eye view, angle from +Z axis):
 *
 *          180° — Aria (Communist, red)
 *                   │
 *   90° Rex ────── [table] ────── 270° Sol
 *   (Anarchist)                  (Libertarian)
 *                   │
 *                 0° — User
 *
 * Each pair of adjacent seats: 90° apart exactly.
 */
export const CHARACTERS: CharacterConfig[] = [
  {
    id: 'aria',
    name: 'Aria',
    ideology: 'communist',
    seatAngleDeg: SEAT_ANGLES_DEG.front,   // 180° — directly opposite user
    color: '#B0102A',                        // darker, saturated communist red
    accentColor: '#FFD700',                  // gold accent for optional star detail
    personality: 'idealistic and resolute',
  },
  {
    id: 'rex',
    name: 'Rex',
    ideology: 'anarchist',
    seatAngleDeg: SEAT_ANGLES_DEG.left,    // 90° — user's left
    color: '#1a1a1a',                        // near-black (anarchist black flag)
    accentColor: '#C8102E',                  // red accent (black-red anarchist flag)
    personality: 'provocative and free-spirited',
  },
  {
    id: 'sol',
    name: 'Sol',
    ideology: 'libertarian',
    seatAngleDeg: SEAT_ANGLES_DEG.right,   // 270° — user's right
    color: '#D4A017',                        // deeper, saturated libertarian gold
    accentColor: '#c9920a',                  // deeper gold accent
    personality: 'individualist and pragmatic',
  },
];

/**
 * Convenience re-exports so Character.tsx doesn't need to import from constants directly.
 * These delegate to the typed constants functions for full consistency.
 */
export { seatPosition, seatFacingAngle };

/** Stub reply generator — replace with real AI/backend call */
export function generateStubReply(characterId: string, userMessage: string): string {
  const char = CHARACTERS.find((c) => c.id === characterId);
  const name = char?.name ?? characterId;
  const personality = char?.personality ?? 'friendly';

  const stubs = [
    `Hmm, that's interesting! "${userMessage}" — I'm ${name}, and I find that ${personality}.`,
    `As someone who is ${personality}, I'd say: ${userMessage.length > 20 ? userMessage.slice(0, 20) + '…' : userMessage} is quite thought-provoking.`,
    `Great point! I'm ${name} and I think we should explore that further.`,
    `${userMessage.endsWith('?') ? 'Great question!' : 'Interesting!'} My ${personality} side wants to dig deeper.`,
    `I was just thinking about something similar! Thanks for sharing, ${name} here.`,
  ];

  return stubs[Math.floor(Math.random() * stubs.length)];
}
