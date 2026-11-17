/**
 * PriorityEventScheduler
 *
 * Chronological, latency-compensated event scheduler.
 * Enforces single controlled scheduling loop, duplicate prevention, and timeline revision invalidation.
 */

import {
  DispatchedEvent,
  EventSubscriber,
  LatencyManager,
  latencyManager as defaultLatencyManager,
  MasterClock,
  masterClock as defaultMasterClock,
  ScheduledEventInput,
  SensoryChannel,
} from '@/engines/synchronization';
import {
  EventSchedulerConfig,
  IEventScheduler,
  InternalScheduledEvent,
} from './types';

export class PriorityEventScheduler implements IEventScheduler {
  private masterClock: MasterClock;
  private latencyManager: LatencyManager;

  private lookAheadWindowMs: number;
  private pollingIntervalMs: number;
  private maxLatenessToleranceMs: number;

  // Chronologically sorted event queue (by scheduledTimestampMs ASC)
  private events: InternalScheduledEvent[] = [];

  // Set of dispatched event IDs for the current timeline to prevent duplicates
  private dispatchedIds = new Set<string>();

  // Last known timeline revision
  private currentRevision = 0;

  // Channel-specific and global subscribers
  private channelSubscribers = new Map<SensoryChannel, Set<EventSubscriber>>();
  private allSubscribers = new Set<EventSubscriber>();

  // Single controlled loop handle
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private clockStatusUnsubscribe: (() => void) | null = null;
  private clockUpdateUnsubscribe: (() => void) | null = null;

  constructor(
    config?: EventSchedulerConfig,
    clock: MasterClock = defaultMasterClock,
    latency: LatencyManager = defaultLatencyManager
  ) {
    this.lookAheadWindowMs = config?.lookAheadWindowMs ?? 80;
    this.pollingIntervalMs = config?.pollingIntervalMs ?? 20;
    this.maxLatenessToleranceMs = config?.maxLatenessToleranceMs ?? 50;
    this.masterClock = clock;
    this.latencyManager = latency;

    this.currentRevision = this.masterClock.getClock().timelineRevision;

    // Synchronize with master clock lifecycle
    this.clockStatusUnsubscribe = this.masterClock.onStatusChange((status) => {
      if (status === 'playing') {
        this.start();
      } else if (status === 'paused' || status === 'stopped' || status === 'error') {
        this.stop();
      }
    });

    this.clockUpdateUnsubscribe = this.masterClock.onClockUpdate((clockSnapshot) => {
      if (clockSnapshot.timelineRevision !== this.currentRevision) {
        this.handleRevisionChange(clockSnapshot.timelineRevision);
      }
    });
  }

