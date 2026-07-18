/** Booking's `.com` accent blue, for the wordmark. */
const DOT_COM = "#4aa4ff";

/**
 * The Booking.com rating badge: the score over the Booking.com wordmark, in a
 * padded brand-blue square — Booking's own review-square look. Sized to sit
 * within a card's ratings row (score 0.73rem, chosen 2026-07-18). Fixed brand
 * colors (not currentColor), so it stays branded on any background.
 */
export function BookingScore({ score }: { score: number }) {
  return (
    <span
      dir="ltr"
      aria-label={`Booking.com ${score.toFixed(1)}`}
      className="inline-flex flex-col items-center rounded-md bg-[#003b95] px-2 py-1 text-white">
      <span className="text-[0.73rem] leading-none font-bold tracking-tight tabular-nums">
        {score.toFixed(1)}
      </span>
      <span className="mt-px text-[0.5rem] leading-none font-semibold">
        Booking<span style={{ color: DOT_COM }}>.com</span>
      </span>
    </span>
  );
}
