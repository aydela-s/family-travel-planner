"use client";

import { shouldShowNapSection } from "@/lib/planning-engine/nap-options";
import type { InputHTMLAttributes, ReactNode } from "react";
import type { NapEntry } from "@/types/trip-plan";
import { applyStayCategory, applyStayType, stayAddressRequired, useDesignLab } from "../state";
import {
  DIETARY_OPTIONS,
  INTEREST_OPTIONS,
  LAB_WIZARD_SECTIONS,
  NAP_TIMES,
  PACE_OPTIONS,
  SPEND_OPTIONS,
  STAY_CATEGORIES,
  STAY_SUB_OPTIONS,
  TRANSIT_OPTIONS,
} from "../lib/wizard-options";
import type { LabConceptId } from "../concepts";

type Skin = LabConceptId;

const optionClass: Record<Skin, { base: string; on: string; off: string; grid: string }> = {
  ledger: {
    base: "flex w-full items-baseline justify-between gap-4 border-b border-stone-300/80 py-3 text-left",
    on: "text-[#016d76]",
    off: "text-stone-700 hover:text-stone-950",
    grid: "flex flex-col",
  },
  atlas: {
    base: "rounded-lg border px-3 py-2.5 text-left text-sm transition",
    on: "border-[#016d76] bg-[#016d76] text-white",
    off: "border-slate-200 bg-white text-slate-800 hover:border-[#02bbcb]",
    grid: "grid grid-cols-1 gap-2 sm:grid-cols-2",
  },
  journal: {
    base: "block w-full border-b border-stone-200 py-4 text-left text-2xl font-normal tracking-tight transition",
    on: "text-[#c45c4a]",
    off: "text-stone-800 hover:text-[#016d76]",
    grid: "flex flex-col",
  },
  board: {
    base: "rounded-md border px-3 py-2 text-left text-sm",
    on: "border-[#016d76] bg-[#e6f3f4] font-semibold text-[#015861]",
    off: "border-slate-200 bg-white hover:bg-slate-50",
    grid: "grid grid-cols-2 gap-2",
  },
  companion: {
    base: "flex min-h-16 w-full items-center rounded-2xl px-4 text-left text-lg font-semibold",
    on: "bg-[#016d76] text-white",
    off: "bg-white text-slate-900 ring-1 ring-slate-200",
    grid: "flex flex-col gap-3",
  },
  harbor: {
    base: "flex w-full items-baseline justify-between gap-4 border-b border-[#d9e8eb] py-3 text-left",
    on: "font-semibold text-[#016d76]",
    off: "text-slate-700 hover:text-[#016d76]",
    grid: "flex flex-col",
  },
  route: {
    base: "flex w-full items-baseline justify-between gap-4 border-b border-slate-200 py-3 text-left",
    on: "border-[#016d76] font-semibold text-[#016d76]",
    off: "text-slate-700 hover:text-slate-950",
    grid: "flex flex-col",
  },
  daylight: {
    base: "flex w-full items-baseline justify-between gap-4 border-b border-[#d9e8eb] py-3 text-left",
    on: "font-semibold text-[#c45c4a]",
    off: "text-slate-700 hover:text-[#016d76]",
    grid: "flex flex-col",
  },
};

function OptionButton({
  skin,
  selected,
  onClick,
  children,
  disabled,
}: {
  skin: Skin;
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const styles = optionClass[skin];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${styles.base} ${selected ? styles.on : styles.off} ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {children}
      {skin === "ledger" && selected ? <span className="font-mono text-xs tracking-wide">SELECTED</span> : null}
    </button>
  );
}

function isRowSkin(skin: Skin) {
  return skin === "ledger" || skin === "harbor" || skin === "route" || skin === "daylight";
}

function FieldLabel({ skin, children }: { skin: Skin; children: ReactNode }) {
  const className =
    skin === "journal"
      ? "mb-6 text-sm uppercase tracking-[0.2em] text-stone-500"
      : skin === "ledger"
        ? "mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-stone-500"
        : isRowSkin(skin)
          ? "mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
        : skin === "companion"
          ? "sr-only"
          : "mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500";
  return <p className={className}>{children}</p>;
}

