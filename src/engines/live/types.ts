/**
 * Types & Contracts for Live Concert Audio Capture & Real-Time Haptic Translation
 *
 * Stage B-LIVE.2: Adaptive Haptic Intelligence & Physical Feedback Calibration
 * Designed for Deaf and hard-of-hearing audience members at live musical performances.
 */

export type LivePermissionStatus = 'undetermined' | 'granted' | 'denied' | 'requesting';

export type LiveCaptureState = 'idle' | 'starting' | 'capturing' | 'paused' | 'stopped' | 'error';

/**
 * Three calibrated physical intensity profiles.
 * - subtle: Platform light/soft waveforms for minimal tactile presence.
 * - balanced: Platform heavy/medium impacts for standard musical feedback.
 * - strong: Direct hardware rail acceleration (via Android Vibration API) to overcome
 *           motor inertia and deliver unmistakably palpable physical pulses.
 */
export type HapticIntensityProfile = 'subtle' | 'balanced' | 'strong';

/**
 * Three acoustic detection sensitivity profiles.
 * - low: For high-volume arena concerts (prevents over-triggering from crowd roar).
 * - normal: Calibrated for clubs, rehearsals, and live venues.
 * - high: Amplified for quiet acoustic sets, unamplified vocals, and living room music.
 */
export type AudioSensitivityProfile = 'low' | 'normal' | 'high';

/**
 * Active native driver mode executing device vibrations.
 */
export type ActuatorDriverMode = 'expo-haptics' | 'native-vibration';

/**
 * Real-time audio features calculated from live microphone PCM buffers.
 */
export interface LiveAudioFeatures {
  /** Packet sequence index */
  sequence: number;
  /** Buffer timestamp in seconds relative to stream start */
  timestamp: number;
  /** Effective sample rate in Hz */
  sampleRate: number;
  /** Number of channels captured (1 = mono, 2 = stereo) */
  channels: number;
  /** Root Mean Square amplitude in [0.0, 1.0] */
  rms: number;
  /** Absolute peak amplitude in [0.0, 1.0] */
  peak: number;
  /** Low-frequency energy (< 250 Hz, bass / kick / sub) in [0.0, 1.0] */
  lowEnergy: number;
  /** Mid-frequency energy (250 Hz - 2500 Hz, musical body / instruments) in [0.0, 1.0] */
  midEnergy: number;
  /** High-frequency energy (> 2500 Hz, cymbals / hi-hats / harmonics) in [0.0, 1.0] */
  highEnergy: number;
  /**
   * Estimated vocal-range energy activity (300 Hz - 3000 Hz) relative to total energy.
   * NOTE: This represents estimated energy in the vocal frequency spectrum.
   * It is NOT confirmed singer separation or isolated speech recognition.
   */
  vocalActivityEstimate: number;
  /** Whether a normalized relative transient attack (kick drum hit, percussion snap) was detected */
  isTransient: boolean;
  /** Estimated dynamic background noise floor in [0.0, 1.0] (resists music self-choking) */
  noiseFloor: number;
  /** Signal-to-noise ratio in decibels (clamped) */
  snrDb: number;
  /** Active effective sensitivity multiplier (including auto-adaptation) */
  effectiveSensitivity: number;
}

/**
 * Haptic translation classification and event payload.
 */
export type LiveHapticEventType =
  | 'bass_punch'       // Heavy low-frequency kick or bass surge
  | 'percussion_snap'  // Sharp transient onset (snare, rimshot, clap)
  | 'vocal_pulse'      // Rhythmic tactile pulse for prominent vocal-range presence
  | 'melody_tick'      // Distinct tick for high-frequency melodic notes/cymbals
  | 'none';

export type LiveHapticFeedbackStyle =
  | 'heavy'
  | 'medium'
  | 'light'
  | 'selection'
  | 'strong_bass'
  | 'strong_percussion'
  | 'strong_vocal'
  | 'strong_melody'
  | 'none';

export interface LiveHapticEvent {
  type: LiveHapticEventType;
  intensity: number; // 0.0 to 1.0
  timestamp: number;
  feedbackStyle: LiveHapticFeedbackStyle;
  driverMode: ActuatorDriverMode;
  durationMs: number;
}

export interface LiveHapticStats {
  totalTriggers: number;
  totalThrottled: number;
  totalSuppressed: number;
  lastTriggerType: LiveHapticEventType;
  activeDriverMode: ActuatorDriverMode;
}

export interface LiveHapticConfig {
  /** Master haptic feedback toggle for live concert mode */
  enabled: boolean;
  /** Physical intensity profile: subtle, balanced, or strong */
  intensityProfile: HapticIntensityProfile;
  /** Acoustic sensitivity profile: low, normal, or high */
  sensitivityProfile: AudioSensitivityProfile;
  /** Automatic ambient venue sensitivity adaptation */
  autoAdaptSensitivity: boolean;
  /** Logical intensity scaling multiplier: 0.0 to 1.0 */
  intensity: number;
  /** Effective sensitivity factor: lower = less sensitive, higher = more sensitive */
  sensitivity: number;
  /** Minimum interval in milliseconds between any two haptic vibrations to prevent buzzing */
  cooldownMs: number; // default: 45ms
  /** Minimum bass energy threshold required to trigger a bass punch */
  bassThreshold: number; // default: 0.12
  /** Minimum transient surge required to trigger a percussive snap */
  transientThreshold: number; // default: 0.16
  /** Minimum vocal-range activity required to trigger a vocal pulse */
  vocalThreshold: number; // default: 0.25
}

export interface LiveConcertState {
  captureState: LiveCaptureState;
  permissionStatus: LivePermissionStatus;
  sampleRate: number;
  channels: number;
  packetsReceived: number;
  features: LiveAudioFeatures;
  lastHapticEvent: LiveHapticEvent | null;
  errorMessage: string | null;
  hapticStats: LiveHapticStats;
  hapticConfig: LiveHapticConfig;
}

export type LiveFeaturesListener = (features: LiveAudioFeatures) => void;
export type LiveHapticListener = (event: LiveHapticEvent) => void;
export type LiveStateListener = (state: LiveConcertState) => void;
