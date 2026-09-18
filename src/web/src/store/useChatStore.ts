import { create } from 'zustand';
import { ChatMessage, ChatStore, SpeakingEntry } from '@/types';
import { CHARACTERS, generateStubReply } from '@/lib/characters';
import { BUBBLE_DURATION_MS, MAX_MESSAGES } from '@/lib/constants';

let messageIdCounter = 0;
function nextId(): string {
  return `msg_${++messageIdCounter}_${Date.now()}`;
}

// Round-robin index for character responses
let lastResponderIndex = -1;

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  speakingEntries: [],
  isPointerLocked: false,
  isChatFocused: false,

  sendUserMessage: (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Add the user's own message to the transcript
    const userMsg: ChatMessage = {
      id: nextId(),
      senderId: 'user',
      senderName: 'You',
      text: trimmed,
      timestamp: Date.now(),
    };
    get().addMessage(userMsg);

    // TODO: replace with real AI/backend call
    // Pick next character in round-robin order
    lastResponderIndex = (lastResponderIndex + 1) % CHARACTERS.length;
    const responder = CHARACTERS[lastResponderIndex];
    const replyText = generateStubReply(responder.id, trimmed);

    // Small delay to feel natural
    setTimeout(() => {
      // Character replies are NOT added to `messages` — they appear only as
      // 3D speech bubbles above the character's head, not in the chat panel.
      const entry: SpeakingEntry = { characterId: responder.id, message: replyText };
      set((state) => ({
        speakingEntries: [
          ...state.speakingEntries.filter((e) => e.characterId !== responder.id),
          entry,
        ],
      }));

      // Auto-clear bubble after duration
      setTimeout(() => {
        set((state) => ({
          speakingEntries: state.speakingEntries.filter(
            (e) => !(e.characterId === responder.id && e.message === replyText),
          ),
        }));
      }, BUBBLE_DURATION_MS);
    }, 800);
  },

  addMessage: (msg: ChatMessage) => {
    set((state) => ({
      messages: [...state.messages.slice(-(MAX_MESSAGES - 1)), msg],
    }));
  },

  setSpeakingEntries: (entries: SpeakingEntry[]) => {
    set({ speakingEntries: entries });
  },

  setPointerLocked: (locked: boolean) => {
    set({ isPointerLocked: locked });
  },

  setChatFocused: (focused: boolean) => {
    set({ isChatFocused: focused });
  },
}));
