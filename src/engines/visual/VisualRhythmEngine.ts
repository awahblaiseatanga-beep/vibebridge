/**
 * VisualRhythmEngine
 *
 * Dedicated SEE pillar engine.
 * Subscribes reactively to PriorityEventScheduler's 'visual' channel.
 * Operates with ZERO independent timers or timeout loops.
 * All musical timings originate from MasterClock and PriorityEventScheduler.
 */

import { MasterClock, masterClock as defaultMasterClock } from '@/engines/synchronization';
import { IEventScheduler } from '@/engines/event-scheduler';
import { VisualCuePayload } from '@/features/rhythm';
import {
  DEFAULT_VISUAL_SCALE_CONFIG,
  IVisualRhythmEngine,
  VisualCueEvent,
  VisualEngineConfig,
  VisualRhythmState,
  VisualScaleConfig,
  VisualStateListener,
} from './types';
import { VisualEventMapper } from './VisualEventMapper';

export class VisualRhythmEngine implements IVisualRhythmEngine {
  private enabled: boolean;
  private reducedMotion: boolean;
  private scales: VisualScaleConfig;

  private state: VisualRhythmState;
  private currentRevision = 0;

  private stateListeners = new Set<VisualStateListener>();
  private activeScheduler: IEventScheduler | null = null;
  private schedulerUnsubscribe: (() => void) | null = null;

  private activeClock: MasterClock | null = null;
  private clockStatusUnsubscribe: (() => void) | null = null;
  private clockUpdateUnsubscribe: (() => void) | null = null;

  constructor(
    config?: VisualEngineConfig,
    clock: MasterClock = defaultMasterClock
  ) {
    this.enabled = config?.enabled ?? true;
    this.reducedMotion = config?.reducedMotion ?? false;
    this.scales = {
      ...DEFAULT_VISUAL_SCALE_CONFIG,
      ...config?.scales,
    };

    const initialVisual = VisualEventMapper.getRestingVisual(this.scales);

    this.state = {
      enabled: this.enabled,
      reducedMotion: this.reducedMotion,
      activeCue: null,
      currentBar: 1,
      currentBeat: 1,
      intensityLevel: 'rest',
      visual: initialVisual,
      isRest: true,
      isPaused: true,
      isBuffering: false,
      lastDispatchedAtMs: 0,
      totalEventsReceived: 0,
    };

    this.attachMasterClock(clock);
  }

  private getMonotonicTime(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  public getState(): VisualRhythmState {
    return {
      ...this.state,
      visual: { ...this.state.visual },
    };
  }

  public setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.state.enabled = enabled;

    if (!enabled) {
      // Suspend scheduler subscription when disabled to prevent redundant processing
      if (this.schedulerUnsubscribe) {
        this.schedulerUnsubscribe();
        this.schedulerUnsubscribe = null;
      }
      this.state.visual = VisualEventMapper.getRestingVisual(this.scales);
      this.state.intensityLevel = 'rest';
      this.state.isRest = true;
    } else {
      // Restore scheduler subscription if a scheduler is attached
      if (this.activeScheduler && !this.schedulerUnsubscribe) {
        this.subscribeToScheduler(this.activeScheduler);
      }
    }

    this.emitState();
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    this.state.reducedMotion = reducedMotion;

    // Re-evaluate current visual with new motion preference
    if (this.state.activeCue) {
      const mapped = VisualEventMapper.mapCueToVisual(
        this.state.activeCue,
        this.scales,
        this.reducedMotion
      );
      this.state.visual = mapped.visual;
      this.state.intensityLevel = mapped.intensityLevel;
    } else {
      this.state.visual = VisualEventMapper.getRestingVisual(this.scales);
    }

    this.emitState();
  }

  public setScales(scales: Partial<VisualScaleConfig>): void {
    this.scales = {
      ...this.scales,
      ...scales,
    };

    if (this.state.activeCue) {
      const mapped = VisualEventMapper.mapCueToVisual(
        this.state.activeCue,
        this.scales,
        this.reducedMotion
      );
      this.state.visual = mapped.visual;
      this.state.intensityLevel = mapped.intensityLevel;
      this.emitState();
    }
  }

