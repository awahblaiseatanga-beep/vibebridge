# Development Log

## Project: VibeBridge
**Phase:** 2 — Core Engineering  
**Milestone:** 1 — Project Foundation  
**Date:** 2026-11-16  

---

### Step 1: Workspace Inspection
- Examined workspace at `c:\Users\PC\Desktop\VIBEBRIDGE`.
- Verified directory was completely empty with no existing code, Git history, or configuration files.
- Initialized local Git repository (`git init`).

### Step 2: Project Initialization
- Evaluated Expo tooling compatibility. Current stable Expo SDK 58 is available.
- Bootstrapped project using `npx create-expo-app@latest . -t blank-typescript --no-agents-md`.
- Scaffolding produced:
  - React Native 0.88.1
  - React 19.3.0
  - TypeScript 6.0.3
  - Expo 58.0.25
- Installed Expo Router and necessary native peers via Expo CLI:
  `npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants`
- Configured Expo Router entry point in `package.json`: `"main": "expo-router/entry"`.
- Cleaned up default `App.tsx` and legacy root `index.ts`.

### Step 3: Application Configuration & Structure
- Configured `app.json`:
  - App Name: `VibeBridge`
  - Slug: `vibebridge`
  - Deep linking scheme: `vibebridge`
  - Android package identifier: `com.vibebridge.app`
  - Dark-mode friendly splash screen and adaptive icons
  - Registered `expo-router` plugin
- Created structured project hierarchy:
  - `app/`: `_layout.tsx`, `index.tsx`
  - `src/theme/`: `colors.ts`, `typography.ts`, `spacing.ts`, `index.ts`
  - `src/constants/`: `index.ts`
  - `src/types/`: `index.ts`
  - `src/utils/`: `formatTime.ts`, `index.ts`
  - `src/components/common/`: `Card.tsx`, `SensoryBadge.tsx`, `index.ts`
  - `src/features/`: `playback/`, `library/`, `lyrics/`, `visualizer/`, `haptics/`, `settings/`
  - `src/engines/`: `audio/`, `synchronization/`, `event-scheduler/`, `haptic/`, `visual/`, `lyrics/`
  - `src/services/`: `storage/`, `file-import/`, `tracks/`, `supabase/`
  - `src/hooks/`: `index.ts`
  - `src/store/`: `index.ts`
  - `assets/`: `images/`, `icons/`, `fonts/`, `music/`
  - `docs/`: Product and architecture documentation

### Step 4: Foundation Documentation
- Authored:
  - `README.md`
  - `docs/PRODUCT_REQUIREMENTS.md`
  - `docs/TECHNICAL_ARCHITECTURE.md`
  - `docs/DECISIONS.md`
  - `docs/DEVELOPMENT_LOG.md`

### Step 5: Initial User Interface
- Created `app/_layout.tsx` providing `SafeAreaProvider`, dark background stack options, and `StatusBar` setup.
- Created `app/index.tsx` entry screen featuring:
  - VibeBridge branding and foundation milestone badge.
  - Three sensory pillars card highlighting READ, SEE, and FEEL channels with distinct sensory accent badges.
  - Now Playing music player placeholder (prepared for Milestone 2).
  - Music Library placeholder (prepared for Library milestone).
  - Clean, accessible mobile layout adhering to WCAG AAA contrast standards.

### Step 6: Build Configuration
- Created `eas.json` configuring:
  - `development`: Development client build.
  - `preview`: Standalone Android APK build (`"buildType": "apk"`).
  - `production`: Final Android release APK (`"buildType": "apk"`).

### Step 7: Quality Verification & Debugging
1. **TypeScript Verification:**
   - Initial check revealed TS 6.0 deprecation on `baseUrl` in `tsconfig.json`.
   - **Resolution:** Replaced `baseUrl` with modern relative path mapping (`"@/*": ["./src/*"]`).
   - Fixed `StatusBar` typing compatibility in Expo SDK 58.
   - Re-ran `npx tsc --noEmit` -> **PASSED (0 errors)**.
2. **Expo Configuration Validation:**
   - Ran `npx expo config` with `EXPO_NO_TELEMETRY=1` -> **PASSED (valid configuration)**.
3. **Metro Bundler & Export Verification:**
   - Executed `npx expo export --platform android --no-bytecode` to test bundling.
   - Bundled 1,132 modules in 42.2s -> **PASSED (1.6MB Android bundle generated without errors)**.
   - Cleaned up test export directory `dist/`.

---

### Status
Phase 2, Milestone 1 is **COMPLETED**. Initial commit `14addcd` created.

---

### Phase 2, Milestone 2: Audio Playback Engine
**Date:** 2026-11-17  

#### 1. Dependency Installation
- Installed `expo-audio@~58.0.12` using `npx expo install expo-audio -- --legacy-peer-deps`.
- Automatically registered `expo-audio` plugin in `app.json`.

#### 2. Architecture & Engine Implementation
- Built `src/engines/audio/types.ts` defining strict `AudioEngine`, `AudioSourceInput`, and event listener types.
- Implemented `src/engines/audio/ExpoAudioEngine.ts`:
  - Concrete implementation powered by `expo-audio` native bridge (`createAudioPlayer`).
  - High-precision 50ms update interval for tight cross-sensory timing.
  - Full transport state machine: `idle` -> `loading` -> `paused` -> `playing` -> `stopped` -> `error`.
  - Operations implemented: `load()`, `play()`, `pause()`, `resume()`, `stop()`, `seek()`, `unload()`.
  - Seeking with instant clock synchronization and boundary clamping.
  - Enforced single authoritative master clock rule: the audio playback position is the single source of truth for all future sensory systems (lyrics, visuals, haptics).

#### 3. Bundled Audio Stem
- Generated a dedicated 12-second 120 BPM rhythmic demonstration stem at `assets/music/vibebridge_demo.wav` (44.1kHz, 16-bit PCM).
- Features pronounced kick drum pulses, off-beat snare hits, and harmonic chord progression ideal for accessibility and tactile testing.

#### 4. UI Integration & React Hook
- Created `src/features/playback/usePlayback.ts`: Decoupled React Hook connecting UI components to the underlying `AudioEngine` singleton without lifecycle leaks.
- Created `src/features/playback/components/NowPlayingCard.tsx`:
  - Connected Play, Pause, Resume, Stop, and Seek transport controls.
  - Real-time progress bar with interactive seek points (`-2s`, `0s`, `50%`, `+2s`).
  - Authoritative clock telemetry display for real-time validation.
- Mounted `NowPlayingCard` on `app/index.tsx`.

#### 5. Verification & Testing
- Automated test suite in `scripts/test-audio-engine.js` covering 11 critical test cases:
  - Initial state inspection.
  - Bundled audio asset loading.
  - Play and resume transitions.
  - Pause preservation.
  - Seeking and clamping precision.
  - Stop and position reset.
  - Automatic track completion (`didJustFinish`).
  - Local file URI resolution.
  - Native error handling.
  - Unload and resource disposal.
  - Status: **ALL 11 TESTS PASSED**.
- TypeScript typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling (`expo export --platform android`): **PASSED (1,151 modules bundled in 1.1s)**.

---

### Status
Phase 2, Milestone 2 is **COMPLETED**. Committed under commit `018af1a`.

---

### Phase 2, Milestone 2.5: Audio Clock Synchronization Preparation
**Date:** 2026-11-17  

#### 1. Clock Anchoring & Generation Counter
- Added `updatedAtMs: number` to `PlaybackClock`: Monotonic timestamp (via `performance.now()`) anchored whenever fresh native position ticks arrive.
- Added `timelineRevision: number` to `PlaybackClock`: Monotonically increasing revision counter incremented on every track load and seek operation to invalidate downstream cues in the upcoming `EventScheduler`.

#### 2. Safe Clock Estimation
- Added `getEstimatedPositionMs(atTimeMs?: number)` to `AudioEngine`:
  - Forward-projects current position using `positionMs + (elapsedMs * rate)`.
  - Non-mutating: does **not** alter native `positionMs` (native hardware timestamps remain strictly authoritative).
  - Strictly freezes estimation when paused, stopped, buffering, or idle.
  - Clamped strictly to `[0, durationMs]`.

#### 3. Rapid Seeking Coalescing & Interruption Safety
- Implemented serialized/coalesced asynchronous seek queue in `ExpoAudioEngine.ts` preventing race conditions from rapid scrubber scrubbing.
- Guarded `handleNativeStatusUpdate` against stale pre-seek ticks while a native seek is in flight.
- Added explicit state transitions and estimation freeze for native interruptions (`AUDIOFOCUS_LOSS`, `AUDIOFOCUS_LOSS_TRANSIENT`, and `setHandleAudioBecomingNoisy` headphone disconnects).

#### 4. Verification & Testing
- Expanded test suite in `scripts/test-audio-engine.js` from 11 to 13 comprehensive tests:
  - Initial state inspection.
  - Track loading revision changes.
  - Play and monotonic clock anchoring.
  - Safe clock estimation between native updates.
  - Playback rate scaling (0.5x, 1.0x, 1.5x).
  - Paused clock estimation freeze.
  - Buffering clock estimation freeze.
  - Seek revision changes and timeline invalidation.
  - Rapid consecutive seek coalescing.
  - Track duration boundary clamping.
  - Track completion (`didJustFinish`).
  - Native interruption (audio focus loss / becoming noisy) and recovery.
  - Unload and memory disposal.
  - Status: **ALL 13 TESTS PASSED**.
