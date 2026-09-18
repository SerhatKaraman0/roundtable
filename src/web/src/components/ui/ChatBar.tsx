'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/useChatStore';
import { parseCommand } from '@/lib/parseCommand';

/**
 * Parchment chat bar docked at the bottom of the viewport.
 *
 * Aesthetic:
 * - Aged parchment background with subtle paper noise texture and natural drop shadow
 * - Ink-brown serif typography for input and placeholder
 * - Antique seal Send button (deep burgundy/oxblood) with micro-interactions
 * - Letterpress stamp command indicators for detected philosopher targets
 */
export default function ChatBar() {
  const [draft, setDraft] = useState('');
  const [commandError, setCommandError] = useState('');
  const [isSent, setIsSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendUserMessage = useChatStore((s) => s.sendUserMessage);
  const setChatFocused = useChatStore((s) => s.setChatFocused);

  const getCommandHint = (text: string) => {
    const lower = text.trimStart().toLowerCase();
    if (lower.startsWith('/question-marx')) {
      return {
        name: 'Marx',
        stampBg: '#6E1920',
        stampText: '#F7EED9',
        stampBorder: '#501217',
        borderColor: '#6E1920',
      };
    }
    if (lower.startsWith('/question-bakunin')) {
      return {
        name: 'Bakunin',
        stampBg: '#2E2724',
        stampText: '#F7EED9',
        stampBorder: '#1F1A18',
        borderColor: '#3D3530',
      };
    }
    if (lower.startsWith('/question-mill')) {
      return {
        name: 'Mill',
        stampBg: '#7A5B18',
        stampText: '#F7EED9',
        stampBorder: '#5C4410',
        borderColor: '#7A5B18',
      };
    }
    if (lower.startsWith('/new-question')) {
      return {
        name: 'New Question',
        stampBg: '#35523A',
        stampText: '#F7EED9',
        stampBorder: '#233927',
        borderColor: '#35523A',
      };
    }
    if (lower.startsWith('/question')) {
      return {
        name: 'Question',
        stampBg: '#4A3522',
        stampText: '#F7EED9',
        stampBorder: '#362618',
        borderColor: '#5C4028',
      };
    }
    return null;
  };

  const commandHint = getCommandHint(draft);

  const handleSubmit = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    const command = parseCommand(trimmed);

    // Validate command has text content
    if (
      (command.type === 'question' ||
        command.type === 'new-question' ||
        command.type === 'targeted-question') &&
      !command.text
    ) {
      setCommandError('Please provide text after the command');
      setTimeout(() => setCommandError(''), 2000);
      return;
    }

    sendUserMessage(trimmed);
    setDraft('');
    setCommandError('');

    // Trigger success pulse feedback on the send button
    setIsSent(true);
    setTimeout(() => setIsSent(false), 700);
  }, [draft, sendUserMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleFocus = useCallback(() => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    setChatFocused(true);
  }, [setChatFocused]);

  const handleBlur = useCallback(() => {
    setChatFocused(false);
  }, [setChatFocused]);

  const canSend = Boolean(draft.trim());

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pb-4 px-4"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <motion.div
        animate={{
          borderColor: commandHint ? commandHint.borderColor : 'rgba(140, 109, 70, 0.5)',
          boxShadow: commandHint
            ? `0 8px 25px -4px rgba(35, 20, 10, 0.5), 0 2px 6px -1px rgba(35, 20, 10, 0.25), 0 0 0 1px ${commandHint.borderColor}40, inset 0 0 0 1px rgba(110, 80, 50, 0.2)`
            : '0 8px 24px -4px rgba(35, 20, 10, 0.45), 0 2px 6px -1px rgba(35, 20, 10, 0.25), inset 0 0 0 1px rgba(110, 80, 50, 0.15)',
        }}
        transition={{ duration: 0.22 }}
        className="w-full max-w-2xl parchment-surface rounded-[6px_8px_7px_6px] border border-[#8C6D46]/50 overflow-hidden"
      >
        {/* Input row */}
        <div className="flex items-center gap-2.5 px-3.5 py-2.5">
          {/* Live letterpress command badge */}
          <AnimatePresence>
            {commandHint && (
              <motion.span
                initial={{ opacity: 0, scale: 0.85, x: -6 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.85, x: -6 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="px-2.5 py-0.5 rounded-[3px_5px_4px_4px] text-xs font-parchment font-semibold tracking-wide flex-shrink-0 select-none shadow-sm"
                style={{
                  backgroundColor: commandHint.stampBg,
                  color: commandHint.stampText,
                  border: `1px solid ${commandHint.stampBorder}`,
                }}
              >
                {commandHint.name}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Visually hidden label for accessibility */}
          <label htmlFor="chat-input" className="sr-only">
            Type a message
          </label>
          <input
            id="chat-input"
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setCommandError('');
            }}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={
              commandError || 'Inquire or converse… (try /question, /new-question, /question-marx)'
            }
            autoComplete="off"
            spellCheck
            className={`
              flex-1 bg-transparent font-parchment text-[#2B1B0E] placeholder-[#7D6650] text-base outline-none min-w-0
              ${commandError ? 'placeholder-red-700 font-semibold' : ''}
            `}
            aria-label="Chat message input"
          />

          {/* Send button styled as an antique seal button */}
          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend && !isSent}
            whileHover={canSend ? { scale: 1.04 } : undefined}
            whileTap={canSend ? { scale: 0.94 } : undefined}
            animate={
              isSent
                ? {
                    scale: [1, 1.08, 1],
                    backgroundColor: '#274E32',
                    transition: { duration: 0.4 },
                  }
                : {}
            }
            className={`
              flex-shrink-0 rounded-[4px_6px_5px_4px] px-4 py-1.5 font-parchment font-semibold text-sm flex items-center justify-center gap-1.5 min-w-[74px] transition-colors shadow-sm
              ${
                isSent
                  ? 'bg-[#274E32] text-[#F7EED9] border border-[#1B3623]'
                  : canSend
                  ? 'bg-[#541E24] hover:bg-[#68232B] text-[#F7EED9] border border-[#3D1418]'
                  : 'bg-[#541E24]/20 text-[#7D6650]/60 border border-[#8C6D46]/20 cursor-not-allowed'
              }
            `}
            aria-label="Send message"
          >
            <AnimatePresence mode="wait">
              {isSent ? (
                <motion.span
                  key="sent"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  className="flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Sent
                </motion.span>
              ) : (
                <motion.span
                  key="send"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Send
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}


