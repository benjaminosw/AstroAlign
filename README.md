# AstroAlign

AstroAlign is a planning tool for photographers who want to capture a landmark
with the Sun or Moon lined up behind it — for example, a full Moon setting
directly behind a mountain, or the Sun rising behind a lighthouse.

Instead of guessing dates and positions, you tell AstroAlign:

- **Where you will stand** (the observer / camera position)
- **What you want in the background** (the target, e.g. a mountain)
- **When** you want to shoot

The app then works out the geometry: where the Sun or Moon will be in the sky,
which direction it sits relative to your target, and how close that is to a
perfect line-up.

## Key terms

| Term | Meaning |
| --- | --- |
| Observer | Where your camera stands |
| Target | The landmark you want to photograph (e.g. a peak or building) |
| Bearing | Compass direction from one place to another (0° = north, 90° = east) |
| Azimuth | Compass direction pointing at the Sun or Moon in the sky |
| Alignment error | How far apart the bearing and azimuth are, in degrees. Lower = better |
| Tolerance | The maximum alignment error you accept as a good enough shot |

## Main tools

The app has six tabs:

### 1. Calculate alignment

Use this when you already know where you will stand and when you want to shoot.

Choose an observer location, a target location, the Sun or Moon, a date and
time, and a tolerance.

The app shows:

- the target bearing from your position
- the Sun/Moon azimuth at that moment
- the difference between them, and whether it falls within your tolerance

Tip: use the "Use sunrise/sunset/moonrise/moonset time" button to fill in the
rise or set time for the chosen day.

### 2. Find alignments

Use this to search a range of dates for moments when a Sun/Moon rise or set
lines up with your target direction.

Choose an observer location, a target location, the Sun or Moon, a date range,
a tolerance (labelled "Maximum azimuth difference"), and run the search.

For Moon searches you can additionally filter by:

- time of night (or a custom time window)
- moon phase
- a "Full Moon date window" that keeps only dates within ±1 day of an exact Full Moon

Results are listed in date order with their local time, event type, and
alignment error, and each result can be previewed on the map.

### 3. Find shooting opportunities

Use this when you know *what* you want to photograph but not yet *where to
stand*.

Choose:

- the target location
- the Sun or Moon and whether to search sunrises/moonrises or sunsets/moonsets
- a date range
- a tolerance ("Maximum azimuth difference")
- a **shooting area**: either a path (start point to end point, e.g. along a
  trail or shoreline) or a list of individual points you add on the map

For every matching rise/set event in the date range, the app works out which
positions inside your shooting area would put the Sun or Moon behind the
target, and lists the results in date order with the alignment error for each.

### 4. Reverse alignment

Use this when you have a target but no observer location yet — for example,
you want to know from which direction a Sun/Moon rise or set could be seen
lining up with your target.

Choose the target location, the Sun or Moon, whether you want the rise or the
set, and a date. Rise/set times are calculated for the target itself, so no
observer location is needed.

The app works out the compass direction (azimuth) of the Sun or Moon at that
moment, treats it as the bearing from camera to target, and draws a ray on the
map from the target in the opposite direction — along that ray is where an
observer could have stood to capture the alignment.

Results update automatically when you change the target, object, event, or
date. Remember that the result is a direction, not a unique shooting location:
any observer along the ray could potentially produce the alignment, subject to
terrain and visibility.

### 5. Saved locations

Targets, shooting locations, and combined setups (target + shooting area) that
you save are kept here between sessions, so you do not have to re-enter
coordinates. Open any saved item to load it back into the search tools.

### 6. Saved alignments

Alignments you have calculated or found and explicitly saved are kept here for
later review, also preserved between sessions.

## How to use the app

### Start the app

#### Go to https://benjaminosw.github.io/AstroAlign

Alternatively for running locally on computer, you need Node.js installed. 

From the project root:

```bash
npm install
npm run dev
```

Then open the local URL shown in the terminal (usually http://localhost:3000).

### Pick locations

Every tool needs coordinates. You can provide them by:

- typing latitude/longitude values directly
- searching for a place or landmark by name (uses OpenStreetMap data)
- clicking or dragging markers on the map

Timezones are detected automatically from the coordinates, so all times are
shown in local time of the location you entered.

### Example workflow

1. Open **Find shooting opportunities** and set the target (e.g. your mountain).
2. Draw a shooting area on the map where you could realistically stand.
3. Pick the Moon, "Set", and a date range around the next full Moon.
4. Run the search and review the results on the map and in the list.
5. Save the target and shooting area so you can come back to them later.
6. Before heading out, verify access, terrain, and weather yourself.

## Understanding the result

What you see depends on the tool:

- **Calculate alignment**: target bearing, Sun/Moon azimuth, the angular
  difference between them, plus details such as altitudes and target distance,
  and a badge showing whether it is within tolerance.
- **Find alignments**: one row per event with date, local time, event type,
  azimuths, and alignment error.
- **Find shooting opportunities**: one result per event and position, with the
  date, local time, camera position, bearing to target, alignment error, and —
  for Moon shots — the moon phase and illumination percentage.
- **Reverse alignment**: the object azimuth at the target's rise/set event, the
  bearing from observer to target, and the opposite bearing from the target
  towards where an observer could have stood (drawn as a ray on the map).

In all cases lower alignment error means a more precise line-up.

## Commands

```bash
npm install   # install dependencies
npm run dev   # start the dev server
npm run build # production build
npm run start # serve the production build
npm test      # run tests in watch mode
npm run lint  # lint the code
```

To run the test suite once without watch mode:

```bash
npx vitest run
```

## Important limitations

- No terrain, obstruction, accessibility, or road analysis
- No weather or visibility checks
- Results are planning aids, not guaranteed safe or legal shooting locations
- Use the app together with real-world site checks before you travel

## Project structure

- src/app — Next.js app entry and page layout
- src/components — UI screens and controls
- src/lib/astronomy — Sun/Moon position, rise/set, and lunar phase logic
- src/lib/geometry — distance, bearing, altitude, and angular separation math
- src/lib/alignment — instant-alignment calculation, rise/set alignment searches, and reverse-alignment calculation
- src/lib/opportunities — shooting-area solver used by "Find shooting opportunities"
- src/lib/reverseSearch — legacy candidate-generation logic (not wired into the UI)
- src/lib/calendar — calendar export (.ics / Google Calendar links)
- src/lib/geocoding — place search via OpenStreetMap/Nominatim
- src/lib/map — MapLibre map configuration helpers
- src/lib/saved — saved targets, shooting locations, setups, and alignments state
- src/lib/storage — persisted app state and database layer
- src/lib/timezone — timezone lookup and local time conversion
- src/types — shared TypeScript types

## Notes

- Rise/set and position calculations use [astronomy-engine](https://github.com/cosinekitty/astronomy).
- Maps are rendered with MapLibre GL using OpenStreetMap tiles.
- Moon searches support filtering by phase, time of night, and a Full Moon ±1 day window.
- Rise/set alignment searches match by azimuth only; the calculator also compares altitude.
- The map helps visualize geometry — it does not replace visiting the site.
