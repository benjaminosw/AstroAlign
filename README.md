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
- Interactive workspace map on the Alignment Calculator and Find Alignments modes: a camera icon for the observer and a pin for the target (draggable SVG markers anchored at their geographic tip, with the active one highlighted), the observer→target bearing line, a live Sun/Moon direction ray and marker, a tolerance sector, an alignment status overlay, and an explicit "Recentre" button. The viewport is controlled by the user — dragging markers or recalculating never moves the map.
- Landmark search (OpenStreetMap Nominatim geocoding) and click-to-select map targeting for the target location
- Geographic calculations for great-circle distance, bearing, geodesic destination, and target altitude
- Timezone detection from coordinates with local date/time handling (tz-lookup + date-fns-tz)
- Configurable alignment tolerance and search radius
- Reusable architecture separating UI, astronomy logic, geographic math, alignment calculation, and reverse-search logic
- Unit and component tests with Vitest

## Features

### Alignment Calculator
Pick an object (Sun/Moon), date, and time, then enter (or drag) the observer and target locations. Coordinates are shown as compact plain text — click the pencil next to a location (or double-click a value) to edit the whole location, then commit with Enter or the check button (Escape cancels). The location section is a compact side-by-side grid — Observer on the left (camera icon), Target on the right (target icon) — with the landmark search on its own row below, sitting above one full-width workspace map. The app detects the timezone from the coordinates, computes the Sun/Moon position at that moment, and plots the Sun's direction live on the map (the dashed ray and ☀/🌙 marker update whenever the date, time, object, or location changes). Below the map, the alignment settings (object, date, time, tolerance, Calculate) sit on the left and one compact result card on the right: the object, date, and time, the target bearing, the object azimuth, the angular difference, and a within/outside-tolerance pill. Detailed diagnostics (tolerance, angular separation, azimuth/altitude differences, target distance) are behind a collapsed Details section. The map viewport is yours to control: it only fits to the locations when you click "Recentre" or select a landmark, never during marker drags, coordinate edits, sun updates, or (re)calculations.

### Find Alignments
Pick a Sun/Moon object, a target location, and a date range. The app searches for times when the object's rise/set azimuth aligns with the target bearing within the selected tolerance, refines each hit to peak alignment, and rates quality with an alignment-star score. Filters are available for the Moon: "Full Moon ±1 day only" and a time-of-day filter (any time, night 18:00–07:00, evening 18:00–23:59, overnight 00:00–07:00, or a custom window with from/to times — windows that cross midnight are supported). The location section sits above one full-width workspace map, and the alignment settings (object, date range, Moon filters, tolerance, Find) and results list sit side by side below the map. Results are compact chronological rows — arrow (↑ rise / ↓ set), event, date (dd/mm/yyyy), time, error, and (for the Moon) a phase column with the traditional eight-phase emoji and name — and the list scrolls independently. Clicking a row selects it, highlights it, updates the alignment overlay on the map, and points the Sun/Moon direction ray at the selected event's azimuth without moving the viewport; the first result is auto-selected.

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
- `src/components/` — UI components (`AlignmentApp`, `AlignmentCalculator`, `AlignmentFinder`, `WorkspaceMap`, `LocationControls`, `LocationEditor`, `TimeFilterPicker`, `FindShootingLocations`, `ShootingLocationMap`, `ShootingLocationResults`, `SearchRadiusPicker`, `TolerancePicker`, `TimePicker`, `StateButton`, `NumberField`, `LandmarkSearch`, `TargetSelectionMap`, `TargetLocationPicker`)
- `src/lib/geocoding/` — landmark search abstraction and the Nominatim provider, with a debounced `useLandmarkSearch` hook
- `src/lib/astronomy/` — Sun/Moon position, rise/set, and lunar phase helpers
- `src/lib/geometry/` — bearing, distance, angular separation, altitude, destination point, unit conversions
- `src/lib/alignment/` — alignment calculation, alignment finder, quality rating, refinement
- `src/lib/reverseSearch/` — shooting-location candidate generation, scoring, and orchestration
- `src/lib/map/` — map style configuration and alignment-map geometry helpers (direction length, direction endpoint, tolerance sector)
- `src/lib/timezone/` — coordinate validation, timezone lookup, local time conversion
- `src/lib/constants/` — default observer/target coordinates
- `src/types/` — shared TypeScript types
- `src/**/__tests__/` — Vitest unit and component tests

## Known limitations

- "Find Shooting Locations" results are geometric only: no terrain, roads, buildings, accessibility, or line-of-sight obstruction data.
- The map uses default OpenStreetMap tiles; a satellite base layer is not configured yet.
- The workspace map lets you drag markers and pan freely; it only auto-fits to the locations when you click "Recentre" or select a landmark. It does not move the viewport during calculations, coordinate edits, or sun updates.
- No backend, accounts, or persistent storage — all computation runs in the browser.
- Rise/set events are found astronomically; they do not account for local horizon obstruction.
- Landmark search requires a network connection and uses the public OpenStreetMap Nominatim service (subject to its usage policy); results are debounced and limited but not cached.
