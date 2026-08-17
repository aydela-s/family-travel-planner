export type TravelStyle = "relaxed" | "balanced" | "packed";

export type BudgetStyle = "save" | "balanced" | "splurge";

export type WalkingLimit = "low" | "medium" | "high";

export type TransportationType =
  | "walking"
  | "car-rental"
  | "taxis"
  | "public-transportation";

export type AccommodationType =
  | "hotel_breakfast_included"
  | "hotel_no_breakfast"
  | "airbnb_with_kitchen"
  | "airbnb_no_kitchen"
  | "staying_with_family_or_friends"
  | "dont_know_yet"
  | "";

/** FAM-52 — structured nap windows (12-hour clock strings). */
export type NapType = "regular" | "stroller";

export type NapEntry = {
  startTime: string;
  endTime: string;
  type: NapType;
};

export type TripPlan = {
  destination: string;
  /**
   * Places-backed destination center (FAM-57). Set when the user picks a city
   * from autocomplete — required by the wizard so free-typed names can't plan.
   */
  destinationPlaceId?: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  startDate: string;
  endDate: string;
  adults: number;
  children: number[];
  travelStyle: TravelStyle | "";
  walkingLimit: WalkingLimit | "";
  transportationType: TransportationType | "";
  accommodationType: AccommodationType;
  /** Formatted stay address from Places (FAM-24). Optional for older plans/tests. */
  stayAddress?: string;
  stayPlaceId?: string;
  stayLat?: number | null;
  stayLng?: number | null;
  dietaryRestrictions: string;
  /**
   * Structured naps (FAM-52).
   * - `null` — not answered yet (wizard)
   * - `[]` — no naps needed
   * - entries — up to 3 scheduled naps
   */
  naps: NapEntry[] | null;
  budgetStyle: BudgetStyle | "";
  interests: string[];
  /**
   * Explicit "must" / "must not" requests, compiled into hard constraints by
   * compileTripConstraints. Optional: no wizard step writes this yet.
   */
  userConstraints?: UserConstraintInput;
};

/**
 * Raw explicit user requirements. Everything here is a HARD requirement — soft
 * preferences stay expressed through interests / travelStyle / budgetStyle.
 */
export type UserConstraintInput = {
  /** Interest categories the family refuses (e.g. theme-parks). */
  excludeInterests?: string[];
  /** Named venues/restaurants the family refuses. */
  excludeVenues?: string[];
  /** Explicit ceiling on one-way driving to a stop / extra driving for a meal. */
  maxDriveMin?: number;
  /** True when the user demanded a fully dedicated dietary venue ("vegan only"). */
  dietaryStrict?: boolean;
};

export const initialTripPlan: TripPlan = {
  destination: "",
  destinationPlaceId: "",
  destinationLat: null,
  destinationLng: null,
  startDate: "",
  endDate: "",
  adults: 2,
  children: [0],
  travelStyle: "",
  walkingLimit: "",
  transportationType: "",
  accommodationType: "",
  stayAddress: "",
  stayPlaceId: "",
  stayLat: null,
  stayLng: null,
  dietaryRestrictions: "",
  /** Default one regular midday nap when traveling with a young child (FAM-52). */
  naps: [{ startTime: "12:00 PM", endTime: "2:00 PM", type: "regular" }],
  budgetStyle: "",
  interests: [],
};

export type StepProps = {
  formData: TripPlan;
  updateFormData: (updates: Partial<TripPlan>) => void;
  /** Optional: step is waiting on an async confirm (e.g. Places details). */
  setStepBusy?: (busy: boolean) => void;
};

/** Infer walking tolerance from travel pace when the user no longer picks it separately */
export function walkingLimitFromTravelStyle(style: TravelStyle): WalkingLimit {
  switch (style) {
    case "relaxed":
      return "low";
    case "packed":
      return "high";
    default:
      return "medium";
  }
}
