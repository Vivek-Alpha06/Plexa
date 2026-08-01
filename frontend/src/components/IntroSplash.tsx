import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const LETTERS = ["p", "l", "e", "x", "a"];
const LETTER_STAGGER = 0.12;
const LETTERS_START = 0.55; // after the icon has mostly settled in
const LETTER_DURATION = 0.45;
const HOLD_MS = 900; // pause after the last letter lands, before exit begins

/** Full-screen reveal shown once per page load, before the landing page
 *  appears: the mark settles in first, then "PLEXA" types in letter by
 *  letter, then the whole thing fades/scales away to hand off to the page
 *  underneath (which has its own fade-in, so the two overlap slightly). */
export function IntroSplash() {
  const [phase, setPhase] = useState<"in" | "exit" | "gone">("in");

  const lastLetterDoneAt =
    (LETTERS_START + (LETTERS.length - 1) * LETTER_STAGGER + LETTER_DURATION) * 1000;

  useEffect(() => {
    const t = setTimeout(() => setPhase("exit"), lastLetterDoneAt + HOLD_MS);
    return () => clearTimeout(t);
  }, [lastLetterDoneAt]);

  if (phase === "gone") return null;

  return (
    <motion.div
      className="intro-splash"
      animate={phase === "exit" ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => {
        if (phase === "exit") setPhase("gone");
      }}
    >
      <motion.img
        className="intro-mark"
        src="/plexa-p-mark.png"
        alt=""
        initial={{ opacity: 0, y: 14, scale: 0.92 }}
        animate={
          phase === "exit"
            ? { opacity: 0, scale: 1.05, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
            : { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
        }
      />
      <div className="intro-word" aria-label="Plexa">
        {LETTERS.map((l, i) => (
          <motion.img
            key={l}
            src={`/letters/letter-${l}.png`}
            alt=""
            initial={{ opacity: 0, y: 16 }}
            animate={
              phase === "exit"
                ? { opacity: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }
                : {
                    opacity: 1,
                    y: 0,
                    transition: {
                      duration: LETTER_DURATION,
                      delay: LETTERS_START + i * LETTER_STAGGER,
                      ease: [0.22, 1, 0.36, 1],
                    },
                  }
            }
          />
        ))}
      </div>
    </motion.div>
  );
}
