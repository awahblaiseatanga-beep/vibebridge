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
Phase 2, Milestone 6 is **COMPLETED**. Proposed commit ready for user review and authorization.
