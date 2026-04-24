# Ariadne — Top Trump card prototype

Isolated PoliticianCard. Dark glassmorphist. Party-coloured spine, radial
spider chart, count-ups, flip, tilt.

## Two ways to preview

### 1. Instant static preview (no install)

Single file, vanilla HTML/CSS/JS. Mirrors the real card's visual language.

```bash
cd ariadne_app
python3 -m http.server 4242
# open http://127.0.0.1:4242/preview.html
```

Or just double-click `preview.html` to open in your browser.

### 2. Real Expo app (web + native-ready)

```bash
cd ariadne_app
npm install
npm run web
# open http://localhost:8081
```

The Expo app uses:

- `expo-router` for typed routes
- `react-native-reanimated` for tilt, flip, count-ups
- `react-native-svg` for the radial chart
- `expo-blur` + `expo-linear-gradient` for the glass

## Structure

```
ariadne_app/
├── app/
│   ├── _layout.tsx        Root stack, dark theme, felt background
│   └── index.tsx          Isolated card preview screen
├── components/
│   ├── primitives/
│   │   ├── GlassSurface   One-purpose frosted panel
│   │   └── CountUp        Number animation
│   └── card/
│       ├── CardSpine      Party-coloured left edge + glow
│       ├── CardAvatar     Circular avatar with party ring
│       ├── CardHeader     Identity block (avatar + name + role)
│       ├── RadialScoreChart  5-axis animated spider
│       ├── HeadlineStat   Large count-up for current sort key
│       ├── StatPill       Single labelled stat
│       ├── StatGrid       2x2 pills for secondary stats
│       ├── CardBack       Reverse face: posts + totals
│       └── PoliticianCard Composes all of the above + flip + tilt
├── data/
│   ├── types.ts           Politician shape
│   └── politicians.ts     Seed fixture (Rayner, Sunak, Davey)
└── theme/
    ├── colors.ts          Neutrals, party tokens, glass, accents
    ├── spacing.ts         4px grid, radii, card dims
    ├── motion.ts          Springs, timing, tilt tokens
    └── typography.ts      UI + mono type scale
```

## Design principles in play

- **One thing per component.** Each file does one visible job. Complex
  elements are composed from simpler ones.
- **Tokens, not hex codes.** All colour, spacing, motion, type goes through
  `theme/`. Changing the system means editing one file.
- **Springs over easing.** Only glow pulses and count-ups use timing. The
  rest is physics.
- **Party colour as identity.** Spine, ring, radial fill, highlight dot,
  headline number, button border — all derived from a single party token.