- TypeScript typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling (`expo export --platform android`): **PASSED (1,151 modules bundled in 5.9s)**.

---

### Phase 2, Milestone 3: Master Synchronization Engine & Latency Compensation
**Date:** 2026-11-17  
**Commit:** `d7d5594ec79db14bb092db5d584dc540bb0c3dab`

#### 1. Master Clock Abstraction (`src/engines/synchronization/MasterClock.ts`)
- Created `AudioMasterClock` implementing `MasterClock`.
- Exposes continuous timeline estimation via `getEstimatedPositionMs()` anchored to monotonic timestamps (`updatedAtMs`).
- Retains native ExoPlayer hardware timestamps as authoritative ground truth.
- Exposes complete playback status, duration, playback rate, and `timelineRevision`.
- Ensures all future sensory systems (haptics, visualizer, lyrics) consume the exact same master timeline clock.

#### 2. Latency Compensation Model (`src/engines/synchronization/LatencyManager.ts`)
- Implemented `LatencyManager` with configurable channel offsets.
- Defined explicit mathematical sign convention:
  $$\text{leadTimeMs} = \text{channelOffsetMs} - \text{audioOffsetMs}$$
  $$\text{triggerTimestampMs} = \max(0, \text{targetTimestampMs} - \text{leadTimeMs})$$
- Default offsets configured for Android hardware:
  - `audioOffsetMs: 0ms` (Bluetooth device calibration point)
  - `hapticOffsetMs: 25ms` (Motor acceleration / spin-up lead)
  - `visualOffsetMs: 16ms` (Display composition / rasterization lead)
  - `lyricsOffsetMs: 0ms` (Reading anticipation point)
- Documented provisional nature of offsets as starting baseline values rather than measured hardware characteristics.

#### 3. Event Scheduler (`src/engines/event-scheduler/PriorityEventScheduler.ts`)
- Implemented `PriorityEventScheduler` with chronological binary search insertion ($O(\log n)$).
- Enforces single controlled scheduling loop with lifecycle management (`start()`, `stop()`, `dispose()`).
- Configurable look-ahead window (`lookAheadWindowMs: 80ms`) and polling interval (`pollingIntervalMs: 20ms`).
- Implemented explicit late-event policy (`maxLatenessToleranceMs: 50ms`): events within tolerance are dispatched immediately; stale events past tolerance are dropped to prevent burst firing.
- Duplicate prevention using dispatched ID tracking.
- Timeline revision invalidation: drops all queued cues from previous revisions on seek or track change.
- Generic, decoupled event delivery contract emitting `DispatchedEvent` with channel and global subscription filters.
- Pauses scheduling loop while audio is paused, stopped, buffering, or past track completion.

#### 4. Architecture Documentation
- Recorded ADR-009 (Master Clock & Look-Ahead Event Scheduling Architecture) and ADR-010 (Latency Compensation Model & Sign Convention) in `docs/DECISIONS.md`.
- Updated `docs/TECHNICAL_ARCHITECTURE.md`.

#### 5. Verification & Testing
- Built deterministic test suite in `scripts/test-synchronization.js` with injectable `MockMasterClock`:
  - Latency compensation calculations and sign convention verification.
  - Chronological event ordering across out-of-order batches.
  - Duplicate dispatch prevention on repeat ticks.
  - Individual event cancellation.
  - Look-ahead window boundary filtering.
  - Timeline revision invalidation upon seeking.
  - Paused and buffering clock estimation freeze.
  - Track completion boundary enforcement.
  - Multi-consumer fan-out, channel isolation, and unsubscription.
  - Scheduler lifecycle cleanup and disposal.
  - Late-event handling policy and staleness dropping.
  - Clamped latency lead time staleness evaluation.
  - Status: **ALL 12 TESTS PASSED**.
- Audio Engine test suite (`scripts/test-audio-engine.js`): **ALL 13 TESTS PASSED**.
- TypeScript strict typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling verification (`expo export --platform android`): **PASSED (1,151 modules bundled in 1.1s)**.

---

### Phase 2, Milestone 4: FEEL — Haptic Feedback Integration
**Date:** 2026-11-17  

#### 1. Haptic Engine Abstraction (`src/engines/haptic/`)
- Created `IHapticEngine` interface and `ExpoHapticEngine` concrete implementation in `src/engines/haptic/ExpoHapticEngine.ts`.
- Integrated `expo-haptics@~58.0.8` using Expo-compatible dependencies.
- Designed with dependency injection (`HapticDriver`) enabling 100% deterministic testing in Node.js test environments without native hardware.
- Subscribes reactively to `PriorityEventScheduler`'s `'haptic'` channel. Operates with **zero independent timers**.
- Implemented **Dynamic Tactile Tier Remapping**: computes $\text{effectiveIntensity} = \text{userIntensity} \times \text{cueWeight}$ and remaps discrete platform feedback styles (`Heavy` -> `Medium` -> `Light` -> `Soft`). Documented that 25%, 50%, 75%, and 100% settings are logical intensity levels, not guaranteed physical vibration amplitude percentages.
- Implemented **Event-Rate Safeguards**: enforces a 40ms minimum interval (`minIntervalMs: 40ms`) between consecutive vibration triggers to prevent dense bursts (without claiming physical motor fatigue or overheating guarantees).
- Implemented suspension of scheduler subscription when haptics are disabled and restoration without duplication upon re-enabling.
- Implemented pause/resume/seek safety: halts during playback pause or buffering, and drops outdated cues on timeline seek.

#### 2. Bundled 120 BPM Demo Track Rhythmic Score (`src/features/haptics/demoTrackHaptics.ts`)
- Mapped rhythmic haptic score for `assets/music/vibebridge_demo.wav` (12 seconds, 6 bars of 4/4 at 120 BPM):
  - 12 downbeat bass kicks (Beats 1 & 3): Heavy impact (`weight: 1.0`)
  - 12 backbeat snares (Beats 2 & 4): Medium impact (`weight: 0.85`)
  - 21 off-beat hi-hat subdivisions (eighth notes): Light impact (`weight: 0.5`)
  - Bar 6 rhythmic fill and final resolution: Rigid accents and Success pulse (`weight: 1.0`)
- Connected `scheduleDemoTrackHaptics(eventScheduler, timelineRevision)` in `NowPlayingCard` to synchronize cues automatically whenever track loads or timeline revision changes.

#### 3. User Controls & Accessible UI (`src/features/haptics/components/HapticControlCard.tsx`)
- Created `useHaptics` hook providing reactive state access and control methods.
- Built accessible `HapticControlCard` component:
  - Master Enable / Disable toggle switch.
  - Tactile Intensity selector with presets (25% Gentle, 50% Balanced, 75% Strong, 100% Max).
  - Real-time sensory feedback indicator displaying active beat type (`KICK`, `SNARE`, `HI-HAT`, `RESOLUTION`).
  - Tactile test buttons allowing the user to feel sample patterns on demand.
  - Clear disclosure of motor safeguards and Android hardware differences.
- Integrated into `app/index.tsx` home screen.

#### 4. Architecture Documentation
- Recorded ADR-011 (Haptic Feedback Architecture, Dynamic Tactile Scaling, and Motor Safeguards) in `docs/DECISIONS.md`.
- Documented Android hardware realities: LRA (Linear Resonant Actuator) vs ERM (Eccentric Rotating Mass), motor rise/fall times, thermal throttling, and future native module escape hatch.
- Updated `docs/TECHNICAL_ARCHITECTURE.md`.

#### 5. Verification & Testing
- Built comprehensive test suite in `scripts/test-haptic-engine.js`:
  - Test 1: Initial state & configuration defaults.
  - Test 2: Master enable/disable toggle strictly gating actuation.
  - Test 3: Pattern mapping for all 8 tactile types (`heavy`, `medium`, `light`, `soft`, `rigid`, `pulse`, `double`, `silence`).
  - Test 4: Intensity scaling and dynamic tier remapping.
  - Test 5: Anti-spam throttling enforcing 40ms motor fatigue limit.
  - Test 6: PriorityEventScheduler subscription and sensory channel isolation.
  - Test 7: Timeline revision seeking and pause safety.
  - Test 8: Bundled 120 BPM demo track score integrity (47 cues).
  - Test 9: Engine disposal and cleanup.
  - Status: **ALL 9 TESTS PASSED**.
- Verification across entire suite (`npm test`):
  - Audio Engine: **13/13 PASSED**
  - Synchronization & Event Scheduler: **12/12 PASSED**
  - Haptic Engine: **9/9 PASSED**
  - Total: **34/34 UNIT TESTS PASSED**.
- TypeScript strict typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling verification (`expo export --platform android`): **PASSED (1,168 modules bundled in 7.5s)**.

---

### Status
Phase 2, Milestone 4 is **COMPLETED**. Confirmed commit: `635aa02a93b0dbfcfb09a38ef8a245fa255a170f`.

---

### Phase 2, Milestone 5: SEE — Hybrid Visual Rhythm Engine
**Date:** 2026-11-17  

