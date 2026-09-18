'use client';

import { useState, useRef, useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import ChatMessageList from './ChatMessageList';

/**
 * Glassmorphic chat bar docked at the bottom of the viewport.
 *
 * - Focusing the input sets isChatFocused=true (releases pointer lock awareness).
 * - Blurring the input sets isChatFocused=false.
 * - Enter or the Send button submits the message.
 * - The input is intentionally NOT connected to R3F state so it won't
 *   re-render on scene updates — memo isolation is handled in Scene.tsx.
 */
export default function ChatBar() {
  const [draft, setDraft] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendUserMessage = useChatStore((s) => s.sendUserMessage);
  const setChatFocused = useChatStore((s) => s.setChatFocused);

  const handleSubmit = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendUserMessage(trimmed);
    setDraft('');
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
    // Release pointer lock if active, then mark chat as focused
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    setChatFocused(true);
    setIsExpanded(true);
  }, [setChatFocused]);

  const handleBlur = useCallback(() => {
    setChatFocused(false);
  }, [setChatFocused]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pb-4 px-4"
      // Prevent canvas from swallowing pointer events in this region
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-2xl flex flex-col bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Message transcript — collapsible */}
        {isExpanded && (
          <div className="px-3 pt-3">
            <ChatMessageList />
          </div>
        )}

        {/* Input row */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* Toggle transcript button */}
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="text-white/40 hover:text-msn-teal transition-colors flex-shrink-0"
            aria-label={isExpanded ? 'Collapse message history' : 'Expand message history'}
            title={isExpanded ? 'Collapse history' : 'Show history'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Visually hidden label for accessibility */}
          <label htmlFor="chat-input" className="sr-only">
            Type a message
          </label>
          <input
            id="chat-input"
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Say something to the group…"
            autoComplete="off"
            spellCheck
            className="flex-1 bg-transparent text-white placeholder-white/35 text-sm outline-none min-w-0"
            aria-label="Chat message input"
          />

          {/* Send button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!draft.trim()}
            className="flex-shrink-0 bg-msn-teal hover:bg-msn-cyan disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl px-4 py-1.5 text-sm font-medium transition-colors"
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
