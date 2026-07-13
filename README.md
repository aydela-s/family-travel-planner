# Family Travel Planner

A web application that generates personalized family travel itineraries from a deterministic,
rule-based planning engine — destination, trip length, children's ages, budget, travel style,
dietary restrictions, accommodation, and transportation preferences all feed directly into code
that builds the schedule, not into an AI prompt that guesses at it.

🔗 Live Demo: https://family-travel-planner-nine.vercel.app/

---

## Why I built this

I wanted to explore how AI can be used to solve real planning problems while applying a QA
mindset throughout development. Instead of only testing software, I designed product
requirements, identified edge cases, prioritized bugs, and iteratively moved business logic that
started out as AI-prompt instructions into deterministic, testable code — treating "the AI got it
wrong" as a bug with a root cause, not just something to re-prompt around.

---

## Features

- Multi-step trip planning wizard — destination, dates, family size and children's ages, budget,
  travel style, dietary needs, transportation, and accommodation
- Deterministic, rule-based planning engine — schedule structure, meal timing, nap windows,
  activity counts, and transportation logic are all handled by code
- Demo mode (no OpenAI cost)
- Family-aware daily cost breakdown — food, transport, and activity totals, with child ticket
  pricing (0–2 free, 3–6 50%, 7–12 70%)
- Budget-aware itinerary generation that targets 80–100% budget utilization without exceeding the
  daily cap
- Per-day route maps (Google Static Maps, with an SVG fallback when no API key is set)
- Google Places destination autocomplete (falls back to a built-in city list)
- Automated regression test suite (Vitest) covering planning-engine logic
- Responsive UI

---

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- OpenAI API
- Google Maps API
- Vitest
- Vercel
- GitHub
- Linear

---

## QA Focus

This project is being developed with a strong QA mindset — including auditing my own
implementation against the requirements I wrote, not just testing behavior after the fact.

**Shipped:**

- Fixed and regression-tested two tracked issues (Linear FAM-5 and FAM-17) — packed and balanced
  travel styles producing identical activity counts, and the summary page using different
  terminology than the wizard steps
- Set up a Vitest suite so planning-engine rules have regression coverage going forward
- Removed a partially-working "Adjust this day" feature rather than ship it half-built, with a
  concrete plan to rebuild it as a free-text, AI-interpreted feature later

**Currently working on:**

- Auditing the planning engine against a target Planning Engine → AI Layer → Validation Engine
  architecture, and against a written list of 39 business rules, to separate what's already
  correct in code from what's a placeholder from what's missing entirely
- Closing the P0/P1 gaps that audit surfaced — age-aware meal timing, realistic travel-time
  buffers, and opening-hours / geographic-clustering checks for activity selection
- Extracting explicit cost and age-suitability checks into a dedicated validation engine, alongside
  the existing conflict and timing checks
- Triaging newly reported bugs by severity (P0/P1/P2) and root-causing each one to the layer
  responsible — planning engine, AI layer, or validation engine — before writing a fix

---

## Running locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

To run the test suite:

```bash
npm run test
```

---

## Environment Variables

| Variable | Purpose |
|---|---|
| DEMO_MODE | Use mock itineraries (no OpenAI cost) |
| OPENAI_API_KEY | Reserved for AI itinerary generation — not yet called in the live path (see "Currently working on") |
| GOOGLE_MAPS_API_KEY | Places autocomplete, directions, and static maps (optional — mocks are used if missing) |

---

## Project Flow

```
Trip Form
    ↓
Generate Itinerary API
    ↓
Planning Engine (deterministic — schedule, meals, naps, budget)
    ↓
Validation & Fix-up (conflicts, timing, meal rules)
    ↓
Enrichment (pricing, geocoding, route maps)
    ↓
Timeline UI
```

---

## Future Improvements

- Will wire a real AI layer for activity/restaurant recommendations and daily tips, scoped to a
  code-curated, budget-filtered catalog rather than an open-ended prompt
- Will rebuild "Adjust this day" as a free-text box that the AI layer interprets into a structured
  change, once that AI layer exists
- Will add weather-aware activity suggestions
- Will support multiple currencies as a real display option
- Will add Playwright end-to-end automation
- Will add user accounts and saved trips
- Will add PDF export
- Will redesign the whole UI
- Will build mobile apps