#### 1. Shared Canonical Rhythm Metadata (`src/features/rhythm/`)
- Extracted single source of truth for the 120 BPM demo track into `CANONICAL_DEMO_RHYTHM_SCORE` in `src/features/rhythm/demoTrackScore.ts`:
  - 47 cues spanning 6 bars of 4/4 time at 120 BPM (500ms quarter note, 250ms eighth note).
  - Downbeat kicks (Beats 1 & 3): `role: 'downbeat'`, `weight: 1.0`.
  - Backbeat snares (Beats 2 & 4): `role: 'backbeat'`, `weight: 0.85`.
  - Off-beat subdivisions (eighth notes): `role: 'subdivision'`, `weight: 0.5`.
  - Bar 6 climax accents (Beats 3.0, 3.5): `role: 'accent'`, `weight: 1.0`.
  - Bar 6 final cadence (Beat 4.0 at 11500ms): `role: 'resolution'`, `weight: 1.0`.
  - Bar 6 compositional silence (11600ms–12000ms): `role: 'rest'`, `weight: 0.0`.
- Refactored `src/features/haptics/demoTrackHaptics.ts` to derive from `CANONICAL_DEMO_RHYTHM_SCORE`, maintaining 100% backward compatibility.
- Implemented `scheduleDemoTrackSensoryCues` which schedules both haptic and visual cues onto `PriorityEventScheduler` simultaneously, guaranteeing 1:1 synchronization.

#### 2. Visual Rhythm Engine (`src/engines/visual/`)
- Created `IVisualRhythmEngine` interface and `VisualRhythmEngine` concrete implementation in `src/engines/visual/VisualRhythmEngine.ts`.
- Created pure, deterministic mapping utility `VisualEventMapper` in `src/engines/visual/VisualEventMapper.ts`.
- Purely reactive consumer: subscribes to `PriorityEventScheduler`'s `'visual'` channel and `MasterClock`. Operates with **zero independent timers**.
- Configurable animation scales (`VisualScaleConfig` with defaults: `strongScale: 1.35`, `mediumScale: 1.20`, `softScale: 1.06`, `accentScale: 1.45`, `resolutionScale: 1.25`, `restScale: 1.00`), overrideable at runtime via `setScales()`.
- Strict separation between compositional silence (musical rest), transport pause, and transport buffering.
- Visual latency compensation uses provisional, configurable 16ms lead time (not claimed as physically validated).
- Suspends scheduler subscription when disabled and restores without duplicate listeners.

#### 3. Hybrid Visual Components & Accessible UI (`src/features/visualizer/`)
- Created `useVisualizer` hook binding UI to `visualRhythmEngine`.
- Built accessible `VisualRhythmSurface` component:
  - **Layer A (Expressive)**: Centered pulsating geometry nodes and expanding aura rings reacting to beat strength and energy level. Rendered via React Native `Animated` running on the Android native UI thread (`useNativeDriver: true`) targeting 60 FPS.
  - **Layer B (Informational)**: Secondary 4/4 meter HUD displaying beat indicators (Kick vs Snare), measure counter (`BAR 1/6`), and clear semantic status.
- Multi-modal accessibility (non-color reliance): distinct shapes (`diamond`, `triangle`, `circle`, `accent-burst`, `starburst`, `line`), distinct glyphs (`◆`, `▲`, `●`, `◈`, `✦`, `—`), variable border weights, and text labels.
- Accessible **Reduced Motion mode**: locks animation scales strictly at 1.00 while amplifying border contrast.
- Integrated into `app/index.tsx` home screen between `NowPlayingCard` and `HapticControlCard`.

#### 4. Architecture Documentation
- Recorded ADR-012 (Hybrid Visual Rhythm Architecture, Non-Color Accessibility, and Canonical Rhythm Metadata) in `docs/DECISIONS.md`.
- Updated `docs/TECHNICAL_ARCHITECTURE.md`.

#### 5. Verification & Testing
- Built comprehensive test suite in `scripts/test-visual-engine.js`:
  - Test 1: Initial state & configurable scale defaults.
  - Test 2: Dynamic scale configuration override.
  - Test 3: Pure event mapping for all musical roles (`downbeat`, `backbeat`, `subdivision`, `accent`, `resolution`, `rest`).
  - Test 4: Non-color visual distinction verification (shapes, glyphs, borders, labels).
  - Test 5: Accessible Reduced Motion mode (scale locked at 1.0, high-contrast borders).
  - Test 6: Clear distinction between musical rest vs transport pause vs buffering.
  - Test 7: PriorityEventScheduler subscription on `'visual'` channel and 16ms lead time dispatch.
  - Test 8: Timeline revision invalidation on seek & track changes.
  - Test 9: Enable/disable lifecycle suspension, unsubscription, and disposal.
  - Test 10: Canonical demo rhythm score visual cues verification (47 cues, 1:1 alignment with haptics).
  - Status: **ALL 10 TESTS PASSED**.
- Verification across entire suite (`npm test`):
  - Audio Engine: **13/13 PASSED**
  - Synchronization & Event Scheduler: **12/12 PASSED**
  - Haptic Engine: **10/10 PASSED**
  - Visual Rhythm Engine: **10/10 PASSED**
  - Total: **45/45 UNIT TESTS PASSED**.
- TypeScript strict typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling verification (`npx expo export --platform android`): **PASSED (1,177 modules bundled in 7.5s)**.

---

### Status
Phase 2, Milestone 5 is **COMPLETED**. Confirmed commit: `1f7e27d3a77f58167525c51c7515a7da5216637f`.

---

### Phase 2, Milestone 6: READ — Synchronized Lyrics Engine
**Date:** 2026-11-17

#### 1. Data Model & Strict Validator (`src/engines/lyrics/`)
- Created `src/engines/lyrics/types.ts` defining `LyricSegment`, `TrackLyrics`, `LyricActiveStatus`, `LyricsEngineState`, `LyricCuePayload`, and `ILyricsEngine`.
- Built `src/engines/lyrics/LyricsValidator.ts`:
  - Enforces finite non-negative timestamps (`startMs >= 0`, `endMs > startMs`).
  - Enforces strict chronological ordering and non-empty text strings.
  - Rejects overlapping segments (`segments[i].startMs < segments[i-1].endMs`).
  - Rejects mismatched track IDs.
  - Zero silent repairs: strictly throws `LyricsValidationError` on invalid data.

#### 2. LyricsTimeline & Active Segment Resolver (`src/engines/lyrics/LyricsTimeline.ts`)
- Pure deterministic timeline resolver utilizing binary search ($O(\log n)$) against authoritative clock time.
- Categorizes exact playback status: `'no_lyrics'`, `'before_lyrics'`, `'active'`, `'instrumental_gap'`, and `'after_lyrics'`.
- Handles gaps between segments explicitly, displaying accessible transition cues without keeping obsolete lyrics highlighted.
- Provides `toScheduledEvents()` converting line start/end boundaries into `ScheduledEventInput` cues for the scheduler's `'lyrics'` channel.

#### 3. LyricsEngine Implementation (`src/engines/lyrics/LyricsEngine.ts`)
- Implements `ILyricsEngine` anchored to `MasterClock` and `PriorityEventScheduler`.
- Zero independent timers: uses `MasterClock.getEstimatedPositionMs()` as the single authoritative source of truth.
- Resilient to delayed JavaScript execution: re-evaluates active line directly from clock position, preventing phase drift or frozen highlights.
- Invalidation safety: listens to `timelineRevision` changes (on seek or track replacement) and immediately re-evaluates line position while dropping outdated cues.
- Handles pause/resume/buffering: freezes active line on pause/buffering and recovers on resume.
- Safe fallback for un-lyriced audio: tracks with `hasLyrics: false` or `null` lyrics transition cleanly to `'no_lyrics'` without exceptions.

#### 4. Original Demonstration Lyrics Metadata (`src/features/lyrics/demoTrackLyrics.ts`)
- Created original 4-segment demonstration lyrics score fitting the 12-second 120 BPM demo track (`assets/music/vibebridge_demo.wav`).
- Composed original text celebrating the accessible multi-sensory experience:
  - Line 1 (500ms–3500ms): *"Feel the pulse begin, deep in your hands"* (Verse)
  - Gap 1 (3500ms–4000ms): Instrumental transition
  - Line 2 (4000ms–6500ms): *"See the colors rise, dancing with the beat"* (Verse)
  - Gap 2 (6500ms–7500ms): Rhythm buildup
  - Line 3 (7500ms–9500ms): *"Sound and motion moving as one"* (Climax)
  - Gap 3 (9500ms–10000ms): Drum fill
  - Line 4 (10000ms–11500ms): *"Every rhythm shared in harmony"* (Resolution)
  - Outro (11500ms–12000ms): Musical cadence
- Prominently marked with `isDemonstration: true` and explicit disclosure label:
  `"Demo Lyrics · Synchronized to 120 BPM Stem"`.

#### 5. Lyrics UI & Hook (`src/features/lyrics/`)
- Created `useLyrics` hook binding React components to `lyricsEngine`.
- Built accessible `LyricsCard` component:
  - **Active Line (Primary)**: Highlighted in Sky Cyan (`#38BDF8`), bold 20pt font, high-contrast elevated container (>7:1 WCAG AAA), optional speaker tag.
  - **Previous Line (Secondary)**: Rendered with reduced emphasis (`opacity: 0.35`) and muted font.
  - **Upcoming Lines (Secondary)**: Next 1–2 preview lines rendered in secondary text (`opacity: 0.6`).
  - **Instrumental Transitions**: Explicit visual indicator (`"♫ Instrumental Break ♫"`, `"♫ Intro — Lyrics start shortly ♫"`) during gaps.
  - **Demonstration Transparency**: Clear badge displaying `"Demo Lyrics · Synchronized to 120 BPM Stem"`.
  - **Empty State**: Friendly fallback when tracks have no lyrics (`hasLyrics: false`).
