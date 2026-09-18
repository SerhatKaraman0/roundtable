// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  /** 'user' for the player's own messages. Character messages are NOT stored here —
   *  they live only in speakingEntries to drive speech bubbles. */
  senderId: 'user';
  senderName: string;
  text: string;
  timestamp: number;
}

// ─── Characters ──────────────────────────────────────────────────────────────

export interface CharacterConfig {
  id: string;
  name: string;
  ideology: 'communist' | 'anarchist' | 'libertarian';
  /** Seat angle in degrees, measured from positive-Z axis */
  seatAngleDeg: number;
  /** Primary body color (hex string) */
  color: string;
  /** Secondary accent color — used for ideological detail hints */
  accentColor: string;
  /** Brief personality hint for stub replies */
  personality: string;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export interface SpeakingEntry {
  characterId: string;
  message: string;
}

export interface ChatStore {
  /** Only the user's own sent messages — character replies are bubbles only. */
  messages: ChatMessage[];
  speakingEntries: SpeakingEntry[];
  isPointerLocked: boolean;
  isChatFocused: boolean;

  sendUserMessage: (text: string) => void;
  addMessage: (msg: ChatMessage) => void;
  setSpeakingEntries: (entries: SpeakingEntry[]) => void;
  setPointerLocked: (locked: boolean) => void;
  setChatFocused: (focused: boolean) => void;
}
