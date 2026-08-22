export const HERO_HEADLINE = "Plan a family trip that actually works";
export const HERO_TAGLINE = "Spend less time planning. More time making memories.";
export const HERO_BODY =
  "Personalized day-by-day itineraries built around your kids, your pace, and your budget.";

export const DAY_FLOW = [
  { time: "8:00 AM", title: "Breakfast", kind: "meal" as const },
  { time: "9:30 AM", title: "Water park", kind: "activity" as const, travel: "20 min" },
  { time: "12:15 PM", title: "Lunch & nap", kind: "meal" as const, travel: "15 min" },
  { time: "3:30 PM", title: "Playground", kind: "activity" as const, travel: "12 min" },
  { time: "6:00 PM", title: "Dinner", kind: "meal" as const, travel: "18 min" },
];

const WHY_CARDS = [
  {
    title: "Built around your family",
    body: "Kids’ ages, nap times, energy levels, food needs, and interests shape your itinerary.",
  },
  {
    title: "Days that actually flow",
    body: "Activities, meals, travel time, and downtime are arranged into a realistic day — not just a list of places.",
  },
  {
    title: "Your pace, not a checklist",
    body: "Choose how much you want to do each day and leave room to breathe.",
  },
  {
    title: "A budget that actually matters",
    body: "Your budget influences what we recommend, from activities to meals.",
  },
] as const;

export const PRODUCT_WHY_CARDS = WHY_CARDS.map((card) =>
  card.title === "Days that actually flow"
    ? {
        ...card,
        body: "Activities, meals, travel time, and downtime are arranged into a realistic day, not just a list of places.",
      }
    : card,
);

export const PRODUCT_HOW_STEPS = [
  {
    step: "1",
    title: "Tell us about your family",
    body: "Kids’ ages, interests, pace, food needs, transportation, budget, and more.",
  },
  {
    step: "2",
    title: "Get your personalized plan",
    body: "We build your days around what your family actually needs.",
  },
  {
    step: "3",
    title: "Share and go",
    body: "Your itinerary is ready. Share it with your family or take it with you wherever you go.",
  },
] as const;

export const MOBILE_WHY_PICK = PRODUCT_WHY_CARDS.slice(0, 2);