- Integrated into `app/index.tsx` home screen, establishing the complete sensory hierarchy: **READ (Lyrics) $\to$ SEE (Visuals) $\to$ FEEL (Haptics)**.

#### 6. Verification & Automated Testing
- Built comprehensive test suite in `scripts/test-lyrics-engine.js` (11 tests):
  - Test 1: Strict metadata validation (timestamps, overlaps, ordering, empty text, mismatched IDs).
  - Test 2: Lyrics timeline binary-search resolution (boundaries, gaps, active lines, pre/post).
  - Test 3: Initial state and no-lyrics / unloaded fallback.
  - Test 4: Active lyric highlighting and context tracking (previous, active, upcoming).
  - Test 5: Explicit instrumental gap and transition handling.
  - Test 6: Playback synchronization (pause, resume, and monotonic clock freezing).
  - Test 7: Seeking (forward & backward) and timeline revision invalidation.
  - Test 8: Track replacement, unload, and playback completion.
  - Test 9: Resilience to delayed/dropped JS events (clock-authoritative recovery).
  - Test 10: Lifecycle: subscription cleanup, no duplicates, and disposal.
  - Test 11: Original demo track lyrics integrity (4 segments, 12s, transparency disclosure).
  - Status: **ALL 11 TESTS PASSED**.
- Verification across entire suite (`npm test`):
  - Audio Engine: **13/13 PASSED**
  - Synchronization & Event Scheduler: **12/12 PASSED**
  - Haptic Engine: **10/10 PASSED**
  - Visual Rhythm Engine: **10/10 PASSED**
  - Synchronized Lyrics Engine: **11/11 PASSED**
  - Total: **56/56 UNIT TESTS PASSED**.
- TypeScript strict typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling verification (`expo export --platform android`): **PASSED (1,186 modules bundled in 6.4s)**.

---

### Status
Phase 2, Milestone 6 is **COMPLETED**. Confirmed commit: `2c8e3fbcb44d613631b0e14d5b4dd6f273d2f327`.

---

### Stage 1: Synchronization & Playback Lifecycle Corrections
**Date:** 2026-11-20

#### 1. Look-Ahead Window Dispatch Semantics Correction (`src/engines/event-scheduler/PriorityEventScheduler.ts`)
- **Problem:** In physical testing on Android 15 (Redmi A5), haptics fired noticeably earlier than musical beats or at irregular intervals. Investigation revealed that `PriorityEventScheduler.tick()` evaluated event eligibility using `event.scheduledTimestampMs <= effectiveHorizonMs`, where `effectiveHorizonMs = currentPosition + lookAheadWindowMs` (80ms). Events were dispatched 60–80ms prematurely (plus 25ms haptic lead time = 85–105ms ahead of acoustic transients).
- **Correction:**
  - Shifted dispatch criteria to strict due-time threshold: `event.scheduledTimestampMs <= currentPosition`.
  - Maintained staleness drop tolerance: cues older than 50ms (`minTimelyTimestamp = currentPosition - 50`) are discarded to avoid delayed bursts after thread stalls.
  - Introduced a **Single Managed Staging Micro-Timer** (`stagedTimerHandle`):
    - When upcoming cues fall within the look-ahead window (`currentPosition < scheduledTimestampMs <= currentPosition + lookAheadWindowMs`), the scheduler calculates the millisecond delta to the earliest upcoming cue ($\Delta t = \text{earliestEvent.scheduledTimestampMs} - \text{currentPosition}$) and sets a single micro-timer.
    - When the timer executes, it invokes `tick()`, dispatching the cue right on time and scheduling the next one.
    - Eliminates 0–20ms polling discretization jitter without spawning uncontrolled timers or leaking handles.
    - Micro-timer handle is strictly cleared on revision change, pause, stop, buffering, queue clearing, and disposal.

#### 2. Replay (Stop $\to$ Play) Cue Rescheduling Correction (`src/engines/audio/ExpoAudioEngine.ts` & `NowPlayingCard.tsx`)
- **Problem:** Stopping and replaying a track resulted in weak or missing vibrations. Investigation revealed that `ExpoAudioEngine.stop()` did not advance `timelineRevision`. When stopped, `eventScheduler.clear()` wiped the queue and cleared dispatched IDs, but `NowPlayingCard`'s cue-scheduling effect (`useEffect([timelineRevision])`) was never triggered. Replay from stopped position left the scheduler queue empty.
- **Correction:**
  - In `ExpoAudioEngine.stop()`, increment `this.clock.timelineRevision++` (guarded against redundant increments if already stopped at position 0).
  - In `NowPlayingCard.tsx`, the `timelineRevision` change triggers `hapticEngine.reset()` and `scheduleDemoTrackSensoryCues(eventScheduler, timelineRevision)`.
  - In `NowPlayingCard.tsx`'s `handlePlayPause()`, added explicit check: if stopped at end of track (`isStopped && durationMs > 0 && positionMs >= durationMs`), explicitly seek to 0 before resuming.

#### 3. Pause $\to$ Resume Lifecycle Continuity
- **Behavior Verified:**
  - On pause: clock estimation freezes, active micro-timer is cancelled, polling interval is stopped, but future scheduled events remain in the queue.
  - On resume: polling restarts, active micro-timer is staged for the next due cue, and playback continues seamlessly without duplicate triggers or skipped beats.

#### 4. Automated Testing & Verification
- Comprehensive rewrite of `scripts/test-synchronization.js` with 14 deterministic tests:
  - Test 1: Latency compensation calculations for all channels.
  - Test 2: Chronological event ordering & identical timestamp FIFO stability.
  - Test 3: Duplicate prevention across dispatch ticks.
  - Test 4: Event cancellation.
  - Test 5: Look-ahead window preparation without premature dispatch & exact due-time firing.
  - Test 6: Timeline revision invalidation on seek.
  - Test 7: Paused & buffering clock behavior (freeze & safe resumption).
  - Test 8: Pause $\to$ Resume lifecycle continuation without replaying old cues.
  - Test 9: Stop invalidation & revision advance.
  - Test 10: Stop $\to$ Play replay complete rescheduling.
  - Test 11: Late-event handling policy & staleness dropping.
  - Test 12: Clamped latency lead time staleness.
  - Test 13: Multiple consumers, channel isolation & unsubscription.
  - Test 14: Scheduler lifecycle cleanup & disposal.
  - Status: **ALL 14 TESTS PASSED**.
- Full test suite verification (`npm test`):
  - Audio Engine: **13/13 PASSED**
  - Synchronization & Event Scheduler: **14/14 PASSED** (up from 12)
  - Haptic Engine: **10/10 PASSED**
  - Visual Rhythm Engine: **10/10 PASSED**
  - Synchronized Lyrics Engine: **11/11 PASSED**
  - Total: **58/58 UNIT TESTS PASSED** (all 5 test suites).
- TypeScript strict typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling verification (`npx expo export --platform android`): **PASSED (1,186 modules bundled in 4.7s)**.

---

### Status
Stage 1: Synchronization & Playback Lifecycle Corrections are **COMPLETE** and verified. Proposed changes ready for user review and commit authorization.

---

### Stage A: SEE Direct Visual Event Animation & Responsiveness
**Date:** 2026-11-20

#### 1. Decoupled Direct Animation Dispatch (`src/engines/visual/` & `src/features/visualizer/`)
- **Problem:** Visual animations were previously initiated solely through React component state updates (`setVisualState`) and an associated `useEffect([state.totalEventsReceived])`. On budget Android hardware (Redmi A5 / Cortex-A53 cores), the React Native reconciliation and commit pass introduced **40ms to 80ms of rendering latency**, causing animations to fire noticeably after the audible beat. Additionally, underdamped 350ms springs exceeded the 250ms eighth-note event interval, causing successive cues to cancel decaying animations and leave the visual surface permanently elevated.
- **Architectural Solution:**
  - Extended `IVisualRhythmEngine` and `VisualRhythmEngine` with synchronous direct cue notification: `onVisualCue(listener: VisualCueListener): () => void`.
  - Dispatches `VisualCueAnimationPayload` synchronously to imperative listeners upon receiving a scheduled visual event, completely bypassing the React render loop.
  - Exposed `onVisualCue` through the `useVisualizer` hook.
  - In `VisualRhythmSurface.tsx`, bound `onVisualCue` directly to React Native `Animated` values (`scaleAnim`, `auraScaleAnim`, `opacityAnim`).
  - Active animations are tracked via `activeAnimationRef.current` and cleanly stopped before initiating the next cue, preventing uncontrolled queues or mid-flight drift.
  - Low-frequency informational UI state (4/4 Beat HUD, measure progression `BAR 1/6`, transport status, and glyph text) continues to be handled via React state at natural, low-frequency intervals without blocking the kinetic animation thread.

