import { CharacterConfig } from '@/types';
import { SEAT_ANGLES_DEG, seatPosition, seatFacingAngle } from './constants';

/**
 * Three characters, each with a distinct political/ideological aesthetic.
 * Seats are at exactly 90° from the user (and from each other).
 *
 * Layout (bird's-eye view, angle from +Z axis):
 *
 *          180° — Marx (Communist, red)
 *                   │
 *   90° Bakunin ──── [table] ────── 270° Mill
 *   (Anarchist)                  (Libertarian)
 *                   │
 *                 0° — User
 *
 * Each pair of adjacent seats: 90° apart exactly.
 */
export const CHARACTERS: CharacterConfig[] = [
  {
    id: 'marx',
    name: 'Marx',
    ideology: 'communist',
    seatAngleDeg: SEAT_ANGLES_DEG.front,   // 180° — directly opposite user
    color: '#8B1E2B',                        // muted antique seal red (~20% desaturated)
    accentColor: '#B8860B',                  // antique gold accent
    personality: 'idealistic and resolute',
    portraitSrc: '/imgs/Karl_Marx.jpeg',
    portraitCrop: { cx: 0.57, cy: 0.36, width: 0.50 },
  },
  {
    id: 'bakunin',
    name: 'Bakunin',
    ideology: 'anarchist',
    seatAngleDeg: SEAT_ANGLES_DEG.left,    // 90° — user's left
    color: '#2E2724',                        // antique lamp-black charcoal
    accentColor: '#8B1E2B',                  // antique red accent
    personality: 'provocative and free-spirited',
    portraitSrc: '/imgs/Mikhail_Bakunin.jpg',
    portraitCrop: { cx: 0.54, cy: 0.35, width: 0.48 },
  },
  {
    id: 'mill',
    name: 'Mill',
    ideology: 'libertarian',
    seatAngleDeg: SEAT_ANGLES_DEG.right,   // 270° — user's right
    color: '#A0751A',                        // muted antique ochre gold (~20% desaturated)
    accentColor: '#7A5B18',                  // deeper antique gold accent
    personality: 'individualist and pragmatic',
    portraitSrc: '/imgs/John_Stuart_Mill.jpg',
    portraitCrop: { cx: 0.50, cy: 0.32, width: 0.72 },
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