function Input({
  skin,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { skin: Skin }) {
  const className =
    skin === "ledger"
      ? "w-full border-0 border-b border-stone-400 bg-transparent py-2 outline-none focus:border-[#016d76]"
      : isRowSkin(skin)
        ? "w-full border-0 border-b border-[#d9e8eb] bg-transparent py-2 outline-none focus:border-[#016d76]"
      : skin === "journal"
        ? "w-full border-0 bg-transparent text-3xl tracking-tight text-stone-900 outline-none placeholder:text-stone-300"
        : skin === "companion"
          ? "min-h-16 w-full rounded-2xl bg-white px-4 text-xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-[#016d76]"
          : skin === "atlas"
            ? "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#016d76]"
            : "w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#016d76]";
  return <input className={className} {...props} />;
}

export function SectionCopy({ skin, index }: { skin: Skin; index: number }) {
  const section = LAB_WIZARD_SECTIONS[index]!;
  if (skin === "journal") {
    return (
      <header className="mb-10">
        <p className="text-sm tracking-[0.25em] text-[#016d76]">CHAPTER {["I", "II", "III", "IV", "V", "VI"][index]}</p>
        <h2 className="mt-3 font-[family-name:var(--font-lab-news)] text-4xl leading-tight text-stone-900 sm:text-5xl">
          {section.title}
        </h2>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-stone-600">{section.prompt}</p>
      </header>
    );
  }
  if (skin === "companion") {
    return (
      <header className="mb-8">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900">{section.prompt}</h2>
      </header>
    );
  }
  if (skin === "ledger") {
    return (
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
          {String(index + 1).padStart(2, "0")} / 06
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-lab-serif)] text-3xl text-stone-900">{section.title}</h2>
        <p className="mt-2 max-w-lg text-stone-600">{section.prompt}</p>
      </header>
    );
  }
  if (isRowSkin(skin)) {
    return (
      <header className="mb-8">
        <p className="text-sm text-slate-500">
          Step {index + 1} of {LAB_WIZARD_SECTIONS.length}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{section.title}</h2>
        <p className="mt-2 max-w-lg text-slate-600">{section.prompt}</p>
      </header>
    );
  }
  return (
    <header className="mb-6">
      <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
      <p className="mt-1 text-sm text-slate-600">{section.prompt}</p>
    </header>
  );
}

