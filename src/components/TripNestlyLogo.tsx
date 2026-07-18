type TripNestlyLogoProps = {
  className?: string;
  /** Kept for call-site compatibility; both variants use the attached wordmark. */
  variant?: "wordmark" | "mark";
  showTagline?: boolean;
  title?: string;
};

/**
 * TripNestly logo — uses the attached Looka/wordmark PNG as-is.
 */
export function TripNestlyLogo({
  className,
  title = "TripNestly",
}: TripNestlyLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset in /public
    <img
      src="/tripnestly-logo.png"
      alt={title}
      className={className}
    />
  );
}
