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

---

### ADR-011: Haptic Feedback Architecture, Dynamic Tactile Scaling, and Event-Rate Safeguards

- **Status:** Accepted (Milestone 4)
- **Context:** The FEEL sensory pillar requires physical tactile pulses synchronized with musical rhythm. However:
  1. `expo-haptics` provides discrete feedback styles (`Heavy`, `Medium`, `Light`, `Soft`, `Rigid`) rather than arbitrary continuous vibration amplitudes.
  2. Android devices have widely varying motor hardware (Linear Resonant Actuators [LRA] vs Eccentric Rotating Mass [ERM]). LRAs have ~20–30ms spin-up and ~30–40ms decay; ERMs require 50–80ms to accelerate.
  3. Firing haptics at high musical density without event rate limiting blurs discrete beats into an indistinct buzzing drone and increases cognitive tactile adaptation.
- **Decision:**
  1. Wrap `expo-haptics` behind a dedicated `ExpoHapticEngine` implementing `IHapticEngine` with an injectable `HapticDriver` for deterministic automated testing.
  2. Implement **Dynamic Tactile Tier Remapping**: calculate $\text{effectiveIntensity} = \text{userIntensity} \times \text{cueWeight}$, and remap discrete styles dynamically (e.g., Heavy scales down to Medium at 50%, Light at 25%, and Soft at 10%). The 25%, 50%, 75%, and 100% user settings represent **logical intensity levels** mapped to these discrete styles; they do **not** guarantee corresponding physical vibration amplitude percentages across Android devices.
  3. Implement **Event-Rate Safeguard**: enforce a 40ms minimum interval (`minIntervalMs = 40`) between consecutive trigger events to prevent overly dense trigger bursts. (Note: this is an event-rate software safeguard and does not claim to guarantee physical protection against motor overheating or hardware fatigue).
  4. Ensure zero independent timers: `HapticEngine` is a purely reactive subscriber to `PriorityEventScheduler`'s `'haptic'` channel. Outdated cues on seek or pause are handled centrally by the scheduler. Suspend scheduler subscription when disabled and restore without duplication when re-enabled.
- **Consequences:** Provides responsive, accessible tactile feedback with user-adjustable logical intensity. If physical testing on target Android phones requires continuous amplitude waveforms or frequency modulation, the abstracted `HapticDriver` allows drop-in replacement with a custom native Android module (`android.os.Vibrator` / `VibrationEffect.createWaveform`) without touching the UI or scheduler.

---

### ADR-012: Hybrid Visual Rhythm Architecture, Non-Color Accessibility, and Canonical Rhythm Metadata

- **Status:** Accepted (Milestone 5)
- **Context:** The SEE sensory pillar requires real-time visual rhythm translation for Deaf and hard-of-hearing music listeners.
  Key architectural requirements:
  1. **Visual Direction:** A hybrid model combining an expressive visual canvas (Layer A: pulsating, expanding/contracting geometric nodes and energy aura rings responding to beat strength and musical energy) with a secondary informational HUD (Layer B: clear 4/4 meter indicators showing Kick vs Snare, measure counter Bar 1–6, and semantic status).
  2. **Multi-Modal Accessibility:** Visual distinctions must not rely on color alone. Each role is assigned unique geometry (`diamond`, `triangle`, `circle`, `accent-burst`, `starburst`, `line`), unique symbols (`◆`, `▲`, `●`, `◈`, `✦`, `—`), variable border weights, and clear text labels. An accessible **Reduced Motion mode** locks animation scales to 1.0 while amplifying high-contrast borders.
  3. **Separation of Musical Rest vs Transport Lifecycle:** Musical rest is compositional silence within an active track (`status: 'playing'`). It must never be conflated with transport pause (user pauses playback) or transport buffering (I/O or network stall).
  4. **Configurable Animation Scales:** Default animation scales (`strongScale: 1.35`, `mediumScale: 1.20`, `softScale: 1.06`, `accentScale: 1.45`, `resolutionScale: 1.25`, `restScale: 1.00`) are fully configurable through `VisualScaleConfig` rather than fixed hardcoded constants.
  5. **Canonical Shared Rhythm Metadata:** Haptic cues and visual cues are derived from a single canonical score (`CANONICAL_DEMO_RHYTHM_SCORE`) under `src/features/rhythm/`, eliminating divergent timestamps and preserving 100% backward compatibility with Milestone 4 haptics.
  6. **Zero Independent Timers:** Visual updates are strictly reactive subscribers to `PriorityEventScheduler`'s `'visual'` channel and `MasterClock`. Visual latency compensation uses a provisional, configurable 16ms lead time (not claimed as physically validated).
- **Consequences:** Provides responsive, accessible visual rhythm feedback that cleanly coexists with haptics and audio. The expressive visual layer is the primary element on Now Playing, with beat and measure information secondary. Performance achieves 60 FPS on Android native UI thread via React Native `Animated` with `useNativeDriver: true`.

---

### ADR-013: READ Synchronized Lyrics Engine, Clock-Authoritative Resolution, and Strict Metadata Validation

