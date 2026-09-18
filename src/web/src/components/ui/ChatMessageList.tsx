'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';

/**
 * Scrollable list of the user's own sent messages.
 *
 * Character replies are intentionally NOT shown here — they appear exclusively
 * as 3D speech bubbles above the characters' heads in the scene.
 * The store no longer stores character messages, so this list is purely user messages.
 */
export default function ChatMessageList() {
  const messages = useChatStore((s) => s.messages);
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
          <div className="max-w-[80%] rounded-xl rounded-br-sm px-3 py-1.5 text-sm leading-snug bg-msn-teal/80 text-white">
            {msg.text}
          </div>
        </div>
      ))}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
