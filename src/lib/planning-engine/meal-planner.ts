import { CityRestaurant } from "@/config/city-restaurants";
import { BudgetStyle, TripPlan } from "@/types/trip-plan";
import { SlotKind } from "@/lib/planning-engine/types";
import { AdjustmentContext } from "@/lib/planning-engine/day-adjustment";
import {
  matchesDietaryNeeds,
  matchesDietaryOptions,
  parseDietaryTags,
} from "@/lib/planning-engine/restaurant-picker";
import { getFamilyAgeProfile } from "@/lib/schedule/family-profile";

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

function budgetFlavorNote(style: BudgetStyle | "", meal: "breakfast" | "lunch" | "dinner"): string {
  switch (style) {
    case "save":
      return `Keeping ${meal} simple and affordable.`;
    case "splurge":
      return "";
    default:
      if (meal === "dinner") {
        return "One sit-down dinner — share plates if you like, without overdoing meals out.";
      }
      return `Keeping ${meal} light and affordable.`;
  }
}

function namedMealNotes(
  plan: TripPlan,
  meal: "breakfast" | "lunch" | "dinner",
  restaurant: CityRestaurant,
  extra?: string,
): string {
  const parts = [restaurant.familyNote];
  const dietary = parseDietaryTags(plan.dietaryRestrictions);
  if (dietary.length > 0) {
    if (matchesDietaryNeeds(restaurant, dietary)) {
      parts.push(`Fits your ${dietary.join(" / ")} preferences.`);
    } else if (matchesDietaryOptions(restaurant, dietary)) {
      parts.push(`Has ${dietary.join(" / ")} options on the menu.`);
    }
  }
  const profile = getFamilyAgeProfile(plan);
  if (profile.hasToddler && restaurant.ageTags.includes("toddler")) {
    parts.push("Chosen with toddlers in mind.");
  } else if (profile.hasYoungChild && restaurant.ageTags.includes("child")) {
    parts.push("Works well for younger kids.");
  }
  const budgetNote = budgetFlavorNote(plan.budgetStyle, meal);
  if (budgetNote) parts.push(budgetNote);
  if (extra) parts.push(extra);
  return parts.join(" ");
}

/**
 * When budget style should name a restaurant for this meal.
 * Save/balanced: bakery/picnic for breakfast & lunch; restaurant mainly at dinner.
 * Splurge (Treat Ourselves): restaurant meals throughout the day.
 */
export function usesNamedRestaurant(
  plan: TripPlan,
  meal: "breakfast" | "lunch" | "dinner",
): boolean {
  if (plan.budgetStyle === "splurge") return true;
  if (plan.budgetStyle === "balanced" && meal === "dinner") return true;
  return false;
}

/** Restaurant-tier copy when no named place is available — driven by Budget Style. */
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
        notes: `A special ${meal} in the ${spot} area.`,
      };
    default:
      if (meal === "lunch") {
        return {
          title: `Picnic or sandwich lunch near ${spot}`,
          notes: "Grab sandwiches, bakery bites, or a park picnic — keep the sit-down meal for later.",
        };
      }
      return {
        title: `${capitalized} in the ${spot} area`,
        notes: `A relaxed sit-down ${meal} with a local neighborhood feel.`,
      };
  }
}