- **Status:** Accepted (Milestone 6)
- **Context:** The READ sensory pillar requires real-time synchronized lyrics rendering for Deaf and hard-of-hearing music listeners.
  Key architectural requirements:
  1. **Clock-Authoritative Active Line Resolution:** Relying solely on asynchronous timer callbacks or JS scheduler event ticks causes lyrics to drift or stay out of sync when the JavaScript thread experiences transient delays or garbage collection pauses. `LyricsEngine` uses binary search ($O(\log n)$) directly against `MasterClock.getEstimatedPositionMs()` to compute the authoritative active line, previous line, and upcoming lines. Boundary events on `PriorityEventScheduler`'s `'lyrics'` channel notify consumers, but the master clock remains the sole source of truth.
  2. **Explicit Transition & Instrumental Gap Handling:** Rather than keeping an outdated lyric highlighted during instrumental periods, `LyricsTimeline` explicitly detects gaps between segments (`status: 'instrumental_gap'`, `'before_lyrics'`, `'after_lyrics'`) and presents an accessible transition state (`"♫ Instrumental Break ♫"`).
  3. **Strict Metadata Validation (No Silent Repairs):** `LyricsValidator` strictly checks segment timestamps (`startMs >= 0`, `endMs > startMs`), strict chronological ordering, non-empty text, matching track associations, and strictly rejects overlapping segments. Invalid metadata is never silently repaired.
  4. **Support for Un-Lyriced Audio (`hasLyrics: false`):** Tracks without lyrics metadata (e.g. purely instrumental audio or user-imported files without `.lrc`) must not break playback, haptics, or visualizer components.
  5. **Demonstration Transparency for Instrumental Stem:** The bundled demo track (`assets/music/vibebridge_demo.wav`) is an instrumental/synthesized rhythm stem. The demonstration lyrics use original demonstrative text illustrating the multi-sensory experience with clear user disclosure: `"Demo Lyrics · Synchronized to 120 BPM Stem"`.
- **Consequences:** Eliminates phase drift and desynchronization. Forward/backward seeking immediately recovers the correct line with zero stale cues. The active line is the primary readable element on Now Playing, accompanied by previous and upcoming line previews.

---

### ADR-014: Event Scheduler Due-Time Dispatch Threshold, Managed Staging Micro-Timer, and Stop Lifecycle Invalidation

- **Status:** Accepted (Stage 1 Corrections)
- **Context:** Physical device testing on Android 15 (Redmi A5) revealed two critical timing and lifecycle bugs in `PriorityEventScheduler` and `ExpoAudioEngine`:
  1. **Premature Event Dispatch:** In `PriorityEventScheduler`, the dispatch condition was previously written as `event.scheduledTimestampMs <= effectiveHorizonMs`, where `effectiveHorizonMs = currentPosition + lookAheadWindowMs` (80ms). This caused events to fire as soon as they entered the lookahead window—60 to 80ms ahead of their intended audio timeline time. When combined with haptic lead time compensation (25ms), haptic feedback was actuated 85 to 105ms prematurely relative to acoustics.
  2. **Replay (Stop $\to$ Play) Cue Starvation:** When audio playback was stopped (`engine.stop()`), `timelineRevision` was not incremented, and the queue was wiped. On subsequent replay from stopped state, `NowPlayingCard` did not re-schedule sensory cues because its cue-scheduling effect depended on `timelineRevision`. Consequently, second and subsequent playbacks ran with an empty cue queue, causing missing sensory cues.
  3. **Polling Discretization Jitter:** Polling the timeline strictly at 20ms intervals without sub-interval dispatch causes up to 20ms of timing jitter for cues falling between polling intervals. Uncontrolled `setTimeout` micro-timers for every queued cue would introduce race conditions, timer leaks, and uncoordinated callbacks across pauses/seeks.
- **Decision:**
  1. **Strict Due-Time Dispatch Threshold:** In `PriorityEventScheduler`, an event is eligible for dispatch if and only if `event.scheduledTimestampMs <= currentPosition`. Lateness tolerance is strictly enforced: cues older than 50ms (`minTimelyTimestamp = currentPosition - 50`) are dropped as stale.
  2. **Single Managed Staging Micro-Timer:** The lookahead window (80ms) is used to inspect upcoming cues (`currentPosition < scheduledTimestampMs <= currentPosition + lookAheadWindowMs`). Instead of firing them immediately or spinning dozens of timers, the scheduler sets a single managed timer (`stagedTimerHandle`) targeting the exact due timestamp of the earliest upcoming cue ($\Delta t = \text{earliestEvent.scheduledTimestampMs} - \text{currentPosition}$). When the timer fires, it calls `tick()`, dispatching the cue at the exact millisecond and staging the next one. This eliminates 0–20ms polling interval jitter while maintaining strict control.
  3. **Timer Lifecycle Cleanup:** `stagedTimerHandle` is strictly cleared whenever `timelineRevision` changes, when playback is paused/stopped/buffered, when the queue is cleared, or when the scheduler is disposed.
  4. **Stop Lifecycle Revision Advancement:** `ExpoAudioEngine.stop()` now increments `timelineRevision++` (guarded against redundant increments if already stopped at position 0). This invalidates any lingering session cues and signals consumers (`NowPlayingCard`) to reload fresh cues, ensuring Stop $\to$ Play replays always run with a full queue.
  5. **Pause $\to$ Resume Continuity:** Pausing freezes the queue, clears the active staging timer, and stops clock estimation. Resuming restarts the polling interval; events remaining in the queue (scheduled for future timestamps) are preserved, and already dispatched cues are not re-fired.
