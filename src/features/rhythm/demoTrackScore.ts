/**
 * Canonical Shared Rhythm Score
 *
 * Source of truth for musical rhythm metadata for the bundled 120 BPM demo track:
 * assets/music/vibebridge_demo.wav (12.0 seconds, 6 bars of 4/4 at 120 BPM).
 *
 * This canonical score is consumed by both the FEEL (Haptic) and SEE (Visual) engines,
 * preventing duplicated timelines and ensuring synchronized sensory perception.
 */

import { ScheduledEventInput } from '@/engines/synchronization';
import { IEventScheduler } from '@/engines/event-scheduler';
import { HapticCuePayload, HapticPattern } from '@/engines/haptic';

export type BeatRole =
  | 'downbeat'     // Primary downbeats (Beats 1 & 3: Kick/Bass)
  | 'backbeat'     // Rhythmic backbeats (Beats 2 & 4: Snare)
  | 'subdivision'  // Off-beat eighth note pulses (Hi-hats)
  | 'accent'       // Syncopated rigid accents (Bar 6 climax)
  | 'resolution';  // Final resolution chord (Bar 6 Beat 4)

export type MusicalIntensity = 'strong' | 'medium' | 'soft';

export interface CanonicalRhythmCue {
  id: string;
  targetTimestampMs: number;
  bar: number;                 // 1 to 6
  beat: number;                // 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5
  role: BeatRole;
  intensity: MusicalIntensity;
  weight: number;              // 0.0 to 1.0
  label: string;
  hapticPattern: HapticPattern;
}

/**
 * 24 canonical rhythm cues across 6 measures of 4/4 at 120 BPM.
 * 120 BPM = 500ms per quarter-note beat.
 *
 * Audio Truth Alignment (Stage A.5):
 * Aligned strictly to the verified audible transient attacks in assets/music/vibebridge_demo.wav.
 * Removed 23 ghost subdivision/filler cues that lacked audible percussion counterparts,
 * restoring 1:1 perceptual coherence between sound, tactile haptics, and visual rhythm.
 */
export const CANONICAL_DEMO_RHYTHM_SCORE: CanonicalRhythmCue[] = [
  // --- Bar 1 (0ms - 2000ms): 4/4 Groove Introduction ---
  { id: 'b1-1', targetTimestampMs: 0, bar: 1, beat: 1.0, role: 'downbeat', intensity: 'strong', weight: 1.0, label: 'Kick 1', hapticPattern: 'heavy' },
  { id: 'b1-2', targetTimestampMs: 500, bar: 1, beat: 2.0, role: 'backbeat', intensity: 'medium', weight: 0.85, label: 'Snare 1', hapticPattern: 'medium' },
  { id: 'b1-3', targetTimestampMs: 1000, bar: 1, beat: 3.0, role: 'downbeat', intensity: 'strong', weight: 0.95, label: 'Kick 2', hapticPattern: 'heavy' },
  { id: 'b1-4', targetTimestampMs: 1500, bar: 1, beat: 4.0, role: 'backbeat', intensity: 'medium', weight: 0.85, label: 'Snare 2', hapticPattern: 'medium' },

  // --- Bar 2 (2000ms - 4000ms): Established Rhythm ---
  { id: 'b2-1', targetTimestampMs: 2000, bar: 2, beat: 1.0, role: 'downbeat', intensity: 'strong', weight: 1.0, label: 'Kick 1', hapticPattern: 'heavy' },
  { id: 'b2-2', targetTimestampMs: 2500, bar: 2, beat: 2.0, role: 'backbeat', intensity: 'medium', weight: 0.85, label: 'Snare 1', hapticPattern: 'medium' },
  { id: 'b2-3', targetTimestampMs: 3000, bar: 2, beat: 3.0, role: 'downbeat', intensity: 'strong', weight: 0.95, label: 'Kick 2', hapticPattern: 'heavy' },
  { id: 'b2-4', targetTimestampMs: 3500, bar: 2, beat: 4.0, role: 'backbeat', intensity: 'medium', weight: 0.85, label: 'Snare 2', hapticPattern: 'medium' },

  // --- Bar 3 (4000ms - 6000ms): Steady Energy ---
  { id: 'b3-1', targetTimestampMs: 4000, bar: 3, beat: 1.0, role: 'downbeat', intensity: 'strong', weight: 1.0, label: 'Kick 1', hapticPattern: 'heavy' },
  { id: 'b3-2', targetTimestampMs: 4500, bar: 3, beat: 2.0, role: 'backbeat', intensity: 'medium', weight: 0.85, label: 'Snare 1', hapticPattern: 'medium' },
  { id: 'b3-3', targetTimestampMs: 5000, bar: 3, beat: 3.0, role: 'downbeat', intensity: 'strong', weight: 0.95, label: 'Kick 2', hapticPattern: 'heavy' },
  { id: 'b3-4', targetTimestampMs: 5500, bar: 3, beat: 4.0, role: 'backbeat', intensity: 'medium', weight: 0.85, label: 'Snare 2', hapticPattern: 'medium' },

  // --- Bar 4 (6000ms - 8000ms): Driving Rhythm ---
  { id: 'b4-1', targetTimestampMs: 6000, bar: 4, beat: 1.0, role: 'downbeat', intensity: 'strong', weight: 1.0, label: 'Kick 1', hapticPattern: 'heavy' },
  { id: 'b4-2', targetTimestampMs: 6500, bar: 4, beat: 2.0, role: 'backbeat', intensity: 'medium', weight: 0.85, label: 'Snare 1', hapticPattern: 'medium' },
  { id: 'b4-3', targetTimestampMs: 7000, bar: 4, beat: 3.0, role: 'downbeat', intensity: 'strong', weight: 0.95, label: 'Kick 2', hapticPattern: 'heavy' },
  { id: 'b4-4', targetTimestampMs: 7500, bar: 4, beat: 4.0, role: 'backbeat', intensity: 'medium', weight: 0.85, label: 'Snare 2', hapticPattern: 'medium' },

  // --- Bar 5 (8000ms - 10000ms): Energy Buildup ---
  { id: 'b5-1', targetTimestampMs: 8000, bar: 5, beat: 1.0, role: 'downbeat', intensity: 'strong', weight: 1.0, label: 'Kick 1', hapticPattern: 'heavy' },
  { id: 'b5-2', targetTimestampMs: 8500, bar: 5, beat: 2.0, role: 'backbeat', intensity: 'medium', weight: 0.85, label: 'Snare 1', hapticPattern: 'medium' },
  { id: 'b5-3', targetTimestampMs: 9000, bar: 5, beat: 3.0, role: 'downbeat', intensity: 'strong', weight: 0.95, label: 'Kick 2', hapticPattern: 'heavy' },
  { id: 'b5-4', targetTimestampMs: 9500, bar: 5, beat: 4.0, role: 'backbeat', intensity: 'medium', weight: 0.85, label: 'Snare 2', hapticPattern: 'medium' },

  // --- Bar 6 (10000ms - 12000ms): Climax Cadence & Final Resolution ---
  { id: 'b6-1', targetTimestampMs: 10000, bar: 6, beat: 1.0, role: 'downbeat', intensity: 'strong', weight: 1.0, label: 'Kick 1', hapticPattern: 'heavy' },
  { id: 'b6-2', targetTimestampMs: 10500, bar: 6, beat: 2.0, role: 'backbeat', intensity: 'medium', weight: 0.9, label: 'Snare 1', hapticPattern: 'medium' },
  { id: 'b6-3', targetTimestampMs: 11000, bar: 6, beat: 3.0, role: 'accent', intensity: 'strong', weight: 1.0, label: 'Accent 1', hapticPattern: 'rigid' },
  { id: 'b6-4', targetTimestampMs: 11500, bar: 6, beat: 4.0, role: 'resolution', intensity: 'strong', weight: 1.0, label: 'Final Resolution', hapticPattern: 'pulse' },
];

