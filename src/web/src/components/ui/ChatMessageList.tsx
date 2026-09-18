'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';

/**
 * Scrollable list of the user's own sent messages.
 *
 * Character replies are intentionally NOT shown here — they appear exclusively
 * as 3D speech bubbles above the characters' heads in the scene.
 * The store contains both user and character messages, but this list filters
 * to show only user messages.
 */
export default function ChatMessageList() {
  const messages = useChatStore((s) =>
    s.questionGroups.flatMap((g) => g.responses).filter((m) => m.senderId === 'user')
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0) return null;

  return (
    <div
      className="max-h-40 overflow-y-auto flex flex-col gap-1 px-1 mb-2"
      role="log"
      aria-label="Your sent messages"
      aria-live="polite"
    >
      {messages.map((msg) => (
        <div key={msg.id} className="flex justify-end">
          <div className="max-w-[80%] rounded-[4px_6px_5px_4px] px-3.5 py-1.5 text-sm leading-snug parchment-surface border border-[#8C6D46]/40 text-[#2B1B0E] font-parchment shadow-sm">
            {msg.text}
          </div>
        </div>
      ))}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
