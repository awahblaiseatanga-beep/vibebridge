# Product Requirements Document (PRD)

## Project: VibeBridge
**Target Release:** CIMFEST Android APK  
**Document Version:** 1.0.0 (Milestone 1 — Foundation)  
**Author:** Product Owner & Lead Mobile Engineer  

---

## 1. Executive Summary

VibeBridge is a specialized mobile application built to make music fully accessible to Deaf and hard-of-hearing (D/HH) individuals. Rather than treating music strictly as an auditory experience, VibeBridge translates sound into three synchronized sensory representations:

1. **READ:** Synchronized real-time lyrics that guide users through vocal narratives, tone, and musical phrasing.
2. **SEE:** Visually dynamic representations of rhythm, frequency range (bass, mids, treble), and song intensity.
3. **FEEL:** Physical tactile feedback driven by the smartphone's vibration motor, mapped directly to rhythm and beat events.

The initial distribution target is an installable Android APK prepared for showcase and user testing at **CIMFEST**.

---

## 2. Target Audience & User Personas

### 2.1 Deaf Music Enthusiasts
- Individuals with severe-to-profound hearing loss who love music festivals, concerts, and beat-heavy music.
- **Needs:** Powerful physical sensation (haptics) and clear visual timing cues that match what they feel.

### 2.2 Hard-of-Hearing (HoH) Users
- Individuals with partial hearing or frequency-specific loss (e.g., high-frequency loss).
- **Needs:** High-contrast synchronized lyrics to bridge gaps in auditory perception alongside tactile reinforcement.

### 2.3 Accessibility Researchers & Festival Attendees
- Attendees and judges at CIMFEST experiencing accessibility innovations.
- **Needs:** Immediate, intuitive, standalone operation without requiring complex account creation or cloud setups.

---

## 3. Core Product Pillars

### 3.1 Pillar 1: READ (Synchronized Lyrics)
- **Real-Time Display:** Lyrics must scroll and highlight synchronously with track playback.
- **Legibility:** High-contrast text exceeding WCAG AAA guidelines. Adjustable text scaling to accommodate various visual preferences.
- **Active Cueing:** Current line and syllable/word highlights to provide musical cadence and pacing.
- **Format Support:** Standard `.lrc` (simple and enhanced timestamped files) and JSON lyric models.

### 3.2 Pillar 2: SEE (Rhythm & Intensity Visualizer)
- **Visual Rhythm:** Animations that pulse and expand in direct synchronization with downbeats and tempo changes.
- **Frequency Distinction:** Distinct visual channels or cues representing bass/sub-bass (heavy foundational pulses) versus higher pitch elements.
- **Framerate & Performance:** Smooth 60fps rendering using React Native Reanimated without stuttering or dropping frames.
- **Visual Ergonomics:** Dark mode foundation to avoid eye fatigue and maintain contrast under bright outdoor festival lighting.

### 3.3 Pillar 3: FEEL (Beat-Synchronized Tactile Haptics)
- **Physical Beat Mapping:** Direct triggering of the phone's vibration motor aligned with rhythm transients and bass kicks.
- **Intensity Controls:** User-adjustable tactile strength (0% to 100%) to accommodate device motor variability and personal sensitivity.
- **Pattern Differentiation:** Varied tactile patterns (sharp impacts for snares, extended rumbles for bass drops).
- **Driver Abstraction:** Initial implementation via Expo Haptics, structured with a clean engine boundary so a native Android `VibrationEffect` module can be integrated if hardware testing requires lower-level waveform control.

---

## 4. Local Library & Audio Management

- **Offline-First:** The app must function completely offline without mandatory network access.
- **File Import:** Users can import local audio files (MP3, WAV, FLAC, M4A) stored on device memory or SD cards using Android Storage Access Framework (SAF).
- **Metadata Storage:** Track title, artist, duration, and custom sensory sync data stored in local persistent storage.
- **Bundled Showcase Tracks:** Application includes bundled royalty-free showcase audio files and synchronized cue data for out-of-the-box demonstration at CIMFEST.

---

## 5. Technical Constraints & Platform Decisions

| Decision | Selected Technology | Rationale |
|---|---|---|
| Platform | Android Native (APK) | CIMFEST requirement for direct device installation and testing. |
| Framework | React Native + Expo | Rapid development, modern ecosystem, and predictable Android builds. |
| Navigation | Expo Router | Modern file-based routing with strict typing and deep linking. |
| Audio Playback | Expo Audio | Clean API for audio loading, playback, and timestamp polling. |
| Animations | React Native Reanimated | High-performance UI-thread animations for the visualizer. |
| Advanced Visuals | React Native Skia (Deferred) | Reserved for advanced custom shader waveforms if Reanimated reaches limits. |
| Backend & Auth | Supabase (Deferred) | Reserved for future cloud profiles; deferred to avoid unnecessary complexity for CIMFEST. |
| Web Services | Vercel (Future) | Reserved for landing page and marketing; not used for mobile deployment. |

---

## 6. Success Metrics for CIMFEST Release

1. **Zero-Crash Standalone Operation:** Installable APK boots immediately on Android 10+ devices without external network dependencies.
2. **Synchronization Accuracy:** Tactile feedback and visual pulses trigger within ±25ms of the audio downbeat.
3. **User Intuitiveness:** First-time users can pick up the device, press play, and immediately understand the multi-sensory connection within 5 seconds.
