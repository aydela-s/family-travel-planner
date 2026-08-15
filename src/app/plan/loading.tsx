import { WizardShell } from "@/components/plan-wizard/WizardShell";
import { btnPrimaryClassName, StepIntro } from "@/components/plan-wizard/shared";

/**
 * Instant first paint for /plan — same layout as step 1 so navigation feels native.
 * Replaced as soon as the wizard client bundle hydrates.
 */
export default function PlanLoading() {
  return (
    <WizardShell
      footer={
        <div className="mt-8">
          <button type="button" disabled className={`w-full ${btnPrimaryClassName}`}>
            Sounds good →
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <StepIntro
          emoji="🌍"
          title="Where are you headed?"
          subtitle="Pick a city from the suggestions so we can plan around the right place."
        />
        <div>
          <label htmlFor="destination-loading" className="sr-only">
            Destination
          </label>
          <input
            id="destination-loading"
            type="text"
            disabled
            placeholder="Start typing a city..."
            className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-ink shadow-sm outline-none placeholder:text-muted"
          />
        </div>
      </div>
    </WizardShell>
  );
}
