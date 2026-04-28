/**
 * TalkBubble — UI v1 companion speech bubble.
 *
 * Subscribes to store.dawTalk and renders a chunky speech bubble next to
 * the AvatarPuck whenever the line is non-null. Replaces the in-mouth
 * scrolling marquee from MouthWave.
 *
 * Visual: rounded white bubble, pointer pointing left toward the puck,
 * pop-in animation, drop shadow, dark text. Auto-fades out when dawTalk
 * goes back to null (the store's sayLine handles the timing).
 *
 * Layout note: positioned `absolute` relative to its parent (the HUD
 * left cluster). The HUD is responsible for placing this component
 * just to the right of the puck.
 */

import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";

export function TalkBubble() {
  const dawTalk = useStore((s) => s.dawTalk);

  // Hold the last non-null line briefly during the fade-out so the bubble
  // animates closed instead of vanishing.
  const [shown, setShown] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (dawTalk) {
      setShown(dawTalk);
      setVisible(true);
    } else {
      setVisible(false);
      // Hold the text for the fade-out duration before clearing.
      const t = setTimeout(() => setShown(null), 200);
      return () => clearTimeout(t);
    }
  }, [dawTalk]);

  if (!shown) return null;

  return (
    <div
      className={[
        "pointer-events-none",
        "max-w-[200px] sm:max-w-[260px]",
        "px-3 py-2",
        "rounded-2xl rounded-bl-sm",  // pointed bottom-left toward puck
        "bg-white text-grvd-base",
        "font-sans font-semibold text-[12px] leading-snug",
        "shadow-chunky",
        "transition-opacity duration-200",
        visible ? "opacity-100 animate-bubble-in" : "opacity-0",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      {shown}
    </div>
  );
}
