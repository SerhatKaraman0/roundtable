// ─── Chat ────────────────────────────────────────────────────────────────────

export type CharacterId = 'marx' | 'bakunin' | 'mill';

export interface ChatMessage {
  id: string;
  /** 'user' for the player's own messages, or character ID for character messages */
  senderId: 'user' | 'marx' | 'bakunin' | 'mill';
  senderName: string;
  text: string;
  timestamp: number;
}

export interface QuestionGroup {
  id: string;
  questionText: string;
  timestamp: number;
  responses: ChatMessage[];
}

export type QuestionPhase = 'entering' | 'pinned' | 'exiting';

export interface ActiveQuestion {
  text: string;
  phase: QuestionPhase;
}

// ─── Characters ──────────────────────────────────────────────────────────────

export interface PortraitCrop {
  /** Face centre X, 0–1 left → right of the source image. */
  cx: number;
  /** Face centre Y, 0–1 top → bottom of the source image. */
  cy: number;
  /** Crop width as a fraction of the source image width. Height follows the face-plate aspect. */
  width: number;
}

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
  /** Public URL of the portrait mapped onto the face plate. */
  portraitSrc: string;
  /** Face-only crop used to fill the face plate. */
  portraitCrop: PortraitCrop;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export interface SpeakingEntry {
  characterId: string;
  message: string;
}

export interface ChatStore {
  /** Question groups instead of flat message list */
  questionGroups: QuestionGroup[];
  speakingEntries: SpeakingEntry[];
  thinkingCharacterIds: string[];
  isPointerLocked: boolean;
  isChatFocused: boolean;
  activeQuestion: ActiveQuestion | null;
  isHistoryPanelOpen: boolean;
  expandedQuestionId: string | null;
  backendError: string;

  sendUserMessage: (text: string) => void;
  addMessage: (msg: ChatMessage) => void;
  setSpeakingEntries: (entries: SpeakingEntry[]) => void;
  setThinkingCharacterIds: (ids: string[]) => void;
  setPointerLocked: (locked: boolean) => void;
  setChatFocused: (focused: boolean) => void;
  setActiveQuestion: (question: ActiveQuestion | null) => void;
  setHistoryPanelOpen: (open: boolean) => void;
  setExpandedQuestionId: (id: string | null) => void;
  setBackendError: (error: string) => void;
}
