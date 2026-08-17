import { describe, expect, it } from "vitest";
import {
  compileTripConstraints,
  wantsStrictDietary,
} from "@/lib/planning-engine/constraints";
import { shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import type { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-15",
    endDate: "2026-09-17",
    adults: 1,
    children: [3],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    naps: [{ startTime: "12:00 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: ["Parks & Gardens", "Theme Parks"],
    ...overrides,
  };
}

describe("compileTripConstraints", () => {
  it("treats an empty nap list as a hard no_naps rule and keeps existing nap policy", () => {
    const noNaps = plan({ naps: [] });
    expect(shouldIncludeNaps(noNaps)).toBe(false);
    expect(compileTripConstraints(noNaps).hard).toContainEqual({ kind: "no_naps" });

    const withNaps = plan();
    expect(shouldIncludeNaps(withNaps)).toBe(true);
    expect(compileTripConstraints(withNaps).hard.some((c) => c.kind === "no_naps")).toBe(false);
  });

  it("compiles explicit exclusions and a drive ceiling as hard rules", () => {
    const compiled = compileTripConstraints(
      plan({
        userConstraints: {
          excludeInterests: ["Theme Parks"],
          excludeVenues: ["Play Street Museum"],
          maxDriveMin: 15,
        },
      }),
    );
    expect(compiled.hard).toEqual(
      expect.arrayContaining([
        { kind: "exclude_interest", tag: "theme-parks" },
        { kind: "exclude_venue", name: "Play Street Museum" },
        { kind: "max_drive_min", minutes: 15 },
      ]),
    );
  });

  it("keeps a stated diet as a soft preference unless the user demanded a dedicated kitchen", () => {
    const soft = compileTripConstraints(plan({ dietaryRestrictions: "vegan" }));
    expect(soft.hard.some((c) => c.kind === "dietary_required")).toBe(false);
    expect(soft.soft).toContainEqual({ kind: "prefer_dietary_fit", tags: ["vegan"] });

    expect(wantsStrictDietary(plan({ dietaryRestrictions: "only vegan restaurants" }))).toBe(true);
    expect(
      compileTripConstraints(plan({ dietaryRestrictions: "must be fully vegan" })).hard,
    ).toContainEqual({ kind: "dietary_required", tags: ["vegan"] });
    expect(
      compileTripConstraints(
        plan({ dietaryRestrictions: "vegan", userConstraints: { dietaryStrict: true } }),
      ).hard,
    ).toContainEqual({ kind: "dietary_required", tags: ["vegan"] });
  });

  it("maps selected interests and save/relaxed styles onto soft preferences", () => {
    const compiled = compileTripConstraints(
      plan({ budgetStyle: "save", travelStyle: "relaxed", walkingLimit: "low" }),
    );
    expect(compiled.soft).toEqual(
      expect.arrayContaining([
        { kind: "prefer_interest", tag: "parks" },
        { kind: "prefer_interest", tag: "theme-parks" },
        { kind: "prefer_cheaper" },
        { kind: "prefer_shorter_drive" },
      ]),
    );
  });
});
