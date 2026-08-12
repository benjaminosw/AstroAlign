# AstroAlign

A local Next.js app for astronomical photography alignment planning.

## What is included

- Next.js + TypeScript application
- Tailwind CSS styling
- Astronomy Engine integration for Sun/Moon azimuth and altitude
- Geographic calculations for great-circle distance, bearing, and target altitude
- Line-of-sight angular separation calculation between the object and target direction
- Configurable alignment tolerance
- Reusable architecture separating UI, astronomy logic, geographic math, and alignment calculation
- Unit tests for geometry calculations and input validation

## Files created

- `package.json`
- `tsconfig.json`
- `next.config.mjs`
- `tailwind.config.js`
- `postcss.config.cjs`
- `.eslintrc.json`
- `vitest.config.ts`
- `.gitignore`
- `README.md`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/globals.css`
- `src/components/AlignmentCalculator.tsx`
- `src/lib/astronomy/position.ts`
- `src/lib/geometry/bearing.ts`
- `src/lib/geometry/distance.ts`
- `src/lib/geometry/altitude.ts`
- `src/lib/geometry/angularSeparation.ts`
- `src/lib/geometry/utils.ts`
- `src/lib/alignment/calculateAlignment.ts`
- `src/types/astronomy.ts`
- `src/lib/geometry/__tests__/bearing.test.ts`
- `src/lib/geometry/__tests__/angularSeparation.test.ts`
- `src/lib/geometry/__tests__/altitude.test.ts`
- `src/lib/alignment/__tests__/calculateAlignment.test.ts`

## Dependencies planned

- astronomy-engine
- next
- react
- react-dom
- tailwindcss
- typescript
- eslint
- vitest
- autoprefixer
- postcss

## How to start

Install Node.js first, then from the project root run:

```bash
npm install
npm run dev
```

To run tests:

```bash
npm run test
```

To run linting:

```bash
npm run lint
```

## Known limitations

- Node.js / npm is not available in this environment, so dependencies could not be installed or executed yet.
- Mode 2 (finding shooting locations) is not implemented.
- UI currently uses manual numeric latitude/longitude and UTC date/time only.
- No terrain, maps, or backend integration yet.
