/**
 * Isolated presentation layer for visual exploration.
 * Delete `src/design-lab` and `src/app/design-lab` to remove the lab.
 * Production routes, APIs, and planning engine are untouched.
 */
export const LAB_CONCEPT_IDS = [
  "ledger",
  "atlas",
  "journal",
  "board",
  "companion",
  "harbor",
  "route",
  "daylight",
] as const;

export const ORIGINAL_CONCEPT_IDS = ["ledger", "atlas", "journal", "board", "companion"] as const;
export const MIX_CONCEPT_IDS = ["harbor", "route", "daylight"] as const;

export type LabConceptId = (typeof LAB_CONCEPT_IDS)[number];

export type LabScreen = "home" | "wizard" | "itinerary";

export const LAB_SCREENS: { id: LabScreen; label: string; path: string }[] = [
  { id: "home", label: "Homepage", path: "" },
  { id: "wizard", label: "Wizard", path: "/plan" },
  { id: "itinerary", label: "Itinerary", path: "/trip" },
];

export type LabConceptMeta = {
  id: LabConceptId;
  name: string;
  shortName: string;
  oneLiner: string;
  idea: string;
  whyFamily: string;
  hierarchy: string;
  wizard: string;
  itinerary: string;
  budget: string;
  differs: string;
};

