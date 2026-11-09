import { create } from 'zustand';
import { ChatMessage, ChatStore, SpeakingEntry, QuestionGroup, ActiveQuestion } from '@/types';
import { CHARACTERS } from '@/lib/characters';
import { BUBBLE_DURATION_MS, MAX_MESSAGES } from '@/lib/constants';
import { parseCommand } from '@/lib/parseCommand';
import { asCharacterId, sendChatToBackend } from '@/lib/backend';

let messageIdCounter = 0;
function nextId(): string {
  return `msg_${++messageIdCounter}_${Date.now()}`;
}

let questionIdCounter = 0;
function nextQuestionId(): string {
  return `q_${++questionIdCounter}_${Date.now()}`;
}

// Round-robin index for character responses
let lastResponderIndex = -1;

function appendMessageToGroup(
  groups: QuestionGroup[],
  groupId: string,
  msg: ChatMessage,
): QuestionGroup[] {
  return groups.map((g) => {
    if (g.id === groupId) {
      return {
        ...g,
        responses: [...g.responses, msg],
      };
    }
    return g;
  });
}

function mentionedTargets(text: string): ('marx' | 'bakunin' | 'mill')[] {
  const lower = text.toLowerCase();
  const targets: ('marx' | 'bakunin' | 'mill')[] = [];
  if (/\bmarx\b/.test(lower)) targets.push('marx');
  if (/\bbakunin\b/.test(lower)) targets.push('bakunin');
  if (/\bmill\b/.test(lower)) targets.push('mill');
  return targets;
}

function requestBackendAnswer(
  set: (partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>)) => void,
  get: () => ChatStore,
  threadId: string,
  targets: ('marx' | 'bakunin' | 'mill')[],
  question: string,
) {
  set((state) => ({
    backendError: '',
    thinkingCharacterIds: Array.from(new Set([...state.thinkingCharacterIds, ...targets])),
  }));
  const history = get().questionGroups.find((group) => group.id === threadId)?.responses ?? [];
  void sendChatToBackend(question, targets, history.slice(0, -1))
    .then((response) => {
      set((state) => {
        let groups = state.questionGroups;
        const speakingEntries = [...state.speakingEntries];
        response.outputs.forEach((output) => {
          const characterId = asCharacterId(output.author, targets[0] ?? 'marx');
          const character = CHARACTERS.find((item) => item.id === characterId);
          const text = output.text.trim();
          if (!text) return;

          groups = appendMessageToGroup(groups, threadId, {
            id: nextId(),
            senderId: characterId,
            senderName: character?.name ?? characterId,
            text,
            timestamp: Date.now(),
          });
          const entry = { characterId, message: text };
          const existingIndex = speakingEntries.findIndex((item) => item.characterId === characterId);
          if (existingIndex >= 0) speakingEntries[existingIndex] = entry;
          else speakingEntries.push(entry);

          setTimeout(() => {
            set((current) => ({
              speakingEntries: current.speakingEntries.filter(
                (item) => !(item.characterId === characterId && item.message === text),
              ),
            }));
          }, BUBBLE_DURATION_MS);
        });
        return {
          questionGroups: groups,
          speakingEntries,
          thinkingCharacterIds: state.thinkingCharacterIds.filter((id) => !targets.includes(id as 'marx' | 'bakunin' | 'mill')),
          backendError: response.detail ?? '',
        };
      });
    })
    .catch((error: unknown) => {
      set((state) => ({
        thinkingCharacterIds: state.thinkingCharacterIds.filter((id) => !targets.includes(id as 'marx' | 'bakunin' | 'mill')),
        backendError: error instanceof Error ? error.message : 'Could not reach the Roundtable backend.',
      }));
    });
}

