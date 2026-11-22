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
  ScoreProvider,
} from './types';

/**
 * Due-event dispatch tolerance in milliseconds (Stage A.7.1).
 * Prevents minor sub-frame rounding discrepancies and OS timer scheduling jitter
 * from deferring an event that is effectively due to the next polling interval.
 * Clamped strictly to 3ms (imperceptible to human senses, <1/5th of a 60Hz display frame).
 */
export const DUE_EVENT_TOLERANCE_MS = 3;

export class PriorityEventScheduler implements IEventScheduler {
  private masterClock: MasterClock;
  private latencyManager: LatencyManager;

  private lookAheadWindowMs: number;
  private pollingIntervalMs: number;
  private maxLatenessToleranceMs: number;
  private dueEventToleranceMs: number;

  // Chronologically sorted event queue (by scheduledTimestampMs ASC)
  private events: InternalScheduledEvent[] = [];

  // Set of dispatched event IDs for the current timeline to prevent duplicates
  private dispatchedIds = new Set<string>();

  // Last known timeline revision
  private currentRevision = 0;

  // Channel-specific and global subscribers
  private channelSubscribers = new Map<SensoryChannel, Set<EventSubscriber>>();
  private allSubscribers = new Set<EventSubscriber>();

  // Synchronous score provider callback invoked immediately upon timeline revision change
  private scoreProvider: ScoreProvider | null = null;

  // Single controlled loop handle
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  // Managed look-ahead wake-up timer handle (ensures sub-interval precision without uncontrolled timers)
  private stagedTimerHandle: ReturnType<typeof setTimeout> | null = null;
  private clockStatusUnsubscribe: (() => void) | null = null;
  private clockUpdateUnsubscribe: (() => void) | null = null;
  private latencyOffsetsUnsubscribe: (() => void) | null = null;

  constructor(
    config?: EventSchedulerConfig,
    clock: MasterClock = defaultMasterClock,
    latency: LatencyManager = defaultLatencyManager
  ) {
    this.lookAheadWindowMs = config?.lookAheadWindowMs ?? 80;
    this.pollingIntervalMs = config?.pollingIntervalMs ?? 20;
    this.maxLatenessToleranceMs = config?.maxLatenessToleranceMs ?? 50;
    this.dueEventToleranceMs = config?.dueEventToleranceMs ?? DUE_EVENT_TOLERANCE_MS;
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

    // Automatically re-compensate pending events when latency offsets are dynamically calibrated
    this.latencyOffsetsUnsubscribe = this.latencyManager.onOffsetsChange(() => {
      this.recomputePendingTimestamps();
    });
  }

