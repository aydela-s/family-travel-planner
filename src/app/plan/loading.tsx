import { WizardShell } from "@/components/plan-wizard/WizardShell";
import {
  btnPrimaryClassName,
  btnSecondaryClassName,
  inputClassName,
  StepIntro,
} from "@/components/plan-wizard/shared";

/**
 * Instant first paint for /plan — same layout as step 1 so navigation feels native.
 * Replaced as soon as the wizard client bundle hydrates.
 */
export default function PlanLoading() {
  return (
    <WizardShell
      footer={
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled
            tabIndex={-1}
            aria-hidden
            className={`order-2 sm:order-1 sm:flex-1 ${btnSecondaryClassName} invisible pointer-events-none`}
          >
            Back
          </button>
          <button type="button" disabled className={`order-1 w-full sm:order-2 sm:flex-1 ${btnPrimaryClassName}`}>
            Sounds good →
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <StepIntro emoji="🌍" title="Where and when?" />
        <div>
          <label htmlFor="destination-loading" className="sr-only">
            Destination
          </label>
          <input
            id="destination-loading"
            type="text"
            disabled
            placeholder="Start typing a city..."
            className={`${inputClassName} disabled:cursor-not-allowed`}
          />
        </div>
      </div>
    </WizardShell>
  );
}
