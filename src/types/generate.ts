import { AdjustActionId } from "@/lib/planning-engine/adjust-types";

export type GenerateItineraryOptions = {
  relaxed?: boolean;
  adjustDay?: number;
  adjustAction?: AdjustActionId;
  adjustNote?: string;
};

export const LOADING_MESSAGES = [
  "Getting to know your destination...",
  "Fitting the trip to your crew...",
  "Planning around where you’re staying...",
  "Keeping the pace comfortable...",
  "Picking places that match your interests...",
] as const;
