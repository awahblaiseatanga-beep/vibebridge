/**
 * Visual Rhythm Engine Types & Contracts (SEE Pillar)
 *
 * Defines contracts, states, configurable animation scales, and
 * visual mapping models for synchronized visual rhythm translation.
 */

import { DispatchedEvent, MasterClock } from '@/engines/synchronization';
import { IEventScheduler } from '@/engines/event-scheduler';
import { VisualCuePayload } from '@/features/rhythm';

export type VisualIntensityLevel =
  | 'strong'      // Downbeat bass kicks
  | 'medium'      // Backbeat snares
  | 'soft'        // Eighth-note subdivisions
  | 'accent'      // Syncopated rigid accents (climax)
  | 'resolution'  // Final resolution
  | 'rest';       // Musical pause / rest within composition

export type VisualShapeType =
  | 'diamond'       // Strong downbeats (◆)
  | 'triangle'      // Backbeat snares (▲)
  | 'circle'        // Subdivisions / gentle pulses (●)
  | 'accent-burst'  // Climax accents (◈)
  | 'starburst'     // Resolution chord (✦)
  | 'line';         // Musical rest / calm baseline (—)

/**
 * Configurable animation scale multipliers.
 * These are configurable rather than fixed universal constants.
 */
export interface VisualScaleConfig {
  /** Scale factor for strong downbeats. Default: 1.35 */
  strongScale: number;
  /** Scale factor for medium backbeats. Default: 1.20 */
  mediumScale: number;
  /** Scale factor for soft subdivisions. Default: 1.06 */
  softScale: number;
  /** Scale factor for climax accents. Default: 1.45 */
  accentScale: number;
  /** Scale factor for final resolution. Default: 1.25 */
  resolutionScale: number;
  /** Resting baseline scale. Default: 1.00 */
  restScale: number;
}

export const DEFAULT_VISUAL_SCALE_CONFIG: VisualScaleConfig = {
  strongScale: 1.35,
  mediumScale: 1.20,
  softScale: 1.06,
  accentScale: 1.45,
  resolutionScale: 1.25,
  restScale: 1.00,
};

/**
 * Configuration options for the VisualRhythmEngine.
 */
export interface VisualEngineConfig {
  /** Master enable switch for visual animations. Default: true */
  enabled?: boolean;
  /** Reduced motion accessibility preference. Default: false */
  reducedMotion?: boolean;
  /** Custom animation scale overrides */
  scales?: Partial<VisualScaleConfig>;
}

/**
 * Geometric, non-color visual parameters mapped from a musical cue.
 */
export interface VisualBeatVisual {
  symbol: string;
  shape: VisualShapeType;
  color: string;
  scale: number;
  opacity: number;
  borderWidth: number;
  label: string;
  energy: number; // Normalized musical energy [0.0 - 1.0]
}

/**
 * State snapshot emitted by the VisualRhythmEngine.
 * Explicitly separates musical rests from transport lifecycle events (pause, buffer).
 */
export interface VisualRhythmState {
  enabled: boolean;
  reducedMotion: boolean;
  activeCue: VisualCuePayload | null;
  currentBar: number;
  currentBeat: number;
  intensityLevel: VisualIntensityLevel;
  visual: VisualBeatVisual;
  /** Musical rest within the composition (playback active, but musical phrase rests) */
  isRest: boolean;
  /** Transport lifecycle: user paused playback */
  isPaused: boolean;
  /** Transport lifecycle: audio buffer is filling */
  isBuffering: boolean;
  lastDispatchedAtMs: number;
  totalEventsReceived: number;
}

export type VisualCueEvent = DispatchedEvent<VisualCuePayload>;
export type VisualStateListener = (state: VisualRhythmState) => void;

/**
 * Visual Latency Calibration Offsets (ms).
 * - 16ms: baseline default
 * - 40ms: intermediate value
 * - 60ms: proposed higher compensation
 */
export type VisualCalibrationOffset = 16 | 40 | 60;
export const VISUAL_CALIBRATION_OFFSETS: readonly VisualCalibrationOffset[] = [16, 40, 60];

/**
 * Diagnostic software telemetry for visual synchronization calibration.
 * Captures software event progression timestamps (performance.now()).
 * Explicitly distinguished from physical display photons and speaker acoustic output.
 */
export interface VisualSyncTelemetryRecord {
  id: string;
  role: string;
  selectedVisualOffsetMs: number;
  targetTimestampMs: number;
  scheduledTimestampMs: number;
  schedulerDispatchMonotonicMs: number;
  onVisualCueMonotonicMs: number;
  animationInitiatedMonotonicMs: number;
  dispatchLatencyMs: number;
  setupLatencyMs: number;
  timelineRevision: number;
}

export type VisualTelemetryListener = (record: VisualSyncTelemetryRecord) => void;

/**
 * Direct animation payload delivered synchronously to imperative visual listeners
 * upon receiving a scheduled visual event. Completely bypasses the React render loop.
 */
export interface VisualCueAnimationPayload {
  event: VisualCueEvent;
  visual: VisualBeatVisual;
  intensityLevel: VisualIntensityLevel;
  targetScale: number;
  auraTarget: number;
  attackMs: number;
  decayMs: number;
  totalDurationMs: number;
  reducedMotion: boolean;

  // Layer 1: Core Node Directional Deformation (Stage A.7.2.1)
  targetScaleX: number;
  targetScaleY: number;

  // Layer 2: Continuous Energy Field (Stage A.7.2.1)
  targetFieldScale: number;
  targetFieldOpacity: number;
  energyAccumulator: number;

  // Layer 3: Acoustic Aura / Ripple (Stage A.7.2.1)
  triggerRipple: boolean;
  targetRippleScale: number;
  targetRippleOpacity: number;
  rippleDurationMs: number;
}

export type VisualCueListener = (payload: VisualCueAnimationPayload) => void;

/**
 * Interface contract for VisualRhythmEngine.
 */
export interface IVisualRhythmEngine {
  setEnabled(enabled: boolean): void;
  setReducedMotion(enabled: boolean): void;
  setScales(scales: Partial<VisualScaleConfig>): void;
  attachScheduler(scheduler: IEventScheduler): void;
  detachScheduler(): void;
  attachMasterClock(clock: MasterClock): void;
  detachMasterClock(): void;
  onVisualStateChange(listener: VisualStateListener): () => void;
  onVisualCue(listener: VisualCueListener): () => void;
  onTelemetry(listener: VisualTelemetryListener): () => void;
  getLatestTelemetry(): VisualSyncTelemetryRecord | null;
  getTelemetryHistory(): VisualSyncTelemetryRecord[];
  clearTelemetry(): void;
  setVisualCalibrationOffset(offsetMs: VisualCalibrationOffset): void;
  getVisualCalibrationOffset(): VisualCalibrationOffset;
  recordAnimationInitiated(cueId: string, timestampMs?: number): void;
  getEnergyAccumulator(): number;
  resetEnergy(): void;
  getState(): VisualRhythmState;
  reset(): void;
  dispose(): void;
}