export function WhereWhenFields({ skin }: { skin: Skin }) {
  const { plan, updatePlan } = useDesignLab();
  const styles = optionClass[skin];
  return (
    <div className="space-y-6">
      <div>
        <FieldLabel skin={skin}>Destination</FieldLabel>
        <Input skin={skin} value={plan.destination} readOnly aria-readonly />
        <p className={skin === "journal" ? "mt-3 text-sm text-stone-500" : "mt-2 text-xs text-slate-500"}>
          Design Lab uses the Dallas demo so every concept shows the same itinerary.
        </p>
      </div>
      <div className={skin === "companion" ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
        <div>
          <FieldLabel skin={skin}>Start</FieldLabel>
          <Input
            skin={skin}
            type="date"
            value={plan.startDate}
            onChange={(event) => updatePlan({ startDate: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel skin={skin}>End</FieldLabel>
          <Input
            skin={skin}
            type="date"
            value={plan.endDate}
            onChange={(event) => updatePlan({ endDate: event.target.value })}
          />
        </div>
      </div>
      <p className={styles.off.includes("text") ? "text-sm text-stone-500" : "text-sm text-slate-500"}>
        Four days in Dallas — same trip in every concept.
      </p>
    </div>
  );
}

export function TravelersFields({ skin }: { skin: Skin }) {
  const { plan, updatePlan } = useDesignLab();
  const styles = optionClass[skin];

  function setAdults(next: number) {
    updatePlan({ adults: Math.max(1, Math.min(12, next)) });
  }
  function setKidCount(count: number) {
    const nextCount = Math.max(0, Math.min(10, count));
    const children = Array.from({ length: nextCount }, (_, index) => plan.children[index] ?? 3);
    updatePlan({ children });
  }
  function setAge(index: number, age: number) {
    const children = plan.children.map((value, i) => (i === index ? age : value));
    updatePlan({ children });
  }

  return (
    <div className="space-y-8">
      <div>
        <FieldLabel skin={skin}>Adults</FieldLabel>
        <div className="flex items-center gap-4">
          <OptionButton skin={skin} selected={false} onClick={() => setAdults(plan.adults - 1)}>
            −
          </OptionButton>
          <span className={skin === "journal" ? "text-4xl" : "min-w-8 text-center text-2xl font-semibold"}>
            {plan.adults}
          </span>
          <OptionButton skin={skin} selected={false} onClick={() => setAdults(plan.adults + 1)}>
            +
          </OptionButton>
        </div>
      </div>
      <div>
        <FieldLabel skin={skin}>Kids</FieldLabel>
        <div className="flex items-center gap-4">
          <OptionButton skin={skin} selected={false} onClick={() => setKidCount(plan.children.length - 1)}>
            −
          </OptionButton>
          <span className={skin === "journal" ? "text-4xl" : "min-w-8 text-center text-2xl font-semibold"}>
            {plan.children.length}
          </span>
          <OptionButton skin={skin} selected={false} onClick={() => setKidCount(plan.children.length + 1)}>
            +
          </OptionButton>
        </div>
      </div>
      {plan.children.map((age, index) => (
        <div key={index}>
          <FieldLabel skin={skin}>Child {index + 1} age</FieldLabel>
          <div className={skin === "companion" ? "grid grid-cols-6 gap-2" : `${styles.grid} ${skin === "ledger" ? "" : ""}`}>
            {isRowSkin(skin) || skin === "journal" ? (
              <Input
                skin={skin}
                type="number"
                min={0}
                max={17}
                value={age}
                onChange={(event) => setAge(index, Number(event.target.value))}
              />
            ) : (
              Array.from({ length: 18 }, (_, n) => (
                <OptionButton key={n} skin={skin} selected={age === n} onClick={() => setAge(index, n)}>
                  {n}
                </OptionButton>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StayFields({ skin }: { skin: Skin }) {
  const { plan, updatePlan, stayCategory, setStayCategory } = useDesignLab();
  const styles = optionClass[skin];
  const category = stayCategory;
  const sub = category === "hotel" || category === "rental" ? STAY_SUB_OPTIONS[category] : null;

  return (
    <div className="space-y-8">
      <div>
        <FieldLabel skin={skin}>Stay</FieldLabel>
        <div className={styles.grid}>
          {STAY_CATEGORIES.map((option) => (
            <OptionButton
              key={option.id}
              skin={skin}
              selected={category === option.id}
              onClick={() => applyStayCategory(option.id, updatePlan, setStayCategory)}
            >
              <span>
                {option.label}
                {skin !== "companion" && skin !== "journal" ? (
                  <span className="mt-0.5 block text-xs font-normal opacity-80">{option.detail}</span>
                ) : null}
              </span>
            </OptionButton>
          ))}
        </div>
      </div>
      {sub ? (
        <div>
          <FieldLabel skin={skin}>Details</FieldLabel>
          <div className={styles.grid}>
            {sub.map((option) => (
              <OptionButton
                key={option.value}
                skin={skin}
                selected={plan.accommodationType === option.value}
                onClick={() => applyStayType(option.value, updatePlan, setStayCategory)}
              >
                {option.label}
              </OptionButton>
            ))}
          </div>
        </div>
      ) : null}
      {stayAddressRequired(plan) ? (
        <div>
          <FieldLabel skin={skin}>Stay address</FieldLabel>
          <Input
            skin={skin}
            value={plan.stayAddress ?? ""}
            onChange={(event) => updatePlan({ stayAddress: event.target.value })}
          />
        </div>
      ) : null}
      <div>
        <FieldLabel skin={skin}>Getting around</FieldLabel>
        <div className={styles.grid}>
          {TRANSIT_OPTIONS.map((option) => (
            <OptionButton
              key={option.value}
              skin={skin}
              selected={plan.transportationType === option.value}
              onClick={() => updatePlan({ transportationType: option.value })}
            >
              <span>
                {option.label}
                {skin !== "companion" ? (
                  <span className="mt-0.5 block text-xs font-normal opacity-80">{option.detail}</span>
                ) : null}
              </span>
            </OptionButton>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PaceFields({ skin }: { skin: Skin }) {
  const { plan, updatePlan } = useDesignLab();
  const styles = optionClass[skin];
  return (
    <div className="space-y-8">
      <div>
        <FieldLabel skin={skin}>Day pace</FieldLabel>
        <div className={styles.grid}>
          {PACE_OPTIONS.map((option) => (
            <OptionButton
              key={option.value}
              skin={skin}
              selected={plan.travelStyle === option.value}
              onClick={() => updatePlan({ travelStyle: option.value })}
            >
              <span>
                {option.label}
                <span className="mt-0.5 block text-xs font-normal opacity-80">{option.detail}</span>
              </span>
            </OptionButton>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel skin={skin}>Spending</FieldLabel>
        <div className={styles.grid}>
          {SPEND_OPTIONS.map((option) => (
            <OptionButton
              key={option.value}
              skin={skin}
              selected={plan.budgetStyle === option.value}
              onClick={() => updatePlan({ budgetStyle: option.value })}
            >
              <span>
                {option.label}
                <span className="mt-0.5 block text-xs font-normal opacity-80">{option.detail}</span>
              </span>
            </OptionButton>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RhythmFields({ skin }: { skin: Skin }) {
  const { plan, updatePlan } = useDesignLab();
  const styles = optionClass[skin];
  const showNaps = shouldShowNapSection(plan);
  const dietary = plan.dietaryRestrictions
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  function toggleDiet(item: string) {
    const next = dietary.includes(item) ? dietary.filter((value) => value !== item) : [...dietary, item];
    updatePlan({ dietaryRestrictions: next.join(", ") });
  }

  function setNaps(naps: NapEntry[] | null) {
    updatePlan({ naps });
  }

  return (
    <div className="space-y-8">
      <div>
        <FieldLabel skin={skin}>Dietary</FieldLabel>
        <div className={styles.grid}>
          {DIETARY_OPTIONS.map((item) => (
            <OptionButton
              key={item}
              skin={skin}
              selected={dietary.includes(item)}
              onClick={() => toggleDiet(item)}
            >
              {item}
            </OptionButton>
          ))}
        </div>
      </div>
      {showNaps ? (
        <div className="space-y-4">
          <FieldLabel skin={skin}>Naps</FieldLabel>
          <OptionButton
            skin={skin}
            selected={Array.isArray(plan.naps) && plan.naps.length === 0}
            onClick={() => setNaps([])}
          >
            No naps needed
          </OptionButton>
          {(plan.naps ?? []).map((nap, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Start
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2"
                  value={nap.startTime}
                  onChange={(event) => {
                    const naps = [...(plan.naps ?? [])];
                    naps[index] = { ...nap, startTime: event.target.value };
                    setNaps(naps);
                  }}
                >
                  {NAP_TIMES.map((time) => (
                    <option key={time}>{time}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                End
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2"
                  value={nap.endTime}
                  onChange={(event) => {
                    const naps = [...(plan.naps ?? [])];
                    naps[index] = { ...nap, endTime: event.target.value };
                    setNaps(naps);
                  }}
                >
                  {NAP_TIMES.map((time) => (
                    <option key={time}>{time}</option>
                  ))}
                </select>
              </label>
            </div>
          ))}
          {(!plan.naps || plan.naps.length === 0) && (
            <OptionButton
              skin={skin}
              selected={false}
              onClick={() => setNaps([{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }])}
            >
              Add a nap window
            </OptionButton>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No nap scheduler — the kids are old enough to skip it.</p>
      )}
    </div>
  );
}

export function InterestsFields({ skin }: { skin: Skin }) {
  const { plan, updatePlan } = useDesignLab();
  const styles = optionClass[skin];
  function toggle(label: string) {
    const next = plan.interests.includes(label)
      ? plan.interests.filter((item) => item !== label)
      : [...plan.interests, label];
    updatePlan({ interests: next });
  }
  return (
    <div>
      <FieldLabel skin={skin}>Interests</FieldLabel>
      <div className={isRowSkin(skin) || skin === "companion" || skin === "journal" ? styles.grid : "flex flex-wrap gap-2"}>
        {INTEREST_OPTIONS.map((label) => (
          <OptionButton key={label} skin={skin} selected={plan.interests.includes(label)} onClick={() => toggle(label)}>
            {label}
          </OptionButton>
        ))}
      </div>
    </div>
  );
}

export function WizardStepFields({ skin, index }: { skin: Skin; index: number }) {
  return (
    <div>
      <SectionCopy skin={skin} index={index} />
      {index === 0 ? <WhereWhenFields skin={skin} /> : null}
      {index === 1 ? <TravelersFields skin={skin} /> : null}
      {index === 2 ? <StayFields skin={skin} /> : null}
      {index === 3 ? <PaceFields skin={skin} /> : null}
      {index === 4 ? <RhythmFields skin={skin} /> : null}
      {index === 5 ? <InterestsFields skin={skin} /> : null}
    </div>
  );
}
