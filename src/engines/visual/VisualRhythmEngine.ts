/**
 * VisualRhythmEngine
 *
 * Dedicated SEE pillar engine.
 * Subscribes reactively to PriorityEventScheduler's 'visual' channel.
 * Operates with ZERO independent timers or timeout loops.
 * All musical timings originate from MasterClock and PriorityEventScheduler.
 */

import {
  LatencyManager,
  latencyManager as defaultLatencyManager,
  MasterClock,
  masterClock as defaultMasterClock,
} from '@/engines/synchronization';
import { IEventScheduler } from '@/engines/event-scheduler';
import { VisualCuePayload } from '@/features/rhythm';
import {
  DEFAULT_VISUAL_SCALE_CONFIG,
  IVisualRhythmEngine,
  VisualCalibrationOffset,
  VisualCueAnimationPayload,
  VisualCueEvent,
  VisualCueListener,
  VisualEngineConfig,
  VisualRhythmState,
  VisualScaleConfig,
  VisualStateListener,
  VisualSyncTelemetryRecord,
  VisualTelemetryListener,
} from './types';
import { VisualEventMapper } from './VisualEventMapper';

export class VisualRhythmEngine implements IVisualRhythmEngine {
  private enabled: boolean;
  private reducedMotion: boolean;
  private scales: VisualScaleConfig;
  private latencyManager: LatencyManager;

  private state: VisualRhythmState;
  private currentRevision = 0;

  // Stage A.7.2.1: Analytical Energy Accumulator State
  private energyAccumulator: number = 0.05;
  private lastCueTimestampMs: number = 0;
  public static readonly E_REST: number = 0.05;
  public static readonly LAMBDA: number = 2.5; // Exponential decay constant (1/s)

  private stateListeners = new Set<VisualStateListener>();
  private cueListeners = new Set<VisualCueListener>();
  private telemetryListeners = new Set<VisualTelemetryListener>();
  private telemetryBuffer: VisualSyncTelemetryRecord[] = [];
  private readonly MAX_TELEMETRY_RECORDS = 20;

  private activeScheduler: IEventScheduler | null = null;
  private schedulerUnsubscribe: (() => void) | null = null;

  private activeClock: MasterClock | null = null;
  private clockStatusUnsubscribe: (() => void) | null = null;
  private clockUpdateUnsubscribe: (() => void) | null = null;

