/**
 * Demo Track Haptic Cues (FEEL Pillar)
 *
 * Derived from the canonical shared rhythm score in @/features/rhythm.
 * Maintains 100% backward compatibility for all haptic consumers and verification suites.
 */

import { ScheduledEventInput } from '@/engines/synchronization';
import { IEventScheduler } from '@/engines/event-scheduler';
import { HapticCuePayload } from '@/engines/haptic';
import { getDemoTrackHapticCues } from '@/features/rhythm';

export const DEMO_TRACK_HAPTIC_CUES: ScheduledEventInput<HapticCuePayload>[] =
  getDemoTrackHapticCues();

/**
 * Helper to schedule the demo track's haptic cues onto an event scheduler.
 */
export function scheduleDemoTrackHaptics(
  scheduler: IEventScheduler,
  timelineRevision?: number
): void {
  const cues = getDemoTrackHapticCues(timelineRevision);
  scheduler.scheduleBatch(cues);
}
