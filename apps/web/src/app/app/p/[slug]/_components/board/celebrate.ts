import confetti from "canvas-confetti";

import { CONFETTI_COLORS } from "@/lib/palette";

export function celebrate() {
  const end = Date.now() + 700;
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      startVelocity: 45,
      origin: { x: 0, y: 0.9 },
      colors: CONFETTI_COLORS,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      startVelocity: 45,
      origin: { x: 1, y: 0.9 },
      colors: CONFETTI_COLORS,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
