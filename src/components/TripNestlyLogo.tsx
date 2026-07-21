import { BRAND } from "@/config/brand";

type TripNestlyLogoProps = {
  className?: string;
  /**
   * `wordmark` — full brand PNG.
   * `mark` — favicon N mark (home → dotted path → pin).
   */
  variant?: "wordmark" | "mark";
  /** @deprecated Logo PNG already includes the slogan; kept for call-site compatibility. */
  showTagline?: boolean;
  title?: string;
};

/**
 * TripNestly brand mark / wordmark.
 */
export function TripNestlyLogo({
  className,
  variant = "wordmark",
  title = BRAND.name,
}: TripNestlyLogoProps) {
  if (variant === "mark") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static brand asset in /public
      <img src={BRAND.markSrc} alt={title} className={className} />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset in /public
    <img src={BRAND.logoSrc} alt={`${title} — ${BRAND.slogan}`} className={className} />
  );
}