#### 2. Optimized Animation Envelopes with Clean Baseline Return
- Replaced underdamped springs with critically tuned, fast-attack, smooth-decay curves using `Easing.out(Easing.quad)` to ensure all animations settle fully back to `scale: 1.0` and baseline opacity `0.35` before the next event:
  - **Downbeat / Accent (`role: 'downbeat' | 'accent'`):** Attack 30ms, Decay 130ms, Total: **160ms** (settles 90ms before next 250ms cue).
  - **Backbeat (`role: 'backbeat'`):** Attack 25ms, Decay 110ms, Total: **135ms** (settles 115ms before next 250ms cue).
  - **Subdivision (`role: 'subdivision'`):** Attack 20ms, Decay 70ms, Total: **90ms** (settles 160ms before next 250ms cue).
  - **Resolution (`role: 'resolution'`):** Attack 40ms, Decay 260ms, Total: **300ms** (fits cleanly within the 500ms outro window).
  - **Reduced Motion Mode:** Kinetic scale is locked strictly at `1.0` (zero scaling/bouncing); high-contrast opacity pulse (Attack 20–25ms, Decay 110–135ms) preserves rhythm clarity.
  - **Resting / Inactive Transport:** Transport pause, stop, buffering, or musical rest triggers a gentle 150ms settle animation to resting baseline.

#### 3. Synchronization & Lifecycle Guarantees
- Strictly driven by `PriorityEventScheduler`'s `'visual'` channel and `MasterClock`; zero independent JavaScript timers or clocks.
- Outdated cues from earlier timeline revisions (e.g., following seeks, track changes, or stop) are dropped upfront via `event.timelineRevision !== this.currentRevision`.
- Unmounting `VisualRhythmSurface` cancels running animations and releases listeners. Disabling visuals suspends scheduler subscription.

#### 4. Automated Verification & Metrics
- Expanded `scripts/test-visual-engine.js` from 10 to 13 tests:
  - Test 11: Direct visual cue animation envelopes (`onVisualCue`) for downbeat, accent, backbeat, subdivision, and resolution.
  - Test 12: High-frequency consecutive cues (8 cues at 250ms spacing) ensuring no accumulation and verified listener unsubscription.
  - Test 13: Direct cue listener reduced-motion handling and timeline revision safety.
  - Status: **ALL 13 TESTS PASSED**.
- Entire automated test suite (`npm test`):
  - Audio Engine: **13/13 PASSED**
  - Synchronization & Event Scheduler: **14/14 PASSED**
  - Haptic Engine: **10/10 PASSED**
  - Visual Rhythm Engine: **13/13 PASSED** (up from 10)
  - Synchronized Lyrics Engine: **11/11 PASSED**
  - Total: **61/61 UNIT TESTS PASSED**.
- TypeScript strict typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling verification (`npx expo export --platform android`): **PASSED (1,186 modules bundled in 3.9s)**.

---

### Status
Stage A: Direct Visual Event Animation & Responsiveness is **COMPLETE** and verified. Proposed changes ready for user review.

---

### Stage A.3: Controlled Visual Latency Lead Calibration
**Date:** 2026-11-20

#### 1. Context and Problem
- Physical testing on Redmi A5 (Android 15, API 35) confirmed that Stage A direct imperative animation dispatch reduced React render overhead.
- However, visual rhythm feedback remained noticeably behind the audible beat.
- Technical analysis identified the root latency budget:
  - Default provisional visual compensation was only **16ms** (1 display frame).
  - Android display presentation pipeline introduces Choreographer VSYNC alignment (0–16.7ms, avg ~8.3ms), SurfaceFlinger triple-buffering (16.7–33.3ms), and IPS LCD GTG pixel transition latency (10–15ms).
  - Kinetic attack time to perceptual peak (P-center) accounts for another 20–30ms.
  - Total physical perceptual lag spans **55ms to 75ms**, leaving 16ms under-compensated by ~40ms to 60ms.

#### 2. Architectural Solution
- **Strict Baseline Preservation:** Default `visualOffsetMs` remains strictly `16ms` in `DEFAULT_LATENCY_OFFSETS`.
- **Dynamic Offset Calibration:**
  - Extended `LatencyManager` with `onOffsetsChange` subscription.
  - Implemented `setVisualCalibrationOffset(16 | 40 | 60)` in `VisualRhythmEngine` and exposed via `useVisualizer`.
  - Added dynamic pending event recalculation in `PriorityEventScheduler.recomputePendingTimestamps()`.
  - Dynamically recalculates `event.scheduledTimestampMs` for un-dispatched cues in the priority queue and re-sorts without seeking, without restarting audio, without advancing `timelineRevision`, and without duplicating previously dispatched cues.
- **Diagnostic Software Telemetry:**
  - Added `VisualSyncTelemetryRecord` capturing: event ID, musical role, selected offset lead (16/40/60ms), target timestamp, scheduled timestamp, scheduler dispatch timestamp, `onVisualCue` arrival timestamp, animation initiation timestamp, dispatch latency, setup latency, and timeline revision.
  - Telemetry ring buffer capped at 20 entries in `VisualRhythmEngine` with subscription support.
- **Developer Calibration UI:**
  - Integrated unobtrusive calibration pills (`[16ms (Default)]`, `[40ms]`, `[60ms]`) and live telemetry readout in `VisualRhythmSurface.tsx`.
  - Seamlessly switchable during live playback on physical devices.

#### 3. Automated Verification & Metrics
- Expanded `scripts/test-visual-engine.js` from 13 to 15 tests:
  - Test 14: Dynamic visual calibration switching (16ms, 40ms, 60ms) and pending cue recomputation without timeline revision change or audio restart.
  - Test 15: Visual sync telemetry recording, animation initiation ingestion, and buffer limit.
  - Status: **ALL 15 TESTS PASSED**.
- Entire automated test suite (`npm test`):
  - Audio Engine: **13/13 PASSED**
  - Synchronization & Event Scheduler: **14/14 PASSED**
  - Haptic Engine: **10/10 PASSED**
  - Visual Rhythm Engine: **15/15 PASSED** (up from 13)
  - Synchronized Lyrics Engine: **11/11 PASSED**
  - Total: **63/63 UNIT TESTS PASSED** (all 5 test suites).
- TypeScript strict typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling verification (`npx expo export --platform android`): **PASSED (1,186 modules bundled in 4.3s)**.

---

### Status
Stage A.3: Controlled Visual Latency Lead Calibration is **COMPLETE** and verified. Ready for physical calibration testing on the Redmi A5 device.

---

### Stage A.5: Canonical Rhythm Score Correction — Audio Truth Alignment
**Date:** 2026-11-22

#### 1. Context and Problem
- Stage A.4 engineering audit revealed a critical discrepancy between the canonical rhythm score and the actual audio file `assets/music/vibebridge_demo.wav`.
- The score originally contained **47 cues**, but independent PCM analysis proved that the audio contains only **24 audible percussion/cadence transients**.
- Exactly **23 cues (49%) were ghost cues** scheduled on eighth-note off-beats ($250\text{ms}, 750\text{ms}, 1250\text{ms}\dots$), plus a false "snare roll" ($10750\text{ms}$) and false "accent 2" ($11250\text{ms}$) in Bar 6 where the audio has zero transient attack.
- These ghost cues caused the visual and haptic engines to fire during dead silence, creating the perceptual illusion of being "wildly ahead," while simultaneously interrupting real beat animations mid-flight and causing jerky velocity resets.

#### 2. Architectural Solution
- **Canonical Score Correction (`src/features/rhythm/demoTrackScore.ts`):**
  - Pruned all 23 ghost cues lacking physical audio counterparts.
  - Retained all **24 genuine audible transients**:
    - Bars 1–5: 4 quarter-note beats per bar at 120 BPM (Beat 1: Kick 1, Beat 2: Snare 1, Beat 3: Kick 2, Beat 4: Snare 2).
    - Bar 6: Beat 1 (Kick 1), Beat 2 (Snare 1), Beat 3 (Accent 1), Beat 4 (Final Resolution).
  - Preserved accurate timestamps ($0\text{ms}, 500\text{ms}, 1000\text{ms}\dots 11500\text{ms}$), bar/beat positions, and musical roles.
  - Visual (`getDemoTrackVisualCues`) and haptic (`getDemoTrackHapticCues`) engines continue to consume the single canonical score in lockstep.
- **Immediate Perceptual & Performance Improvements:**
  - Every visual pulse and phone vibration corresponds 1:1 to an audible transient.
  - Event interval expanded from $250\text{ms}$ to $500\text{ms}$. With a $160\text{ms}$ animation envelope, the visualizer settles completely to baseline $340\text{ms}$ before the next beat, completely eliminating mid-decay preemption and velocity discontinuities.
  - Secondary 4/4 Beat Indicator HUD now tracks clean quarter beats (Beats 1, 2, 3, 4) without ghost re-renders.

#### 3. Automated Verification & Metrics
- Updated `scripts/test-visual-engine.js` (Test 10):
  - Verified all 24 retained cues match verified audible transient timestamps.
  - Verified all 23 removed ghost cue IDs do not exist in the canonical score and are never scheduled on visual or haptic channels.
  - Verified 1:1 synchronization between visual and haptic cue schedules (24 cues each, 48 total).
  - Verified beat and bar numbering integrity.
  - Verified playback sequence and pause/resume/seek/stop/replay lifecycles.
- Entire automated test suite (`npm test`):
  - Audio Engine: **13/13 PASSED**
  - Synchronization & Event Scheduler: **14/14 PASSED**
  - Haptic Engine: **10/10 PASSED**
  - Visual Rhythm Engine: **15/15 PASSED**
  - Synchronized Lyrics Engine: **11/11 PASSED**
  - Total: **63/63 UNIT TESTS PASSED** across all 5 engines.
- TypeScript strict typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling verification (`npx expo export --platform android`): **PASSED (1,186 modules bundled in 3.1s)**.

---

### Status
Stage A.5: Canonical Rhythm Score Correction — Audio Truth Alignment is **COMPLETE** and verified. Ready for user review.

