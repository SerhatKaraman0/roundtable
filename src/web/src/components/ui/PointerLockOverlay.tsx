'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/useChatStore';

/**
 * Full-screen overlay shown when pointer lock is not active.
 * Prompts the user to click to enter FPS look-around mode.
 * Fades out smoothly once pointer lock is acquired or chat is focused.
 */
export default function PointerLockOverlay() {
  const isPointerLocked = useChatStore((s) => s.isPointerLocked);
  const isChatFocused = useChatStore((s) => s.isChatFocused);

  const isVisible = !isPointerLocked && !isChatFocused;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
          aria-live="polite"
          aria-label="Click the scene to enable look-around controls"
        >
          <div className="parchment-surface border border-[#8C6D46]/60 rounded-[6px_8px_7px_6px] px-8 py-6 flex flex-col items-center gap-3 text-center max-w-xs shadow-[0_12px_32px_rgba(35,20,10,0.5),0_2px_6px_rgba(35,20,10,0.25),inset_0_0_0_1px_rgba(110,80,50,0.15)]">
            {/* Ink cursor icon */}
            <svg
              className="w-10 h-10 text-[#6E4F32]"
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

            <p className="font-parchment text-[#2B1B0E] text-xl font-bold tracking-normal">
              Click to look around
            </p>
            <p className="font-parchment text-[#5C4028] text-sm leading-relaxed">
              Move your mouse to rotate the view.
              <br />
              Press{' '}
              <kbd className="px-2 py-0.5 bg-[#E8D9B8] border border-[#8C6D46]/40 text-[#2B1B0E] rounded text-xs font-mono shadow-sm">
                Esc
              </kbd>{' '}
              to release the cursor.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