/**
 * Payload data for visual rhythm cues.
 */
export interface VisualCuePayload {
  role: BeatRole;
  intensity: MusicalIntensity;
  weight: number;
  bar: number;
  beat: number;
  label: string;
}

/**
 * Generates ScheduledEventInput array for the 'haptic' channel from the canonical score.
 * Retains exact backwards compatibility with Milestone 4.
 */
export function getDemoTrackHapticCues(timelineRevision?: number): ScheduledEventInput<HapticCuePayload>[] {
  return CANONICAL_DEMO_RHYTHM_SCORE.map((cue) => ({
    id: `haptic-${cue.id}`,
    targetTimestampMs: cue.targetTimestampMs,
    channel: 'haptic',
    type: 'beat',
    timelineRevision,
    payload: {
      pattern: cue.hapticPattern,
      weight: cue.weight,
      label: cue.label,
    },
  }));
}

/**
 * Generates ScheduledEventInput array for the 'visual' channel from the canonical score.
 */
export function getDemoTrackVisualCues(timelineRevision?: number): ScheduledEventInput<VisualCuePayload>[] {
  return CANONICAL_DEMO_RHYTHM_SCORE.map((cue) => ({
    id: `visual-${cue.id}`,
    targetTimestampMs: cue.targetTimestampMs,
    channel: 'visual',
    type: 'rhythm',
    timelineRevision,
    payload: {
      role: cue.role,
      intensity: cue.intensity,
      weight: cue.weight,
      bar: cue.bar,
      beat: cue.beat,
      label: cue.label,
    },
  }));
}

/**
 * Schedules all canonical demo track sensory cues (both haptic and visual) onto the event scheduler.
 */
export function scheduleDemoTrackSensoryCues(
  scheduler: IEventScheduler,
  timelineRevision?: number
): void {
  const hapticCues = getDemoTrackHapticCues(timelineRevision);
  const visualCues = getDemoTrackVisualCues(timelineRevision);
  scheduler.scheduleBatch(hapticCues);
  scheduler.scheduleBatch(visualCues);
}