---

### Stage A.6: React Rendering Decoupling and Visual Performance Optimization
**Date:** 2026-11-22

#### 1. Context and Problem
- Physical testing on a Redmi A5 (Android 15) exposed jerky, unstable visual rhythm movement despite Stage A direct animation dispatch and Stage A.5 score truth alignment.
- Audit identified the rendering bottleneck:
  - During playback, `visualRhythmEngine.handleVisualEvent()` emitted engine state and telemetry on every cue.
  - In `useVisualizer`, `setVisualState` and `setLatestTelemetry` triggered 2–3 full React component re-renders per visual cue ($4\text{ to }6\text{ Hz}$).
  - In `VisualRhythmSurface.tsx`, the single monolithic component re-rendered its entire tree on every state update.
  - Crucially, `borderWidth: state.visual.borderWidth` (cycling between 1, 2, 3, 4) and `<Text>{state.visual.symbol}</Text>` were bound to React state inside the very `Animated.View` executing native scale transforms.
  - On Android, mutating `borderWidth` and `TextView` content invalidates view geometry and triggers `requestLayout()` calls on the UI thread, causing layout thrashing and dropped animation frames on the RenderThread during active scaling.

#### 2. Architectural Solution
- **Decoupled Memoized Visual Subcomponents (`src/features/visualizer/components/VisualRhythmSurface.tsx`):**
  - **`VisualExpressiveCanvas` (Layer A - Memoized):** Isolated expressive kinetic surface hosting `scaleAnim`, `auraScaleAnim`, `opacityAnim`, and `activeAnimationRef`. Subscribes directly to `onVisualCue` imperatively; completely bypasses React VDOM diffing during playback. Uses fixed `borderWidth: 3` and stable geometry to eliminate Android `requestLayout()` thrashing. Re-renders only on transport transitions (`isPaused`, `isBuffering`, `isRest`, `enabled`, `reducedMotion`), never on beat/bar progression.
  - **`VisualInformationalHUD` (Layer B - Memoized):** Displays the secondary 4/4 beat indicator row (`Beat 1..4`), bar progression badge (`BAR X/6`), and semantic status text. Re-renders on beat progression in its own lightweight tree without touching Layer A animation nodes.
  - **`VisualHeader` (Memoized):** Static brand header and toggles (`ON/MUTED`, `CALM/MOTION`). Never re-renders during playback.
  - **`VisualCalibrationPanel` (Memoized):** Interactive latency lead pills (`16ms`, `40ms`, `60ms`) and software telemetry readout.
- **Controlled Low-Frequency Telemetry Ingestion (`src/features/visualizer/useVisualizer.ts`):**
  - High-frequency software telemetry recording and ring buffering (up to 20 records) remain fully functional in `VisualRhythmEngine`.
  - In `useVisualizer`, telemetry emissions to React state (`setLatestTelemetry`) are throttled using `lastTelemetryTimeRef` to at most once per 1000ms ($\le 1\text{ Hz}$) or on manual calibration pill selection.
- **Native Animation Driver Preservation:**
  - Retained `useNativeDriver: true` across all scale and opacity animation sequences.
  - Clamped scale strictly to `1.0` in reduced-motion mode with non-motion high-contrast opacity pulsing.
  - Clean lifecycle unmount: cancels active animations and unsubscribes imperative cue and state listeners without leaks.

#### 3. Automated Verification & Metrics
- Added Test 16 to `scripts/test-visual-engine.js`:
  - Verified imperative animation callback fires synchronously without requiring state listeners.
  - Verified engine telemetry buffering preserves all records while React telemetry throttling restricts state updates to 1 pass across high-frequency cue bursts.
  - Verified HUD state consistency (bar, beat, role, label, rest/pause/buffer).
  - Verified reduced-motion mode locks scale to 1.0 while allowing opacity pulse.
  - Verified complete listener cleanup on unmount with zero leaks or duplicate dispatches.
  - Status: **ALL 16 TESTS PASSED**.
- Entire automated test suite (`npm test`):
  - Audio Engine: **13/13 PASSED**
  - Synchronization & Event Scheduler: **14/14 PASSED**
  - Haptic Engine: **10/10 PASSED**
  - Visual Rhythm Engine: **16/16 PASSED** (up from 15)
  - Synchronized Lyrics Engine: **11/11 PASSED**
  - Total: **64/64 UNIT TESTS PASSED** across all 5 engines.
- TypeScript strict typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling verification (`npx expo export --platform android --no-bytecode`): **PASSED (1,186 modules bundled in 4.4s)**.

---

### Status
Stage A.6: React Rendering Decoupling and Visual Performance Optimization is **COMPLETE** and verified. Ready for user review.

---

### Stage A.7.1: MasterClock and Scheduler Hardening
**Date:** 2026-11-22

#### 1. Context and Problem
- The Stage A.7 engineering audit identified a potential temporal instability in `MasterClock`: during continuous forward playback, if native ExoPlayer ticks arrived with timestamps slightly behind JavaScript forward extrapolation, `getEstimatedPositionMs()` could jump backwards by 5–20ms.
- In `PriorityEventScheduler`, minor timer jitter or sub-millisecond roundoff could cause an event due at `1000ms` (e.g. evaluating at `998ms` when the staged timeout fires) to be deferred until the next 20ms polling interval, causing an artificial 18ms dispatch latency spike.
- Stage A.7.1 hardened the temporal foundation across `ExpoAudioEngine` and `PriorityEventScheduler` before implementing continuous visual animation.

#### 2. Architectural Solution
- **Monotonic Forward Progression Clamp (`src/engines/audio/ExpoAudioEngine.ts`):**
  - Added `lastEstimatedPositionMs` and `monotonicRevision` tracking to `ExpoAudioEngine`.
  - During uninterrupted forward playback (`status === 'playing'` and `rate > 0`), `getEstimatedPositionMs()` enforces non-decreasing values:
    $$\text{estimatedPositionMs} = \min(\max(\text{lastEstimatedPositionMs}, \text{clampedProjectedMs}), \text{durationMs})$$
  - Handled all timeline discontinuities cleanly:
    - **Backward Seek:** Immediately resets `monotonicRevision = this.timelineRevision` and establishes `lastEstimatedPositionMs = clampedMs`. No sticky floor.
    - **Forward Seek:** Immediately updates `lastEstimatedPositionMs = clampedMs` and revision.
    - **Track Replacement (`load`):** Resets clock state, revision, and monotonic floor to 0ms.
    - **Stop:** Resets floor to 0ms and advances timeline revision.
    - **Pause:** Freezes estimated position at current value.
    - **Resume:** Re-anchors clock at paused position with zero artificial time jump.
    - **Buffering:** Freezes estimation during buffering; re-anchors to native position when buffering clears.
    - **Playback Rate Change:** Re-anchors extrapolation anchor to current native position and updates velocity without jump.
- **Scheduler Due-Event Tolerance (`src/engines/event-scheduler/PriorityEventScheduler.ts`):**
  - Defined `DUE_EVENT_TOLERANCE_MS = 3` (imperceptible to human senses, $<1/5$th of a 60Hz display frame).
  - In `tick()`, events dispatch when:
    $$\text{event.scheduledTimestampMs} \le \text{currentPosition} + \text{dueEventToleranceMs}$$
  - Absorbs minor sub-frame timer jitter, completely eliminating the 20ms polling deferral.
  - In `scheduleNextStagedTimer()`, computes `timeRemainingMs = nextEvent.scheduledTimestampMs - (currentPosition + dueEventToleranceMs)` to wake up exactly when due.
  - Single code path in `tick()` enforces identical timing rules across both polling and staged-timer paths.

#### 3. Automated Verification & Metrics
- Expanded `scripts/test-audio-engine.js` from 13 to 16 tests:
  - Test 14: Monotonic forward progression & delayed native update resilience.
  - Test 15: Timeline discontinuities: backward seek, forward seek & track replacement.
  - Test 16: Pause & resume continuous re-anchoring without artificial time jump.
  - Status: **ALL 16 TESTS PASSED**.
- Expanded `scripts/test-synchronization.js` from 14 to 16 tests:
  - Test 15: Due-event dispatch tolerance (3ms) and sub-frame precision.
  - Test 16: Competing timer paths and staged timeout race safety.
  - Status: **ALL 16 TESTS PASSED**.
- Entire automated test suite (`npm test`):
  - Audio Engine: **16/16 PASSED** (up from 13)
  - Synchronization & Event Scheduler: **16/16 PASSED** (up from 14)
  - Haptic Engine: **10/10 PASSED**
  - Visual Rhythm Engine: **16/16 PASSED**
  - Synchronized Lyrics Engine: **11/11 PASSED**
  - Total: **69/69 UNIT TESTS PASSED** across all 5 engines.
- TypeScript strict typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling verification (`npx expo export --platform android --no-bytecode`): **PASSED (1,186 modules bundled in 5.4s)**.

---

### Status
Stage A.7.1: MasterClock and Scheduler Hardening is **COMPLETE** and verified. Ready for user review.

---

### Stage A.7.1.2: Visual Animation Lifecycle Correction
**Date:** 2026-11-22

