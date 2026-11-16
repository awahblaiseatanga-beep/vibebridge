/**
 * Engine: Synchronization
 *
 * Responsibilities:
 * - Master synchronization orchestrator.
 * - Bridges the Audio Engine playback clock with the Event Scheduler.
 * - Compensates for latency differences across Bluetooth devices, internal speakers,
 *   Android vibration motor spin-up latency, and visual rendering frames.
 *
 * Status: Interface defined.
 */

export interface LatencyOffsets {
  audioMs: number;
  hapticMs: number;
  visualMs: number;
  lyricsMs: number;
}

export interface SynchronizationEngine {
  setMasterTime(timeMs: number): void;
  getMasterTime(): number;
  setOffsets(offsets: Partial<LatencyOffsets>): void;
  getOffsets(): LatencyOffsets;
  syncTick(): void;
}
