# familyTravely — Interest Category Definitions

Use this as the source of truth for what activity types belong under each interest tag. When generating itinerary activities, tag each suggested activity with one (or more, if it genuinely spans categories) of these interest IDs so filtering/personalization stays consistent.

Category duration / energy defaults used by the scheduler live in `src/lib/schedule/interest-category-defaults.ts`.

## General classification rule

**Classify an attraction based on its primary visitor purpose, not merely one feature it contains.**

Examples: a city park with a small playground is still **Parks & Gardens** if the park itself is the draw; a sculpture garden is **Museums & Art** when art is the primary attraction and **Parks & Gardens** when the garden/park setting is; a water park is **Theme Parks** only when rides clearly dominate, **Swimming & Water Play** when swimming/splash dominates or when rides and swimming are mixed equally.

---

## 🌳 Parks & Gardens
`id: parks_gardens`

Primary intent = Relax outdoors / explore landscaped spaces

**Look for:**

- City parks
- Botanical gardens
- Public gardens
- Formal gardens
- Large landscaped parks
- Arboretums
- Picnic-friendly parks
- Scenic parks with walking paths
- Family parks where the primary draw is the park itself
- Sculpture gardens **when the garden/park is the primary attraction**
- Dog parks (generally lower priority for family itineraries unless pets or dog-park interest is specifically relevant)

**Don't use for:** playgrounds as the primary attraction, hiking/nature destinations, dedicated sports facilities, or sculpture gardens where art is the primary draw (use **Museums & Art**).

---

## 🏊 Swimming & Water Play
`id: swimming_water_play`  
Legacy label: Beaches & Waterfronts (`beaches_waterfronts`). Catalog coverage today still maps via the `beaches` tag.

Primary intent = Swim / splash / cool off

**Look for:**

- Public pools
- Water parks
- Hybrid water parks that mix major rides and swimming equally
- Splash pads
- Aquatic centers
- Swimming beaches
- Lakes/rivers with designated swimming
- Kiddie pools
- Family water-play areas
- Interactive fountains intended for water play

**Don't use for:** aquariums, boat tours, scenic waterfronts, or beaches where swimming/water play isn't a meaningful activity (scenic beaches → **Nature & Scenic Views**; boat sightseeing → **Tours & Sightseeing**). Water parks where rides clearly dominate → **Theme Parks**.

---

## 🌿 Nature & Scenic Views
`id: nature_scenic`

Primary intent = Experience natural scenery / hike

**Look for:**

- Nature preserves
- Wildlife/nature trails
- Hiking trails
- Scenic overlooks
- Mountains/hills
- Waterfalls
- Canyons
- Lakes/rivers primarily visited for scenery
- Beaches primarily visited for scenery/nature
- Forests
- Natural landmarks
- Cable cars / gondolas primarily for scenery (not transport)
- Stargazing spots / outdoor observatories when scenery or night sky is the draw

**Don't use for:** standard city parks, zoos, aquariums, or dedicated animal encounters.

---

## 🏛️ History & Landmarks
`id: history_landmarks`

Primary intent = See historically/culturally significant places

**Look for:**

- Historic buildings
- Historic districts
- Monuments
- Memorials
- Famous landmarks
- Historic sites
- Forts
- Castles
- Presidential/government landmarks
- Archaeological sites
- Historic homes (exterior/landmark visits; not house museums)
- Cultural heritage sites
- Religious landmarks/sites of historical or cultural significance (visited as landmarks, not for worship)
- UNESCO World Heritage sites that are landmarks/districts rather than museum collections

**Don't use for:** history museums and historic house museums — use **Museums & Art**; guided historical tours as the primary experience — use **Tours & Sightseeing**.

**Age note:** War/genocide memorial sites should be flagged `mature_content: true` so they're deprioritized or excluded for young children (under ~8) unless a parent explicitly opts in.

---

## 🎨 Museums & Art
`id: museums_art`

Primary intent = Explore exhibits and collections

**Look for:**

- Art museums
- History museums
- Historic house museums
- Science museums
- Natural history museums
- Cultural museums
- Specialty museums
- Galleries
- Art exhibitions
- Sculpture gardens **when art is the primary attraction**
- Design / architecture museums
- Photography exhibits

**Don't use for:** children's museums — those belong under **Interactive Museums**. Historic buildings/sites/monuments without a museum-collection experience belong under **History & Landmarks**. Large immersive ticketed attractions belong under **Interactive Museums**.

---

## 🛝 Indoor & Outdoor Play
`id: indoor_outdoor_play`  
Legacy label: Playgrounds & Indoor Play (`playgrounds_indoor_play`). Catalog coverage today maps to `playgrounds` + `indoor-play`.

Primary intent = Unstructured/active children's play

**Look for:**

- Playgrounds
- Indoor playgrounds
- Soft-play centers
- Trampoline parks
- Bounce houses
- Kids' play centers
- Indoor climbing/play structures
- Ball pits
- Adventure playgrounds
- Family activity centers primarily focused on free-form play

