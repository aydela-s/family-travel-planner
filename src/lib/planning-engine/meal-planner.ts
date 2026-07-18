import { BudgetStyle, TripPlan } from "@/types/trip-plan";
import { SlotKind } from "@/lib/planning-engine/types";
import { AdjustmentContext } from "@/lib/planning-engine/day-adjustment";

/** P0 #5–6: breakfast slot only when accommodation does not cover it */
export function requiresBreakfastSlot(plan: TripPlan): boolean {
  switch (plan.accommodationType) {
    case "hotel_breakfast_included":
    case "airbnb_with_kitchen":
    case "staying_with_family_or_friends":
      return false;
    case "hotel_no_breakfast":
    case "airbnb_no_kitchen":
    default:
      return true;
  }
}

/** Alternate cook-at-home and eat-out nights for rentals with a kitchen */
export function shouldCookDinnerAtHome(
  plan: TripPlan,
  day: number,
  adjustment?: AdjustmentContext,
): boolean {
  if (plan.accommodationType !== "airbnb_with_kitchen") return false;
  if (adjustment?.forceEatOut) return false;
  if (adjustment?.forceCookDinner) return true;
  return day % 2 === 1;
}

/** P0 #8: do not auto-schedule restaurant dinner when staying with hosts */
export function shouldAutoScheduleRestaurantDinner(plan: TripPlan): boolean {
  return plan.accommodationType !== "staying_with_family_or_friends";
}

export function breakfastLabel(plan: TripPlan, spot: string): { title: string; notes: string } {
  switch (plan.accommodationType) {
    case "airbnb_no_kitchen":
      return {
        title: `Takeaway breakfast near ${spot}`,
        notes: "Bakery or café — no kitchen at your rental.",
      };
    default:
      return {
        title: `Breakfast near ${spot}`,
        notes: "Café stop before the main outing.",
      };
  }
}

/** Restaurant-tier copy for the default (non-kitchen, non-hosted) case — driven by Budget Style, not a dollar target. */
function restaurantMealLabel(
  style: BudgetStyle | "",
  spot: string,
  meal: "lunch" | "dinner",
): { title: string; notes: string } {
  const capitalized = meal === "lunch" ? "Lunch" : "Dinner";
  switch (style) {
    case "save":
      return {
        title: `Casual ${meal} near ${spot}`,
        notes: `Takeaway or a low-key spot — keeping ${meal} simple and affordable.`,
      };
    case "splurge":
      return {
        title: `${capitalized} at a top pick near ${spot}`,
        notes: `A standout ${meal} experience worth lingering over.`,
      };
    default:
      return {
        title: `${capitalized} in the ${spot} area`,
        notes: `A relaxed sit-down ${meal} with a local neighborhood feel.`,
      };
  }
}

export function lunchLabel(plan: TripPlan, spot: string): { title: string; notes: string } {
  if (plan.accommodationType === "airbnb_with_kitchen") {
    return {
      title: `Picnic lunch near ${spot}`,
      notes: "Pack lunch from your rental or pick up groceries on the way.",
    };
  }
  if (plan.accommodationType === "staying_with_family_or_friends") {
    return {
      title: `Lunch near ${spot}`,
      notes: "May be shared with hosts — budget extra for treats out.",
    };
  }
  return restaurantMealLabel(plan.budgetStyle, spot, "lunch");
}

export function dinnerLabel(
  plan: TripPlan,
  spot: string,
  day: number,
  adjustment?: AdjustmentContext,
): { title: string; notes: string } {
  if (shouldCookDinnerAtHome(plan, day, adjustment)) {
    return {
      title: "Cook dinner at your rental",
      notes: "Grocery-based dinner — a relaxed night in, ingredients picked up on the way back.",
    };
  }
  if (plan.accommodationType === "airbnb_with_kitchen") {
    return {
      title: `Dinner out near ${spot}`,
      notes: "Night off from cooking — enjoy a local restaurant as a family.",
    };
  }
  if (plan.accommodationType === "staying_with_family_or_friends") {
    return {
      title: "Dinner with your hosts",
      notes: "Meals are likely covered — confirm plans with your hosts.",
    };
  }
  return restaurantMealLabel(plan.budgetStyle, spot, "dinner");
}

export function slotActivityType(kind: SlotKind): "meal" | "activity" | "rest" | "nap" {
  if (kind === "breakfast" || kind === "lunch" || kind === "dinner") return "meal";
  if (kind === "morning_activity" || kind === "afternoon_activity" || kind === "extra_activity" || kind === "calm_activity" || kind === "grocery") {
    return "activity";
  }
  return "rest";
}