- **Consequences:** Restores exact acoustic-tactile-visual synchronization. Eliminates premature dispatch and timing jitter. Guarantees 100% reliable cue replay on repeated Stop $\to$ Play cycles without memory leaks or race conditions.

---

### ADR-015: Direct Visual Event Animation Dispatch and Critically Damped Envelope Optimization

- **Status:** Accepted (Stage A)
- **Context:** Following Stage 1 synchronization corrections, physical testing on Android 15 (Redmi A5) revealed that visual animations appeared delayed and insufficiently responsive to musical beats. An investigation identified that:
  1. Animations were triggered inside React component `useEffect` following asynchronous state updates (`setVisualState`). On entry-level Android devices, React's reconciliation and commit pass introduced 40ms to 80ms of latency before `Animated.start()` was executed.
  2. The expressive spring animation duration (350ms–450ms) exceeded the 250ms eighth-note subdivision interval at 120 BPM, causing subsequent cues to interrupt active springs mid-flight and leaving the visual node permanently elevated or trembling.
- **Decision:**
  1. **Direct Imperative Animation Dispatch (`onVisualCue`):** Introduce `onVisualCue(listener: VisualCueListener)` in `VisualRhythmEngine` to deliver `VisualCueAnimationPayload` synchronously upon receiving a scheduled visual event. `VisualRhythmSurface` subscribes to this callback and imperatively triggers `Animated.parallel([...]).start()` on native animated values (`scaleAnim`, `auraScaleAnim`, `opacityAnim`), completely bypassing the React render and `useEffect` queue.
  2. **Decoupled Informational State:** Preserve React `useState` strictly for low-frequency informational queries (Layer B 4/4 Beat Indicator HUD, measure progression `BAR 1/6`, transport status, and glyph text).
  3. **Critically Damped Animation Envelopes:** Replace underdamped springs with fast-attack, smooth-decay curves using `Easing.out(Easing.quad)` that settle fully back to baseline (`scale: 1.0`, `opacity: 0.35`) before subsequent events:
     - Downbeat / Accent: 30ms attack, 130ms decay (160ms total $\ll$ 250ms).
     - Backbeat: 25ms attack, 110ms decay (135ms total).
     - Subdivision: 20ms attack, 70ms decay (90ms total).
     - Resolution: 40ms attack, 260ms decay (300ms total).
     - Reduced Motion: Scale locked strictly at 1.0; 130–160ms opacity pulse.
  4. **Active Animation Preemption Guard:** Hold a reference to `activeAnimationRef.current` and explicitly `.stop()` any running animation before launching a new cue, preventing uncontrolled queues or memory leaks.
- **Consequences:** Eliminates 40–80ms of React render delay on low-end hardware. Guarantees that animations settle cleanly back to baseline resting state between beats, restoring crisp, synchronized visual rhythm perception.

---

### ADR-016: Controlled Visual Latency Lead Calibration and Dynamic Pending Queue Recomputation

- **Status:** Accepted (Stage A.3)
- **Context:**
  - Following Stage A direct animation dispatch, physical testing on the Redmi A5 (Android 15) demonstrated noticeable improvement in visual responsiveness. However, visual pulsations were still perceived as slightly behind the audible music.
  - A technical analysis of Android 60Hz display hardware revealed a compound latency budget:
    1. Android Choreographer VSYNC alignment delay: 0–16.7ms (mean ~8.3ms).
    2. SurfaceFlinger triple-buffering presentation delay: 16.7–33.3ms (1–2 frames).
    3. IPS LCD Gray-to-Gray (GTG) liquid crystal transition time: 10–15ms.
    4. Kinetic attack duration to perceptual salience (P-center / peak node expansion): 20–30ms.
    - Combined physical perceptual lag spans **55ms to 75ms**, leaving the provisional 16ms offset under-compensated by approximately 40ms to 60ms.
  - Arbitrarily hardcoding a higher offset without empirical physical validation risks overshooting. A controlled, live calibration mechanism was required to evaluate three distinct values: `16ms` (default baseline), `40ms` (intermediate), and `60ms` (proposed higher lead).