**Don't use for:** theme parks, museums, zoos, pools, splash pads (→ **Swimming & Water Play**), structured sports, arcades, escape rooms, or family entertainment centers (those last three → **Sports & Recreation**).

**Age note:** Sub-tag by age suitability where possible (toddler 0–3, young child 4–7, older child 8–12) since equipment varies a lot by age.

---

## 🦁 Zoos & Aquariums
`id: zoos_aquariums`

Primary intent = Observe diverse animal/marine collections

**Look for:**

- Zoos
- Aquariums
- Safari parks
- Wildlife parks
- Large marine-life facilities
- Major wildlife collections

**Don't use for:** farms, petting zoos, animal sanctuaries (including those that mix observation and encounter roughly equally), animal encounters, horseback riding, or animal-feeding experiences where interaction is the primary attraction (→ **Animal Experiences**).

---

## 🐾 Animal Experiences
`id: animal_experiences` → catalog tag `animal-experiences`

Primary intent = Interact with animals

**Look for:**

- Petting zoos
- Farms with animals
- Farm visits that mix market shopping and animal interaction
- Animal sanctuaries
- Wildlife sanctuaries that mix observation and encounter roughly equally
- Animal encounters
- Animal feeding experiences
- Horseback riding
- Pony rides
- Alpaca/llama farms
- Butterfly experiences
- Bird encounters
- Reptile encounters
- Animal rescue/rehabilitation visits
- Cat cafes

**Don't use for:** traditional zoos and aquariums (observe-first collections).

**Core distinction:**

- **Zoos & Aquariums** = primarily observe animals
- **Animal Experiences** = interact with animals

---

## 🎢 Theme Parks
`id: theme_parks`

Primary intent = Rides and amusement

**Look for:**

- Theme parks
- Amusement parks
- Major ride-focused family parks
- Roller coasters
- Large rides
- Water/theme amusement parks where rides clearly dominate as the primary attraction
- Legoland-style parks
- Disney-style parks

**Don't use for:** individual attractions, playgrounds, arcades, mini golf, small family entertainment centers (→ **Sports & Recreation**), fairs/carnivals (→ **Shows & Entertainment**), or hybrid water parks that mix major rides and swimming equally (→ **Swimming & Water Play**).

**Note:** These are typically full-day, high-energy commitments — flag as `high_energy: true, min_half_day: true` so the pacing engine (Relaxed/Balanced/Packed) doesn't stack multiple in one day.

---

## 🧪 Interactive Museums
`id: interactive_museums`

Primary intent = Hands-on learning/play

**Look for:**

- Hands-on science centers
- Children's museums
- Interactive technology museums
- Discovery centers
- Hands-on educational exhibits
- STEM centers
- Immersive attractions
- Large immersive ticketed attractions (immersive art/experience venues that sit between art, interactive, and show)
- Experiment-based museums
- Interactive history/science experiences
- Planetariums
- Educational craft/workshop experiences where hands-on learning is the primary purpose

**Don't use for:** conventional museums where visitors primarily look at exhibits/artifacts, or recreational workshops/classes where play/recreation is the primary purpose (→ **Sports & Recreation**).

**Core distinction:**

- **Museums & Art** = primarily view/explore exhibits — often better for older kids + adults
- **Interactive Museums** = touch, experiment, build, play, or participate — primarily for kids / hands-on learning

---

## 🗺️ Tours & Sightseeing
`id: tours_sightseeing` → catalog tag `tours`

Primary intent = Guided exploration

**Look for:**

- Guided walking tours
- City sightseeing tours
- Hop-on/hop-off buses
- Boat sightseeing tours
- Bus tours
- Scenic tours
- Architecture tours
- Cultural tours
- Food tours
- Historical tours
- Guided local experiences
- Sightseeing cruises

