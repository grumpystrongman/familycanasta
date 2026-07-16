import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

export const CHAT_BUBBLE_DURATION_MS = 2500;

function readSender(game) {
  const identity = game?.querySelector(".identity");
  return {
    avatar: identity?.querySelector("span")?.textContent?.trim() || "💬",
    nickname: identity?.querySelector("b")?.textContent?.trim() || "You",
  };
}

function chatInputFromEvent(event) {
  const input = event.target?.closest?.(".game-page .compose input");
  if (input) return input;

  const button = event.target?.closest?.(".game-page .compose button");
  return button?.closest(".compose")?.querySelector("input") || null;
}

export default function ChatBubbleEnhancer() {
  const [bubble, setBubble] = useState(null);
  const timerRef = useRef(null);
  const sequenceRef = useRef(0);

  useEffect(() => {
    const showBubble = (input) => {
      const text = input?.value?.trim();
      const game = input?.closest(".game-page.enhanced-game");
      if (!text || !game) return;

      clearTimeout(timerRef.current);
      sequenceRef.current += 1;
      setBubble({
        id: sequenceRef.current,
        text,
        ...readSender(game),
      });
      timerRef.current = window.setTimeout(() => setBubble(null), CHAT_BUBBLE_DURATION_MS);
    };

    const onKeyDown = (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.repeat) return;
      showBubble(chatInputFromEvent(event));
    };

    const onClick = (event) => {
      if (!event.target?.closest?.(".game-page .compose button")) return;
      showBubble(chatInputFromEvent(event));
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("click", onClick, true);
      clearTimeout(timerRef.current);
    };
  }, []);

  return createPortal(
    <AnimatePresence>
      {bubble && (
        <motion.aside
          className="ephemeral-chat-bubble"
          key={bubble.id}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.18 }}
        >
          <span className="ephemeral-chat-avatar" aria-hidden="true">{bubble.avatar}</span>
          <div>
            <b>{bubble.nickname}</b>
            <p>{bubble.text}</p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body,
  );
}
