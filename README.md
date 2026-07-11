# Family Travel Planner

A production-style MVP for planning family trips with AI or free demo mode.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

### Environment variables

| Variable | Purpose |
|---|---|
| `DEMO_MODE=true` | Always use free mock itineraries (no OpenAI cost) |
| `OPENAI_API_KEY` | Live AI generation when `DEMO_MODE` is not set |
| `GOOGLE_MAPS_API_KEY` | Places autocomplete, directions, static maps (optional — mocks used if missing) |

## Features

- Multi-step trip form → itinerary generation → cost breakdown → maps
- City-based pricing (USD, EUR, GBP, ILS, JPY) with taxi provider multipliers
- Family cost totals per day (food, transport, activities)
- Child ticket pricing rules (0–2 free, 3–6 50%, 7–12 70%)
- 12-hour time display, full date headers
- Per-day route maps (Google Static Maps or SVG fallback)
- Destination autocomplete (Google Places or built-in city list)

## Flow

`form → POST /api/generate-itinerary → enrich (costs, maps, dates) → timeline UI`