**Don't use for:** standalone landmarks that don't involve a tour (→ **History & Landmarks** or the landmark's primary category).

---

## 🥕 Food Markets
`id: food_markets`

Primary intent = Explore local food

**Look for:**

- Farmers markets
- Food halls
- Public markets
- Specialty food markets
- Street food markets
- International food markets
- Night markets where food is a primary attraction
- Marketplaces where food is a primary attraction
- Cooking classes tied to a market visit

**Don't use for:** normal grocery stores or shopping malls. Sit-down restaurant meals are handled separately in the Meals itinerary block, not as an interest activity. Farm visits that mix market shopping and animal interaction → **Animal Experiences**.

---

## 🛍️ Shopping
`id: shopping`

Primary intent = Browse/buy goods

**Look for:**

- Shopping districts
- Malls
- Outlet malls
- Pedestrian shopping streets
- Specialty shopping areas
- Local boutiques
- Artisan markets **when shopping is the primary purpose**
- Souvenir markets
- Department stores
- Toy stores (when a meaningful kid-specific draw)

**Don't use for:** food markets where food is the primary attraction.

**Note:** Outlet centers can be flagged `time_intensive: true` — families rarely want a half day here unless requested. Malls are often best as rainy-day backups rather than primary plans.

---

## 🎭 Shows & Entertainment
`id: shows_entertainment`

Primary intent = Watch a live/entertainment performance

**Look for:**

- Theater
- Musicals
- Concerts
- Children's shows
- Family performances
- Circuses
- Magic shows
- Comedy
- Live performances
- Dance performances
- Movie theaters
- Puppet shows
- Cultural performances
- Seasonal entertainment/events
- Fairs and carnivals

**Don't use for:** sporting events/games (→ **Sports & Recreation**), theme parks, or large immersive ticketed attractions (→ **Interactive Museums**).

**Age note:** Flag evening showtimes against the family's bedtime data — this is a common scheduling conflict source.

---

## ⚽ Sports & Recreation
`id: sports_recreation`

Primary intent = Participate in recreational activities **or** attend family-friendly sporting events

**Look for:**

- Mini golf
- Bowling
- Go-karts
- Ice skating
- Roller skating
- Rock climbing
- Sports centers
- Recreational facilities
- Tennis
- Golf
- Batting cages
- Soccer activities
- Kayaking/canoeing
- Bike rentals/trails
- Fishing
- Adventure activities / rope courses
- Family recreation centers
- Family entertainment centers (combined venues such as go-karts, laser tag, arcade clusters)
- Arcades
- Escape rooms
- Recreational craft workshops/classes where recreation is the primary purpose
- Family-friendly spectator sporting events and games

**Don't use for:** swimming/water parks when swimming/splash is the primary attraction (→ **Swimming & Water Play**), or theme parks when rides are the primary attraction.

---

## 🧖 Spas
`id: spas`

Primary intent = Adult relaxation/wellness

**Look for:**

- Spas
- Massage
- Wellness centers
- Thermal baths
- Hot springs
- Saunas
- Beauty/wellness treatments
- Resort spa facilities

**Important:** Because this is a family planner, prioritize **places that can actually accommodate the traveling adults/children** rather than adult-only spas. Adult-only venues may still be tagged `requires_childcare: true` or `adults_only: true` when they are the only realistic match.

**Note:** This is the category most likely to imply parent solo time while another adult covers kids — a scheduling/logistics implication, not just an activity type.

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

These are **category-level defaults** — a sensible starting value the AI/code can assign automatically when generating an activity, which should still be overridable per specific activity (e.g. a Louvre visit runs longer than the Museums & Art default, so it overrides `duration_estimate`).

| Category | `min_age`/`max_age` | `duration_estimate` | `energy_level` | `weather_dependent` | `cost_tier` | `indoor_outdoor` |
|---|---|---|---|---|---|---|
| 🌳 Parks & Gardens | 0 / 99 | 60–90 min | low | true | free–low | outdoor |
| 🏊 Swimming & Water Play | 1 / 99 | 90–180 min | medium–high | mixed (indoor pools false, beaches/outdoor parks true) | free–medium | both |
| 🌿 Nature & Scenic Views | 3 / 99 | 90–150 min | medium | true | free–low | outdoor |
| 🏛️ History & Landmarks | 5 / 99 | 60–90 min | low–medium | false | low–medium | both |
| 🎨 Museums & Art | 4 / 99 | 60–120 min | low | false | medium | indoor |
| 🛝 Indoor & Outdoor Play | 0 / 10 | 45–90 min | high | false (indoor) / true (outdoor) | free–low | both |
| 🦁 Zoos & Aquariums | 0 / 99 | 120–180 min | medium | mixed (aquariums false, zoos true) | medium–high | both |
| 🐾 Animal Experiences | 0 / 99 | 60–120 min | medium | mixed | low–medium | both |
| 🎢 Theme Parks | 3 / 99 | 240–480 min | high | true | high | outdoor |
| 🧪 Interactive Museums | 3 / 12 | 90–150 min | medium | false | medium | indoor |
| 🗺️ Tours & Sightseeing | 5 / 99 | 90–180 min | low–medium | mixed | medium | both |
| 🥕 Food Markets | 0 / 99 | 45–75 min | low–medium | mixed (open-air true, halls false) | low–medium | both |
| 🛍️ Shopping | 0 / 99 | 60–120 min | low | mixed (streets true, malls false) | varies | both |
| 🎭 Shows & Entertainment | 3 / 99 | 60–120 min | low | mixed | medium–high | both |
| ⚽ Sports & Recreation | 3 / 99 | 60–120 min | high (participate) / low–medium (spectator) | mixed | low–medium | both |
| 🧖 Spas | 12 / 99 (adults-only variants: 18+) | 60–120 min | low | false | high | indoor |

**Notes on the defaults:**

- **Theme Parks** is the clear outlier for duration — treat it as effectively a full-day commitment in the scheduling engine, not a slot to combine with much else.
- **Zoos & Aquariums**, **Food Markets**, **Shopping**, **Shows & Entertainment**, and **Sports & Recreation** often need `weather_dependent` set per activity rather than only per category.
- **Spas** is the only category where `min_age` should often gate the whole category out for itineraries with young children, rather than just filtering individual activities.
- Cost tiers are relative (free / low / medium / high) rather than fixed dollar amounts — pair with local-currency budget logic rather than hardcoding prices here.