#### 1. Context and Problem
- Physical testing on a Redmi Android 15 device confirmed rock-solid transport and consistent haptics, but noted that 1–2 visual beats were still missed during playback.
- A read-only investigation traced the defect to two animation lifecycle issues:
  1. **Beat 1 Cancellation:** On playback start, `VisualRhythmEngine` emitted `isPaused: false` while leaving `isRest: true`. When Beat 1 (`b1-1` at 0ms) initiated, a subsequent React render with `isRest: true` caused `VisualExpressiveCanvas`'s settling effect to abort the animation mid-flight via `activeAnimationRef.current.stop()`.
  2. **Final Resolution Truncation:** Bar 6 Beat 4 (`b6-4` at 11500ms) has a 300ms envelope (40ms attack + 260ms decay), active through 11784ms (11800ms audio time). `VisualRhythmEngine` prematurely triggered `isRest = true` at `positionMs >= 11600` (116ms into the beat), aborting the animation 184ms early.
  3. **Settling Effect Conflation:** `VisualExpressiveCanvas` conflated genuine transport interruptions (mute, pause, buffering) with active musical rests (`isRest`), stopping active animations whenever `isRest` was present.

#### 2. Architectural Solution
- **Active Groove Establishment (`src/engines/visual/VisualRhythmEngine.ts`):**
  - When `status === 'playing'`, immediately set `isPaused: false` AND `isRest: false`.
  - When stopped or idle, clear `activeCue: null`.
- **300ms Resolution Envelope Protection (`src/engines/visual/VisualRhythmEngine.ts`):**
  - Updated musical rest transition threshold from `positionMs >= 11600` to `positionMs >= 11800`, ensuring the entire 300ms envelope completes naturally before resting state begins.
- **Settling Effect Conflation Elimination (`src/features/visualizer/components/VisualRhythmSurface.tsx`):**
  - Transport interruptions (mute, pause, buffering) continue to forcibly stop active animations and settle to baseline 1.0.
  - Active musical rest (`isRest` while actively playing) now only settles if `!activeAnimationRef.current`. Never cancels an active cue animation mid-flight.

#### 3. Automated Verification & Metrics
- Updated Test 6 in `scripts/test-visual-engine.js` to verify resolution active at 11600ms and resting at 11800ms.
- Added Test 17: First-beat lifecycle, active groove establishment, and stale resting state immunity.
- Added Test 18: Final-resolution 300ms envelope, post-resolution musical rest (11800ms), and transport interrupt safety.
- Entire automated test suite (`npm test`):
  - Audio Engine: **16/16 PASSED**
  - Synchronization & Event Scheduler: **16/16 PASSED**
  - Haptic Engine: **10/10 PASSED**
  - Visual Rhythm Engine: **18/18 PASSED** (up from 16)
  - Synchronized Lyrics Engine: **11/11 PASSED**
  - Total: **71/71 UNIT TESTS PASSED** across all 5 engines.
- TypeScript strict typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling verification (`npx expo export --platform android --no-bytecode`): **PASSED (1,186 modules bundled in 4.5s)**.

---

### Status
Stage A.7.1.2: Visual Animation Lifecycle Correction is **COMPLETE** and verified. Ready for user review.

---

### Stage A.7.2: Hybrid Continuous Motion Architecture (Stages A.7.2.1 & A.7.2.2)
**Date:** 2026-11-22

#### 1. Context and Problem
- Physical testing on a Redmi A5 (MediaTek Helio G36, 60Hz display) identified the **Dead-Zone Problem**: discrete visual pulses with 135–160ms envelopes left the visual surface motionless for 340–365ms ($> 70\%$ of active playback time between 500ms beats at 120 BPM).
- Snare backbeat attacks of 25ms spanned only 1.5 frames on 60Hz displays, making them visually subliminal.
- Stopping animations abruptly on incoming beats produced visible inflection kinks.

#### 2. Architectural Solution
- **Stage A.7.2.1: Engine Contracts & Analytical Energy Model:**
  - Extended `VisualCueAnimationPayload` with 3-layer motion parameters:
    - Layer 1 (Core): `targetScaleX`, `targetScaleY` for directional deformation.
    - Layer 2 (Energy Field): `targetFieldScale`, `targetFieldOpacity`, `energyAccumulator`.
    - Layer 3 (Ripple): `triggerRipple`, `targetRippleScale`, `targetRippleOpacity`, `rippleDurationMs`.
  - Implemented analytical scalar energy accumulator in `VisualRhythmEngine` evaluated at each cue arrival using track audio timestamps (`event.targetTimestampMs`):
    $$E(t_k) = \min\left(1.0, \, E_{rest} + (E(t_{k-1}) - E_{rest}) \cdot e^{-\lambda \Delta t} + \Delta E_k\right)$$
    with $E_{rest} = 0.05$ and $\lambda = 2.5\text{ s}^{-1}$.
  - Reconciled exact ambient floor targets: resting baseline at $E = E_{rest}$ produces scale 1.05 and opacity 0.25; peak at $E = 1.00$ produces scale 1.40 and opacity 0.75.
  - Implemented transport lifecycle policies: pause preserves energy state; seek and stop reset energy to $E_{rest} = 0.05$ and coordinate with timeline revision changes.
- **Stage A.7.2.2: Native Layered Motion Canvas Implementation (`VisualRhythmSurface.tsx`):**
  - Refactored `VisualExpressiveCanvas` to manage seven persistent native animated values via `useRef`:
    - `coreScaleX` (1.0), `coreScaleY` (1.0), `coreOpacity` (0.35).
    - `fieldScale` (1.05), `fieldOpacity` (0.25).
    - `rippleScale` (1.0), `rippleOpacity` (0.0).
  - Layer 1 (Core Node): Executes directional deformation with quad easing (kick horizontal squash $1.35 \times 1.25$, snare vertical snap $1.15 \times 1.30$, accent burst $1.45 \times 1.45$).
  - Layer 2 (Energy Field): Executes continuous ambient breathing by ramping up over 50ms and decaying over 450ms toward the ambient floor (scale 1.05, opacity 0.25), smoothly bridging the 500ms beat grid.
  - Layer 3 (Ripple): Triggered strictly on major accents (`b6-3`) and resolution (`b6-4`). Ordinary downbeats and backbeats (`triggerRipple === false`) never stop, restart, or interfere with active ripples.
  - Multi-modal accessibility: Reduced-motion mode locks all kinetic scales strictly to 1.0 while preserving opacity rhythms, glyphs, and high-contrast indicators.

#### 3. Automated Verification & Metrics
- Added Tests 19 to 24 in `scripts/test-visual-engine.js`:
  - Test 19: Reconciled ambient floor and exponential energy decay.
  - Test 20: Directional deformation geometry for kick, snare, and accents.
  - Test 21: Three-layer payload generation and numerical bounds across all 24 canonical events.
  - Test 22: Ripple trigger policy (strictly triggered for `b6-3` and `b6-4`).
  - Test 23: Complete transport lifecycle and energy state preservation across pause, resume, seek, and stop.
  - Test 24: Reduced-motion mode invariants.
- Entire automated test suite (`npm test`):
  - Audio Clock Engine: **16/16 PASSED**
  - Synchronization & Event Scheduler: **16/16 PASSED**
  - Haptic Engine: **10/10 PASSED**
  - Visual Rhythm Engine: **24/24 PASSED** (up from 18)
  - Synchronized Lyrics Engine: **11/11 PASSED**
  - Total: **77/77 UNIT TESTS PASSED** across all 5 engines.
- TypeScript strict typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling verification (`npx expo export --platform android --no-bytecode`): **PASSED (1,186 modules bundled in 4.7s)**.

---

### Status
Stage A.7.2.2: Native Layered Motion Canvas Implementation is **COMPLETE** and verified. Ready for user review.

---

### Stage A.7.2.3.7: Startup Lifecycle Correction — Implementation
**Date:** 2026-11-22

#### 1. Context and Problem
- Physical testing of Stage A.7.2.2 on the Redmi Android device revealed an initial playback transition defect: "Every time Play is pressed, the first part of the music begins, then there is one small lag or jump, after which playback and visual synchronization continue smoothly for the rest of the track."
- Investigation (Stages A.7.2.3.1 – A.7.2.3.6) established:
  - In `ExpoAudioEngine.play()`, calling `this.updateStatus('playing')` prematurely advanced JavaScript's extrapolated clock for 50–150ms before native Android audio buffers (ExoPlayer/AudioTrack) began outputting sound.
  - When the first native `playbackStatusUpdate` arrived reporting `currentTime = 0.0s`, the JS clock experienced a sudden backward step or re-anchoring jump.
  - Furthermore, rapid transport toggling (Play → Pause → Play) could cause unversioned delayed status callbacks from previous attempts to falsely confirm newer playback attempts.

#### 2. Architectural Solution
- **`ExpoAudioEngine` (`src/engines/audio/ExpoAudioEngine.ts`):**
  - Added `currentSource: AudioSourceInput | null`, `isAwaitingNativeStart: boolean`, `currentPlaybackAttemptId: number`, and `startupTimeoutHandle: ReturnType<typeof setTimeout> | null`.
  - In `load()`: retained `this.currentSource = source`.
  - In `play()`: flag `isAwaitingNativeStart = true` and arm 3000ms safety timeout via `armStartupTimeout()`. Defer `updateStatus('playing')` until genuine native confirmation arrives.
  - In `getEstimatedPositionMs()`: freeze position at `this.clock.positionMs` without forward extrapolation while `isAwaitingNativeStart === true`.
  - In `pause()`, `stop()`, and `seek()`: if startup cancellation occurs (`isAwaitingNativeStart === true`), immediately dispose of the unconfirmed native player (`cleanupPlayer()`) and reset `isAwaitingNativeStart = false`. On subsequent play/seek, instantiate a fresh player via `recreatePlayer()` with preserved source, seek position, and metadata.
  - In `handleNativeStatusUpdate()`: enforce callback isolation by strictly discarding updates where `status.id !== this.player?.id`. Transition master clock status to `'playing'` and anchor clock upon first confirmed playing tick.
  - Normal mid-track pause and resume retain the existing player instance without recreation.
