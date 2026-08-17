import { describe, expect, it } from "vitest";
import { rescheduleActivitiesWithMealAnchors } from "@/lib/schedule/meal-planning";
import {
  chooseAfternoonPattern,
  minRealisticActivityDuration,
  planMorningChainFromNap,
  postNapDowntimeMin,
  preferReturnHomeBeforeDinner,
} from "@/lib/schedule/family-rhythm";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import type { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Denver",
    startDate: "2026-09-15",
    endDate: "2026-09-18",
    adults: 2,
    children: [3, 5],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: ["Interactive Museums"],
    ...overrides,
  };
}

describe("morning chain planned backward from a fixed nap", () => {
  it("starts a 10:00-open venue at 10:00 when that fits before the nap", () => {
    const chain = planMorningChainFromNap({
      napStartMin: 12 * 60 + 30,
      activityDurationMin: 90,
      breakfast: true,
      lunchAtStay: true,
      travelMin: 15,
      venueOpenMin: 10 * 60,
      lunchDurationMin: 45,
    });
    expect(chain.activityStartMin).toBe(10 * 60);
    expect(chain.activityEndMin).toBe(11 * 60 + 30);
    expect(chain.lunchStartMin).toBe(11 * 60 + 45);
    expect(chain.breakfastStartMin).toBeLessThan(10 * 60);
    expect(chain.breakfastStartMin).toBeGreaterThanOrEqual(8 * 60);
  });

  it("moves breakfast earlier to protect the morning activity", () => {
    const chain = planMorningChainFromNap({
      napStartMin: 12 * 60 + 30,
      activityDurationMin: 90,
      breakfast: true,
      lunchAtStay: true,
      travelMin: 15,
      venueOpenMin: 10 * 60,
    });
    expect(chain.breakfastStartMin).toBeLessThan(9 * 60 + 30);
  });

  it("works backward from lunch when there is no nap", () => {
    const chain = planMorningChainFromNap({
      lunchStartMin: 12 * 60,
      activityDurationMin: 90,
      breakfast: true,
      lunchAtStay: false,
      travelMin: 15,
      venueOpenMin: 10 * 60,
    });
    expect(chain.activityStartMin).toBe(10 * 60);
    expect(chain.activityEndMin - chain.activityStartMin).toBe(90);
    expect(chain.breakfastStartMin).toBeLessThan(10 * 60);
  });
});

describe("scheduler applies family-rhythm mornings", () => {
  it("does not delay a 10:00-open morning stop until just before the nap", () => {
    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "08:00",
          title: "Breakfast near the science museum",
          type: "meal" as const,
          slotKind: "breakfast" as const,
        },
        {
          time: "10:00",
          title: "Explore the science museum",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
          interestTags: ["museums" as const],
        },
        {
          time: "11:45",
          title: "Takeout or delivery lunch at your stay",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "12:30",
          title: "Nap & Quiet Time",
          type: "nap" as const,
        },
        {
          time: "18:00",
          title: "Dinner at a restaurant",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      plan(),
    );

    const morning = scheduled.find((a) => a.slotKind === "morning_activity")!;
    expect(parseTimeToMinutes(morning.time)).toBeLessThanOrEqual(10 * 60 + 15);
    expect(parseTimeToMinutes(morning.time)).toBeGreaterThanOrEqual(9 * 60 + 45);
    expect(
      parseTimeToMinutes(morning.endTime!) - parseTimeToMinutes(morning.time),
    ).toBeGreaterThanOrEqual(60);

    const breakfast = scheduled.find((a) => a.slotKind === "breakfast")!;
    expect(parseTimeToMinutes(breakfast.time)).toBeLessThan(parseTimeToMinutes(morning.time));
  });

  it("keeps a realistic morning visit before lunch when naps are off", () => {
    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "08:00",
          title: "Breakfast near indoor play",
          type: "meal" as const,
          slotKind: "breakfast" as const,
        },
        {
          time: "10:00",
          title: "Play at indoor play",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
          interestTags: ["indoor-play" as const],
        },
        {
          time: "12:00",
          title: "Lunch at a cafe",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "13:30",
          title: "Explore the nature reserve",
          type: "activity" as const,
          slotKind: "afternoon_activity" as const,
          interestTags: ["nature" as const],
        },
        {
          time: "18:00",
          title: "Dinner at a restaurant",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      plan({ naps: [] }),
    );

    const morning = scheduled.find((a) => a.slotKind === "morning_activity");
    expect(morning).toBeTruthy();
    expect(
      parseTimeToMinutes(morning!.endTime!) - parseTimeToMinutes(morning!.time),
    ).toBeGreaterThanOrEqual(90);
  });
});

