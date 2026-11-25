/**
 * Track Score Scheduler
 *
 * Schedules a song's CanonicalRhythmCue[] score into PriorityEventScheduler
 * for both FEEL (tactile haptics) and SEE (visual rhythm) channels.
 * Guarantees exact timestamp equality and payload schema parity across both channels,
 * and supports O(log n + k) rolling look-ahead window replenishment for full-length songs.
 */

import { IEventScheduler } from '@/engines/event-scheduler';
import { ScheduledEventInput } from '@/engines/synchronization';
import { HapticCuePayload } from '@/engines/haptic';
import { CanonicalRhythmCue, VisualCuePayload } from './demoTrackScore';

function findFirstCueIndexAtOrAfter(
  score: CanonicalRhythmCue[],
  targetMs: number
): number {
  let low = 0;
  let high = score.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (score[mid].targetTimestampMs < targetMs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function buildSensoryEventsForCues(
  cues: CanonicalRhythmCue[],
  revision: number
): {
  hapticEvents: ScheduledEventInput<HapticCuePayload>[];
  visualEvents: ScheduledEventInput<VisualCuePayload>[];
} {
  const hapticEvents: ScheduledEventInput<HapticCuePayload>[] = [];
  const visualEvents: ScheduledEventInput<VisualCuePayload>[] = [];

  for (const cue of cues) {
    // 1. FEEL Channel (Tactile Haptic Actuation) - matches HapticCuePayload
    hapticEvents.push({
      id: `haptic-${revision}-${cue.id}`,
      channel: 'haptic',
      type: 'beat',
      targetTimestampMs: cue.targetTimestampMs,
      timelineRevision: revision,
      payload: {
        pattern: cue.hapticPattern,
        weight: cue.weight,
        label: cue.label,
      },
    });

    // 2. SEE Channel (Visual Rhythm Surface & Radar) - matches VisualCuePayload
    visualEvents.push({
      id: `visual-${revision}-${cue.id}`,
      channel: 'visual',
      type: 'rhythm',
      targetTimestampMs: cue.targetTimestampMs,
      timelineRevision: revision,
      payload: {
        role: cue.role,
        intensity: cue.intensity,
        weight: cue.weight,
        bar: cue.bar,
        beat: cue.beat,
        label: cue.label,
      },
    });
  }

  return { hapticEvents, visualEvents };
}

/**
 * Schedules all cues in a score in bulk.
 */
export function scheduleTrackSensoryCues(
  scheduler: IEventScheduler,
  revision: number,
  score: CanonicalRhythmCue[]
): void {
  if (!score || score.length === 0) return;

  const { hapticEvents, visualEvents } = buildSensoryEventsForCues(score, revision);
  scheduler.scheduleBatch(hapticEvents);
  scheduler.scheduleBatch(visualEvents);
}

/**
 * Schedules cues falling inside [windowStartMs, windowEndMs) using binary search,
 * enabling continuous rolling look-ahead replenishment across full-length songs.
 */
export function scheduleTrackSensoryCuesInWindow(
  scheduler: IEventScheduler,
  revision: number,
  score: CanonicalRhythmCue[],
  windowStartMs: number,
  windowEndMs: number
): number {
  if (!score || score.length === 0 || windowEndMs <= windowStartMs) return 0;

  const startIndex = findFirstCueIndexAtOrAfter(score, windowStartMs);
  const windowCues: CanonicalRhythmCue[] = [];

  for (let i = startIndex; i < score.length; i++) {
    const cue = score[i];
    if (cue.targetTimestampMs >= windowEndMs) {
      break;
    }
    windowCues.push(cue);
  }

  if (windowCues.length === 0) return 0;

  const { hapticEvents, visualEvents } = buildSensoryEventsForCues(windowCues, revision);
  scheduler.scheduleBatch(hapticEvents);
  scheduler.scheduleBatch(visualEvents);

  return windowCues.length;
}
