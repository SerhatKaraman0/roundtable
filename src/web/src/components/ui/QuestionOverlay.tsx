'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/useChatStore';

export default function QuestionOverlay() {
  const activeQuestion = useChatStore((s) => s.activeQuestion);

  const isVisible = activeQuestion && activeQuestion.phase !== 'exiting';
  const isEntering = activeQuestion?.phase === 'entering';
  const isPinned = activeQuestion?.phase === 'pinned';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Background blur layer — smooth cross-fade during initial entrance */}
      <AnimatePresence>
        {isEntering && (
          <motion.div
            key="question-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="absolute inset-0 bg-black/35 backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      {/* Question card — center-to-top spring transition with natural overshoot & settle */}
      <AnimatePresence mode="wait">
        {isVisible && activeQuestion && (
          <motion.div
            key={activeQuestion.text}
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={
              isPinned
                ? {
                    opacity: 0.92,
                    scale: 0.78,
                    y: '-35vh',
                    transition: {
                      type: 'spring',
                      stiffness: 120,
                      damping: 18,
                      mass: 0.9,
                    },
                  }
                : {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    transition: {
                      type: 'spring',
                      stiffness: 240,
                      damping: 22,
                    },
                  }
            }
            exit={{
              opacity: 0,
              scale: 0.72,
              y: '-42vh',
              transition: {
                duration: 0.38,
                ease: [0.32, 0, 0.67, 0],
              },
            }}
            className="relative max-w-2xl px-8 py-5 parchment-surface rounded-[5px_8px_6px_7px] border border-[#9C7F5B]/60 shadow-[0_8px_25px_-4px_rgba(45,28,14,0.45),0_2px_6px_-1px_rgba(45,28,14,0.25),inset_0_0_0_1px_rgba(110,80,50,0.2)]"
          >
            <div className="border border-[#8C6D46]/25 rounded-[3px_5px_4px_4px] px-6 py-4">
              <p className="font-parchment text-[#2B1B0E] font-medium text-center text-xl sm:text-2xl leading-relaxed italic">
                “{activeQuestion.text}”
              </p>
              <div className="flex items-center justify-center gap-2.5 mt-2 opacity-50 select-none">
                <span className="h-[1px] w-10 bg-[#6E4F32]" />
                <span className="text-[#6E4F32] text-xs font-serif">❦</span>
                <span className="h-[1px] w-10 bg-[#6E4F32]" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

