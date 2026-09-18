'use client';

import { useChatStore } from '@/store/useChatStore';

/**
 * Minimal heads-up display.
 * Shows a small "🔒 Looking around" badge when pointer lock is active,
 * and the character names as a subtle legend.
 */
export default function HUD() {
  const isPointerLocked = useChatStore((s) => s.isPointerLocked);

  return (
    <div className="fixed top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
      {isPointerLocked && (
        <div
          className="flex items-center gap-2 bg-black/50 backdrop-blur-sm border border-msn-teal/30 rounded-lg px-3 py-1.5 text-sm text-msn-teal"
          aria-label="Pointer lock active — mouse controls camera"
        >
          <span aria-hidden="true">🔒</span>
          <span>Looking around — press Esc to release</span>
        </div>
      )}
    </div>
  );
}
