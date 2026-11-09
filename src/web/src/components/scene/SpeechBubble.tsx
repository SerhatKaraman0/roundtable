'use client';

import { Html } from '@react-three/drei';
import { AnimatePresence, motion } from 'framer-motion';

interface SpeechBubbleProps {
  message?: string;
  isThinking?: boolean;
  /** Y offset above the character head center */
  yOffset?: number;
  /** Muted character accent color for subtle border identity */
  accentColor?: string;
}

/**
 * A CSS speech bubble rendered in 3D space via @react-three/drei's <Html>.
 * It billboards automatically (always faces the camera).
 * Styled in parchment paper with ink serif typography and subtle character border.
 * Uses framer-motion for spring entrance, subtle continuous breathing,
 * animated ink dots while thinking, and graceful exit animation when character finishes speaking.
 */
export default function SpeechBubble({
  message,
  isThinking = false,
  yOffset = 0.8,
  accentColor = '#8c6d46',
}: SpeechBubbleProps) {
  return (
    <Html
      position={[0, yOffset, 0]}
      center
      zIndexRange={[100, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <AnimatePresence mode="wait">
        {message ? (
          <motion.div
            key={message}
            initial={{ opacity: 0, scale: 0.82, y: 12 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: {
                type: 'spring',
                stiffness: 380,
                damping: 24,
                mass: 0.8,
              },
            }}
            exit={{
              opacity: 0,
              scale: 0.88,
              y: -8,
              transition: { duration: 0.22, ease: 'easeOut' },
            }}
            className="speech-bubble"
            style={{
              '--bubble-border-color': accentColor,
            } as React.CSSProperties}
          >
            <div className="speech-bubble-inner speech-bubble-breathing">{message}</div>
          </motion.div>
        ) : isThinking ? (
          <motion.div
            key="thinking-bubble"
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: {
                type: 'spring',
                stiffness: 380,
                damping: 24,
              },
            }}
            exit={{
              opacity: 0,
              scale: 0.85,
              y: -6,
              transition: { duration: 0.18, ease: 'easeOut' },
            }}
            className="speech-bubble"
            style={{
              '--bubble-border-color': accentColor,
            } as React.CSSProperties}
          >
            <div className="speech-bubble-inner px-3.5 py-1.5 flex items-center justify-center gap-1.5 min-w-[52px]">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{
                    opacity: [0.35, 1, 0.35],
                    y: [0, -3, 0],
                  }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    delay: i * 0.18,
                    ease: 'easeInOut',
                  }}
                  className="inline-block w-1.5 h-1.5 rounded-full bg-[#3D2614]"
                />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Html>
  );
}


