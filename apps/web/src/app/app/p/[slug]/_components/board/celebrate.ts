import confetti from "canvas-confetti";

export function celebrate() {
  const end = Date.now() + 700;
  const colors = ["#38bdf8", "#a78bfa", "#f472b6", "#fbbf24", "#34d399"];
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      startVelocity: 45,
      origin: { x: 0, y: 0.9 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      startVelocity: 45,
      origin: { x: 1, y: 0.9 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
