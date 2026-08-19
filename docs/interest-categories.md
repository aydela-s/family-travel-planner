# familyTravely — Interest Category Definitions

Use this as the source of truth for what activity types belong under each interest tag. When generating itinerary activities, tag each suggested activity with one (or more, if it genuinely spans categories) of these interest IDs so filtering/personalization stays consistent.

Category duration / energy defaults used by the scheduler live in `src/lib/schedule/interest-category-defaults.ts`.

---

## 🌳 Parks & Gardens
`id: parks_gardens`

- Public parks, city parks, green spaces
- Botanical gardens, arboretums, rose gardens
- Riverside/lakeside parks and promenades
- Picnic areas and park pavilions
- Public gardens attached to palaces/estates (e.g. Versailles gardens)
- Community gardens open to visitors
- Off-leash dog parks (only if family has noted pet interest — otherwise skip)

**Not included:** playgrounds (see Playgrounds & Indoor Play), nature reserves/hiking trails (see Nature & Scenic Views)

---

## 🌊 Beaches & Waterfronts
`id: beaches_waterfronts`

- Public beaches (swimming, sunbathing)
- Waterfront boardwalks and promenades
- Harbor/marina areas
- Lake shores and swimming holes
- Water parks (if not already covered by Theme Parks — flag overlap)
- Boat tours, ferry rides, gondola rides
- Kayaking, paddleboarding, snorkeling (family-friendly/beginner level)
- Tide pools and rock pool exploration

**Not included:** water activities inside a theme park (tag as Theme Parks), aquariums (see Zoos & Aquariums)

---

## 🌿 Nature & Scenic Views
`id: nature_scenic`

- Hiking trails (family/stroller-friendly graded separately from strenuous)
- Nature reserves and wildlife sanctuaries (non-zoo, self-guided)
- Scenic overlooks, viewpoints, lookout towers
- Waterfalls, caves, natural landmarks
- Forests, botanical trails
- Cable cars / gondolas primarily for scenery (not transport)
- Stargazing spots, observatories (astronomy-focused)
- Farms and orchards (petting-farm crossover — tag both if applicable with Zoos & Aquariums)

**Not included:** manicured public gardens (Parks & Gardens), beaches (Beaches & Waterfronts)

---

## 🏛️ History & Landmarks
`id: history_landmarks`

- Historical monuments and statues
- Castles, palaces, forts
- Religious sites of historical significance (churches, temples, mosques — as landmarks, not for worship)
- Archaeological sites and ruins
- Old towns / historic districts (walking tours)
- War memorials and museums (age-appropriateness flag needed — see notes below)
- Guided historical walking tours
- UNESCO World Heritage sites

**Age note:** War/genocide memorial sites should be flagged `mature_content: true` so they're deprioritized or excluded for young children (under ~8) unless a parent explicitly opts in.

---

## 🎨 Museums & Art
`id: museums_art`

- Art museums and galleries
- Sculpture gardens/parks
- Art walks, street art tours
- Design museums, architecture-focused museums
- Craft/artisan workshops (pottery, painting classes for families)
- Photography exhibits

**Not included:** interactive/hands-on science-style museums (see Interactive Museums), history museums (see History & Landmarks — unless primarily art-focused, e.g. Louvre gets both tags)

---

## 🛝 Playgrounds & Indoor Play
`id: playgrounds_indoor_play`

- Outdoor public playgrounds
- Indoor play centers / soft play
- Trampoline parks
- Splash pads / spray parks
- Ball pits, climbing walls (kid-scale)
- Arcades (family-friendly)
- Mini golf
- Bounce houses / inflatable parks

**Age note:** Sub-tag by age suitability where possible (toddler 0-3, young child 4-7, older child 8-12) since equipment varies a lot by age.

---

## 🦁 Zoos & Aquariums
`id: zoos_aquariums`

- Zoos and safari parks
- Aquariums and marine life centers
- Petting zoos and farms
- Butterfly gardens/conservatories
- Bird sanctuaries and aviaries
- Wildlife rehabilitation centers open to visitors
- Reptile houses/exhibits

---

## 🎢 Theme Parks
`id: theme_parks`

- Amusement/theme parks (roller coasters, rides)
- Water parks
- Family entertainment centers (go-karts, laser tag combined venues)
- Fairs and carnivals (seasonal — flag as date-dependent)
- Character/branded parks

**Note:** These are typically full-day, high-energy commitments — flag as `high_energy: true, min_half_day: true` so the pacing engine (Relaxed/Balanced/Packed) doesn't stack multiple in one day.

---

## 🧪 Interactive Museums
`id: interactive_museums`

- Science museums / science centers
- Children's museums
- Hands-on discovery centers
- Planetariums
- Technology/innovation museums
- Escape rooms (age-appropriate difficulty tiers)
- Interactive history experiences (e.g. recreated period rooms with activities)

**Not included:** traditional look-don't-touch art/history museums (see Museums & Art / History & Landmarks)

---

## 🥕 Food Markets
`id: food_markets`

- Farmers markets
- Public food halls / food courts with local vendors
- Street food markets
- Specialty markets (cheese, spice, seafood markets)
- Night markets
- Cooking classes tied to a market visit
- Local produce/artisan markets with tastings

