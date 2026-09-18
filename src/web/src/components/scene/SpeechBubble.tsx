'use client';

import { Html } from '@react-three/drei';
import { useEffect, useState } from 'react';

interface SpeechBubbleProps {
  message: string;
  /** Y offset above the character head center */
  yOffset?: number;
}

/**
 * A CSS speech bubble rendered in 3D space via @react-three/drei's <Html>.
 * It billboards automatically (always faces the camera).
 * Animates in via the .bubble-enter CSS class defined in globals.css.
 *
 * NOTE: `distanceFactor` is intentionally NOT used here. `distanceFactor`
 * applies a CSS scale transform based on camera distance, which is a known
 * source of unpredictable width/word-wrap behaviour in drei's <Html> (the
 * browser can end up computing wrap width against the wrong effective box).
 * Without it, <Html> renders as a fixed-size screen-space overlay anchored to
 * the projected 3D point — same pixel size regardless of distance, and its
 * CSS width behaves exactly like a normal DOM element (see .speech-bubble's
 * fixed `width: 280px` in globals.css).
 */
export default function SpeechBubble({ message, yOffset = 0.8 }: SpeechBubbleProps) {
  // Trigger re-mount animation when message changes
  const [key, setKey] = useState(0);

  useEffect(() => {
    setKey((k) => k + 1);
  }, [message]);

  return (
    <Html
      position={[0, yOffset, 0]}
      center
      zIndexRange={[100, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div key={key} className="speech-bubble bubble-enter">
        <div className="speech-bubble-inner">{message}</div>
      </div>
    </Html>
  );
}