export const useChatStore = create<ChatStore>((set, get) => ({
  questionGroups: [],
  speakingEntries: [],
  thinkingCharacterIds: [],
  isPointerLocked: false,
  isChatFocused: false,
  activeQuestion: null,
  isHistoryPanelOpen: false,
  expandedQuestionId: null,
  backendError: '',

  sendUserMessage: (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const command = parseCommand(trimmed);

    // Validate command has text content
    if (
      (command.type === 'question' ||
        command.type === 'new-question' ||
        command.type === 'targeted-question') &&
      !command.text
    ) {
      return; // Invalid command, don't submit
    }

    // Handle different command types
    switch (command.type) {
      case 'question': {
        // /question starts a brand-new thread
        const threadId = nextQuestionId();
        const userMsg: ChatMessage = {
          id: nextId(),
          senderId: 'user',
          senderName: 'You',
          text: command.text,
          timestamp: Date.now(),
        };

        const newQuestionGroup: QuestionGroup = {
          id: threadId,
          questionText: command.text,
          timestamp: Date.now(),
          responses: [userMsg],
        };

        set((state) => ({
          questionGroups: [...state.questionGroups, newQuestionGroup],
          thinkingCharacterIds: CHARACTERS.map((c) => c.id),
          activeQuestion: { text: command.text, phase: 'entering' },
        }));

        // Transition active question to pinned after hold time
        setTimeout(() => {
          set((state) => ({
            activeQuestion: state.activeQuestion
              ? { ...state.activeQuestion, phase: 'pinned' }
              : null,
          }));
        }, 1200);

        requestBackendAnswer(set, get, threadId, CHARACTERS.map((char) => char.id as 'marx' | 'bakunin' | 'mill'), command.text);
        break;
      }

      case 'new-question': {
        // /new-question appends under the CURRENT ongoing thread
        const userMsg: ChatMessage = {
          id: nextId(),
          senderId: 'user',
          senderName: 'You (New Question)',
          text: command.text,
          timestamp: Date.now(),
        };

        // Transition old active question out if present
        if (get().activeQuestion) {
          set((state) => ({
            activeQuestion: state.activeQuestion
              ? { ...state.activeQuestion, phase: 'exiting' }
              : null,
          }));
          setTimeout(() => {
            set({ activeQuestion: null });
          }, 500);
        }

        let targetThreadId = '';
        set((state) => {
          if (state.questionGroups.length === 0) {
            targetThreadId = nextQuestionId();
            const initialGroup: QuestionGroup = {
              id: targetThreadId,
              questionText: command.text,
              timestamp: Date.now(),
              responses: [userMsg],
            };
            return {
              questionGroups: [initialGroup],
              thinkingCharacterIds: CHARACTERS.map((c) => c.id),
            };
          }

          const currentGroup = state.questionGroups[state.questionGroups.length - 1];
          targetThreadId = currentGroup.id;
          return {
            questionGroups: appendMessageToGroup(state.questionGroups, targetThreadId, userMsg),
            thinkingCharacterIds: CHARACTERS.map((c) => c.id),
          };
        });

        // Display new question in the QuestionOverlay
        setTimeout(() => {
          set({
            activeQuestion: { text: command.text, phase: 'entering' },
          });

          setTimeout(() => {
            set((state) => ({
              activeQuestion: state.activeQuestion
                ? { ...state.activeQuestion, phase: 'pinned' }
                : null,
            }));
          }, 1200);
        }, 600);

        requestBackendAnswer(set, get, targetThreadId, CHARACTERS.map((char) => char.id as 'marx' | 'bakunin' | 'mill'), command.text);
        break;
      }

      case 'targeted-question': {
        // /question-marx, /question-bakunin, /question-mill appends under the CURRENT ongoing thread
        const targetChar = CHARACTERS.find((c) => c.id === command.targetId);
        const targetName = targetChar ? targetChar.name : command.targetId;

        const targetMsg: ChatMessage = {
          id: nextId(),
          senderId: 'user',
          senderName: `You (to ${targetName})`,
          text: command.text,
          timestamp: Date.now(),
        };

        let targetThreadId = '';
        set((state) => {
          if (state.questionGroups.length === 0) {
            targetThreadId = nextQuestionId();
            const initialGroup: QuestionGroup = {
              id: targetThreadId,
              questionText: `To ${targetName}: ${command.text}`,
              timestamp: Date.now(),
              responses: [targetMsg],
            };
            return {
              questionGroups: [initialGroup],
              thinkingCharacterIds: [command.targetId],
            };
          }

          const currentGroup = state.questionGroups[state.questionGroups.length - 1];
          targetThreadId = currentGroup.id;
          return {
            questionGroups: appendMessageToGroup(state.questionGroups, targetThreadId, targetMsg),
            thinkingCharacterIds: [
              ...state.thinkingCharacterIds.filter((id) => id !== command.targetId),
              command.targetId,
            ],
          };
        });

        // Display targeted inquiry in QuestionOverlay
        set({
          activeQuestion: {
            text: `To ${targetName}: “${command.text}”`,
            phase: 'entering',
          },
        });

        setTimeout(() => {
          set((state) => ({
            activeQuestion: state.activeQuestion
              ? { ...state.activeQuestion, phase: 'pinned' }
              : null,
          }));
        }, 1200);

        requestBackendAnswer(set, get, targetThreadId, [command.targetId], command.text);
        break;
      }

      case 'plain': {
        const plainMsg: ChatMessage = {
          id: nextId(),
          senderId: 'user',
          senderName: 'You',
          text: command.text,
          timestamp: Date.now(),
        };

        let targetThreadId = '';
        set((state) => {
          if (state.questionGroups.length === 0) {
            targetThreadId = nextQuestionId();
            const initialGroup: QuestionGroup = {
              id: targetThreadId,
              questionText: command.text,
              timestamp: Date.now(),
              responses: [plainMsg],
            };
            return {
              questionGroups: [initialGroup],
            };
          }

          const currentGroup = state.questionGroups[state.questionGroups.length - 1];
          targetThreadId = currentGroup.id;
          return {
            questionGroups: appendMessageToGroup(state.questionGroups, targetThreadId, plainMsg),
          };
        });

        const directTargets = mentionedTargets(command.text);
        if (directTargets.length === 0) {
          lastResponderIndex = (lastResponderIndex + 1) % CHARACTERS.length;
          directTargets.push(CHARACTERS[lastResponderIndex].id as 'marx' | 'bakunin' | 'mill');
        }
        set((state) => ({
          thinkingCharacterIds: Array.from(new Set([...state.thinkingCharacterIds, ...directTargets])),
          backendError: '',
        }));
        requestBackendAnswer(set, get, targetThreadId, directTargets, command.text);
        break;
      }
    }
  },

  addMessage: (msg: ChatMessage) => {
    set((state) => {
      if (state.questionGroups.length === 0) {
        const initialGroup: QuestionGroup = {
          id: nextQuestionId(),
          questionText: msg.text,
          timestamp: msg.timestamp,
          responses: [msg],
        };
        return {
          questionGroups: [initialGroup],
        };
      }

      const currentGroup = state.questionGroups[state.questionGroups.length - 1];
      return {
        questionGroups: appendMessageToGroup(state.questionGroups, currentGroup.id, msg),
      };
    });
  },

  setSpeakingEntries: (entries: SpeakingEntry[]) => {
    set({ speakingEntries: entries });
  },

  setThinkingCharacterIds: (ids: string[]) => {
    set({ thinkingCharacterIds: ids });
  },

  setPointerLocked: (locked: boolean) => {
    set({ isPointerLocked: locked });
  },

  setChatFocused: (focused: boolean) => {
    set({ isChatFocused: focused });
  },

  setActiveQuestion: (question: ActiveQuestion | null) => {
    set({ activeQuestion: question });
  },

  setHistoryPanelOpen: (open: boolean) => {
    set({ isHistoryPanelOpen: open });
  },

  setExpandedQuestionId: (id: string | null) => {
    set({ expandedQuestionId: id });
  },

  setBackendError: (error: string) => {
    set({ backendError: error });
  },
}));
