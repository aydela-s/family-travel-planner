import { AdjustActionId } from "@/lib/planning-engine/adjust-types";

export type GenerateItineraryOptions = {
  demo?: boolean;
  relaxed?: boolean;
  adjustDay?: number;
  adjustAction?: AdjustActionId;
  adjustNote?: string;
};

export const LOADING_MESSAGES = [
  "Finding great places nearby...",
  "Planning rest breaks...",
  "Optimizing your day...",
  "Checking walking distances...",
  "Picking restaurants...",
  "Adding buffer time between stops...",
] as const;
