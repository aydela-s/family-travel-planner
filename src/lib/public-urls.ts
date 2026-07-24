import { BRAND } from "@/config/brand";

/**
 * Origin for links in emails (view/edit/feedback).
 * Prefer the request/app origin so localhost emails open the local app.
 */
export function linkOrigin(appOrigin: string): string {
  return appOrigin.replace(/\/$/, "") || "http://localhost:3000";
}

/**
 * Email clients cannot load localhost images. Prefer a public HTTPS host for the logo.
 * Override with NEXT_PUBLIC_EMAIL_ASSET_ORIGIN or NEXT_PUBLIC_APP_URL (non-localhost).
 */
export function emailAssetOrigin(appOrigin?: string): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_EMAIL_ASSET_ORIGIN?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv && !/localhost|127\.0\.0\.1/i.test(fromEnv)) {
    return fromEnv;
  }
  // Deployed demo assets — works for local Resend tests when localhost can't be fetched.
  return "https://family-travel-planner-nine.vercel.app";
}

export function emailLogoUrl(appOrigin?: string): string {
  return `${emailAssetOrigin(appOrigin)}${BRAND.logoSrc}`;
}

/** Opens the full itinerary with chips / edit options (not a blank wizard). */
export function sharedTripViewPath(shareId: string): string {
  return `/plan?share=${encodeURIComponent(shareId)}`;
}

export function feedbackPath(): string {
  return "/feedback";
}