- **Decision:**
  1. **Strict Baseline Preservation:** Maintain `visualOffsetMs: 16ms` strictly as the initial/default offset in `DEFAULT_LATENCY_OFFSETS`.
  2. **Reactive Latency Offset Updates:** Extended `LatencyManager` with `onOffsetsChange(listener)` subscription, firing whenever offsets are updated via `setOffsets()` or reset via `reset()`.
  3. **Dynamic Pending Event Queue Recomputation:** `PriorityEventScheduler` subscribes to offset updates and executes `recomputePendingTimestamps('visual')`. This recalculates `event.scheduledTimestampMs = latencyManager.computeTriggerTimestamp(targetTimestampMs, 'visual')` for all pending events in the priority queue and re-sorts them in place. This guarantees:
     - Zero audio interruption or transport restarts.
     - Zero seek or timeline revision changes (`timelineRevision` is preserved).
     - Zero event duplication (already-dispatched IDs in `dispatchedIds` remain intact).
     - Non-visual events (`haptic`, `lyrics`) are completely unaffected.
  4. **Diagnostic Software Telemetry Buffer:** Implemented `VisualSyncTelemetryRecord` capturing software-level timestamps (`targetTimestampMs`, `scheduledTimestampMs`, `schedulerDispatchMonotonicMs`, `onVisualCueMonotonicMs`, `animationInitiatedMonotonicMs`, `dispatchLatencyMs`, `setupLatencyMs`). Telemetry records are maintained in a 20-entry ring buffer in `VisualRhythmEngine` and exposed to subscribers.
  5. **Live Developer Calibration Controls:** Added compact calibration selector pills (`[16ms (Default)]`, `[40ms]`, `[60ms]`) and live telemetry readout to `VisualRhythmSurface.tsx`, allowing instant switching during live playback on physical devices.
- **Consequences:**
  - Enables rigorous, empirical, side-by-side perceptual comparison of visual latency lead values on physical Android hardware in real time.
  - Software telemetry cleanly isolates scheduling/dispatch delays from physical display photon latency.
  - Zero breaking changes to existing Stage 1, Stage A, or Milestone 6 synchronization contracts.

---

### ADR-017: Canonical Rhythm Score Audio Truth Alignment

- **Status:** Accepted (Stage A.5)
- **Context:**
  - During Stage A.4 physical testing on the Redmi A5, visual and haptic rhythm feedback was perceived as erratic, jittery, and frequently out-of-sync with the audible music.
  - An independent digital signal analysis of `assets/music/vibebridge_demo.wav` (12.0s, 44.1kHz, 16-bit mono PCM) revealed that although `CANONICAL_DEMO_RHYTHM_SCORE` originally defined 47 cues (every 250ms), the audio file contains only 24 genuine percussion/cadence transients.
  - Exactly 23 cues (49% of the score) were eighth-note off-beat "subdivisions" and fills where there is zero percussion attack in the audio waveform.
  - Actuating visual animations and haptic vibrations during dead silence created the illusion of the visualizer being "wildly ahead" of the music, while simultaneously interrupting active beat animations mid-decay every 250ms.
- **Decision:**
  1. **Prune Ghost Cues:** Remove the 23 non-audible ghost cues from `CANONICAL_DEMO_RHYTHM_SCORE` in `src/features/rhythm/demoTrackScore.ts`.
  2. **Retain 24 Verified Audible Transients:**
     - Bars 1–5: 4 quarter-note beats per bar at 120 BPM (Beats 1 & 3: Kick, Beats 2 & 4: Snare).
     - Bar 6: 4 quarter-note beats (Beat 1: Kick, Beat 2: Snare, Beat 3: Climax Accent 1, Beat 4: Final Resolution).
  3. **Preserve Shared Canonical Architecture:** Both `getDemoTrackHapticCues` and `getDemoTrackVisualCues` continue to derive from the single canonical source of truth, guaranteeing 1:1 tactile and visual synchrony.
- **Consequences:**
  - Guarantees 100% audio truth: every visual pulse and tactile vibration now has an audible sound counterpart.
  - Expands event intervals from 250ms to 500ms, providing 340ms of calm resting baseline between 160ms animation envelopes, completely eliminating mid-decay preemption, velocity snapping, and jitter.
  - Restores clean 4/4 Beat Indicator HUD progression (Beats 1, 2, 3, 4) without ghost re-renders.

---

### ADR-018: React Rendering Decoupling and Memoized Visual Canvas

- **Status:** Accepted (Stage A.6)
- **Context:**
  - Physical testing on a Redmi A5 (Android 15) exposed jerky, unstable visual movement during playback.
  - While Stage A introduced direct imperative animation dispatch via `onVisualCue` and Stage A.5 pruned ghost cues, an audit revealed that high-frequency React component re-renders were interfering with native animation smoothness:
    1. Every visual cue triggered `setVisualState` and `setLatestTelemetry` in `useVisualizer`, causing 2–3 full React component re-renders per cue ($4\text{ to }6\text{ Hz}$).
    2. `VisualRhythmSurface` was structured as a single monolithic component; re-renders caused the entire virtual DOM tree (Header, Canvas, HUD, Calibration panel) to diff and reconcile on every beat.
    3. The animated central node bound `borderWidth: state.visual.borderWidth` (cycling between 1, 2, 3, 4) and `<Text>{state.visual.symbol}</Text>` inside the same `Animated.View` undergoing native transform scaling. On Android, mutating border widths and text dimensions triggers `requestLayout()` calls on the UI thread, invalidating layout passes and dropping frames on the native RenderThread.
