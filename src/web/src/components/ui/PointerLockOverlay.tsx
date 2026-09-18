'use client';

import { useChatStore } from '@/store/useChatStore';

/**
 * Full-screen overlay shown when pointer lock is not active.
 * Prompts the user to click to enter FPS look-around mode.
 * Fades out once pointer lock is acquired.
 */
export default function PointerLockOverlay() {
  const isPointerLocked = useChatStore((s) => s.isPointerLocked);
  const isChatFocused = useChatStore((s) => s.isChatFocused);

  // Hide when locked, or when user is actively typing in chat
  if (isPointerLocked || isChatFocused) return null;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
      aria-live="polite"
      aria-label="Click the scene to enable look-around controls"
    >
      <div className="bg-black/60 backdrop-blur-sm border border-msn-teal/40 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 text-center max-w-xs">
        {/* Cursor icon */}
        <svg
          className="w-10 h-10 text-msn-teal"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.042 21.672L13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5"
          />
        </svg>

        <p className="text-white text-lg font-semibold tracking-wide">
          Click to look around
        </p>
        <p className="text-white/60 text-sm leading-relaxed">
          Move your mouse to rotate the view.
          <br />
          Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono">Esc</kbd> to
          release the cursor.
        </p>
      </div>
    </div>
  );
}
