import type { SVGProps } from "react";

/** The Booking.com "B." logomark in brand colors — white B on the brand-blue
 * rounded square. Deliberately NOT currentColor, so the mark stays branded on
 * any chip/button background (same idea as the multicolor Google "G"). */
export function BookingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      aria-hidden
      {...props}>
      <rect x="1" y="1" width="22" height="22" rx="5.5" fill="#003B95" />
      <path
        d="M8 12h3.5a2 2 0 1 1 0 4h-3.5v-7a1 1 0 0 1 1 -1h1.5a2 2 0 1 1 0 4h-1.5"
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16.5 16l.01 0" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" />
    </svg>
  );
}
