# Architecture Decision Records (ADR)

## Project: VibeBridge
**Status:** Approved for Phase 2, Milestone 1  

---

### ADR-001: React Native + Expo Managed Workflow

- **Status:** Accepted
- **Context:** VibeBridge requires high velocity, cross-platform capabilities, and seamless native hardware integration (audio, haptics, display refresh) for an installable Android APK to be showcased at CIMFEST.
- **Decision:** Use React Native with the Expo Managed Workflow (SDK 58).
- **Consequences:** We leverage Expo's modern tooling, prebuild capabilities, config plugins, and managed updates without maintaining fragile manual Gradle/Android Studio build scripts. If low-level native code is needed, `npx expo prebuild` provides a seamless escape hatch.

---

### ADR-002: Expo Router for Application Navigation

- **Status:** Accepted
- **Context:** The app requires clean, maintainable navigation with deep linking, modal sheets (player controls), and screen transitions.
- **Decision:** Use Expo Router (file-based navigation matching Next.js paradigms).
- **Consequences:** Centralizes routes in `app/`, enforces type-safe routing, automatically configures linking schemes (`vibebridge://`), and simplifies the component hierarchy.

---

### ADR-003: EAS Build for Android APK Generation

- **Status:** Accepted
- **Context:** CIMFEST attendees and judges need to test the app directly on Android physical devices without requiring Expo Go or development servers.
- **Decision:** Configure `eas.json` with `"android": { "buildType": "apk" }` in both `preview` and `production` profiles.
- **Consequences:** Standalone `.apk` files can be generated on demand and sideloaded directly onto target devices. Google Play Store bundle (`.aab`) requirements do not block physical demonstration.

---

### ADR-004: Expo Audio for Initial Music Playback

- **Status:** Accepted
- **Context:** We need a stable audio playback engine capable of loading local files, streaming, and reporting precise playback timestamps for multi-sensory synchronization.
- **Decision:** Use Expo Audio as the initial playback engine wrapped behind an abstracted `AudioEngine` interface.
- **Consequences:** Keeps initial dependencies standard and Expo-compatible. The abstracted interface ensures that if advanced low-level audio analysis (e.g., FFT frequency extraction or native C++ audio players) is required in later milestones, the presentation and synchronization layers remain unchanged.

---

### ADR-005: Expo Haptics with Native Vibration Escape Hatch

- **Status:** Accepted
- **Context:** The FEEL pillar requires beat-synchronized tactile feedback through the phone's vibration motor.
- **Decision:** Implement the initial FEEL channel with Expo Haptics, structured behind an abstracted `HapticEngine` interface.
- **Consequences:** Provides immediate cross-device vibration capability. If physical testing on target Android phones reveals that predefined haptic feedback lacks amplitude nuances or sustained rumble control, we can drop in a custom native Android module (`android.os.Vibrator` / `VibrationEffect`) with zero friction.

---

### ADR-006: React Native Reanimated as Core Animation Engine

- **Status:** Accepted
- **Context:** The SEE pillar requires 60fps/120fps visual representations of rhythm and intensity that do not stutter when the JavaScript thread is processing lyrics or state changes.
- **Decision:** Use React Native Reanimated. Reserve React Native Skia only when custom GPU shader rendering is strictly required.
- **Consequences:** Animations execute directly on the UI thread without crossing the JS bridge. Eliminates unnecessary bundle weight until advanced shaders are proven necessary.

---

### ADR-007: Local-First Storage Architecture & Deferral of Supabase Auth

- **Status:** Accepted
- **Context:** CIMFEST venue connectivity may be spotty or offline, and requiring user signup introduces unnecessary friction during judging and testing.
- **Decision:** Adopt an offline-first architecture using local device storage for music and metadata. Defer Supabase Auth and Supabase PostgreSQL to post-CIMFEST milestones.
- **Consequences:** Zero network dependency for core application functions (READ, SEE, FEEL). Supabase integration boundary is documented and reserved in `src/services/supabase/` without installing unneeded packages now.

---

### ADR-008: Strict Separation of Engine, Service, and Feature Layers

- **Status:** Accepted
- **Context:** Multi-sensory music synchronization is prone to spaghetti code when UI components manage timers, hardware drivers, and playback states directly.
- **Decision:** Enforce four decoupled layers: Presentation (`app/`, `src/features/`), State/Hooks (`src/store/`, `src/hooks/`), Engines (`src/engines/`), and Services (`src/services/`).
- **Consequences:** High testability, zero tight coupling to hardware APIs, and clear boundaries for future team scaling.

---

### ADR-009: Master Clock and Look-Ahead Event Scheduling Architecture

- **Status:** Accepted
- **Context:** Deaf and hard-of-hearing music translation requires synchronizing three distinct sensory channels (READ lyrics, SEE rhythm visuals, FEEL tactile vibrations). Running separate JavaScript interval timers for each channel creates phase drift, thread contention, and desynchronization.
- **Decision:**
  1. Use the AudioEngine's native hardware playback position as the single authoritative master clock.
  2. Implement a single controlled scheduling loop in `PriorityEventScheduler` with a configurable look-ahead window (default: 80ms) and sorted chronological queue.
  3. Track `timelineRevision` to instantly invalidate obsolete cues upon seek or track changes.
  4. Provide safe forward estimation (`getEstimatedPositionMs`) without mutating native position.
- **Consequences:** All sensory systems consume a unified timeline. Eliminates duplicate timers, guarantees chronological event dispatch, and cleanly decouples output drivers from the scheduler.

---

### ADR-010: Latency Compensation Model and Sign Convention

- **Status:** Accepted
- **Context:** Different output channels exhibit asymmetric physical latencies: Android ERM/LRA vibration motors require 15–30ms to accelerate to peak amplitude, 60Hz/120Hz displays compose frames across 8–16ms, and Bluetooth audio sinks introduce 80–200ms transport delays.
- **Decision:**
  Adopt a unified latency compensation formula:
  $$\text{leadTimeMs} = \text{channelOffsetMs} - \text{audioOffsetMs}$$
  $$\text{triggerTimestampMs} = \max(0, \text{targetTimestampMs} - \text{leadTimeMs})$$
  Where a positive offset ($+L$) represents the hardware delay from electrical trigger to physical perception.
- **Consequences:** Allows deterministic, channel-specific early triggering (e.g. firing haptics 25ms ahead so physical impact aligns with acoustic perception) and dynamic adjustment when Bluetooth headphones are connected. Eliminates hardcoded hardware assumptions.
