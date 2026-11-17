/**
 * Demo Track Haptic Cues (FEEL Pillar)
 *
 * Pre-composed rhythmic haptic score for the bundled 120 BPM demo track:
 * assets/music/vibebridge_demo.wav (12.0 seconds, 6 bars of 4/4).
 *
 * Timing:
 * - 120 BPM = 500ms per quarter note beat.
 * - Eighth note = 250ms.
 * - Downbeats (Beats 1 & 3): Heavy impact (Kick/Bass)
 * - Backbeats (Beats 2 & 4): Medium impact (Snare)
 * - Off-beats (Eighth notes): Light impact (Hi-hat)
 */

import { ScheduledEventInput } from '@/engines/synchronization';
import { IEventScheduler } from '@/engines/event-scheduler';
import { HapticCuePayload } from '@/engines/haptic';

export const DEMO_TRACK_HAPTIC_CUES: ScheduledEventInput<HapticCuePayload>[] = [
  // --- Bar 1 (0ms - 2000ms) ---
  { id: 'haptic-b1-1', targetTimestampMs: 0, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy', weight: 1.0, label: 'Kick 1' } },
  { id: 'haptic-b1-1.5', targetTimestampMs: 250, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b1-2', targetTimestampMs: 500, channel: 'haptic', type: 'beat', payload: { pattern: 'medium', weight: 0.85, label: 'Snare 1' } },
  { id: 'haptic-b1-2.5', targetTimestampMs: 750, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b1-3', targetTimestampMs: 1000, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy', weight: 0.95, label: 'Kick 2' } },
  { id: 'haptic-b1-3.5', targetTimestampMs: 1250, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b1-4', targetTimestampMs: 1500, channel: 'haptic', type: 'beat', payload: { pattern: 'medium', weight: 0.85, label: 'Snare 2' } },
  { id: 'haptic-b1-4.5', targetTimestampMs: 1750, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },

  // --- Bar 2 (2000ms - 4000ms) ---
  { id: 'haptic-b2-1', targetTimestampMs: 2000, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy', weight: 1.0, label: 'Kick 1' } },
  { id: 'haptic-b2-1.5', targetTimestampMs: 2250, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b2-2', targetTimestampMs: 2500, channel: 'haptic', type: 'beat', payload: { pattern: 'medium', weight: 0.85, label: 'Snare 1' } },
  { id: 'haptic-b2-2.5', targetTimestampMs: 2750, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b2-3', targetTimestampMs: 3000, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy', weight: 0.95, label: 'Kick 2' } },
  { id: 'haptic-b2-3.5', targetTimestampMs: 3250, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b2-4', targetTimestampMs: 3500, channel: 'haptic', type: 'beat', payload: { pattern: 'medium', weight: 0.85, label: 'Snare 2' } },
  { id: 'haptic-b2-4.5', targetTimestampMs: 3750, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },

  // --- Bar 3 (4000ms - 6000ms) ---
  { id: 'haptic-b3-1', targetTimestampMs: 4000, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy', weight: 1.0, label: 'Kick 1' } },
  { id: 'haptic-b3-1.5', targetTimestampMs: 4250, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b3-2', targetTimestampMs: 4500, channel: 'haptic', type: 'beat', payload: { pattern: 'medium', weight: 0.85, label: 'Snare 1' } },
  { id: 'haptic-b3-2.5', targetTimestampMs: 4750, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b3-3', targetTimestampMs: 5000, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy', weight: 0.95, label: 'Kick 2' } },
  { id: 'haptic-b3-3.5', targetTimestampMs: 5250, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b3-4', targetTimestampMs: 5500, channel: 'haptic', type: 'beat', payload: { pattern: 'medium', weight: 0.85, label: 'Snare 2' } },
  { id: 'haptic-b3-4.5', targetTimestampMs: 5750, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },

  // --- Bar 4 (6000ms - 8000ms) ---
  { id: 'haptic-b4-1', targetTimestampMs: 6000, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy', weight: 1.0, label: 'Kick 1' } },
  { id: 'haptic-b4-1.5', targetTimestampMs: 6250, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b4-2', targetTimestampMs: 6500, channel: 'haptic', type: 'beat', payload: { pattern: 'medium', weight: 0.85, label: 'Snare 1' } },
  { id: 'haptic-b4-2.5', targetTimestampMs: 6750, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b4-3', targetTimestampMs: 7000, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy', weight: 0.95, label: 'Kick 2' } },
  { id: 'haptic-b4-3.5', targetTimestampMs: 7250, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b4-4', targetTimestampMs: 7500, channel: 'haptic', type: 'beat', payload: { pattern: 'medium', weight: 0.85, label: 'Snare 2' } },
  { id: 'haptic-b4-4.5', targetTimestampMs: 7750, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },

  // --- Bar 5 (8000ms - 10000ms) ---
  { id: 'haptic-b5-1', targetTimestampMs: 8000, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy', weight: 1.0, label: 'Kick 1' } },
  { id: 'haptic-b5-1.5', targetTimestampMs: 8250, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b5-2', targetTimestampMs: 8500, channel: 'haptic', type: 'beat', payload: { pattern: 'medium', weight: 0.85, label: 'Snare 1' } },
  { id: 'haptic-b5-2.5', targetTimestampMs: 8750, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b5-3', targetTimestampMs: 9000, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy', weight: 0.95, label: 'Kick 2' } },
  { id: 'haptic-b5-3.5', targetTimestampMs: 9250, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },
  { id: 'haptic-b5-4', targetTimestampMs: 9500, channel: 'haptic', type: 'beat', payload: { pattern: 'medium', weight: 0.85, label: 'Snare 2' } },
  { id: 'haptic-b5-4.5', targetTimestampMs: 9750, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.5, label: 'Hi-hat' } },

  // --- Bar 6 (10000ms - 12000ms) Rhythmic Build & Final Resolution ---
  { id: 'haptic-b6-1', targetTimestampMs: 10000, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy', weight: 1.0, label: 'Kick 1' } },
  { id: 'haptic-b6-1.5', targetTimestampMs: 10250, channel: 'haptic', type: 'beat', payload: { pattern: 'light', weight: 0.6, label: 'Hi-hat' } },
  { id: 'haptic-b6-2', targetTimestampMs: 10500, channel: 'haptic', type: 'beat', payload: { pattern: 'medium', weight: 0.9, label: 'Snare 1' } },
  { id: 'haptic-b6-2.5', targetTimestampMs: 10750, channel: 'haptic', type: 'beat', payload: { pattern: 'medium', weight: 0.9, label: 'Snare Roll' } },
  { id: 'haptic-b6-3', targetTimestampMs: 11000, channel: 'haptic', type: 'beat', payload: { pattern: 'rigid', weight: 1.0, label: 'Accent 1' } },
  { id: 'haptic-b6-3.5', targetTimestampMs: 11250, channel: 'haptic', type: 'beat', payload: { pattern: 'rigid', weight: 1.0, label: 'Accent 2' } },
  { id: 'haptic-b6-4', targetTimestampMs: 11500, channel: 'haptic', type: 'beat', payload: { pattern: 'pulse', weight: 1.0, label: 'Final Resolution' } },
];

/**
 * Helper to schedule the demo track's haptic cues onto an event scheduler.
 */
export function scheduleDemoTrackHaptics(
  scheduler: IEventScheduler,
  timelineRevision?: number
): void {
  const cuesToSchedule = timelineRevision !== undefined
    ? DEMO_TRACK_HAPTIC_CUES.map((cue) => ({ ...cue, timelineRevision }))
    : DEMO_TRACK_HAPTIC_CUES;

  scheduler.scheduleBatch(cuesToSchedule);
}
