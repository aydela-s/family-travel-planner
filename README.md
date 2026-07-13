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

## Project Status

🚧 This project is under active development and serves as both a portfolio project and an exploration of deterministic planning combined with AI-assisted recommendations.

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


| Variable            | Purpose                                      |
| ------------------- | -------------------------------------------- |
| DEMO_MODE           | Use mock itineraries without OpenAI costs    |
| OPENAI_API_KEY      | Reserved for AI-powered itinerary generation |
| GOOGLE_MAPS_API_KEY | Places autocomplete, directions, and maps    |


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
- End-to-end testing with Playwright
- User accounts and saved trips
- PDF itinerary export
- Mobile application
- UI redesign

