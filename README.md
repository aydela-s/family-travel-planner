# Family Travel Planner

A web application that generates personalized family travel itineraries using a deterministic, rule-based planning engine. Destination, trip length, children's ages, budget, travel style, dietary restrictions, accommodation, and transportation preferences all feed directly into code that builds the itinerary, rather than relying solely on AI-generated planning.

🔗 **Live Demo:** [https://family-travel-planner-nine.vercel.app/](https://family-travel-planner-nine.vercel.app/)

---

## Why I built this

I wanted to explore how AI can solve real planning problems while applying a QA mindset throughout development.

Instead of only testing software, I designed product requirements, identified edge cases, prioritized defects by severity, and progressively moved business logic that originally existed as AI prompt instructions into deterministic, testable code. The goal was to treat incorrect AI behavior as an engineering problem with a root cause rather than something to solve by repeatedly changing prompts.

---



## Features

- Multi-step trip planning wizard
- Deterministic planning engine for scheduling, meal timing, naps, travel style, budgeting, and transportation logic
- Demo mode (no OpenAI cost)
- Family-aware cost calculations with child pricing rules
- Budget-aware itinerary generation targeting 80–100% budget utilization without exceeding the daily limit
- Google Places destination autocomplete with fallback support
- Daily route maps using Google Static Maps (SVG fallback supported)
- Automated regression testing using Vitest
- Responsive interface

---



## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- OpenAI API (via Vercel AI Gateway)
- Google Maps API
- Vitest
- Vercel
- GitHub
- Linear

---



## QA Focus

This project is developed using a QA-first approach, where product requirements, implementation, and testing evolve together.

Highlights include:

- Converting AI prompt logic into deterministic business rules
- Root-cause analysis of defects before implementing fixes
- Regression testing for planning-engine logic
- Severity-based bug tracking and prioritization using Linear
- Continuous manual exploratory testing alongside automated tests

---



## Running locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Run the automated tests:

```bash
npm run test
```

---



## Environment Variables


| Variable              | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| DEMO_MODE             | Use mock itineraries without AI tip enrichment                          |
| AI_GATEWAY_API_KEY    | Vercel AI Gateway key for optional family tips (FAM-47)                 |
| AI_GATEWAY_MODEL      | Optional model id (default `openai/gpt-4o-mini`)                        |
| AI_ENRICH_TIPS        | Set `false` to disable tip enrichment while keeping the gateway key     |
| OPENAI_API_KEY        | Legacy fallback auth for AI Gateway locally                             |
| GOOGLE_MAPS_API_KEY   | Places autocomplete, directions, and maps                               |
| RESEND_API_KEY        | Send product feedback email (FAM-49)                                    |
| FEEDBACK_TO_EMAIL     | Inbox that receives feedback                                            |
| FEEDBACK_FROM_EMAIL   | Optional From header (default: `TripNestly Feedback <onboarding@resend.dev>` for local testing) |

### Testing feedback on localhost

1. Sign up at [resend.com](https://resend.com) and create an API key.
2. Put the key and your Resend account email into `.env.local` (see `.env.example`).
3. Keep `FEEDBACK_FROM_EMAIL` as `onboarding@resend.dev` until you verify `tripnestly.app`.
4. Run `npm run dev`, click **Feedback**, submit a note — it should arrive in that inbox.

The same Resend keys power **Share by email** on the itinerary (FAM-50). **Download PDF** runs in the browser and does not need Resend.

Resend’s free onboarding sender can only deliver to **the email on your Resend account**. After you buy/verify the domain, switch `FEEDBACK_FROM_EMAIL` to something like `TripNestly Feedback <feedback@tripnestly.app>` and you can send to any inbox.


---



## Project Architecture

```
Trip Form
    ↓
Generate Itinerary API
    ↓
Planning Engine
(schedule, meals, naps, budget, transportation)
    ↓
Validation
(conflicts, timing, business rules)
    ↓
Enrichment
(pricing, maps, geocoding)
    ↓
Timeline UI

```



## Future Improvements

- AI-powered activity and restaurant recommendations
- Weather-aware itinerary adjustments
- User accounts and saved trips
- PDF itinerary export
- Mobile application
- UI redesign

---



## License

All Rights Reserved. This repository is public for portfolio purposes only — the code may be
viewed but not copied, modified, redistributed, or used without written permission. See
[LICENSE](./LICENSE) for details.