- **Decision:**
  1. **Subcomponent Decomposition with `React.memo`:**
     - **`VisualExpressiveCanvas` (Layer A - Memoized):** Isolated kinetic animation surface. Subscribes imperatively to `onVisualCue` using stable animated value refs (`scaleAnim`, `auraScaleAnim`, `opacityAnim` with `useNativeDriver: true`). Never re-renders during playback; re-renders only on transport transitions (`isPaused`, `isBuffering`, `isRest`, `enabled`, `reducedMotion`).
     - **Fixed Geometry & Stable Layout:** Stabilized border width to a constant `borderWidth: 3` and static layout bounds, completely eliminating Android `requestLayout()` layout thrashing.
     - **`VisualInformationalHUD` (Layer B - Memoized):** Isolated secondary informational display (`Beat 1..4`, `BAR X/6`, status label). Re-renders on beat progression in its own lightweight tree without affecting Layer A native animation nodes.
     - **`VisualHeader` (Memoized):** Static brand header and toggles (`ON/MUTED`, `CALM/MOTION`). Never re-renders during playback.
     - **`VisualCalibrationPanel` (Memoized):** Calibration pills and telemetry display.
  2. **Low-Frequency Telemetry Ingestion:**
     - Throttled `useVisualizer` telemetry state updates to $\le 1\text{ Hz}$ or on manual calibration pill selection using `lastTelemetryTimeRef`, decoupling high-frequency diagnostic logging from React rendering passes.
  3. **Strict Native Driver Preservation:**
     - Maintained `useNativeDriver: true` across all scale and opacity sequences.
     - Preserved reduced-motion accessibility behavior with non-motion high-contrast opacity pulsing.
  4. **Lifecycle & Cleanup Safety:**
     - Maintained clean unmount teardown for all animation composite refs and event subscriptions, preventing memory leaks across playback transitions.
- **Consequences:**
  - Completely decouples native 60/120 Hz animation execution on Android RenderThread from React component rendering and reconciliation.
  - Eliminates Android layout thrashing during animations.
  - HUD and transport UI remain fully accurate and reactive without dropping animation frames.
  - Zero memory leaks across unmount and playback lifecycles.

---

### ADR-019: MasterClock Monotonic Hardening and Scheduler Due-Event Tolerance

- **Status:** Accepted (Stage A.7.1)
- **Context:**
  - In Stage A.7 read-only investigations, audio-visual-tactile timing discrepancies were traced upstream of presentation to two core engine behaviors:
    1. **MasterClock Time Reversal / Regressive Jitter:** In `ExpoAudioEngine.ts`, `getEstimatedPositionMs()` extrapolates playback position between ~50ms ExoPlayer native status updates using monotonic elapsed wall-clock time (`clock.positionMs + (now - clock.updatedAtMs) * rate`). When ExoPlayer native position updates arrive slightly behind forward extrapolation (due to Android AudioTrack audio sink buffer reporting latency or bridge transit delays), the estimated position stepped backward by 5–20ms before climbing again. This created artificial stutter and temporal instability in the shared master timeline.
    2. **Scheduler Polling Discretization from Strict Inequality:** In `PriorityEventScheduler.ts`, the dispatch threshold `event.scheduledTimestampMs <= currentPosition` was mathematically exact ($0\text{ms}$ tolerance). If the managed micro-timer or polling interval woke even 0.1ms to 1.0ms before the calculated trigger time due to JS timer granularity (`setTimeout` roundoff on Android), the due event was postponed to the subsequent 20ms polling tick, introducing arbitrary 15–20ms dispatch jitter.
- **Decision:**
  1. **Monotonic Forward Progression Clamp in `ExpoAudioEngine`:**
     - Added `lastEstimatedPositionMs` and `monotonicRevision` state tracking to `ExpoAudioEngine`.
     - In `getEstimatedPositionMs(atTimeMs)`: When actively playing forward (`rate > 0`) within the active `timelineRevision`, clamp the returned estimate to `Math.max(this.lastEstimatedPositionMs, clampedProjected)`.
     - **Discontinuity Re-anchoring:** Legitimate timeline discontinuities cleanly re-anchor `lastEstimatedPositionMs` and avoid false clamping:
       - `seek()`: Immediately resets `lastEstimatedPositionMs = clampedMs` and aligns `monotonicRevision = timelineRevision` (backward seek establishes lower position immediately; forward seek establishes higher position immediately).
       - `load()`: Resets `lastEstimatedPositionMs = 0` and aligns revision.
       - `stop()`: Resets `lastEstimatedPositionMs = 0`.
       - `pause()`: Freezes `lastEstimatedPositionMs` at `clock.positionMs`.
       - `resume()`: Re-anchors monotonic baseline at paused position with zero forward jump.
       - `handleNativeStatusUpdate()`: When playback rate changes (`rateChanged`), re-anchors `lastEstimatedPositionMs = clock.positionMs` to prevent previous higher-rate estimates from freezing lower playback rates; on buffer clear, re-anchors monotonic baseline.
  2. **Scheduler Due-Event Dispatch Tolerance (`dueEventToleranceMs = 3ms`):**
     - Introduced `dueEventToleranceMs` into `EventSchedulerConfig` defaulting to constant `DUE_EVENT_TOLERANCE_MS = 3ms`.
     - 3ms represents $< 1/5$th of a 60Hz frame (16.67ms) and $< 1/2$ of a 120Hz frame (8.33ms), completely below human sensory perception thresholds, but comfortably absorbing JavaScript timer jitter and sub-millisecond timer roundoff.
     - In `PriorityEventScheduler.tick()`: Events are evaluated as due when `event.scheduledTimestampMs <= currentPosition + this.dueEventToleranceMs`.
     - In `scheduleNextStagedTimer()`: Computes remaining delay as `timeRemainingMs = nextEvent.scheduledTimestampMs - (currentPosition + this.dueEventToleranceMs)`, triggering precise staging without racing or duplicate timer allocation.
