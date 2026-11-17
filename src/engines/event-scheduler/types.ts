/**
 * Event Scheduler Types & Contracts
 */

import {
  SensoryChannel,
  ScheduledEventInput,
  DispatchedEvent,
  EventSubscriber,
} from '@/engines/synchronization';

export interface EventSchedulerConfig {
  /** Look-ahead window in milliseconds. Default: 80ms */
  lookAheadWindowMs?: number;
  /** Scheduling loop polling interval in milliseconds. Default: 20ms */
  pollingIntervalMs?: number;
  /**
   * Maximum lateness tolerance in milliseconds.
   * If an event arrives or is processed when current playback time has already
   * passed (scheduledTimestampMs < currentPosition - maxLatenessToleranceMs),
   * it is dropped as stale to prevent burst-firing of past cues.
   * Default: 50ms.
   */
  maxLatenessToleranceMs?: number;
}

export interface InternalScheduledEvent<T = unknown> {
  id: string;
  targetTimestampMs: number;
  scheduledTimestampMs: number;
  timelineRevision: number;
  type: string;
  channel: SensoryChannel;
  payload: T;
}

export interface IEventScheduler {
  /**
   * Schedule a timestamped sensory event.
   */
  schedule<T = unknown>(event: ScheduledEventInput<T>): void;

  /**
   * Schedule multiple timestamped sensory events in bulk.
   */
  scheduleBatch<T = unknown>(events: ScheduledEventInput<T>[]): void;

  /**
   * Cancel a pending event by ID. Returns true if found and removed.
   */
  cancel(id: string): boolean;

  /**
   * Clear all pending queued events and dispatched history.
   */
  clear(): void;

  /**
   * Subscribe to events dispatched for a specific sensory channel.
   */
  subscribe<T = unknown>(channel: SensoryChannel, subscriber: EventSubscriber<T>): () => void;

  /**
   * Subscribe to all dispatched events across all channels.
   */
  subscribeAll<T = unknown>(subscriber: EventSubscriber<T>): () => void;

  /**
   * Number of pending un-dispatched events in the queue.
   */
  getPendingEventCount(): number;

  /**
   * Manually step the scheduler. Useful for deterministic testing and manual animation loops.
   * Returns all events dispatched during this step.
   */
  tick(currentTimeMs?: number, monotonicNowMs?: number): DispatchedEvent[];

  /**
   * Start the single controlled background scheduling loop.
   */
  start(): void;

  /**
   * Stop the scheduling loop.
   */
  stop(): void;

  /**
   * Completely dispose the scheduler and release all subscriptions.
   */
  dispose(): void;
}