export function breakfastLabel(
  plan: TripPlan,
  spot: string,
  restaurant?: CityRestaurant | null,
): { title: string; notes: string } {
  if (restaurant && usesNamedRestaurant(plan, "breakfast")) {
    const takeaway = plan.accommodationType === "airbnb_no_kitchen";
    return {
      title: takeaway
        ? `Takeaway breakfast at ${restaurant.name}`
        : `Breakfast at ${restaurant.name}`,
      notes: namedMealNotes(
        plan,
        "breakfast",
        restaurant,
        takeaway ? "No kitchen at your rental — grab it to go." : undefined,
      ),
    };
  }

  switch (plan.budgetStyle) {
    case "splurge":
      break;
    case "save":
      return {
        title: `Bakery breakfast near ${spot}`,
        notes: "Pastries or takeaway coffee — simple and affordable.",
      };
    default:
      return {
        title: `Pastries or café breakfast near ${spot}`,
        notes: "Bakery or café takeaway before the main outing — not a full sit-down meal.",
      };
  }

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

export function lunchLabel(
  plan: TripPlan,
  spot: string,
  restaurant?: CityRestaurant | null,
): { title: string; notes: string } {
  if (plan.accommodationType === "airbnb_with_kitchen") {
    return {
      title: `Picnic lunch near ${spot}`,
      notes: "Pack lunch from your rental or pick up groceries on the way.",
    };
  }

  if (restaurant && usesNamedRestaurant(plan, "lunch")) {
    const hostExtra =
      plan.accommodationType === "staying_with_family_or_friends"
        ? "May be shared with hosts — budget extra for treats out."
        : undefined;
    return {
      title: `Lunch at ${restaurant.name}`,
      notes: namedMealNotes(plan, "lunch", restaurant, hostExtra),
    };
  }

  if (plan.budgetStyle === "save" || plan.budgetStyle === "balanced" || !plan.budgetStyle) {
    const base =
      plan.budgetStyle === "save"
        ? {
            title: `Casual lunch near ${spot}`,
            notes: "Sandwiches, takeaway, or a park picnic — keeping lunch simple and affordable.",
          }
        : {
            title: `Picnic or sandwich lunch near ${spot}`,
            notes: "Grab sandwiches, bakery bites, or a park picnic — keep the sit-down meal for later.",
          };
    if (plan.accommodationType === "staying_with_family_or_friends") {
      return {
        ...base,
        notes: `${base.notes} May be shared with hosts — budget extra for treats out.`,
      };
    }
    return base;
  }

  if (plan.accommodationType === "staying_with_family_or_friends") {
    const meal = restaurantMealLabel(plan.budgetStyle, spot, "lunch");
    return {
      ...meal,
      notes: `${meal.notes} May be shared with hosts — budget extra for treats out.`,
    };
  }
  return restaurantMealLabel(plan.budgetStyle, spot, "lunch");
}

export function dinnerLabel(
  plan: TripPlan,
  spot: string,
  day: number,
  adjustment?: AdjustmentContext,
  restaurant?: CityRestaurant | null,
): { title: string; notes: string } {
  if (shouldCookDinnerAtHome(plan, day, adjustment)) {
    return {
      title: "Cook dinner at your rental",
      notes: "Grocery-based dinner — a relaxed night in, ingredients picked up on the way back.",
    };
  }
  if (plan.accommodationType === "staying_with_family_or_friends") {
    return {
      title: "Dinner with your hosts",
      notes: "Meals are likely covered — confirm plans with your hosts.",
    };
  }

  if (restaurant && usesNamedRestaurant(plan, "dinner")) {
    const kitchenNightOff =
      plan.accommodationType === "airbnb_with_kitchen"
        ? "Night off from cooking — enjoy a local restaurant as a family."
        : plan.budgetStyle === "balanced"
          ? "Share plates if you like — one sit-down meal for the day."
          : undefined;
    return {
      title: `Dinner at ${restaurant.name}`,
      notes: namedMealNotes(plan, "dinner", restaurant, kitchenNightOff),
    };
  }

  if (plan.accommodationType === "airbnb_with_kitchen") {
    return {
      title: `Dinner out near ${spot}`,
      notes: "Night off from cooking — enjoy a local restaurant as a family.",
    };
  }
  return restaurantMealLabel(plan.budgetStyle, spot, "dinner");
}

export function slotActivityType(kind: SlotKind): "meal" | "activity" | "rest" | "nap" {
  if (kind === "breakfast" || kind === "lunch" || kind === "dinner") return "meal";
  if (
    kind === "morning_activity" ||
    kind === "afternoon_activity" ||
    kind === "extra_activity" ||
    kind === "calm_activity" ||
    kind === "grocery" ||
    kind === "afternoon_rest" ||
    kind === "evening_rest" ||
    kind === "midday_rest" ||
    kind === "return_home"
  ) {
    return "activity";
  }
  // Free-time / recovery slots that aren't naps are activities (FAM-14).
  return "activity";
}