- **Consequences:**
  - Guarantees strictly non-decreasing, stable playback timeline progression during continuous audio playback.
  - Completely eliminates 15–20ms dispatch delays caused by sub-millisecond timer roundoff.
  - Zero risk of runaway drift: the monotonic clamp acts strictly as a low-water mark that native projections catch up to within 1–2 update cycles (~50ms).
  - All legitimate timeline operations (seek, stop, pause, resume, rate change) function seamlessly with instant time realignment.

---

### ADR-020: Visual Animation Lifecycle and Settle Safety Correction

- **Status:** Accepted (Stage A.7.1.2)
- **Context:**
  - Following Stage A.7.1 hardening, physical testing on the Redmi A5 (Android 15) demonstrated rock-solid haptic rhythm and transport controls, but revealed that approximately 1–2 visual beats were still missed or visually truncated during playback.
  - A rigorous code investigation identified two distinct animation lifecycle defects:
    1. **First-Beat Cancellation Race (`b1-1` at 0ms):** When playback begins, `VisualRhythmEngine` transitions `isPaused` to `false`, but left `isRest: true` un-cleared. When Cue 1 (`b1-1`) arrived at 0ms, it synchronously started expanding the central node. However, when React processed the status update render where `isPaused === false` and `isRest === true`, the canvas settling effect in `VisualExpressiveCanvas` executed `activeAnimationRef.current.stop()`, killing Beat 1 within 5–20ms of initiation.
    2. **Final Resolution Premature Truncation (`b6-4` at 11500ms):** The final resolution cue has a 300ms envelope (40ms attack + 260ms decay), active through 11784ms (11800ms in audio timeline). However, `VisualRhythmEngine` prematurely triggered `isRest = true` at `positionMs >= 11600` (116ms into the beat), causing React to execute the settling effect and abort the resolution animation 184ms early.
    3. **Settling Effect Conflation:** `VisualExpressiveCanvas` conflated genuine transport interruptions (mute, pause, buffering) with active musical rests (`isRest`). Stopping active animations on `isRest` during active playback caused any active cue animation to be vulnerable to React state transitions.
- **Decision:**
  1. **Immediate Active Groove State Establishment:**
     - In `VisualRhythmEngine.clockStatusUnsubscribe`: When `status === 'playing'`, immediately set `this.state.isPaused = false` AND `this.state.isRest = false`.
     - When stopped or idle, clear `this.state.activeCue = null`.
  2. **300ms Resolution Envelope Protection:**
     - In `VisualRhythmEngine.clockUpdateUnsubscribe`: Transition to musical rest occurs strictly at `positionMs >= 11800` (after the 300ms resolution envelope has finished), preserving the entire crescendo and decay.
  3. **Settling Effect Conflation Elimination (`VisualExpressiveCanvas`):**
     - Partitioned the settling effect into two distinct branches:
       - **Transport Interruption (Mute, Pause, Buffering):** Forcibly stops `activeAnimationRef.current` and settles canvas to baseline 1.0.
       - **Musical Rest (`isRest` during active playback):** Only settles if `!activeAnimationRef.current`. Never cancels an active cue animation mid-flight.
- **Consequences:**
  - Beat 1 (`b1-1` at 0ms) is 100% immune to cancellation from initial resting state reconciliation.
  - Final Resolution (`b6-4` at 11500ms) plays its full 300ms envelope without truncation.
  - Genuine transport interruptions (pause, stop, buffering, mute) continue to freeze and settle animations instantly.
  - Zero dependencies or independent timers added. 100% synchronized with MasterClock.

---

### ADR-021: Hybrid Continuous Motion — Three-Layer Native Expressive Canvas Architecture

- **Status:** Accepted (Stage A.7.2.1 & Stage A.7.2.2)
- **Context:**
  - Physical testing on the Redmi A5 (MediaTek Helio G36, 60Hz display) identified the **Dead-Zone Problem**: discrete beat pulses (135–160ms envelopes) left the visual canvas motionless for 340–365ms ($> 70\%$ of the 500ms quarter-note beat period at 120 BPM), creating an intermittent strobe flash rather than an organic musical pulse.
  - Snare backbeat attacks of 25ms spanned only 1.5 frames on 60Hz displays, making them visually subliminal.
  - The developer approved Option D: Hybrid Continuous Motion to evolve the SEE pillar into a three-layer visual experience.