**Not included:** sit-down restaurant meals (these are handled separately in the "Meals" itinerary block, not as an "activity")

---

## 🛍️ Shopping
`id: shopping`

- Shopping districts / main shopping streets
- Malls (only when relevant to trip, e.g. rainy-day backup)
- Local boutiques and artisan shops
- Souvenir markets
- Toy stores (kid-specific draw)
- Outlet centers (flag as `time_intensive: true` — families rarely want a half day here unless requested)

---

## 🎭 Shows & Entertainment
`id: shows_entertainment`

- Theater and live performances (family-appropriate)
- Musicals
- Puppet shows / children's theater
- Circus performances
- Magic shows
- Concerts (family-friendly/daytime)
- Cultural performances (dance, music tied to local culture)
- Movie screenings (outdoor cinema, special format like IMAX as a novelty)

**Age note:** Flag evening showtimes against the family's bedtime data — this is a common scheduling conflict source.

---

## ⚽ Sports & Recreation
`id: sports_recreation`

- Bike rentals and family bike routes
- Ice skating / roller skating
- Bowling
- Swimming pools (public/recreational, not beach)
- Rock climbing (indoor, kid-friendly walls)
- Sports games as spectators (family-friendly matches)
- Adventure/rope courses (age-gated)
- Skiing/snow activities (seasonal)
- Horseback riding

---

## 🧖 Spas
`id: spas`

- Spa treatments (typically adult-only — flag as `requires_childcare: true` or `adults_only: true`)
- Hot springs / thermal baths (family-friendly ones exist — tag those separately as `family_friendly: true`)
- Wellness centers with family-oriented offerings (rare — sub-tag explicitly)

**Note:** This is your one category that's mostly adult-oriented. Worth deciding in the wizard whether this means "parent solo time while other parent covers kids" — that's a scheduling/logistics implication, not just an activity type.

---

## Cross-cutting tags to consider adding to every activity
Regardless of category, each activity object should probably also carry:
- `min_age` / `max_age` (or age suitability band)
- `duration_estimate` (in minutes)
- `energy_level` (low / medium / high)
- `weather_dependent` (true/false)
- `cost_tier` (free / low / medium / high)
- `indoor_outdoor` (indoor / outdoor / both)

These let the scheduling engine make pacing and rainy-day-backup decisions without re-deriving them from the category alone.

---

## Default cross-cutting tag values by category

These are **category-level defaults** — a sensible starting value the AI/code can assign automatically when generating an activity, which should still be overridable per specific activity (e.g. "Louvre guided tour" runs longer than the Museums & Art default, so it overrides `duration_estimate`).

| Category | `min_age`/`max_age` | `duration_estimate` | `energy_level` | `weather_dependent` | `cost_tier` | `indoor_outdoor` |
|---|---|---|---|---|---|---|
| 🌳 Parks & Gardens | 0 / 99 | 60–90 min | low | true | free–low | outdoor |
| 🌊 Beaches & Waterfronts | 1 / 99 | 120–180 min | medium | true | free–low | outdoor |
| 🌿 Nature & Scenic Views | 3 / 99 | 90–150 min | medium | true | free–low | outdoor |
| 🏛️ History & Landmarks | 5 / 99 | 60–90 min | low–medium | false | low–medium | both |
| 🎨 Museums & Art | 4 / 99 | 60–120 min | low | false | medium | indoor |
| 🛝 Playgrounds & Indoor Play | 0 / 10 | 45–90 min | high | false (indoor variants) / true (outdoor) | free–low | both |
| 🦁 Zoos & Aquariums | 0 / 99 | 120–180 min | medium | mixed (aquariums false, zoos true) | medium–high | both |
| 🎢 Theme Parks | 3 / 99 | 240–480 min | high | true | high | outdoor |
| 🧪 Interactive Museums | 3 / 12 | 90–150 min | medium | false | medium | indoor |
| 🥕 Food Markets | 0 / 99 | 45–75 min | low–medium | mixed (open-air true, halls false) | low–medium | both |
| 🛍️ Shopping | 0 / 99 | 60–120 min | low | mixed (streets true, malls false) | varies | both |
| 🎭 Shows & Entertainment | 3 / 99 | 60–120 min | low | mixed (outdoor cinema true, theater false) | medium–high | both |
| ⚽ Sports & Recreation | 3 / 99 | 60–120 min | high | mixed (pools/skating false, bikes true) | low–medium | both |
| 🧖 Spas | 12 / 99 (adults-only variants: 18+) | 60–120 min | low | false | high | indoor |

**Notes on the defaults:**
- **Theme Parks** is the clear outlier for duration — treat it as effectively a full-day commitment in the scheduling engine, not a slot to combine with much else.
- **Zoos & Aquariums**, **Food Markets**, **Shopping**, and **Shows & Entertainment** need the `weather_dependent` flag set per-activity rather than per-category, since indoor/outdoor varies a lot within the category itself — worth storing a sub-flag at the activity level that overrides the category default.
- **Spas** is the only category where `min_age` should probably gate the whole category out for itineraries with young children, rather than just filtering individual activities.
- Cost tiers are relative (free / low / medium / high) rather than fixed dollar amounts, since they'll vary heavily by destination — pair with your local-currency budget logic rather than hardcoding prices here.