- **`PriorityEventScheduler` (`src/engines/event-scheduler/PriorityEventScheduler.ts`):**
  - In `start()`: execute an immediate `this.tick()` upon starting to eliminate up to 20ms of polling interval latency for opening boundary events.
  - In `tick()` and `scheduleBatch()`: implemented bounded opening boundary kick exception ($T=0\text{ms}$ opening cue `b1-1` preserved when $0\text{ms} \le \text{currentPos} \le 100\text{ms}$; dropped if first confirmation arrives > 100ms; never replayed after seeking to 2000ms).
- **Automated Verification Suites:**
  - Extended `scripts/test-audio-engine.js` with Tests 17–27 covering asynchronous startup delay (100ms), startup abort via pause/stop/seek, player recreation, stale callback rejection from disposed players, rapid play/pause cycling, startup timeout, and normal mid-track pause/resume. (All 27 passed).
  - Extended `scripts/test-synchronization.js` with Tests 17–18 verifying bounded boundary kick exception across 0, 10, 35, 80, 150ms delays and post-seek rejection, as well as immediate tick execution on `start()`. (All 18 passed).
  - Updated `scripts/test-visual-engine.js` Test 10 with start dispatch tracking to account for immediate tick on scheduler start. (All 24 passed).

#### 3. Automated Verification & Metrics
- Entire automated test suite (`npm test`):
  - Audio Clock Engine: **27/27 PASSED** (up from 16)
  - Synchronization & Event Scheduler: **18/18 PASSED** (up from 16)
  - Haptic Engine: **10/10 PASSED**
  - Visual Rhythm Engine: **24/24 PASSED**
  - Synchronized Lyrics Engine: **11/11 PASSED**
  - Total: **90/90 UNIT TESTS PASSED** across all 5 engines.
- TypeScript strict typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling verification (`npx expo export --platform android --no-bytecode`): **PASSED (1,186 modules bundled in 5.8s)**.

---

### Status
Stage A.7.2.3.7: Startup Lifecycle Correction is **COMPLETE** and verified. Ready for physical testing on Redmi Android device.

---

### Stage A.7.2.3.10: Seek Lifecycle and Landing Synchronization Correction
**Date:** 2026-11-22

#### 1. Context and Problem
- Physical testing on a Redmi Android device revealed an asymmetry in seeking:
  - Forward seeking (e.g. from 4s to 8s) worked reliably.
  - Backward seeking (e.g. from 8s to 3s) caused visual animations to take noticeable time to respond, even though audio seeking occurred immediately.
- Investigations (Stages A.7.2.3.8 & A.7.2.3.9) identified four converging causes:
  1. **Pre-Seek Native Callback Clock Poisoning:** In `ExpoAudioEngine`, after issuing a backward seek (e.g. 8000ms to 3000ms), in-flight native status updates from the pre-seek position (e.g. 7950ms) arrived. Because `isSeekingNative` had completed, these updates overwrote `clock.positionMs = 7950`, and `getEstimatedPositionMs()` latched into `lastEstimatedPositionMs` via `Math.max()`, locking the monotonic clock at ~8000ms for 5 seconds until real audio caught up.
  2. **Seek Landing Boundary Cue Dropping:** With a 60ms visual lead, a visual cue at the seek landing point (e.g. 3000ms) has a compensated trigger timestamp of $3000 - 60 = 2940\text{ms}$. When seeking to 3000ms, the scheduler evaluated $2940 < 3000 - 50 = 2950\text{ms}$ and dropped the cue as stale.
  3. **React useEffect Rescheduling Latency:** In `NowPlayingCard.tsx`, sensory cues were rescheduled inside an asynchronous React passive `useEffect([timelineRevision])`, introducing a 50–150ms delay before the scheduler queue was populated.
  4. **Competing Running Settle Animation:** In `VisualRhythmSurface.tsx`, transport changes initiated a 150ms `settleAnim` returning values to baseline. When incoming visual cues arrived, the running settle animation was not cancelled, competing with and dampening the cue animation.

#### 2. Architectural Solution
- **`ExpoAudioEngine` (`src/engines/audio/ExpoAudioEngine.ts`):**
  - Added seek isolation state: `activeSeekTargetMs: number | null`, `activeSeekRevision: number`, `seekSafetyTimeoutHandle: ReturnType<typeof setTimeout> | null`, `SEEK_CONFIRMATION_WINDOW_MS = 250`, `SEEK_SAFETY_TIMEOUT_MS = 1500`.
  - In `seek()`: suspend forward monotonic floor (`monotonicRevision = 0`), set `activeSeekTargetMs = clampedMs`, and arm 1500ms safety timeout.
  - In `getEstimatedPositionMs()`: return exact seek target position without extrapolation while `activeSeekTargetMs !== null`.
  - In `handleNativeStatusUpdate()`: while `activeSeekTargetMs !== null`, any status update with $|posMs - activeSeekTargetMs| > 250\text{ms}$ is discarded as a stale pre-seek update. When an update arrives within 250ms, native seek is confirmed: `activeSeekTargetMs` is cleared, safety timeout cancelled, clock re-anchored, and forward monotonic floor reactivated (`monotonicRevision = clock.timelineRevision`).
  - In `pause()`, `stop()`, `unload()`, `cleanupPlayer()`: clear seek safety timeout and set `activeSeekTargetMs = null`.
- **`PriorityEventScheduler` (`src/engines/event-scheduler/PriorityEventScheduler.ts`):**
  - Added `ScoreProvider` type export and declared `setScoreProvider(provider: ScoreProvider | null)` on `IEventScheduler`.
  - In `handleRevisionChange(newRevision)`: immediately invoke `this.scoreProvider(this, newRevision)` synchronously upon revision changes, populating new cues with 0ms delay.
  - In `scheduleBatch()` and `tick()`: implemented Seek Landing Boundary Exception ($|currentPos - targetTimestampMs| \le 60\text{ms}$). Preserves and dispatches landing cues immediately on the landing tick while keeping genuinely expired cues ($> 60\text{ms}$) dropped.
- **`NowPlayingCard` (`src/features/playback/components/NowPlayingCard.tsx`):**
  - Registered synchronous score provider with `eventScheduler` on mount:
    `eventScheduler.setScoreProvider((scheduler, rev) => { hapticEngine.reset(); scheduleDemoTrackSensoryCues(scheduler, rev); })`.
  - Removed passive `useEffect([timelineRevision])` rescheduling, eliminating 50–150ms delay.
- **`VisualRhythmSurface` (`src/features/visualizer/components/VisualRhythmSurface.tsx`):**
  - Added `activeSettleAnimRef` tracking the running settle animation.
  - In `onVisualCue`: immediately cancel any running settle animation (`activeSettleAnimRef.current.stop()`) when an incoming visual cue arrives.
  - Cleaned up on unmount and transition.
- **Automated Verification Suites:**
  - Extended `scripts/test-audio-engine.js` with Tests 28–30 (stale pre-seek callback rejection, native seek confirmation & floor reactivation, 1500ms safety timeout). (All 30 passed).
  - Extended `scripts/test-synchronization.js` with Tests 19–21 (seek landing boundary exception, stale cue rejection beyond 60ms, synchronous score provider). (All 21 passed).
  - Extended `scripts/test-visual-engine.js` with Test 25 (backward seek visual recovery, immediate landing cue delivery, clean energy reset). (All 25 passed).

#### 3. Automated Verification & Metrics
- Entire automated test suite (`npm test`):
  - Audio Clock Engine: **30/30 PASSED** (up from 27)
  - Synchronization & Event Scheduler: **21/21 PASSED** (up from 18)
  - Haptic Engine: **10/10 PASSED**
  - Visual Rhythm Engine: **25/25 PASSED** (up from 24)
  - Synchronized Lyrics Engine: **11/11 PASSED**
  - Total: **97/97 UNIT TESTS PASSED** across all 5 engines.
- TypeScript strict typecheck (`npm run typecheck`): **PASSED (0 errors)**.
- Android bundling verification (`npx expo export --platform android --no-bytecode`): **PASSED (1,186 modules bundled in 10.7s)**.

---

### Status
Stage A.7.2.3.10: Seek Lifecycle and Landing Synchronization Correction is **COMPLETE** and verified. Ready for physical testing on Redmi Android device.

---

### Stage A.7.2.3.10: Physical Device Validation
**Date:** 2026-11-22

#### 1. User-Confirmed Physical Tests (Redmi Android Device)
Physical testing of the Stage A.7.2.3.10 seek lifecycle and landing synchronization correction was conducted and confirmed on a physical Redmi Android device across five scenarios:

1. Backward seek: 8s → 3s — PASS.
2. Forward seek: 4s → 8s — PASS.
3. Paused seek: 6s → 3s → resume — PASS.
4. Rapid alternating seeks — PASS.
5. Small seek adjustments — PASS.

---

### Status
Stage A.7.2.3.10: Physical Device Validation is **COMPLETE** (all 5 scenarios user-confirmed). Ready for final pre-commit review.