- **Decision:**
  1. **Three-Layer Native Canvas Decomposition (`VisualExpressiveCanvas`):**
     - **Layer 1: Core Node (Kinetic Impact):** Directional deformation driven by `coreScaleX` and `coreScaleY`. Downbeat kicks produce horizontal squash ($1.35 \times 1.25$), backbeat snares produce vertical snap ($1.15 \times 1.30$), climax accents produce omnidirectional bursts ($1.45 \times 1.45$), and resolution produces harmonic bloom ($1.25 \times 1.25$).
     - **Layer 2: Energy Field (Ambient Breath):** Ambient presence driven by `fieldScale` and `fieldOpacity`. Ramps up on each cue over 50ms and decays over ~450ms toward the reconciled ambient floor ($1.05\text{x}$ scale, $0.25$ opacity), smoothly bridging the 500ms inter-beat interval without dropping to zero.
     - **Layer 3: Ripple / Acoustic Aura (Wave Propagation):** Radial shockwave driven by `rippleScale` and `rippleOpacity`. Triggered strictly on high-impact accents (`b6-3` at 11000ms) and final resolution (`b6-4` at 11500ms). Ordinary downbeats and backbeats (`triggerRipple === false`) never interrupt or restart an active Ripple.
  2. **Seven Persistent Native Animated Values:**
     - `coreScaleX` (1.0), `coreScaleY` (1.0), `coreOpacity` (0.35), `fieldScale` (1.05), `fieldOpacity` (0.25), `rippleScale` (1.0), `rippleOpacity` (0.0). Allocated once via `useRef`, resulting in zero garbage collection pauses during playback.
  3. **Zero JavaScript Animation Loops:**
     - Motion executes via React Native's Native Driver (`useNativeDriver: true`) hooked into the Android platform Choreographer. JavaScript executes only when a cue is delivered by `PriorityEventScheduler` (~2 Hz).
  4. **Strict Transport Lifecycle Settle Guarantees:**
     - Transport pause, mute, or buffer immediately halts running animations and executes a 150ms smooth settle to resting baseline while preserving `energyAccumulator` in memory.
     - Musical rest (`isRest`) settles only after active cue and resolution animations finish mid-flight.
- **Consequences:**
  - Completely eliminates the 70% dead zone, replacing it with an organic, breathing ambient field.
  - Preserves $C^0$ position continuity on every retargeting pass.
  - Zero React re-renders or layout invalidation passes during active playback.
  - Full multi-modal accessibility: Reduced-motion mode locks all kinetic scales strictly to 1.0 while maintaining opacity pulses, glyphs, and high-contrast borders.

---

### ADR-022: Playback Startup Transition & Native Lifecycle Desynchronization Correction

- **Status:** Accepted (Stage A.7.2.3.7)
- **Context:**
  - Physical testing on a Redmi Android device revealed an initial playback glitch: "Every time Play is pressed, the first part of the music begins, then there is one small lag or jump, after which playback and visual synchronization continue smoothly for the rest of the track."
  - Root cause investigation (Stages A.7.2.3.1 – A.7.2.3.6) established:
    1. **Premature JavaScript Clock Anchoring:** In `ExpoAudioEngine.play()`, `this.updateStatus('playing')` was called immediately when the JS command was issued, causing the JavaScript clock to advance forward for 50–150ms while the native Android audio pipeline (ExoPlayer/AudioTrack) was still asynchronously preparing buffers.
    2. **Discontinuous Re-Anchoring Jump:** When the first native `playbackStatusUpdate` arrived reporting `currentTime = 0.0s`, the JS clock experienced a sudden backward step or re-anchoring jump.
    3. **Rapid Transport Concurrency Race:** In rapid Play → Pause → Play sequences, Android's asynchronous `MainLooper` message queue could emit delayed `playing: true` status callbacks from an earlier attempt, which could falsely confirm a newer playback attempt because `expo-audio` native status updates lack attempt identifiers.
- **Decision:**
  1. **Deferred Master Clock Anchoring & Position Freeze:**
     - In `ExpoAudioEngine.play()`: flag `isAwaitingNativeStart = true` and arm a 3000ms safety timeout. Master clock status remains in its existing state (`'paused'` or `'stopped'`).
     - While `isAwaitingNativeStart === true`, `getEstimatedPositionMs()` strictly returns `this.clock.positionMs` without forward wall-clock extrapolation.
     - When the first native update arrives with `status.playing && !status.isBuffering`, verify `status.id === this.player.id`, clear `isAwaitingNativeStart`, cancel the safety timeout, transition master clock status to `'playing'`, and anchor the clock at that exact arrival time.
  2. **Deterministic Player Disposal & Recreation on Startup Abort:**
     - If the user cancels playback (pause, stop, seek) while `isAwaitingNativeStart === true`, synchronously dispose of the unconfirmed player (`cleanupPlayer()`) and set `this.player = null`.
     - Retain `this.currentSource`, track metadata, and target position in memory.
     - On the next `play()`, recreate a fresh native player instance via `recreatePlayer()`, assigning a new unique native player UUID.
     - Status callbacks with mismatched player IDs (`status.id !== this.player.id`) are discarded.
     - Normal mid-track pause and resume preserve the existing native player instance without recreation.
  3. **Immediate First-Tick on Scheduler Start:**
     - In `PriorityEventScheduler.start()`: immediately invoke `this.tick()` before starting `setInterval` to eliminate up to 20ms of initial polling latency for the opening beat.
  4. **Bounded Opening Boundary Kick Exception:**
     - For $T=0\text{ms}$ opening cues (`b1-1`), if native startup delay causes the first tick to arrive at $0\text{ms} \le \text{currentPos} \le 100\text{ms}$, the cue is dispatched instead of being dropped by the 50ms lateness threshold.
     - Once dispatched, `dispatchedIds` prevents duplicate firing.
     - Dropped if first confirmation arrives > 100ms.
     - Never replayed after seeking to 2000ms.