describe("nap end is not an automatic activity start", () => {
  it("allows 60–90 minutes of post-nap downtime on Balanced with young kids", () => {
    expect(postNapDowntimeMin(plan())).toBeGreaterThanOrEqual(60);
    expect(postNapDowntimeMin(plan())).toBeLessThanOrEqual(90);

    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "10:00",
          title: "Explore the science museum",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
          interestTags: ["museums" as const],
        },
        {
          time: "11:45",
          title: "Takeout or delivery lunch at your stay",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "12:30",
          title: "Nap & Quiet Time",
          type: "nap" as const,
        },
        {
          time: "14:15",
          title: "Explore the children's museum",
          type: "activity" as const,
          slotKind: "afternoon_activity" as const,
          interestTags: ["museums" as const],
        },
        {
          time: "18:00",
          title: "Dinner at a restaurant",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      plan(),
    );

    const nap = scheduled.find((a) => a.type === "nap")!;
    const afternoon = scheduled.find((a) => a.slotKind === "afternoon_activity");
    if (afternoon) {
      expect(parseTimeToMinutes(afternoon.time) - parseTimeToMinutes(nap.endTime!)).toBeGreaterThanOrEqual(
        60,
      );
    }
    const downtime = scheduled.find((a) => /free time at your accommodation/i.test(a.title));
    expect(downtime).toBeTruthy();
  });

  it("can schedule only one afternoon activity on a balanced day", () => {
    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "10:00",
          title: "Explore the science museum",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
          interestTags: ["museums" as const],
        },
        {
          time: "11:45",
          title: "Takeout or delivery lunch at your stay",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "12:30",
          title: "Nap & Quiet Time",
          type: "nap" as const,
        },
        {
          time: "15:30",
          title: "Play at the splash pad",
          type: "activity" as const,
          slotKind: "afternoon_activity" as const,
          interestTags: ["beaches" as const],
        },
        {
          time: "16:15",
          title: "Extra stop at the mall",
          type: "activity" as const,
          slotKind: "extra_activity" as const,
          interestTags: ["shopping" as const],
        },
        {
          time: "18:00",
          title: "Dinner at a restaurant",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      plan(),
    );
    const paid = scheduled.filter(
      (a) =>
        a.slotKind === "morning_activity" ||
        a.slotKind === "afternoon_activity" ||
        a.slotKind === "extra_activity",
    );
    expect(paid.filter((a) => a.slotKind === "extra_activity")).toHaveLength(0);
    expect(paid.filter((a) => a.slotKind === "afternoon_activity").length).toBeLessThanOrEqual(1);
  });

  it("can have no afternoon activity on a balanced or relaxed day", () => {
    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "10:00",
          title: "Explore the science museum",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
          interestTags: ["museums" as const],
        },
        {
          time: "11:45",
          title: "Takeout or delivery lunch at your stay",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "12:30",
          title: "Nap & Quiet Time",
          type: "nap" as const,
        },
        {
          time: "18:00",
          title: "Dinner at a restaurant",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      plan({ travelStyle: "relaxed" }),
    );
    expect(scheduled.some((a) => a.slotKind === "afternoon_activity")).toBe(false);
    expect(scheduled.some((a) => a.type === "nap")).toBe(true);
  });
});

