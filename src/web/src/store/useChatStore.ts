import { create } from 'zustand';
import { ChatMessage, ChatStore, SpeakingEntry, QuestionGroup, ActiveQuestion } from '@/types';
import { CHARACTERS, generateStubReply } from '@/lib/characters';
import { BUBBLE_DURATION_MS, MAX_MESSAGES } from '@/lib/constants';
import { parseCommand, ParsedCommand } from '@/lib/parseCommand';

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

export const useChatStore = create<ChatStore>((set, get) => ({
  questionGroups: [],
  speakingEntries: [],
  thinkingCharacterIds: [],
  isPointerLocked: false,
  isChatFocused: false,
  activeQuestion: null,
  isHistoryPanelOpen: false,
  expandedQuestionId: null,

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

        // Staggered replies from all characters
        setTimeout(() => {
          CHARACTERS.forEach((char, index) => {
            setTimeout(() => {
              const replyText = generateStubReply(char.id, command.text);
              const entry: SpeakingEntry = { characterId: char.id, message: replyText };
              const charMsg: ChatMessage = {
                id: nextId(),
                senderId: char.id as 'marx' | 'bakunin' | 'mill',
                senderName: char.name,
                text: replyText,
                timestamp: Date.now(),
              };

              set((state) => ({
                thinkingCharacterIds: state.thinkingCharacterIds.filter((id) => id !== char.id),
                speakingEntries: [
                  ...state.speakingEntries.filter((e) => e.characterId !== char.id),
                  entry,
                ],
                questionGroups: appendMessageToGroup(state.questionGroups, threadId, charMsg),
              }));

              // Auto-clear bubble after duration
              setTimeout(() => {
                set((state) => ({
                  speakingEntries: state.speakingEntries.filter(
                    (e) => !(e.characterId === char.id && e.message === replyText),
                  ),
                }));
              }, BUBBLE_DURATION_MS);
            }, index * 1500);
          });
        }, 1500);
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

        let targetThreadId: string;
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

        // Staggered replies from all characters under this same thread
        setTimeout(() => {
          CHARACTERS.forEach((char, index) => {
            setTimeout(() => {
              const replyText = generateStubReply(char.id, command.text);
              const entry: SpeakingEntry = { characterId: char.id, message: replyText };
              const charMsg: ChatMessage = {
                id: nextId(),
                senderId: char.id as 'marx' | 'bakunin' | 'mill',
                senderName: char.name,
                text: replyText,
                timestamp: Date.now(),
              };

              set((state) => ({
                thinkingCharacterIds: state.thinkingCharacterIds.filter((id) => id !== char.id),
                speakingEntries: [
                  ...state.speakingEntries.filter((e) => e.characterId !== char.id),
                  entry,
                ],
                questionGroups: appendMessageToGroup(state.questionGroups, targetThreadId, charMsg),
              }));

              setTimeout(() => {
                set((state) => ({
                  speakingEntries: state.speakingEntries.filter(
                    (e) => !(e.characterId === char.id && e.message === replyText),
                  ),
                }));
              }, BUBBLE_DURATION_MS);
            }, index * 1500);
          });
        }, 1800);
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

        let targetThreadId: string;
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

        // Targeted character responds
        setTimeout(() => {
          const replyText = generateStubReply(command.targetId, command.text);
          const entry: SpeakingEntry = { characterId: command.targetId, message: replyText };
          const charMsg: ChatMessage = {
            id: nextId(),
            senderId: command.targetId,
            senderName: targetName,
            text: replyText,
            timestamp: Date.now(),
          };

          set((state) => ({
            thinkingCharacterIds: state.thinkingCharacterIds.filter((id) => id !== command.targetId),
            speakingEntries: [
              ...state.speakingEntries.filter((e) => e.characterId !== command.targetId),
              entry,
            ],
            questionGroups: appendMessageToGroup(state.questionGroups, targetThreadId, charMsg),
          }));

          setTimeout(() => {
            set((state) => ({
              speakingEntries: state.speakingEntries.filter(
                (e) => !(e.characterId === command.targetId && e.message === replyText),
              ),
            }));
          }, BUBBLE_DURATION_MS);
        }, 900);
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

        let targetThreadId: string;
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

        // Pick next character in round-robin order
        lastResponderIndex = (lastResponderIndex + 1) % CHARACTERS.length;
        const responder = CHARACTERS[lastResponderIndex];
        const replyText = generateStubReply(responder.id, command.text);

        set((state) => ({
          thinkingCharacterIds: [
            ...state.thinkingCharacterIds.filter((id) => id !== responder.id),
            responder.id,
          ],
        }));

        setTimeout(() => {
          const entry: SpeakingEntry = { characterId: responder.id, message: replyText };
          const charMsg: ChatMessage = {
            id: nextId(),
            senderId: responder.id as 'marx' | 'bakunin' | 'mill',
            senderName: responder.name,
            text: replyText,
            timestamp: Date.now(),
          };

          set((state) => ({
            thinkingCharacterIds: state.thinkingCharacterIds.filter((id) => id !== responder.id),
            speakingEntries: [
              ...state.speakingEntries.filter((e) => e.characterId !== responder.id),
              entry,
            ],
            questionGroups: appendMessageToGroup(state.questionGroups, targetThreadId, charMsg),
          }));

          setTimeout(() => {
            set((state) => ({
              speakingEntries: state.speakingEntries.filter(
                (e) => !(e.characterId === responder.id && e.message === replyText),
              ),
            }));
          }, BUBBLE_DURATION_MS);
        }, 900);
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
}));