- **Consequences:**
  - Completely eliminates the opening playback jump/lag on Android devices.
  - Guarantees 100% deterministic isolation between rapid playback attempts.
  - Zero desynchronization during rapid transport toggling.
  - All 90 automated unit tests pass across all 5 engines with 0 TypeScript errors and clean Android bundling.

---

### ADR-023: Seek Lifecycle, Landing Synchronization, and Settle Cancel Correction

- **Status:** Accepted (Stage A.7.2.3.10)
- **Context:**
  - Physical testing on a Redmi Android device revealed that seeking backward (e.g. from 8s to 3s) caused visual animations to take noticeable time to respond, whereas seeking forward functioned normally.
  - Comprehensive investigations (Stages A.7.2.3.8 – A.7.2.3.9) identified four converging factors creating the backward seek latency:
    1. **Pre-Seek Native Callback Clock Poisoning:** In `ExpoAudioEngine`, when seeking backward (e.g. 8000ms to 3000ms), in-flight native status updates from the pre-seek position (e.g. 7950ms) arrived after the JS seek command was issued. These delayed updates were latched into `lastEstimatedPositionMs` via `Math.max()`, locking the forward monotonic playback clock at 8000ms until real audio reached 8000ms (a 5-second dead freeze).
    2. **Seek Landing Boundary Cue Dropping:** With a 60ms visual lead time, a visual cue scheduled at the seek landing point (e.g. 3000ms) has a compensated trigger timestamp of $3000 - 60 = 2940\text{ms}$. When seeking to 3000ms, the scheduler evaluated $2940 < 3000 - 50 = 2950\text{ms}$ and dropped the landing cue as stale.
    3. **React useEffect Rescheduling Latency:** In `NowPlayingCard.tsx`, sensory cues were rescheduled asynchronously inside a passive `useEffect([timelineRevision])`, introducing a 50–150ms delay before the scheduler received the new revision's cues.
    4. **Competing Running Settle Animation:** In `VisualRhythmSurface.tsx`, transport changes triggered a 150ms `settleAnim` returning values to resting baseline. When incoming cues arrived while `settleAnim` was in flight, the running settle animation was not stopped, actively competing with and dampening the cue animation.
- **Decision:**
  1. **Seek Confirmation Window & Monotonic Floor Suspension:**
     - In `ExpoAudioEngine.seek()`: suspend the forward monotonic floor (`monotonicRevision = 0`), set `activeSeekTargetMs = clampedMs`, and arm a 1500ms safety timeout.
     - In `ExpoAudioEngine.getEstimatedPositionMs()`: freeze forward extrapolation and return exact seek target position while `activeSeekTargetMs !== null`.
     - In `ExpoAudioEngine.handleNativeStatusUpdate()`: while `activeSeekTargetMs !== null`, any status update with $|posMs - activeSeekTargetMs| > 250\text{ms}$ is discarded as a stale pre-seek update. When an update arrives within 250ms, the seek is confirmed: `activeSeekTargetMs` is cleared, safety timeout cancelled, clock re-anchored, and forward monotonic floor reactivated (`monotonicRevision = clock.timelineRevision`).
  2. **Seek Landing Boundary Exception in Event Scheduler:**
     - In `PriorityEventScheduler`: introduced a Seek Landing Boundary Exception in both `scheduleBatch()` and `tick()`.
     - An event whose compensated trigger falls just before the current position ($T_{visual} < P - 50\text{ms}$) is preserved and dispatched immediately on the landing tick if its musical target is at or within 60ms proximity of the seek landing position ($|P - T| \le 60\text{ms}$).
     - Genuinely expired cues ($P - T > 60\text{ms}$, e.g. seeking to 3200ms when beat was at 3000ms) remain dropped.
  3. **Synchronous Score Provider Registration:**
     - Added `ScoreProvider` contract to `IEventScheduler` and implemented `setScoreProvider(provider)` in `PriorityEventScheduler`.
     - In `PriorityEventScheduler.handleRevisionChange(newRevision)`: immediately invoke `this.scoreProvider(this, newRevision)` synchronously upon revision changes, populating new cues with 0ms delay and completely bypassing React passive effect scheduling.
     - In `NowPlayingCard.tsx`: registered the synchronous score provider on mount and cleaned up on unmount.
  4. **Active Settle Animation Cancellation:**
     - In `VisualRhythmSurface.tsx`: added `activeSettleAnimRef` tracking the running settle animation.
     - In `onVisualCue`: immediately cancel any running settle animation (`activeSettleAnimRef.current.stop()`) when an incoming visual cue arrives, giving full unconstrained control to the incoming cue.
     - Cleaned up on unmount and transition.
- **Consequences:**
  - Completely eliminates backward-seek clock poisoning and dead freezes.
  - Eliminates visual latency and missing beats at seek landing points.
  - Removes 50–150ms React passive effect scheduling latency.
  - Ensures visual animations respond instantaneously to incoming cues without competition from settle animations.
  - All 98 unit tests pass across all 5 engines (30 audio, 21 sync, 25 visual, 11 haptic, 11 lyrics), with 0 TypeScript errors and clean Android bundling.
