# AstroAlign

A local Next.js app for astronomical photography alignment planning.

## What is included

- Next.js + TypeScript application (App Router)
- Tailwind CSS styling
- Astronomy Engine integration for Sun/Moon azimuth and altitude, rise/set events, and lunar phase
- Three modes in a tabbed interface:
  - **Alignment Calculator** — compute the Sun/Moon azimuth, altitude, and line-of-sight alignment error for a target location and moment
  - **Find Alignments** — search a date range for moments when a chosen object's azimuth aligns with a target bearing, with automatic time refinement and alignment-quality rating
  - **Find Shooting Locations** — reverse search: given a target, date, and Sun/Moon rise or set event, generate and rank camera locations whose line-of-sight bearing aligns with the event azimuth
- MapLibre GL JS map showing the target, the ideal alignment corridor, and ranked shooting locations
- Geographic calculations for great-circle distance, bearing, geodesic destination, and target altitude
- Timezone detection from coordinates with local date/time handling (tz-lookup + date-fns-tz)
- Configurable alignment tolerance and search radius
- Reusable architecture separating UI, astronomy logic, geographic math, alignment calculation, and reverse-search logic
- Unit and component tests with Vitest

## Features

### Alignment Calculator
Enter a target latitude/longitude, date, and time. The app detects the timezone from the coordinates, computes the Sun/Moon position at that moment, and reports the azimuth, altitude, and how closely a line drawn from the target toward the object aligns with the target-to-north reference.

### Find Alignments
Pick a Sun/Moon object, a target bearing, and a date range. The app searches for times when the object's azimuth matches the target bearing within the selected tolerance, refines each hit to peak alignment, and rates quality with an alignment-star score. Filters like "full moon ±1 day" are available for the Moon.

### Find Shooting Locations
Set a target, date, and Sun or Moon rise/set event. The app computes the event azimuth at the target, derives the ideal corridor in the opposite direction (where a camera would look toward the target as the object rises/sets behind it), and samples candidate camera locations along that corridor within the search radius. Each candidate is scored by real bearing, distance, and alignment error, then ranked by error and distance. The map shows the target, corridor, and candidate points; clicking a candidate shows its details. Results are geometric only — terrain, roads, and line-of-sight obstructions are not considered.

## Commands

From the project root:

```bash
npm install        # install dependencies
npm run dev        # start the development server
npm run build      # create an optimized production build
npm run start      # serve the production build
npm run test       # run the test suite (watch mode)
npm run lint       # run ESLint
```

To run tests once and exit, use `npx vitest run`.

## Dependencies

Runtime:
- next, react, react-dom
- astronomy-engine — Sun/Moon position, rise/set, lunar phase calculations
- maplibre-gl — interactive map rendering (OpenStreetMap default tiles)
- date-fns-tz, tz-lookup — timezone resolution and local time conversion

Development:
- typescript, eslint, eslint-config-next
- tailwindcss, postcss, autoprefixer
- vitest, happy-dom, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event

## Project structure

- `src/app/` — Next.js pages and root layout
- `src/components/` — UI components (`AlignmentApp`, `AlignmentCalculator`, `AlignmentFinder`, `FindShootingLocations`, `ShootingLocationMap`, `ShootingLocationResults`, `SearchRadiusPicker`, `TolerancePicker`, `TimePicker`, `StateButton`, `LocationInputs`)
- `src/lib/astronomy/` — Sun/Moon position, rise/set, and lunar phase helpers
- `src/lib/geometry/` — bearing, distance, angular separation, altitude, destination point, unit conversions
- `src/lib/alignment/` — alignment calculation, alignment finder, quality rating, refinement
- `src/lib/reverseSearch/` — shooting-location candidate generation, scoring, and orchestration
- `src/lib/map/` — map style configuration
- `src/lib/timezone/` — coordinate validation, timezone lookup, local time conversion
- `src/lib/constants/` — default observer/target coordinates
- `src/types/` — shared TypeScript types
- `src/**/__tests__/` — Vitest unit and component tests

## Known limitations

- "Find Shooting Locations" results are geometric only: no terrain, roads, buildings, accessibility, or line-of-sight obstruction data.
- The map uses default OpenStreetMap tiles; a satellite base layer is not configured yet.
- No backend, accounts, or persistent storage — all computation runs in the browser.
- Rise/set events are found astronomically; they do not account for local horizon obstruction.
