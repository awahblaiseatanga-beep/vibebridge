# VibeBridge

> **Translating music into synchronized tactile, visual, and lyrical experiences.**

VibeBridge is an accessibility-focused music application designed for Deaf and hard-of-hearing users. It bridges sound into three synchronized sensory channels:

1. **READ** — Synchronized real-time lyrics and karaoke cues.
2. **SEE** — Reactive visual representations of rhythm, frequency, and musical intensity.
3. **FEEL** — Beat-synchronized tactile feedback through the Android phone's vibration motor.

---

## Target Platform & Distribution

- **Platform:** Android Native Application.
- **Distribution:** Standalone installable APK for **CIMFEST** demonstration and testing.
- **Offline First:** Fully functional with local device storage for imported audio tracks and metadata.

---

## Technology Stack

- **Framework:** [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/) (SDK 58).
- **Navigation:** [Expo Router](https://docs.expo.dev/router/introduction/) (file-based navigation).
- **Language:** [TypeScript](https://www.typescriptlang.org/) (strict mode enabled).
- **Audio Engine:** [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/) (initial playback engine).
- **Haptic Engine:** [Expo Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/) (with architectural interface ready for native Android vibration modules).
- **Animations:** [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/) (and React Native Skia when advanced shaders are required).
- **Build System:** [Expo Application Services (EAS Build)](https://docs.expo.dev/build/introduction/) configured for Android APK artifacts.
- **Backend (Reserved):** Supabase Auth & PostgreSQL (deferred to future milestones).

---

## Project Structure

```
VIBEBRIDGE/
├── app/                      # Expo Router navigation routes
│   ├── _layout.tsx           # Root navigation stack and theme provider
│   └── index.tsx             # Entry dashboard and sensory status
├── src/
│   ├── components/
│   │   └── common/           # Accessible UI primitives (Card, SensoryBadge, etc.)
│   ├── features/             # Feature domain modules
│   │   ├── playback/         # Player controls, scrubber, transport UI
│   │   ├── library/          # Local audio track browser and file picker
│   │   ├── lyrics/           # READ pillar UI and karaoke highlight
│   │   ├── visualizer/       # SEE pillar UI (rhythm & frequency visuals)
│   │   ├── haptics/          # FEEL pillar UI (tactile intensity controls)
│   │   └── settings/         # Sensory channel preferences and accessibility
│   ├── engines/              # High-performance processing engines
│   │   ├── audio/            # Expo Audio playback engine and lifecycle
│   │   ├── synchronization/  # Master timeline clock & latency compensation
│   │   ├── event-scheduler/  # Look-ahead timestamped cue scheduler
│   │   ├── haptic/           # Tactile motor driver
│   │   ├── visual/           # Rhythm visual rendering driver
│   │   └── lyrics/           # Timed lyrics parser (LRC/JSON)
│   ├── services/             # Platform and external services
│   │   ├── storage/          # Local device key-value storage
│   │   ├── file-import/      # SAF audio file import and validation
│   │   ├── tracks/           # Track metadata repository
│   │   └── supabase/         # Cloud sync boundary (deferred)
│   ├── constants/            # App-wide constants, channels, keys
│   ├── hooks/                # Reusable React hooks
│   ├── store/                # Application state definitions
│   ├── theme/                # High-contrast accessibility theme (WCAG AAA)
│   ├── types/                # Strict domain TypeScript definitions
│   └── utils/                # Pure formatting and helper functions
├── assets/                   # Media assets (icons, fonts, images, bundled music)
├── docs/                     # Engineering documentation
│   ├── PRODUCT_REQUIREMENTS.md
│   ├── TECHNICAL_ARCHITECTURE.md
│   ├── DEVELOPMENT_LOG.md
│   └── DECISIONS.md
├── app.json                  # Expo application configuration
├── eas.json                  # EAS Build profiles (development, preview APK, production APK)
├── package.json
└── tsconfig.json             # TypeScript configuration with strict checking
```

---

## Development Setup

### Prerequisites

- **Node.js:** v18+ (Node v26+ tested)
- **Package Manager:** `npm`
- **Expo CLI:** Handled via `npx expo`
- **Android Device / Emulator:** For testing audio, visuals, and physical haptics.

### Installation

```bash
# Clone the repository
git clone https://github.com/<owner>/vibebridge.git
cd vibebridge

# Install dependencies
npm install
```

### Running Locally

```bash
# Start Metro bundler
npm run start

# Run directly on connected Android device/emulator
npm run android

# Run on Web (fallback preview)
npm run web
```

### Quality & Type Checks

```bash
# Run strict TypeScript compiler verification
npm run typecheck

# Verify Expo project configuration
npx expo config
```

---

## Building the APK (CIMFEST)

EAS Build is configured in `eas.json` with three profiles:

```bash
# Build an installable standalone Android APK for preview / testing
eas build --platform android --profile preview

# Build a release Android APK for CIMFEST distribution
eas build --platform android --profile production
```

> **Note:** Cloud builds incur EAS usage. Always confirm before initiating remote builds.

---

## Engineering Roadmap

- [x] **Phase 2, Milestone 1:** Project Foundation (Expo Router, TypeScript strict, Theme tokens, Engine contracts, EAS config).
- [ ] **Phase 2, Milestone 2:** Audio Playback Engine (Expo Audio integration, local track loading, playback transport controls).
- [ ] **Phase 2, Milestone 3:** Master Synchronization Engine & Latency Compensation.
- [ ] **Phase 2, Milestone 4:** FEEL Pillar — Haptic Feedback Integration.
- [ ] **Phase 2, Milestone 5:** SEE Pillar — Rhythm & Intensity Visualizer (Reanimated).
- [ ] **Phase 2, Milestone 6:** READ Pillar — Synchronized Lyrics Engine.
- [ ] **Phase 2, Milestone 7:** Local Library & Audio File Import.
- [ ] **Phase 2, Milestone 8:** Standalone Android APK Build & CIMFEST Validation.

---

## License

Private repository. All rights reserved.
