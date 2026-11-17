/**
 * Engine: Synchronization
 *
 * Responsibilities:
 * - Master synchronization orchestrator.
 * - Bridges the Audio Engine playback clock with the Event Scheduler.
 * - Distributes authoritative time to all sensory channels.
 * - Calculates cross-sensory latency compensation offsets (audio, haptics, visuals, lyrics).
 */

export * from './types';
export * from './LatencyManager';
export * from './MasterClock';
