# Technical Architecture Document

## Project: VibeBridge
**Document Version:** 1.0.0  
**Status:** Approved for Phase 2, Milestone 1  

---

## 1. Architecture Overview

VibeBridge is built as a multi-sensory translation architecture using React Native and Expo. The core engineering challenge is achieving tight real-time synchronization between three distinct output pipelines (audio playback, screen rendering, and hardware vibration).

To ensure high maintainability, testability, and non-blocking performance, the system is partitioned into four decoupled layers:

```
┌────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                   │
│   Expo Router (app/)  •  Features (src/features/)      │
│   Accessible UI Primitives (src/components/common/)     │
└───────────────────────────▲────────────────────────────┘
                            │ State & React Hooks
┌───────────────────────────┴────────────────────────────┐
│                      STATE LAYER                       │
│    Application Store (src/store/) • Hooks (src/hooks/) │
└───────────────────────────▲────────────────────────────┘
                            │ Domain Calls & Events
┌───────────────────────────┴────────────────────────────┐
│                     ENGINE LAYER                       │
│  ┌───────────────┐  ┌────────────────────────────────┐ │
│  │ Audio Engine  │──►│ Synchronization Master Clock  │ │
│  └───────────────┘  └───────────────┬────────────────┘ │
│                                     │                  │
│                      ┌──────────────▼──────────────┐   │
│                      │   Look-Ahead Event Scheduler│   │
│                      └──────┬───────────────┬──────┘   │
│                             │               │          │
│            ┌────────────────▼─┐   ┌─────────▼────────┐ │
│            │  Haptic Engine   │   │  Visual Engine   │ │
│            │  (Expo Haptics)  │   │   (Reanimated)   │ │
│            └──────────────────┘   └──────────────────┘ │
│            ┌─────────────────────────────────────────┐ │
│            │              Lyrics Engine              │ │
│            └─────────────────────────────────────────┘ │
└───────────────────────────▲────────────────────────────┘
                            │ Persistence & IO
┌───────────────────────────┴────────────────────────────┐
│                    SERVICE LAYER                       │
│  StorageService • FileImportService • TrackService     │
│  SupabaseService (Reserved/Deferred)                   │
└────────────────────────────────────────────────────────┘
```

---

## 2. Layer Responsibilities & Contracts

### 2.1 Presentation Layer (`app/`, `src/features/`, `src/components/common/`)
- **`app/`**: File-based routing managed by Expo Router. Contains route definitions (`_layout.tsx`, `index.tsx`, etc.). Minimal business logic; acts as entry points.
- **`src/features/`**: Feature-specific UI, hooks, and sub-components organized by domain:
  - `playback/`: Transport controls, seek bar, timecode indicators.
  - `library/`: Track browsing, sorting, search, and import actions.
  - `lyrics/`: Real-time scrolling and karaoke line highlighting.
  - `visualizer/`: Rhythm canvas and reactive animations.
  - `haptics/`: Tactile intensity sliders and pattern toggles.
  - `settings/`: Sensory toggles and accessibility configurations.
- **`src/components/common/`**: Reusable design tokens and accessible UI primitives (`Card`, `SensoryBadge`, high-contrast text wrappers).

### 2.2 Engine Layer (`src/engines/`)
The engine layer handles real-time processing and hardware control, isolated from React component lifecycles.

1. **`AudioEngine`**:
   - Manages playback state machine (`idle`, `loading`, `playing`, `paused`, `stopped`, `error`).
   - Wraps Expo Audio (`androidx.media3.exoplayer.ExoPlayer` on Android) to load bundled assets and local URIs.
   - Provides authoritative playback timestamps (`positionMs`) with high-frequency updates.
   - Anchors monotonic timestamps (`updatedAtMs` via `performance.now()`) for safe forward estimation without mutating native timestamps.
   - Tracks timeline revisions (`timelineRevision`) incremented on track loads and seeks to invalidate downstream scheduled cues.
   - Serializes and coalesces rapid seek requests to eliminate asynchronous race conditions.

