/**
 * LyricsEngine (READ Pillar)
 *
 * Dedicated synchronized lyrics engine implementing ILyricsEngine.
 * - Anchored to MasterClock for authoritative timeline synchronization.
 * - Reacts to PriorityEventScheduler for boundary notification cues.
 * - Resolves active line in O(log n) time directly from clock position to remain
 *   100% accurate even if JavaScript thread execution experiences transient delays.
 * - Distinguishes active lines, instrumental gaps, before-track, and after-track states.
 * - Handles seeking, pause/resume, track changes, and empty/un-lyriced tracks safely.
 */

import { MasterClock, masterClock as defaultMasterClock } from '@/engines/synchronization';
import { IEventScheduler, eventScheduler as defaultEventScheduler } from '@/engines/event-scheduler';
import {
  ILyricsEngine,
  LyricCuePayload,
  LyricSegment,
  LyricsEngineState,
  LyricsStateListener,
  TrackLyrics,
} from './types';
import { LyricsTimeline } from './LyricsTimeline';

export class LyricsEngine implements ILyricsEngine {
  private timeline: LyricsTimeline;
  private activeClock: MasterClock | null = null;
  private activeScheduler: IEventScheduler | null = null;

  private clockStatusUnsubscribe: (() => void) | null = null;
  private clockUpdateUnsubscribe: (() => void) | null = null;
  private schedulerUnsubscribe: (() => void) | null = null;

  private currentRevision = 0;
  private stateListeners = new Set<LyricsStateListener>();
  private state: LyricsEngineState;

  constructor(
    initialLyrics: TrackLyrics | null = null,
    clock: MasterClock = defaultMasterClock,
    scheduler: IEventScheduler = defaultEventScheduler
  ) {
    this.timeline = new LyricsTimeline(initialLyrics);

    const initialResolution = this.timeline.resolveAt(0);

    this.state = {
      trackId: this.timeline.getTrackId(),
      hasLyrics: this.timeline.hasLyrics(),
      isDemonstration: this.timeline.getIsDemonstration(),
      demonstrationLabel: this.timeline.getDemonstrationLabel(),
      segments: this.timeline.getSegments(),
      status: initialResolution.status,
      activeIndex: initialResolution.activeIndex,
      activeSegment: initialResolution.activeSegment,
      previousSegment: initialResolution.previousSegment,
      upcomingSegments: initialResolution.upcomingSegments,
      currentPositionMs: 0,
      isPaused: true,
      isBuffering: false,
      isEnded: false,
      totalSegmentsCount: this.timeline.getSegmentCount(),
    };

    this.attachMasterClock(clock);
    if (scheduler) {
      this.attachScheduler(scheduler);
    }
  }

  /**
   * Returns current state snapshot.
   */
  public getState(): LyricsEngineState {
    return {
      ...this.state,
      segments: [...this.state.segments],
      upcomingSegments: [...this.state.upcomingSegments],
    };
  }

  /**
   * Loads a new set of track lyrics into the engine.
   * Passing null or a track with empty segments safely sets hasLyrics to false.
   */
  public loadLyrics(lyrics: TrackLyrics | null): void {
    this.timeline = new LyricsTimeline(lyrics);

    const currentPos = this.activeClock ? this.activeClock.getEstimatedPositionMs() : 0;
    const resolution = this.timeline.resolveAt(currentPos);

    this.state = {
      ...this.state,
      trackId: this.timeline.getTrackId(),
      hasLyrics: this.timeline.hasLyrics(),
      isDemonstration: this.timeline.getIsDemonstration(),
      demonstrationLabel: this.timeline.getDemonstrationLabel(),
      segments: this.timeline.getSegments(),
      status: resolution.status,
      activeIndex: resolution.activeIndex,
      activeSegment: resolution.activeSegment,
      previousSegment: resolution.previousSegment,
      upcomingSegments: resolution.upcomingSegments,
      currentPositionMs: currentPos,
      totalSegmentsCount: this.timeline.getSegmentCount(),
    };

    // If a scheduler is active and we have lyrics, schedule boundary cues
    if (this.activeScheduler && this.timeline.hasLyrics()) {
      const cues = this.timeline.toScheduledEvents(this.currentRevision);
      this.activeScheduler.scheduleBatch(cues);
    }

    this.emitState();
  }

  /**
   * Clears loaded lyrics and resets state to empty.
   */
  public clearLyrics(): void {
    this.loadLyrics(null);
  }

  /**
   * Queries the active lyric segment at an explicit positionMs or the current clock estimation.
   */
  public getActiveSegment(positionMs?: number): LyricSegment | null {
    const pos = typeof positionMs === 'number'
      ? positionMs
      : (this.activeClock ? this.activeClock.getEstimatedPositionMs() : this.state.currentPositionMs);

    return this.timeline.resolveAt(pos).activeSegment;
  }

