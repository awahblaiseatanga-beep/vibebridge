/**
 * Engine: Event Scheduler
 *
 * Responsibilities:
 * - High-precision chronological event scheduler.
 * - Dispatches latency-compensated cues against the MasterClock timeline.
 * - Look-ahead window scheduling with duplicate prevention.
 * - Invalidation of outdated cues across seeking and track transitions.
 */

export * from './types';
export * from './PriorityEventScheduler';