  /**
   * Helper returning monotonic timestamp in milliseconds.
   */
  private getMonotonicTime(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  /**
   * Handle changes in timeline revision (e.g. user seek or track load).
   * Discards outdated events and clears dispatched history.
   */
  private handleRevisionChange(newRevision: number): void {
    this.currentRevision = newRevision;
    // Clear history of past dispatched IDs for the previous revision
    this.dispatchedIds.clear();
    // Drop all events with outdated timeline revision
    this.events = this.events.filter((e) => e.timelineRevision === newRevision);
  }

  /**
   * Schedule a single event.
   */
  public schedule<T = unknown>(input: ScheduledEventInput<T>): void {
    this.scheduleBatch([input]);
  }

  /**
   * Schedule multiple events in bulk.
   */
  public scheduleBatch<T = unknown>(inputs: ScheduledEventInput<T>[]): void {
    const clockSnapshot = this.masterClock.getClock();
    const activeRevision = clockSnapshot.timelineRevision;

    for (const input of inputs) {
      // Discard event immediately if explicitly tagged with an outdated revision
      const eventRevision = input.timelineRevision ?? activeRevision;
      if (eventRevision < activeRevision) {
        continue;
      }

      // Compute latency-compensated trigger time
      const scheduledTimestampMs = this.latencyManager.computeTriggerTimestamp(
        input.targetTimestampMs,
        input.channel
      );

      // Discard event upfront if playback is active and the event is already stale
      const currentPos = this.masterClock.getEstimatedPositionMs();
      if (
        clockSnapshot.status === 'playing' &&
        scheduledTimestampMs < currentPos - this.maxLatenessToleranceMs
      ) {
        continue;
      }

      const internalEvent: InternalScheduledEvent<T> = {
        id: input.id,
        targetTimestampMs: input.targetTimestampMs,
        scheduledTimestampMs,
        timelineRevision: eventRevision,
        type: input.type,
        channel: input.channel,
        payload: input.payload,
      };

      this.insertSorted(internalEvent);
    }
  }

  /**
   * Inserts an event into the chronological queue using binary search for O(log n) efficiency.
   */
  private insertSorted(event: InternalScheduledEvent): void {
    // If event with this ID already exists, replace it
    const existingIndex = this.events.findIndex((e) => e.id === event.id);
    if (existingIndex !== -1) {
      this.events.splice(existingIndex, 1);
    }

    let low = 0;
    let high = this.events.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      // Use <= for stable FIFO ordering when timestamps are identical
      if (this.events[mid].scheduledTimestampMs <= event.scheduledTimestampMs) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    this.events.splice(low, 0, event);
  }

  /**
   * Cancel an event by ID.
   */
  public cancel(id: string): boolean {
    const index = this.events.findIndex((e) => e.id === id);
    if (index !== -1) {
      this.events.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all pending events and history.
   */
  public clear(): void {
    this.events = [];
    this.dispatchedIds.clear();
  }

  /**
   * Subscribe to events for a specific channel.
   */
  public subscribe<T = unknown>(
    channel: SensoryChannel,
    subscriber: EventSubscriber<T>
  ): () => void {
    if (!this.channelSubscribers.has(channel)) {
      this.channelSubscribers.set(channel, new Set());
    }
    const set = this.channelSubscribers.get(channel)!;
    set.add(subscriber as EventSubscriber);
    return () => {
      set.delete(subscriber as EventSubscriber);
    };
  }

  /**
   * Subscribe to all events across all channels.
   */
  public subscribeAll<T = unknown>(subscriber: EventSubscriber<T>): () => void {
    this.allSubscribers.add(subscriber as EventSubscriber);
    return () => {
      this.allSubscribers.delete(subscriber as EventSubscriber);
    };
  }

  public getPendingEventCount(): number {
    return this.events.length;
  }

  /**
   * Primary scheduler tick.
   * Can be driven automatically by the internal loop or stepped deterministically in tests.
   */
  public tick(currentTimeMs?: number, monotonicNowMs?: number): DispatchedEvent[] {
    const clock = this.masterClock.getClock();

    // Verify timeline revision is up-to-date
    if (clock.timelineRevision !== this.currentRevision) {
      this.handleRevisionChange(clock.timelineRevision);
    }

    // Never fire events when paused, stopped, buffering, or completed
    if (currentTimeMs === undefined) {
      if (clock.status !== 'playing' || clock.isBuffering) {
        return [];
      }
    }

    const currentPosition =
      currentTimeMs !== undefined
        ? currentTimeMs
        : this.masterClock.getEstimatedPositionMs();

    // Do not fire events after the track has ended
    if (clock.durationMs > 0 && currentPosition >= clock.durationMs) {
      return [];
    }

    const monotonicNow =
      monotonicNowMs !== undefined ? monotonicNowMs : this.getMonotonicTime();

    // Horizon covers current time up through the look-ahead window
    const horizonMs = currentPosition + this.lookAheadWindowMs;
    const effectiveHorizonMs =
      clock.durationMs > 0 ? Math.min(horizonMs, clock.durationMs) : horizonMs;

    const dispatchedThisTick: DispatchedEvent[] = [];
    const remainingEvents: InternalScheduledEvent[] = [];
    const minTimelyTimestamp = currentPosition - this.maxLatenessToleranceMs;

    for (const event of this.events) {
      // Discard event if outdated revision
      if (event.timelineRevision !== this.currentRevision) {
        continue;
      }

      // Late-event policy: drop stale events older than maxLatenessToleranceMs
      if (event.scheduledTimestampMs < minTimelyTimestamp) {
        continue;
      }

      // If scheduled time has arrived within the look-ahead window
      if (event.scheduledTimestampMs <= effectiveHorizonMs) {
        // Prevent duplicate dispatch
        if (this.dispatchedIds.has(event.id)) {
          continue;
        }

        this.dispatchedIds.add(event.id);

        const dispatched: DispatchedEvent = {
          id: event.id,
          targetTimestampMs: event.targetTimestampMs,
          scheduledTimestampMs: event.scheduledTimestampMs,
          dispatchedAtMs: monotonicNow,
          timelineRevision: event.timelineRevision,
          type: event.type,
          channel: event.channel,
          payload: event.payload,
        };

        dispatchedThisTick.push(dispatched);

        // Deliver to channel subscribers
        const channelSet = this.channelSubscribers.get(event.channel);
        if (channelSet) {
          channelSet.forEach((subscriber) => {
            try {
              subscriber(dispatched);
            } catch (err) {
              console.error(`[EventScheduler] Subscriber error on channel ${event.channel}:`, err);
            }
          });
        }

        // Deliver to global subscribers
        this.allSubscribers.forEach((subscriber) => {
          try {
            subscriber(dispatched);
          } catch (err) {
            console.error('[EventScheduler] Global subscriber error:', err);
          }
        });
      } else {
        // Since queue is chronologically sorted, events after horizon remain for future ticks
        remainingEvents.push(event);
      }
    }

    this.events = remainingEvents;
    return dispatchedThisTick;
  }

  /**
   * Start the single controlled scheduler loop.
   */
  public start(): void {
    if (this.timerHandle) return;
    this.timerHandle = setInterval(() => {
      this.tick();
    }, this.pollingIntervalMs);
  }

  /**
   * Stop the scheduler loop.
   */
  public stop(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  /**
   * Dispose scheduler and all subscriptions.
   */
  public dispose(): void {
    this.stop();
    if (this.clockStatusUnsubscribe) {
      this.clockStatusUnsubscribe();
      this.clockStatusUnsubscribe = null;
    }
    if (this.clockUpdateUnsubscribe) {
      this.clockUpdateUnsubscribe();
      this.clockUpdateUnsubscribe = null;
    }
    this.channelSubscribers.clear();
    this.allSubscribers.clear();
    this.clear();
  }
}

export const eventScheduler: IEventScheduler = new PriorityEventScheduler();