  private handleVisualEvent(event: VisualCueEvent): void {
    if (!this.enabled) return;

    // Discard outdated cues if revision does not match
    if (event.timelineRevision !== this.currentRevision) {
      return;
    }

    const payload = event.payload;
    if (!payload) return;

    const mapped = VisualEventMapper.mapCueToVisual(
      payload,
      this.scales,
      this.reducedMotion
    );

    this.state.activeCue = payload;
    this.state.currentBar = payload.bar;
    this.state.currentBeat = payload.beat;
    this.state.intensityLevel = mapped.intensityLevel;
    this.state.visual = mapped.visual;
    this.state.isRest = false;
    this.state.isPaused = false;
    this.state.lastDispatchedAtMs = this.getMonotonicTime();
    this.state.totalEventsReceived++;

    this.emitState();
  }

  private subscribeToScheduler(scheduler: IEventScheduler): void {
    if (this.schedulerUnsubscribe) {
      this.schedulerUnsubscribe();
      this.schedulerUnsubscribe = null;
    }

    this.schedulerUnsubscribe = scheduler.subscribe<VisualCuePayload>(
      'visual',
      (event) => {
        this.handleVisualEvent(event);
      }
    );
  }

  public attachScheduler(scheduler: IEventScheduler): void {
    this.activeScheduler = scheduler;
    if (this.enabled) {
      this.subscribeToScheduler(scheduler);
    }
  }

  public detachScheduler(): void {
    if (this.schedulerUnsubscribe) {
      this.schedulerUnsubscribe();
      this.schedulerUnsubscribe = null;
    }
    this.activeScheduler = null;
  }

  public attachMasterClock(clock: MasterClock): void {
    this.detachMasterClock();
    this.activeClock = clock;

    const initialSnapshot = clock.getClock();
    this.currentRevision = initialSnapshot.timelineRevision;
    this.state.isPaused = initialSnapshot.status !== 'playing';
    this.state.isBuffering = initialSnapshot.isBuffering;

    this.clockStatusUnsubscribe = clock.onStatusChange((status) => {
      const wasPaused = this.state.isPaused;
      this.state.isPaused = status !== 'playing';

      if (status === 'paused' || status === 'stopped' || status === 'idle' || status === 'error') {
        // Freeze visual animations and settle to calm resting state
        this.state.visual = VisualEventMapper.getRestingVisual(this.scales);
        this.state.isRest = true;
      } else if (status === 'playing' && wasPaused) {
        // If resuming, clear paused flag; active cue will update on next scheduled event
        this.state.isPaused = false;
      }

      this.emitState();
    });

    this.clockUpdateUnsubscribe = clock.onClockUpdate((clockSnapshot) => {
      // 1. Revision invalidation check (Seek or Track Change)
      if (clockSnapshot.timelineRevision !== this.currentRevision) {
        this.currentRevision = clockSnapshot.timelineRevision;
        this.state.activeCue = null;
        this.state.visual = VisualEventMapper.getRestingVisual(this.scales);
        this.state.intensityLevel = 'rest';
        this.state.isRest = true;
        this.emitState();
        return;
      }

      // 2. Buffering check
      if (this.state.isBuffering !== clockSnapshot.isBuffering) {
        this.state.isBuffering = clockSnapshot.isBuffering;
        if (clockSnapshot.isBuffering) {
          this.state.visual = VisualEventMapper.getRestingVisual(this.scales);
        }
        this.emitState();
        return;
      }

      // 3. Musical Rest Check (between Bar 6 resolution at 11500ms and track loop at 12000ms)
      // When playback is actively playing past 11500ms without new beat events:
      if (
        clockSnapshot.status === 'playing' &&
        !clockSnapshot.isBuffering &&
        clockSnapshot.durationMs > 0 &&
        clockSnapshot.positionMs >= 11600 &&
        !this.state.isRest
      ) {
        this.state.isRest = true;
        this.state.intensityLevel = 'rest';
        this.state.visual = VisualEventMapper.getRestingVisual(this.scales);
        this.emitState();
      }
    });
  }

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

  public onVisualStateChange(listener: VisualStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private emitState(): void {
    const snapshot = this.getState();
    this.stateListeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[VisualRhythmEngine] Listener error:', err);
      }
    });
  }

  public reset(): void {
    this.state.activeCue = null;
    this.state.currentBar = 1;
    this.state.currentBeat = 1;
    this.state.intensityLevel = 'rest';
    this.state.visual = VisualEventMapper.getRestingVisual(this.scales);
    this.state.isRest = true;
    this.state.isPaused = true;
    this.state.isBuffering = false;
    this.state.lastDispatchedAtMs = 0;
    this.state.totalEventsReceived = 0;
    this.emitState();
  }

  public dispose(): void {
    this.detachScheduler();
    this.detachMasterClock();
    this.stateListeners.clear();
    this.reset();
  }
}

export const visualRhythmEngine: IVisualRhythmEngine = new VisualRhythmEngine();