describe("dinner timing and unused time", () => {
  it("does not force an early dinner after the afternoon activity", () => {
    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "10:00",
          title: "Explore the science museum",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
          interestTags: ["museums" as const],
        },
        {
          time: "11:45",
          title: "Takeout or delivery lunch at your stay",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "12:30",
          title: "Nap & Quiet Time",
          type: "nap" as const,
        },
        {
          time: "15:30",
          title: "Play at the splash pad",
          type: "activity" as const,
          slotKind: "afternoon_activity" as const,
          interestTags: ["playgrounds" as const],
        },
        {
          time: "18:00",
          title: "Dinner at a restaurant",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      plan(),
    );
    const dinner = scheduled.find((a) => a.slotKind === "dinner")!;
    expect(parseTimeToMinutes(dinner.time)).toBeGreaterThanOrEqual(17 * 60);
  });

  it("can return the family to the accommodation before dinner", () => {
    expect(
      preferReturnHomeBeforeDinner(plan(), 15 * 60 + 45, 18 * 60, 15),
    ).toBe(true);

    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "10:00",
          title: "Explore the science museum",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
          interestTags: ["museums" as const],
        },
        {
          time: "11:45",
          title: "Takeout or delivery lunch at your stay",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "12:30",
          title: "Nap & Quiet Time",
          type: "nap" as const,
        },
        {
          time: "15:30",
          title: "Play at the splash pad",
          type: "activity" as const,
          slotKind: "afternoon_activity" as const,
          interestTags: ["playgrounds" as const],
        },
        {
          time: "18:00",
          title: "Dinner at a restaurant",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      plan(),
    );
    const home = scheduled.filter((a) => /free time at your accommodation/i.test(a.title));
    expect(home.length).toBeGreaterThan(0);
  });

  it("treats delivery at the stay as a valid dinner pattern", () => {
    const pattern = chooseAfternoonPattern(plan(), {
      morningDurationMin: 90,
      hasAfternoonSlot: true,
      remainingAfterNapMin: 240,
      dinnerAtStay: true,
    });
    expect(pattern).toBe("downtime_home_dinner");
  });

  it("does not treat unused time as a scheduling failure", () => {
    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "10:00",
          title: "Explore the science museum",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
          interestTags: ["museums" as const],
        },
        {
          time: "11:45",
          title: "Takeout or delivery lunch at your stay",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "12:30",
          title: "Nap & Quiet Time",
          type: "nap" as const,
        },
        {
          time: "18:00",
          title: "Dinner at a restaurant",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      plan(),
    );
    const lastBeforeDinner = [...scheduled]
      .reverse()
      .find((a) => a.slotKind !== "dinner")!;
    const dinner = scheduled.find((a) => a.slotKind === "dinner")!;
    const gap =
      parseTimeToMinutes(dinner.time) - parseTimeToMinutes(lastBeforeDinner.endTime!);
    expect(gap).toBeGreaterThan(0);
  });
});

describe("minimum realistic activity duration", () => {
  it("will not silently compress a museum to 15 minutes", () => {
    const min = minRealisticActivityDuration(
      {
        type: "activity",
        title: "Explore the science museum",
        slotKind: "morning_activity",
        interestTags: ["museums"],
      },
      plan(),
    );
    expect(min).toBeGreaterThanOrEqual(60);

    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "11:30",
          title: "Explore the science museum",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
          interestTags: ["museums" as const],
        },
        {
          time: "11:45",
          title: "Takeout or delivery lunch at your stay",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "12:30",
          title: "Nap & Quiet Time",
          type: "nap" as const,
        },
        {
          time: "18:00",
          title: "Dinner at a restaurant",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      plan(),
    );
    const museum = scheduled.find((a) => /science museum/i.test(a.title));
    if (museum) {
      expect(
        parseTimeToMinutes(museum.endTime!) - parseTimeToMinutes(museum.time),
      ).toBeGreaterThan(15);
      expect(
        parseTimeToMinutes(museum.endTime!) - parseTimeToMinutes(museum.time),
      ).toBeGreaterThanOrEqual(60);
    }
  });

  it("allows an explicit short visit when configured", () => {
    expect(
      minRealisticActivityDuration(
        {
          type: "activity",
          title: "Quick look at the mural",
          allowShortVisit: true,
        },
        plan(),
      ),
    ).toBe(15);
  });
});
