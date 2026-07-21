import { StepProps } from "@/types/trip-plan";
import {
  CounterControl,
  DynamicHint,
  FieldHint,
  getTravelerHints,
  labelClassName,
  SelectChip,
  StepIntro,
} from "../shared";

const childAges = Array.from({ length: 18 }, (_, age) => age);

export default function TravelersStep({ formData, updateFormData }: StepProps) {
  function handleChildCountChange(count: number) {
    const children = [...formData.children];
    while (children.length < count) children.push(0);
    while (children.length > count) children.pop();
    updateFormData({
      children,
      ...(count === 0 ? { napSchedule: "" } : {}),
    });
  }

  function handleChildAgeChange(index: number, age: number) {
    const children = [...formData.children];
    children[index] = age;
    updateFormData({ children });
  }

  const hints = getTravelerHints(formData.children);

  return (
    <div className="space-y-6">
      <StepIntro
        emoji="👨‍👩‍👧‍👦"
        title="Who's coming along?"
        subtitle="Tell us who's in your travel squad so we can plan for every age."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <CounterControl
          label="Adults"
          hint="Parents, grandparents, caregivers — anyone 18+."
          value={formData.adults}
          min={1}
          max={12}
          onChange={(adults) => updateFormData({ adults })}
        />
        <CounterControl
          label="Kids"
          hint="Anyone under 18. We'll ask ages next."
          value={formData.children.length}
          min={0}
          max={10}
          onChange={handleChildCountChange}
        />
      </div>

      {formData.children.length > 0 && (
        <div className="space-y-4">
          <div>
            <p className={labelClassName}>How old is each kiddo?</p>
            <FieldHint>Tap their age — little ones change everything in the best way.</FieldHint>
          </div>

          {formData.children.map((age, index) => (
            <div
              key={index}
              className="rounded-2xl border border-border bg-background p-4"
            >
              <p className="mb-3 text-sm font-semibold text-ink">Child {index + 1}</p>
              <div className="flex flex-wrap gap-2">
                {childAges.map((option) => (
                  <SelectChip
                    key={option}
                    selected={age === option}
                    onClick={() => handleChildAgeChange(index, option)}
                    className="min-w-[2.75rem] px-3"
                  >
                    {option}
                  </SelectChip>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hints.map((hint) => (
        <DynamicHint key={hint}>{hint}</DynamicHint>
      ))}
    </div>
  );
}