2. **`SynchronizationEngine` (MasterClock & LatencyManager)**:
   - Exposes `AudioMasterClock` as the central timing distribution point across all sensory consumers.
   - Provides continuous forward timeline estimation via monotonic clock anchoring (`getEstimatedPositionMs`) without mutating native ExoPlayer timestamps.
   - Manages configurable `LatencyOffsets` (audio, haptic, visual, lyrics) using a standardized lead-time compensation formula:
     $$\text{leadTimeMs} = \text{channelOffsetMs} - \text{audioOffsetMs}$$
     $$\text{triggerTimestampMs} = \max(0, \text{targetTimestampMs} - \text{leadTimeMs})$$
   - Default offsets: `audioOffsetMs: 0ms`, `hapticOffsetMs: 25ms` (motor spin-up), `visualOffsetMs: 16ms` (display frame rasterization), `lyricsOffsetMs: 0ms`.

3. **`EventScheduler` (PriorityEventScheduler)**:
   - Chronological, priority-sorted event queue with binary search insertion ($O(\log n)$).
   - Single controlled scheduling loop (default 20ms interval) with configurable look-ahead window (default 80ms).
   - Automated timeline revision invalidation: instantly drops queued cues from older revisions on seek or track transitions.
   - Duplicate prevention via dispatched event ID tracking.
   - Channel-specific subscriptions (`haptic`, `visual`, `lyrics`) and global event delivery interface.
   - Fully decoupled from UI components and hardware drivers.

4. **`HapticEngine` (ExpoHapticEngine — Completed Milestone 4)**:
   - Dedicated physical tactile actuation engine implementing `IHapticEngine`.
   - Purely reactive consumer: subscribes to `PriorityEventScheduler`'s `'haptic'` channel with zero independent timers.
   - Built on `expo-haptics` with an injectable `HapticDriver` abstraction for deterministic unit testing.
   - Standard tactile pattern vocabulary:
     - `'heavy'`: Downbeats, heavy bass kicks, sub-bass impacts (`ImpactFeedbackStyle.Heavy`).
     - `'medium'`: Backbeats, snares, rimshots (`ImpactFeedbackStyle.Medium`).
     - `'light'`: Hi-hats, subtle rhythm pulses, subdivisions (`ImpactFeedbackStyle.Light`).
     - `'soft'`: Gentle background rhythm cues (`ImpactFeedbackStyle.Soft`).
     - `'rigid'`: Sharp accents, staccato hits (`ImpactFeedbackStyle.Rigid`).
     - `'pulse'`: Notification pulse (`NotificationFeedbackType.Success`).
     - `'double'`: Double click / selection (`selectionAsync`).
     - `'silence'`: Rest / muted beat.
   - **Dynamic Tactile Tier Remapping**: Adapts discrete platform styles to continuous user intensity ($\text{effectiveIntensity} = \text{userIntensity} \times \text{cueWeight}$), dynamically remapping heavy cues to medium/light/soft as intensity decreases. Preset levels (25%, 50%, 75%, 100%) represent logical intensity tiers and do not guarantee corresponding physical vibration amplitude percentages.
   - **Event-Rate Safeguards**: Enforces a strict 40ms minimum interval (`minIntervalMs = 40`) between consecutive vibration triggers to prevent dense bursts. (Software event-rate guard; does not guarantee physical protection against motor overheating or hardware fatigue).
   - Clean interface allows hot-swapping with a custom Android native module (`VibrationEffect` with amplitude control) if hardware testing demands it.