export const LAB_CONCEPTS: Record<LabConceptId, LabConceptMeta> = {
  ledger: {
    id: "ledger",
    name: "Day Ledger",
    shortName: "Ledger",
    oneLiner: "A printed daily agenda — time on the left, the day as type, not cards.",
    idea: "The trip is a set of day sheets a parent could pin on the fridge. Typography and a time spine do the work that cards usually do.",
    whyFamily: "Parents scan by clock time: breakfast, outing, nap, next stop. A ledger makes that scan the primary interface.",
    hierarchy: "Time → what happens → where / cost in quieter type. Days stack as full sheets; nothing is hidden behind a tab.",
    wizard: "One intake document with a numbered section index. You fill a travel brief, not a marketing stepper.",
    itinerary: "Every day is visible by scrolling. A thin date spine jumps between sheets. Activities are lines, not tiles.",
    budget: "A running margin on each day plus a trip total as a last line — like a bill, not a dashboard banner.",
    differs: "Flat and typographic. All days at once. No pill tabs, no card stack, no centered wizard card.",
  },
  atlas: {
    id: "atlas",
    name: "Family Atlas",
    shortName: "Atlas",
    oneLiner: "Geography first — the map is the trip, the list is the legend.",
    idea: "Family days fail on distance and logistics. This concept treats Dallas as a map you move through, with the schedule attached to pins.",
    whyFamily: "Nap-at-home, taxi hops, and ‘is this too far?’ are spatial questions. Showing where you will be makes the plan believable.",
    hierarchy: "Map (where) → selected stop (what) → time and cost (when / how much). Days are a filmstrip of mapped routes.",
    wizard: "A left-hand briefing panel over a city map. Short questions. The map stays while you set stay and transport.",
    itinerary: "Split view: route map beside a compact stop list. Selecting a stop highlights its pin. Mobile stacks map above the day.",
    budget: "Cost lives on pins and a compact overlay, not a three-column marketing banner.",
    differs: "Spatial split layout vs single column. Persistent map. Day switching changes the route, not a card deck.",
  },
  journal: {
    id: "journal",
    name: "Trip Journal",
    shortName: "Journal",
    oneLiner: "An editorial travel story you’d actually send to grandparents.",
    idea: "Each day opens with a thesis — what the family is doing and why it fits the kids — then reads as a magazine chapter, not a SaaS timeline.",
    whyFamily: "The itinerary is shared. A journal is something a partner or grandparent can read, not a settings panel with chips.",
    hierarchy: "Day thesis → photo-like place field → story blocks. Meals are asides. Nap is a pulled quote, not a row in a list.",
    wizard: "Full-bleed chapters with large type and generous quiet. One chapter per screen: Destination, Family, How you move, Rhythm, Taste.",
    itinerary: "Vertical magazine. Day chapters with a cover field, then narrative blocks. No day tabs — you turn pages by scrolling or a chapter list.",
    budget: "A colophon at the end of each day and the trip: quiet figures, like a magazine credits line.",
    differs: "Imagery-led, serif, narrative day openers. Wizard is chapters, not a progress-bar card.",
  },
  board: {
    id: "board",
    name: "Week Board",
    shortName: "Board",
    oneLiner: "The whole trip on one board — compare Tuesday to Wednesday at a glance.",
    idea: "Parents choose which day is the museum day and which is the rest day. Single-day tabs hide that decision. This is a family calendar.",
    whyFamily: "Planning is comparative: ‘can we do water on Wednesday if Thursday is the long taxi to Grapevine?’ You need all days visible.",
    hierarchy: "Trip header with total spend → columns per day → blocks for morning / meal / nap / afternoon. Detail opens from a block.",
    wizard: "A setup desk: checklist of topics on the left, editor on the right. Jump to any topic; generate when the brief is complete.",
    itinerary: "Kanban of days (horizontal on desktop, stacked compact columns on mobile). No exclusive day tabs.",
    budget: "Sticky trip total with per-day spend bars so expensive days stand out before you open anything.",
    differs: "All days simultaneous. Non-linear wizard. Calendar/board vs sequential timeline.",
  },
  companion: {
    id: "companion",
    name: "Pocket Companion",
    shortName: "Pocket",
    oneLiner: "Built for the parent holding a phone in one hand — now, next, later.",
    idea: "The itinerary is used on the trip. The primary object is what is happening now and what comes next, with travel time attached.",
    whyFamily: "A full-day card stack is hard to use between a stroller and a ticket line. Now/next is how a day is actually followed.",
    hierarchy: "Now → Next (with travel) → Later as a compact remainder. Budget is a small persistent figure, not a hero.",
    wizard: "One question per screen, large tap targets, a bottom dock for Back/Continue. Native-app pacing, not a web form in a card.",
    itinerary: "Sticky now/next hero, swipeable day rail, bottom navigation. The rest of the day is a short list, not a long accordion.",
    budget: "A status-bar amount plus a slide-up breakdown — available, never the first thing you see.",
    differs: "Mobile-native IA, bottom nav, now/next vs full-day scan, one-question wizard.",
  },
  harbor: {
    id: "harbor",
    name: "Harbor",
    shortName: "Harbor",
    oneLiner: "Ledger structure in product colors — week board first, then a day view with a map.",
    idea: "Keep the two-column homepage and numbered wizard, restyle them with FamilyTravely teal/coral and Poppins. The itinerary opens as a week board; switch to one day to follow it with a map.",
    whyFamily: "You compare the week, then zoom into today — the way parents actually use a plan.",
    hierarchy: "Homepage split brief → numbered wizard → week of day columns → selected day + route map.",
    wizard: "Same indexed brief as Ledger, with product language and teal/coral instead of cream paper.",
    itinerary: "Week Board columns by default. Day mode uses production-style day tabs, board blocks, and an Atlas map for that day.",
    budget: "Sticky trip total with per-day spend bars, same as Week Board.",
    differs: "Brand-colored Ledger frame. Week-first itinerary with an explicit Day toggle.",
  },
  route: {
    id: "route",
    name: "Route",
    shortName: "Route",
    oneLiner: "Ledger structure in cool white — map always on, week and day share the same board.",
    idea: "A quieter, more product-like Ledger. The itinerary keeps the Atlas map visible while you scan the week or open a single day.",
    whyFamily: "Distance stays visible while you compare days, so a long taxi never hides behind a tab.",
    hierarchy: "Split homepage → indexed wizard → persistent map + week columns; selecting a day updates the map and can expand to a full day board.",
    wizard: "Ledger index and underline fields, DM Sans, teal for structure only.",
    itinerary: "Map beside the board. Click a column to focus that day. Day view is the same blocks, full height, with the map still there.",
    budget: "Compact total over the map; per-day bars above the board.",
    differs: "Map never leaves. Cooler type and color. Week and day share one spatial layout.",
  },
  daylight: {
    id: "daylight",
    name: "Daylight",
    shortName: "Daylight",
    oneLiner: "Ledger structure with coral actions — day-first like today, week strip + map on the selected day.",
    idea: "Follow the trip one day at a time (current product habit), but keep a Week Board overview and a map for the day you’re on.",
    whyFamily: "On the trip you want today. While planning you still need to see the other days.",
    hierarchy: "Split homepage → indexed wizard → day tabs → week strip → day’s map → day’s board blocks.",
    wizard: "Ledger index with warmer copy and coral continue, still not the cream/serif Ledger look.",
    itinerary: "Production-style day tabs as the primary nav. Mini week board above the map. Selected day’s blocks below.",
    budget: "Trip total in the header; the selected day’s spend next to the map.",
    differs: "Day-first like the current app, with a week overview and map attached to the open day.",
  },
};

export function isMixConceptId(value: string | undefined): value is (typeof MIX_CONCEPT_IDS)[number] {
  return !!value && (MIX_CONCEPT_IDS as readonly string[]).includes(value);
}

export function isLabConceptId(value: string | undefined): value is LabConceptId {
  return !!value && (LAB_CONCEPT_IDS as readonly string[]).includes(value);
}

export function conceptPath(id: LabConceptId, screen: LabScreen = "home"): string {
  if (screen === "home") return `/design-lab/${id}`;
  if (screen === "wizard") return `/design-lab/${id}/plan`;
  return `/design-lab/${id}/trip`;
}