  /**
   * Subscribes a listener to reactive state updates.
   * Immediately calls the listener with the current state snapshot.
   */
  public onLyricsStateChange(listener: LyricsStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Attach to MasterClock for continuous timeline tracking and seek invalidation.
   */
  public attachMasterClock(clock: MasterClock): void {
    this.detachMasterClock();
    this.activeClock = clock;

    const initialSnapshot = clock.getClock();
    this.currentRevision = initialSnapshot.timelineRevision;
    this.state.isPaused = initialSnapshot.status !== 'playing';
    this.state.isBuffering = initialSnapshot.isBuffering;
    this.state.isEnded = initialSnapshot.status === 'stopped' && initialSnapshot.positionMs > 0;

    // 1. Status change listener
    this.clockStatusUnsubscribe = clock.onStatusChange((status) => {
      const wasPaused = this.state.isPaused;
      this.state.isPaused = status !== 'playing';
      this.state.isEnded = status === 'stopped';

      if (status === 'playing' && wasPaused) {
        // Resuming from pause: immediately re-evaluate active segment at current position
        this.updatePositionFromClock();
      }

      this.emitState();
    });

    // 2. Authoritative clock update listener
    this.clockUpdateUnsubscribe = clock.onClockUpdate((clockSnapshot) => {
      // Timeline Revision Change (Seek or Track Replacement)
      if (clockSnapshot.timelineRevision !== this.currentRevision) {
        this.currentRevision = clockSnapshot.timelineRevision;

        // Immediately resolve at new seek position
        this.updatePositionFromClock(clockSnapshot.positionMs);

        // Reschedule lyric boundary events on the new revision if lyrics exist
        if (this.activeScheduler && this.timeline.hasLyrics()) {
          const cues = this.timeline.toScheduledEvents(this.currentRevision);
          this.activeScheduler.scheduleBatch(cues);
        }
        return;
      }

      // Buffering state change
      if (this.state.isBuffering !== clockSnapshot.isBuffering) {
        this.state.isBuffering = clockSnapshot.isBuffering;
        this.emitState();
      }

      // During active playback, continuously synchronize position
      if (clockSnapshot.status === 'playing' && !clockSnapshot.isBuffering) {
        this.updatePositionFromClock();
      }
    });

    // Initial evaluation
    this.updatePositionFromClock();
  }

  /**
   * Detach from MasterClock.
   */
  public detachMasterClock(): void {
    if (this.clockStatusUnsubscribe) {
      this.clockStatusUnsubscribe();
      this.clockStatusUnsubscribe = null;
    }
    if (this.clockUpdateUnsubscribe) {
      this.clockUpdateUnsubscribe();
      this.clockUpdateUnsubscribe = null;
    }
    this.activeClock = null;
  }

  /**
   * Attach to PriorityEventScheduler to receive boundary cues and schedule lyrics events.
   */
  public attachScheduler(scheduler: IEventScheduler): void {
    this.detachScheduler();
    this.activeScheduler = scheduler;

    this.schedulerUnsubscribe = scheduler.subscribe<LyricCuePayload>(
      'lyrics',
      (event) => {
        // Invalidate outdated cue revisions
        if (event.timelineRevision !== this.currentRevision) {
          return;
        }

        // Rely on clock estimation as source of truth to avoid drift
        this.updatePositionFromClock();
      }
    );

    // If lyrics are already loaded, schedule their cues
    if (this.timeline.hasLyrics()) {
      const cues = this.timeline.toScheduledEvents(this.currentRevision);
      this.activeScheduler.scheduleBatch(cues);
    }
  }

  /**
   * Detach from PriorityEventScheduler.
   */
  public detachScheduler(): void {
    if (this.schedulerUnsubscribe) {
      this.schedulerUnsubscribe();
      this.schedulerUnsubscribe = null;
    }
    this.activeScheduler = null;
  }

  /**
   * Recalculates position and resolves active segment directly from authoritative clock.
   */
  private updatePositionFromClock(explicitPosMs?: number): void {
    if (!this.timeline.hasLyrics()) {
      return;
    }

    const pos = typeof explicitPosMs === 'number'
      ? explicitPosMs
      : (this.activeClock ? this.activeClock.getEstimatedPositionMs() : this.state.currentPositionMs);

    const resolution = this.timeline.resolveAt(pos);

    // Check if state changed to prevent unnecessary re-renders
    const changed =
      this.state.currentPositionMs !== pos ||
      this.state.status !== resolution.status ||
      this.state.activeIndex !== resolution.activeIndex ||
      this.state.activeSegment?.id !== resolution.activeSegment?.id;

    if (changed) {
      this.state.currentPositionMs = pos;
      this.state.status = resolution.status;
      this.state.activeIndex = resolution.activeIndex;
      this.state.activeSegment = resolution.activeSegment;
      this.state.previousSegment = resolution.previousSegment;
      this.state.upcomingSegments = resolution.upcomingSegments;
      this.emitState();
    }
  }

  private emitState(): void {
    const snapshot = this.getState();
    this.stateListeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[LyricsEngine] Listener error:', err);
      }
    });
  }

  public reset(): void {
    this.clearLyrics();
    this.state.currentPositionMs = 0;
    this.state.isPaused = true;
    this.state.isBuffering = false;
    this.state.isEnded = false;
    this.emitState();
  }

  public dispose(): void {
    this.detachScheduler();
    this.detachMasterClock();
    this.stateListeners.clear();
    this.reset();
  }
}

export const lyricsEngine: ILyricsEngine = new LyricsEngine();
