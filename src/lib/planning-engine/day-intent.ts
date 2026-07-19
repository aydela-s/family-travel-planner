import { SlotKind } from "@/lib/planning-engine/types";

export type SlotPriority = "core" | "optional";

const OPTIONAL_SLOT_KINDS: SlotKind[] = [
  "evening_rest",
  "extra_activity",
  "afternoon_rest",
];

/** Whether a skeleton slot may be dropped when the day is too tight for dinner. */
export function priorityForSlotKind(kind: SlotKind): SlotPriority {
  return OPTIONAL_SLOT_KINDS.includes(kind) ? "optional" : "core";
}

export function isOptionalSlotKind(kind: SlotKind): boolean {
  return priorityForSlotKind(kind) === "optional";
}

type IntentTagged = {
  title: string;
  type: string;
  slotKind?: SlotKind;
};

/** Intent-tagged activity, with title fallback for adjustment-injected items. */
export function isOptionalActivity(a: IntentTagged): boolean {
  if (a.slotKind) return isOptionalSlotKind(a.slotKind);
  return (
    /\bevening stroll\b/i.test(a.title) ||
    ((a.type === "rest" || a.type === "activity") && /stroll|evening/i.test(a.title))
  );
}
