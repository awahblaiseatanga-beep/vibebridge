/**
 * Engine: Event Scheduler
 *
 * Responsibilities:
 * - High-precision timeline scheduling for timestamped cues (Haptics, Lyrics, Visuals).
 * - Implements a rolling look-ahead window to prevent main-thread starvation.
 * - Handles seeking, pausing, and cue resets accurately.
 *
 * Status: Interface defined.
 */

export interface ScheduledEvent<T = unknown> {
  id: string;
  timestampMs: number;
  payload: T;
}

export interface EventScheduler<T = unknown> {
  schedule(events: ScheduledEvent<T>[]): void;
  seek(positionMs: number): void;
  update(currentPositionMs: number): ScheduledEvent<T>[];
  clear(): void;
}
