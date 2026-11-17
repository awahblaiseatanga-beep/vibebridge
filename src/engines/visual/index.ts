/**
 * Engine: Visual (SEE Pillar)
 *
 * Responsibilities:
 * - Dedicated SEE pillar visual rhythm engine.
 * - Reactive subscriber to PriorityEventScheduler's 'visual' channel.
 * - Dynamic geometric mapping of musical events and energy.
 * - Supports configurable animation scales and reduced-motion mode.
 * - Distinguishes musical rests from transport lifecycle events (pause, buffering).
 */

export * from './types';
export * from './VisualEventMapper';
export * from './VisualRhythmEngine';
