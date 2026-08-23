# AstroAlign

AstroAlign is a small astronomy planning app for photographers.

It helps you answer three questions:

- When is the Sun or Moon aligned with my target at a specific moment?
- When does a Sun or Moon rise/set event line up with a target bearing across a date range?
- Where could I stand to photograph a target when the Sun or Moon rises or sets behind it?

## Main features

### 1. Alignment Calculator
Use this when you already know the camera location.

Choose:

- observer location
- target location
- date and time
- Sun or Moon
- alignment tolerance

The app calculates:

- target bearing from the observer to the target
- object azimuth
- angular difference
- whether the result is within tolerance

### 2. Find Alignments
Use this to search a date range for good alignment moments.

Choose:

- observer location
- target location
- object (Sun or Moon)
- date range
- tolerance

The app searches for rise/set events that line up with the target direction and shows the best matches.

### 3. Find Shooting Locations
Use this to find camera positions that could shoot a target when the Sun or Moon rises or sets in alignment with it.

Choose:

- target location
- date
- object
- rise or set event
- search radius
- tolerance

The app generates candidate positions around the target, ranks them by alignment quality, and shows them on a map.

> This is geometric alignment only. It does not check roads, accessibility, trees, buildings, terrain, or legal access.

## How to use the app

### Start the app

From the project root:

```bash
npm install
npm run dev
```

Then open the local URL shown in the terminal.

### Pick a mode

Use the mode switcher in the app to choose:

- Alignment Calculator
- Find Alignments
- Find Shooting Locations

### Example workflow

1. Set the target coordinates.
2. Select the Sun or Moon.
3. Choose the date.
4. Pick a time or rise/set event.
5. Set the tolerance.
6. Run the calculation or search.
7. Review the map and result list.

## Understanding the result

Each result includes:

- latitude and longitude
- distance from the target
- bearing to the target
- event azimuth
- alignment error
- whether it is within tolerance

Lower error is better.

## Commands

```bash
npm install
npm run dev
npm run build
npm run start
npm test
npm run lint
```

To run the test suite once without watch mode:

```bash
npx vitest run
```

## Important limitations

- No terrain, obstruction, accessibility, or road analysis yet
- No weather or visibility checks yet
- Results are planning aids, not guaranteed safe or legal shooting locations
- The app is a geometry-first planning tool and should be used together with real-world site checks

## Project structure

- src/app — app entry and page layout
- src/components — main UI screens and controls
- src/lib/astronomy — Sun/Moon astronomy logic
- src/lib/geometry — distance, bearing, and alignment math
- src/lib/alignment — forward alignment searches
- src/lib/reverseSearch — reverse shooting-location logic
- src/lib/timezone — timezone and local time conversion
- src/types — shared TypeScript types

## Notes

- The app uses astronomy-engine for rise/set and position calculations.
- Geographic calculations are based on proper bearing and distance logic.
- Moon searches support a Full Moon +/- 1 day filter.
- The map is meant to help visualize the geometry, not replace field assessment.