  constructor(
    config?: VisualEngineConfig,
    clock: MasterClock = defaultMasterClock,
    latency: LatencyManager = defaultLatencyManager
  ) {
    this.enabled = config?.enabled ?? true;
    this.reducedMotion = config?.reducedMotion ?? false;
    this.scales = {
      ...DEFAULT_VISUAL_SCALE_CONFIG,
      ...config?.scales,
    };
    this.latencyManager = latency;

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

    // Stage A.7.2.1: Analytical Energy Accumulator Calculation
    // Uses track audio timestamps (targetTimestampMs), NOT wall-clock time
    const nowMs = event.targetTimestampMs;
    const deltaSec = this.lastCueTimestampMs > 0
      ? Math.max(0, (nowMs - this.lastCueTimestampMs) / 1000.0)
      : 0.5; // Default for first cue
    this.lastCueTimestampMs = nowMs;

    // Exponential decay toward E_REST
    const dissipated = VisualRhythmEngine.E_REST +
      (this.energyAccumulator - VisualRhythmEngine.E_REST) * Math.exp(-VisualRhythmEngine.LAMBDA * deltaSec);

    // Musical impulse delta based on role and weight
    let deltaEnergy = 0.20 * payload.weight;
    switch (payload.role) {
      case 'downbeat':
        deltaEnergy = 0.35 * payload.weight;
        break;
      case 'backbeat':
        deltaEnergy = 0.22 * payload.weight;
        break;
      case 'accent':
        deltaEnergy = 0.50 * payload.weight;
        break;
      case 'resolution':
        deltaEnergy = 0.40 * payload.weight;
        break;
      default:
        deltaEnergy = 0.20 * payload.weight;
        break;
    }

    // Accumulate and clamp within [E_REST, 1.0]
    this.energyAccumulator = Math.min(1.0, Math.max(VisualRhythmEngine.E_REST, dissipated + deltaEnergy));

    // Map cue into complete 3-layer animation payload
    const animationPayload = VisualEventMapper.mapCueToLayeredPayload(
      payload,
      event,
      this.energyAccumulator,
      this.scales,
      this.reducedMotion
    );

    const mapped = {
      visual: animationPayload.visual,
      intensityLevel: animationPayload.intensityLevel,
    };

    // Record development-only timing telemetry (software timestamps only)
    const onVisualCueMonotonicMs = this.getMonotonicTime();
    const dispatchLatency = Math.max(0, onVisualCueMonotonicMs - (event.dispatchedAtMs || onVisualCueMonotonicMs));

    const telemetryRecord: VisualSyncTelemetryRecord = {
      id: event.id,
      role: payload.role,
      selectedVisualOffsetMs: this.latencyManager.getOffsets().visualOffsetMs,
      targetTimestampMs: event.targetTimestampMs,
      scheduledTimestampMs: event.scheduledTimestampMs,
      schedulerDispatchMonotonicMs: event.dispatchedAtMs || onVisualCueMonotonicMs,
      onVisualCueMonotonicMs,
      animationInitiatedMonotonicMs: onVisualCueMonotonicMs,
      dispatchLatencyMs: dispatchLatency,
      setupLatencyMs: 0,
      timelineRevision: event.timelineRevision,
    };

    if (this.telemetryBuffer.length >= this.MAX_TELEMETRY_RECORDS) {
      this.telemetryBuffer.shift();
    }
    this.telemetryBuffer.push(telemetryRecord);
    this.notifyTelemetry(telemetryRecord);

    // 1. Immediately notify high-frequency direct animation listeners (imperative path, zero React render latency)
    this.cueListeners.forEach((listener) => {
      try {
        listener(animationPayload);
      } catch (err) {
        console.error('[VisualRhythmEngine] Cue listener error:', err);
      }
    });

    // 2. Update engine state for low-frequency informational queries
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
    const initialEndRestThreshold =
      initialSnapshot.durationMs > 200 ? initialSnapshot.durationMs - 200 : initialSnapshot.durationMs;
    this.state.isRest =
      initialSnapshot.status !== 'playing' ||
      (initialSnapshot.durationMs > 0 && initialSnapshot.positionMs >= initialEndRestThreshold);

    this.clockStatusUnsubscribe = clock.onStatusChange((status) => {
      this.state.isPaused = status !== 'playing';

      if (status === 'paused') {
        // Stage A.7.2.1: Pause suspends visual animation and preserves energy state
        this.state.visual = VisualEventMapper.getRestingVisual(this.scales);
        this.state.isRest = true;
      } else if (status === 'stopped' || status === 'idle' || status === 'error') {
        // Stage A.7.2.1: Stop/idle resets energy to E_REST
        this.resetEnergy();
        this.state.visual = VisualEventMapper.getRestingVisual(this.scales);
        this.state.isRest = true;
        this.state.activeCue = null;
      } else if (status === 'playing') {
        // Active playback: clear paused flag and establish non-resting active groove state.
        // Prevents the first visual beat (0ms) from being cancelled by a stale resting state.
        this.state.isPaused = false;
        this.state.isRest = false;
      }

      this.emitState();
    });

    this.clockUpdateUnsubscribe = clock.onClockUpdate((clockSnapshot) => {
      // 1. Revision invalidation check (Seek or Track Change)
      if (clockSnapshot.timelineRevision !== this.currentRevision) {
        this.currentRevision = clockSnapshot.timelineRevision;
        // Stage A.7.2.1: Seek and track change reset energy to E_REST and invalidate stale events
        this.resetEnergy();
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

      // 3. Musical Rest Check near the end of any track (strictly after resolution envelope completes)
      const endRestThresholdMs =
        clockSnapshot.durationMs > 200 ? clockSnapshot.durationMs - 200 : clockSnapshot.durationMs;
      if (
        clockSnapshot.status === 'playing' &&
        !clockSnapshot.isBuffering &&
        clockSnapshot.durationMs > 0 &&
        clockSnapshot.positionMs >= endRestThresholdMs &&
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

  public onVisualCue(listener: VisualCueListener): () => void {
    this.cueListeners.add(listener);
    return () => {
      this.cueListeners.delete(listener);
    };
  }

  public onTelemetry(listener: VisualTelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    const latest = this.getLatestTelemetry();
    if (latest) {
      try {
        listener(latest);
      } catch (err) {
        console.error('[VisualRhythmEngine] Telemetry listener error:', err);
      }
    }
    return () => {
      this.telemetryListeners.delete(listener);
    };
  }

  public getLatestTelemetry(): VisualSyncTelemetryRecord | null {
    return this.telemetryBuffer.length > 0
      ? this.telemetryBuffer[this.telemetryBuffer.length - 1]
      : null;
  }

  public getTelemetryHistory(): VisualSyncTelemetryRecord[] {
    return [...this.telemetryBuffer];
  }

  public clearTelemetry(): void {
    this.telemetryBuffer = [];
  }

  public recordAnimationInitiated(cueId: string, timestampMs?: number): void {
    const record = this.telemetryBuffer.find((r) => r.id === cueId);
    if (record) {
      const now = timestampMs !== undefined ? timestampMs : this.getMonotonicTime();
      record.animationInitiatedMonotonicMs = now;
      record.setupLatencyMs = Math.max(0, now - record.onVisualCueMonotonicMs);
      this.notifyTelemetry(record);
    }
  }

  public setVisualCalibrationOffset(offsetMs: VisualCalibrationOffset): void {
    this.latencyManager.setOffsets({ visualOffsetMs: offsetMs });
  }

  public getVisualCalibrationOffset(): VisualCalibrationOffset {
    const current = this.latencyManager.getOffsets().visualOffsetMs;
    if (current === 40 || current === 60) return current;
    return 16;
  }

  private notifyTelemetry(record: VisualSyncTelemetryRecord): void {
    this.telemetryListeners.forEach((listener) => {
      try {
        listener(record);
      } catch (err) {
        console.error('[VisualRhythmEngine] Telemetry listener error:', err);
      }
    });
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

  public getEnergyAccumulator(): number {
    return this.energyAccumulator;
  }

  public resetEnergy(): void {
    this.energyAccumulator = VisualRhythmEngine.E_REST;
    this.lastCueTimestampMs = 0;
  }

  public reset(): void {
    this.resetEnergy();
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
    this.cueListeners.clear();
    this.telemetryListeners.clear();
    this.clearTelemetry();
    this.reset();
  }
}

export const visualRhythmEngine: IVisualRhythmEngine = new VisualRhythmEngine();
