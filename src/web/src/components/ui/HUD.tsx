'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/useChatStore';
import { CHARACTERS } from '@/lib/characters';
import { isAmbienceMuted, subscribeAmbience, toggleAmbienceMute } from '@/lib/ambientAudio';

/**
 * Heads-up display in aged parchment & ink aesthetic.
 * - Shows a parchment badge when pointer lock is active
 * - Character legend doubles as a live "who's talking now" indicator with warm amber highlight
 * - Ambient study & fireplace sound toggle
 */
export default function HUD() {
  const isPointerLocked = useChatStore((s) => s.isPointerLocked);
  const speakingEntries = useChatStore((s) => s.speakingEntries);
  const [isMuted, setIsMuted] = useState(isAmbienceMuted());

  useEffect(() => {
    return subscribeAmbience((muted) => setIsMuted(muted));
  }, []);

  const getMutedDotColor = (id: string) => {
    if (id === 'marx') return '#8B1E2B'; // antique seal red
    if (id === 'bakunin') return '#38302B'; // antique lamp-black
    if (id === 'mill') return '#A0751A'; // antique ochre gold
    return '#8C6D46';
  };

  return (
    <div className="fixed top-4 right-4 z-20 flex flex-col gap-2 pointer-events-none items-end">
      {/* Ambience mute/unmute control */}
      <motion.button
        type="button"
        onClick={() => toggleAmbienceMute()}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="pointer-events-auto flex items-center gap-2 parchment-surface border border-[#8C6D46]/50 rounded-[4px_6px_5px_4px] px-3 py-1.5 text-xs font-parchment font-semibold text-[#4A3522] hover:text-[#2B1B0E] hover:bg-[#E2D0A9]/60 transition-colors shadow-[0_4px_12px_rgba(45,28,14,0.25)] cursor-pointer"
        title={isMuted ? 'Unmute fireplace & study ambience' : 'Mute fireplace & study ambience'}
        aria-label={isMuted ? 'Unmute ambience' : 'Mute ambience'}
      >
        <span className="text-sm" aria-hidden="true">
          {isMuted ? '🔇' : '🔥'}
        </span>
        <span>{isMuted ? 'Ambience: Off' : 'Hearth Ambience'}</span>
      </motion.button>
      {/* Pointer lock status badge */}
      <AnimatePresence>
        {isPointerLocked && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="flex items-center gap-2 parchment-surface border border-[#8C6D46]/50 rounded-[4px_6px_5px_4px] px-3.5 py-1.5 text-sm font-parchment font-semibold text-[#2B1B0E] shadow-[0_4px_12px_rgba(45,28,14,0.3)]"
            aria-label="Pointer lock active — mouse controls camera"
          >
            <span>Looking around — press Esc to release</span>
            <span aria-hidden="true" className="text-xs">🔒</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Character discussion legend & active speaker indicator */}
      <div className="flex flex-col gap-1.5 parchment-surface border border-[#8C6D46]/50 rounded-[5px_7px_6px_5px] px-3.5 py-2.5 min-w-[175px] shadow-[0_6px_20px_rgba(45,28,14,0.35)]">
        <div className="text-[11px] font-parchment font-bold tracking-wider uppercase text-[#6E4F32] mb-0.5">
          Discussion:
        </div>
        {CHARACTERS.map((char) => {
          const isSpeaking = speakingEntries.some((e) => e.characterId === char.id);
          const dotColor = getMutedDotColor(char.id);

          return (
            <motion.div
              key={char.id}
              animate={{
                x: isSpeaking ? -2 : 0,
                backgroundColor: isSpeaking ? 'rgba(180, 130, 60, 0.22)' : 'transparent',
                borderColor: isSpeaking ? 'rgba(140, 100, 50, 0.35)' : 'transparent',
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded-md border"
            >
              <div className="flex items-center gap-2.5">
                {/* Status dot with warm pulse animation when speaking */}
                <div className="relative flex items-center justify-center w-2.5 h-2.5">
                  {isSpeaking && (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0.8 }}
                      animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: dotColor }}
                    />
                  )}
                  <motion.div
                    animate={{
                      scale: isSpeaking ? 1.25 : 1,
                    }}
                    transition={{ type: 'spring', stiffness: 350, damping: 20 }}
                    className="w-2 h-2 rounded-full relative z-10 border border-[#8C6D46]/40"
                    style={{
                      backgroundColor: dotColor,
                    }}
                  />
                </div>

                {/* Character name */}
                <span
                  className={`font-parchment transition-colors text-sm ${
                    isSpeaking ? 'text-[#2B1B0E] font-bold tracking-wide' : 'text-[#4A3522]'
                  }`}
                >
                  {char.name}
                </span>
              </div>

              {/* Active speaking badge */}
              <AnimatePresence>
                {isSpeaking && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.75, x: 4 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.75, x: 4 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="text-[10px] font-parchment font-bold tracking-wider text-[#6E4F32] flex items-center gap-1"
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#8B1E2B] animate-pulse" />
                    Speaking
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}


