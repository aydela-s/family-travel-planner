import { ageAwareTravelerHints } from "@/lib/schedule/family-profile";
import { TripPlan } from "@/types/trip-plan";

export const inputClassName =
  "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

export const labelClassName = "block text-sm font-semibold text-slate-800";

export function StepIntro({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-2">
      <span className="text-3xl" aria-hidden>
        {emoji}
      </span>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
      <p className="text-base leading-relaxed text-slate-600">{subtitle}</p>
    </div>
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-slate-500">{children}</p>;
}

export function DynamicHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3.5 text-sm leading-relaxed text-amber-900">
      <span className="text-lg" aria-hidden>
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
      <span className="font-normal text-slate-400">— totally optional</span>
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
          ? "border-sky-500 bg-sky-500 text-white shadow-sm shadow-sky-200"
          : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50"
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
}: {
  selected: boolean;
  label: string;
  description: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-sky-500 bg-sky-50 ring-2 ring-sky-100"
          : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/40"
      }`}
    >
      {icon && <div className="mb-3 text-sky-600">{icon}</div>}
      <span className="font-semibold text-slate-900">{label}</span>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
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
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-medium text-slate-700 transition hover:border-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <span className="min-w-[2rem] text-center text-2xl font-bold text-slate-900">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-medium text-slate-700 transition hover:border-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export const activityInterestOptions = [
  { label: "Parks & Gardens", emoji: "🌳" },
  { label: "Beaches & Waterfronts", emoji: "🌊" },
  { label: "Nature & Scenic Views", emoji: "🌿" },
  { label: "History & Landmarks", emoji: "🏛️" },
  { label: "Museums & Art", emoji: "🎨" },
  { label: "Playgrounds", emoji: "🛝" },
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