5. **`VisualRhythmEngine` (VisualEngine — Completed Milestone 5)**:
   - Hybrid music visualization engine implementing `IVisualRhythmEngine`.
   - Driven reactively via `PriorityEventScheduler`'s `'visual'` channel with provisional, configurable latency compensation (16ms lead time).
   - **Layer A (Expressive)**: Expanding and pulsating geometric nodes with energy aura rings reacting to musical beat energy. Rendered via React Native `Animated` running on the Android native UI thread (`useNativeDriver: true`) targeting 60 FPS without bridge contention.
   - **Layer B (Informational)**: Secondary 4/4 meter HUD displaying beat indicators (Kick vs Snare), measure progression (`BAR 1/6`), and semantic status.
   - **Non-Color Multi-Modal Accessibility**:
     - *Downbeat (Kick / Beat 1)*: Diamond (`◆`), border width 3–4, scale 1.35x.
     - *Backbeat (Snare / Beats 2 & 4)*: Triangle (`▲`), border width 2–3, scale 1.20x.
     - *Subdivision (Hi-hats / eighth notes)*: Circle (`●`), border width 1–2, scale 1.06x.
     - *Accent (Climax syncopations)*: Accent Burst (`◈`), border width 4–5, scale 1.45x.
     - *Resolution (Final cadence)*: Starburst (`✦`), border width 2–3, scale 1.25x.
     - *Rest (Compositional silence)*: Neutral Line (`—`), border width 1, scale 1.00x.
   - **Accessible Reduced Motion Mode**:
     - Disables kinetic pulsing/scaling animations (scale locked strictly to 1.00).
     - Amplifies high-contrast border weights to preserve visual rhythm perception without motion triggers.
   - **Strict Distinction of Musical Rest vs Transport Lifecycle**:
     - *Musical Rest*: Compositional silence while actively playing (`status: 'playing'`); `isRest: true`.
     - *Transport Pause*: User paused playback; freezes animation and settles to neutral; `isPaused: true`.
     - *Transport Buffering*: Network or storage stall; freezes animation; `isBuffering: true`.
   - **Configurable Animation Scales**:
     - Managed via `VisualScaleConfig` (`DEFAULT_VISUAL_SCALE_CONFIG`) and dynamically overrideable via `setScales()`.
   - **Canonical Shared Rhythm Source (`src/features/rhythm/`)**:
     - 47 cues spanning 6 bars of 4/4 time at 120 BPM in `CANONICAL_DEMO_RHYTHM_SCORE`.
     - Shared single source of truth for both tactile haptics and visual rhythm cues, ensuring 1:1 synchronization without divergence.

6. **`LyricsEngine`**:
   - Fast parser for `.lrc` and JSON lyrics formats.
   - Uses binary search to resolve the active lyric line for any given `positionMs` in $O(\log n)$ time.

### 2.3 Service Layer (`src/services/`)
- **`StorageService`**: Abstracts device persistent storage for user preferences and track library index.
- **`FileImportService`**: Handles file selection through Android Storage Access Framework (SAF) and file integrity checks.
- **`TrackService`**: Manages track metadata, ID3 tag extraction, and track-to-cue associations.
- **`SupabaseService`**: Architectural placeholder for optional cloud synchronization; explicitly deferred until local foundation is rock-solid.

---

## 3. Directory Layout

```
VIBEBRIDGE/
├── app/
│   ├── _layout.tsx
│   └── index.tsx
├── src/
│   ├── components/
│   │   └── common/
│   ├── features/
│   │   ├── playback/
│   │   ├── library/
│   │   ├── lyrics/
│   │   ├── visualizer/
│   │   ├── haptics/
│   │   ├── rhythm/
│   │   └── settings/
│   ├── engines/
│   │   ├── audio/
│   │   ├── synchronization/
│   │   ├── event-scheduler/
│   │   ├── haptic/
│   │   ├── visual/
│   │   └── lyrics/
│   ├── services/
│   │   ├── storage/
│   │   ├── file-import/
│   │   ├── tracks/
│   │   └── supabase/
│   ├── hooks/
│   ├── store/
│   ├── types/
│   ├── constants/
│   ├── theme/
│   └── utils/
├── assets/
│   ├── images/
│   ├── icons/
│   ├── fonts/
│   └── music/
└── docs/
    ├── PRODUCT_REQUIREMENTS.md
    ├── TECHNICAL_ARCHITECTURE.md
    ├── DEVELOPMENT_LOG.md
    └── DECISIONS.md
```

---

## 4. Build & Distribution Architecture (EAS)

The application uses Expo Application Services (EAS Build) with `eas.json` configured for direct APK generation:

```json
{
  "cli": {
    "version": ">= 15.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

- **`development`**: Creates an APK with the Expo Development Client embedded for rapid iterative device testing.
- **`preview`**: Generates a standalone, installable release APK for user testing at CIMFEST without requiring Expo Go or development servers.
- **`production`**: Produces the final optimized APK for distribution.
