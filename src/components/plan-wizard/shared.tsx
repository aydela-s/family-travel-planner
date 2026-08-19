import { ageAwareTravelerHints } from "@/lib/schedule/family-profile";
import { TripPlan } from "@/types/trip-plan";

/** Shared control styles — use these for consistent form chrome. */
export const inputClassName =
  "mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-ink shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-muted";

export const labelClassName = "block text-sm font-semibold text-ink";

/** Primary teal button (default actions / wizard Next). */
export const btnPrimaryClassName =
  "rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50";

/** Secondary outlined button (Back / cancel). */
export const btnSecondaryClassName =
  "rounded-full border border-secondary bg-surface px-6 py-3.5 text-sm font-semibold text-primary transition hover:bg-secondary-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:opacity-50";

/** Coral CTA for the main commit action (Generate). */
export const btnCtaClassName =
  "rounded-full bg-accent px-6 py-4 text-base font-semibold text-white shadow-[var(--shadow-accent)] transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50";

/** Quiet tertiary action. */
export const btnGhostClassName =
  "rounded-full border border-border bg-background px-6 py-3.5 text-sm font-semibold text-muted transition hover:border-secondary/50 hover:bg-secondary-muted hover:text-primary disabled:opacity-50";

export const cardClassName =
  "rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow-card)]";


export function StepIntro({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-2">
      <span className="text-3xl" aria-hidden>
        {emoji}
      </span>
      <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h2>
      {subtitle ? <p className="text-base leading-relaxed text-muted">{subtitle}</p> : null}
    </div>
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>;
}

export function DynamicHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-secondary/30 bg-secondary-muted px-4 py-3.5 text-sm leading-relaxed text-ink">
      <span className="text-lg text-primary" aria-hidden>
        ✨
      </span>
      <p>{children}</p>
    </div>
  );
}

export function OptionalLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className={labelClassName}>
      {children}{" "}
      <span className="font-normal text-muted">— totally optional</span>
    </label>
  );
}

export function SelectChip({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
        selected
          ? "border-primary bg-primary text-white"
          : "border-border bg-surface text-ink hover:border-secondary/60 hover:bg-secondary-muted"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function OptionCard({
  selected,
  label,
  description,
  onClick,
  icon,
  disabled = false,
}: {
  selected: boolean;
  label: string;
  description?: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={`rounded-2xl border p-4 text-left transition ${
        disabled
          ? "cursor-not-allowed border-border bg-background opacity-55"
          : selected
            ? "border-primary bg-secondary-muted"
            : "border-border bg-surface hover:border-secondary/50 hover:bg-secondary-muted/60"
      }`}
    >
      {icon && <div className="mb-3 text-primary">{icon}</div>}
      <span className={`font-semibold ${disabled ? "text-muted" : "text-ink"}`}>{label}</span>
      {description ? (
        <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
    </button>
  );
}

export function CounterControl({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="font-semibold text-ink">{label}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink transition hover:border-secondary/60 hover:bg-secondary-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Decrease ${label}`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
            <path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="min-w-[2rem] text-center text-2xl font-bold text-ink">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink transition hover:border-secondary/60 hover:bg-secondary-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Increase ${label}`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
            <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export const activityInterestOptions = [
  { label: "Parks & Gardens", emoji: "🌳" },
  { label: "Swimming & Water Play", emoji: "🏊" },
  { label: "Nature & Scenic Views", emoji: "🌿" },
  { label: "History & Landmarks", emoji: "🏛️" },
  { label: "Museums & Art", emoji: "🎨" },
  { label: "Playgrounds & Indoor Play", emoji: "🛝" },
  { label: "Zoos & Aquariums", emoji: "🦁" },
  { label: "Theme Parks", emoji: "🎢" },
  { label: "Interactive Museums", emoji: "🧪" },
  { label: "Food Markets", emoji: "🥕" },
  { label: "Shopping", emoji: "🛍️" },
  { label: "Shows & Entertainment", emoji: "🎭" },
  { label: "Sports & Recreation", emoji: "⚽" },
  { label: "Spas", emoji: "🧖" },
] as const;

export const dietaryQuickPicks = [
  "Vegetarian",
  "Vegan",
  "Gluten-free",
  "Dairy-free",
] as const;

export const destinationSuggestions = [
  "San Diego, CA",
  "Orlando, FL",
  "London, UK",
  "Tokyo, Japan",
  "Paris, France",
] as const;

export function getTravelerHints(children: number[]) {
  return ageAwareTravelerHints(children);
}