  /**
   * Helper returning monotonic timestamp in milliseconds.
   */
  private getMonotonicTime(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  /**
   * Cancels any pending managed look-ahead wake-up timer.
   */
  private clearStagedTimer(): void {
    if (this.stagedTimerHandle) {
      clearTimeout(this.stagedTimerHandle);
      this.stagedTimerHandle = null;
    }
  }

  /**
   * Handle changes in timeline revision (e.g. user seek or track load).
   * Discards outdated events, clears staged wake-up timers, and resets dispatched history.
   */
  private handleRevisionChange(newRevision: number): void {
    this.clearStagedTimer();
    this.currentRevision = newRevision;
    // Clear history of past dispatched IDs for the previous revision
    this.dispatchedIds.clear();
    // Drop all events with outdated timeline revision
    this.events = this.events.filter((e) => e.timelineRevision === newRevision);

    // Synchronously populate new revision cues if a score provider is registered
    if (this.scoreProvider && newRevision > 0) {
      this.scoreProvider(this, newRevision);
    }
  }

  /**
   * Register a synchronous score provider.
   * Invoked immediately inside handleRevisionChange when the timeline revision advances,
   * eliminating passive useEffect rescheduling latency.
   */
  public setScoreProvider(provider: ScoreProvider | null): void {
    this.scoreProvider = provider;
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
      const isStartupBoundaryKick =
        input.targetTimestampMs === 0 &&
        currentPos <= 100;
      const isSeekLandingBoundary =
        Math.abs(currentPos - input.targetTimestampMs) <= 60;
      const isBoundaryException = isStartupBoundaryKick || isSeekLandingBoundary;

      if (
        clockSnapshot.status === 'playing' &&
        scheduledTimestampMs < currentPos - this.maxLatenessToleranceMs &&
        !isBoundaryException
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
    this.clearStagedTimer();
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

  public getPendingEvents(): readonly InternalScheduledEvent[] {
    return [...this.events];
  }

  /**
   * Recomputes latency-compensated trigger timestamps for pending events
   * when latency offsets are dynamically calibrated during playback.
   * Safe against audio restarts, seeks, and duplicate event dispatches.
   */
  public recomputePendingTimestamps(channel?: SensoryChannel): void {
    if (this.events.length === 0) return;

    this.clearStagedTimer();

    for (const event of this.events) {
      if (!channel || event.channel === channel) {
        event.scheduledTimestampMs = this.latencyManager.computeTriggerTimestamp(
          event.targetTimestampMs,
          event.channel
        );
      }
    }

    // Re-sort the queue in chronological order (by scheduledTimestampMs ASC)
    this.events.sort((a, b) => a.scheduledTimestampMs - b.scheduledTimestampMs);

    // If currently playing, check if earliest event is now immediately due or re-stage micro-timer
    const clockSnapshot = this.masterClock.getClock();
    if (clockSnapshot.status === 'playing' && !clockSnapshot.isBuffering) {
      const currentPos = this.masterClock.getEstimatedPositionMs();
      if (this.events.length > 0 && this.events[0].scheduledTimestampMs <= currentPos) {
        this.tick();
      } else {
        this.scheduleNextStagedTimer(currentPos, this.events, clockSnapshot.rate);
      }
    }
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

      // Late-event policy: drop stale events older than maxLatenessToleranceMs (default 50ms)
      const isTimely = event.scheduledTimestampMs >= minTimelyTimestamp;

      // Opening boundary kick exception: strictly for targetTimestampMs === 0
      // during initial playback startup of the current timeline revision (currentPosition <= 100ms)
      const isStartupBoundaryException =
        !isTimely &&
        event.targetTimestampMs === 0 &&
        currentPosition <= 100 &&
        !this.dispatchedIds.has(event.id);

      // Seek landing boundary exception: for events whose musical target is within 60ms
      // of currentPosition (e.g. visual cue compensated trigger fell slightly before seek landing)
      const isSeekLandingBoundaryException =
        !isTimely &&
        Math.abs(currentPosition - event.targetTimestampMs) <= 60 &&
        !this.dispatchedIds.has(event.id);

      const isBoundaryException = isStartupBoundaryException || isSeekLandingBoundaryException;

      if (!isTimely && !isBoundaryException) {
        continue;
      }

      // Dispatch when the compensated trigger time has arrived within the defined sub-frame tolerance
      // OR if it is a boundary exception (startup boundary kick or seek landing boundary)
      if (isBoundaryException || event.scheduledTimestampMs <= currentPosition + this.dueEventToleranceMs) {
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
        // Future event (either within look-ahead preparation window or beyond) remains in queue
        remainingEvents.push(event);
      }
    }

    this.events = remainingEvents;

    // In live playback, use look-ahead window to stage a controlled micro-timer for the next due event
    if (currentTimeMs === undefined && clock.status === 'playing' && !clock.isBuffering) {
      this.scheduleNextStagedTimer(currentPosition, remainingEvents, clock.rate);
    }

    return dispatchedThisTick;
  }

  /**
   * Look-ahead staging: schedules a single managed timer to wake up the scheduler
   * at the exact trigger time of the earliest upcoming event within the look-ahead window.
   */
  private scheduleNextStagedTimer(
    currentPosition: number,
    upcomingEvents: InternalScheduledEvent[],
    playbackRate: number = 1.0
  ): void {
    if (upcomingEvents.length === 0) {
      this.clearStagedTimer();
      return;
    }

    const nextEvent = upcomingEvents[0];
    const horizonMs = currentPosition + this.lookAheadWindowMs;

    // Only stage a wake-up timer if the next event falls within the look-ahead window
    if (nextEvent.scheduledTimestampMs <= horizonMs) {
      const timeRemainingMs = nextEvent.scheduledTimestampMs - (currentPosition + this.dueEventToleranceMs);
      const deltaMs = Math.max(
        1,
        Math.round(timeRemainingMs / (playbackRate || 1.0))
      );

      // If a staged timer is already active for an upcoming wake-up, let it complete
      if (this.stagedTimerHandle !== null) {
        return;
      }

      this.stagedTimerHandle = setTimeout(() => {
        this.stagedTimerHandle = null;
        this.tick();
      }, deltaMs);

      if (this.stagedTimerHandle && typeof (this.stagedTimerHandle as any).unref === 'function') {
        (this.stagedTimerHandle as any).unref();
      }
    } else {
      this.clearStagedTimer();
    }
  }

  /**
   * Start the single controlled scheduler loop.
   */
  public start(): void {
    if (this.timerHandle) return;
    this.tick();
    this.timerHandle = setInterval(() => {
      this.tick();
    }, this.pollingIntervalMs);
    if (this.timerHandle && typeof (this.timerHandle as any).unref === 'function') {
      (this.timerHandle as any).unref();
    }
  }

  /**
   * Stop the scheduler loop and cancel any pending staged wake-up timers.
   */
  public stop(): void {
    this.clearStagedTimer();
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
    this.clearStagedTimer();
    if (this.clockStatusUnsubscribe) {
      this.clockStatusUnsubscribe();
      this.clockStatusUnsubscribe = null;
    }
    if (this.clockUpdateUnsubscribe) {
      this.clockUpdateUnsubscribe();
      this.clockUpdateUnsubscribe = null;
    }
    if (this.latencyOffsetsUnsubscribe) {
      this.latencyOffsetsUnsubscribe();
      this.latencyOffsetsUnsubscribe = null;
    }
    this.channelSubscribers.clear();
    this.allSubscribers.clear();
    this.clear();
  }
}

export const eventScheduler: IEventScheduler = new PriorityEventScheduler();
