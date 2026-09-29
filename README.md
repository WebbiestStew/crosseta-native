<div align="center">

<img src="./assets/icon.png" width="100" alt="CrossETA icon" />

# CrossETA

**Live US border crossing wait times — plan your crossing, skip the line.**

[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB?logo=react&logoColor=white)](https://reactnative.dev)
[![Expo SDK](https://img.shields.io/badge/Expo-52-000020?logo=expo&logoColor=white)](https://expo.dev)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-lightgrey)](#getting-started)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)

</div>

---

## Overview

CrossETA is a mobile app for frequent US border crossers — commuters, truckers, and travelers — who need real-time wait times and smart departure planning across **52 US land border crossings** (US–Mexico and US–Canada) drawn from the CBP port list.

Pull live data from the **official CBP BWTnew API** (covers all US–Mexico and US–Canada land borders), see rough +1h/+3h estimates, start a GPS-tracked crossing session, and get alerts for starred crossings while the app is open.

---

## Features

### Live Wait Times
- Pulls from the **official CBP BWTnew API** every 5 minutes
- Covers 52 crossings along the US–Mexico and US–Canada borders. A crossing with no matching CBP data shows "No live data" instead of a number
- Standard, SENTRI/NEXUS and Ready Lane waits come straight from CBP; closed lanes show as closed
- Shows **Standard**, **SENTRI/NEXUS**, and **Ready Lane** waits per crossing
- Stale-data banner animates in after 15 minutes without a refresh
- Offline cache via AsyncStorage for instant load on re-open

### Estimates
- **Est. +1h and +3h** figures scale the current CBP wait by a generic time-of-day curve. They are rough estimates, not per-crossing forecasts, and are labelled "Est." in the app
- Per-crossing history, heatmaps and accuracy scores are not shipped yet: they need stored CBP history, which the app doesn't collect

### Leave-By Calculator
- Enter your desired arrival time → app computes drive time + expected wait → tells you exactly when to leave
- Schedule a **local push notification** reminder right from the detail screen
- Also available as a standalone **Trip Planner** screen

### GPS Crossing Tracker ("I'm In Line")
- One tap starts a live GPS session from the comfort of your car
- **Haversine-based distance tracking** with a 4-state status machine (`queued → moving → clearing → done`)
- **Auto-completes** when speed drops below threshold after sufficient distance
- Live timer, animated pulsing FAB, and real-time distance/speed readout
- Session persists through app restarts — close the app mid-crossing and it picks back up
- Completed trips are saved to a local analytics log

### Notifications (4 types, local only)
Threshold and drop alerts are evaluated only while the app is running (no push server or background fetch yet). Leave-by reminders are scheduled on-device and fire even when the app is closed.

| Type | Trigger |
|---|---|
| **Threshold alert** | Wait exceeds your set limit for a starred crossing |
| **Drop alert** | Wait falls back below your threshold ("good to go") |
| **Leave-by reminder** | Fires at your calculated departure time |
| **Crossing complete** | Celebration notification when your GPS session ends |

All notifications include proper cooldown timers and per-crossing deduplication so you never get flooded.

### Map View
- Full-screen interactive map powered by `react-native-maps`
- Color-coded wait-time pins (green → yellow → red) for every crossing
- Tap any pin for a callout card with current lane waits

### More
- **Region comparison table** — every crossing in your region side by side
- **Packing checklist** — per-crossing document checklist with an animated SVG progress ring
- **Trip history & analytics** — personal stats: favorite crossing, best day of week, average wait, personal best
- **Near Me sorting** — distance-based crossing order using device location
- **Full dark mode** — system-level, zero edge cases
- **Share** — capture and share a crossing snapshot via `react-native-view-shot`

---

## Screenshots

> _Coming soon — TestFlight build in progress._

---

## Tech Stack

| Category | Library |
|---|---|
| Framework | React Native 0.76 + Expo SDK 52 |
| Navigation | React Navigation v7 (native stack + bottom tabs) |
| Animations | React Native Reanimated 3 + core `Animated` |
| Maps | react-native-maps |
| Charts | react-native-svg (custom, no charting lib) |
| Location & GPS | expo-location |
| Notifications | expo-notifications |
| Persistence | @react-native-async-storage/async-storage |
| UI effects | expo-blur, expo-linear-gradient, expo-haptics |
| Sharing | react-native-view-shot |
| State | React Context + hooks (no Redux/Zustand) |
| Data source | [CBP BWTnew API](https://bwt.cbp.gov/api/bwtnew) |

---

## Architecture

```
crosseta-native/
├── App.js                  # Root navigator, notification handler, deep-link setup
├── data.js                 # CBP crossing data, theme tokens, time utilities
├── context/
│   └── AppContext.js       # Global state: crossings, favorites, settings, persistence
├── hooks/
│   └── useLineTracker.js   # GPS session hook — distance math, state machine, auto-complete
├── components/
│   ├── UI.js               # Design system: WaitPill, Sparkline, GlassSurface, Card, etc.
│   ├── CrossingCard.js     # Home list item
│   ├── ReportCard.js       # Community report item
│   ├── SkeletonCard.js     # Loading placeholder
│   └── TrackingFAB.jsx     # Floating action button (lives above all tabs)
└── screens/                # 15 screens (see below)
```

### Navigation tree

```
RootStack
├── OnboardingScreen        — crossing selection + notification opt-in
├── HomeTabs (bottom tabs)
│   ├── HomeStack
│   │   ├── HomeScreen      — search, filter, sort, favorites
│   │   ├── DetailScreen    — hero gradient, leave-by calc, reports
│   │   ├── CrossingComparisonScreen
│   │   └── MapScreen
│   └── TripsStack
│       ├── TripsScreen
│       └── TripHistoryScreen
├── AlertsScreen            — per-crossing notification controls
├── SettingsScreen
├── ReportScreen            — modal: submit a wait report
├── ShareScreen             — modal: capture & share
├── InLineScreen            — fullscreen modal: live GPS tracker
├── TripPlanningScreen      — modal: standalone leave-by planner
└── ChecklistScreen         — modal: packing checklist
```

### Key implementation notes

**CBP API fuzzy matching** — port names from the CBP API are inconsistent across endpoints (e.g. `"San Ysidro"` vs `"San Ysidro (PedWest)"`). `normName()` strips punctuation, trims directional suffixes, and uses a scored substring match to reliably merge live data onto crossing objects.

**GPS hook (`useLineTracker`)** — location callbacks use `useRef` for all mutable state so they never capture stale closures. A `cancelled` flag prevents async race conditions on unmount. Auto-completion fires when speed exceeds 15 km/h after 200 m of accumulated distance.

**Custom SVG charts** — `Sparkline`, `BigSparkline` (gradient area chart with a current-hour dot), and `ProgressRing` (animated arc) are all built directly with `react-native-svg`. No third-party chart library.

**GlassSurface** — uses `expo-blur`'s `BlurView` on iOS for true background blur, gracefully falls back to a semi-transparent `View` on Android where the API isn't available.

**Notification deduplication** — threshold and drop alerts are gated by a `useRef` cooldown (15 min per crossing). Weekly preview notifications are deduped per-crossing via an AsyncStorage key so they fire at most once per Sunday.

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator / Android Emulator, or Expo Go on a physical device

### Install

```bash
git clone https://github.com/WebbiestStew/crosseta-native.git
cd crosseta-native
npm install
```

### Run

```bash
# Start the dev server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android
```

> **Note:** GPS tracking and push notifications require a physical device or a simulator with location simulation enabled.

---

## Roadmap

- [ ] Cover every CBP port of entry (currently 52)
- [ ] Store CBP history to power real forecasts and heatmaps
- [ ] Community reports with a backend (currently a local-only preview)
- [ ] Push notifications / background fetch, widgets, pedestrian and commercial lanes, Spanish
- [ ] Real backend for trip contributions and community reports
- [ ] Native iOS widget (WidgetKit via Expo)
- [ ] CarPlay support
- [ ] Historical wait analytics (server-side)
- [ ] App Store / Play Store release

---

## License

MIT © Diego Villarreal
