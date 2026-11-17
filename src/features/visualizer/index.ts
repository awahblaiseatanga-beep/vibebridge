/**
 * Feature: Visualizer (SEE Pillar)
 *
 * Responsibilities:
 * - Real-time visual representation of musical intensity and rhythm.
 * - Reactive animations (pulsing, expanding/contracting geometric shapes).
 * - Layer A (Expressive) & Layer B (Informational 4/4 meter HUD).
 * - Non-color-reliant visual hierarchy with accessible Reduced Motion mode.
 */

export interface VisualizerRenderConfig {
  mode: 'waveform' | 'pulse' | 'bars';
  fpsLimit: number;
  sensitivity: number;
}

export { useVisualizer } from './useVisualizer';
export { VisualRhythmSurface } from './components/VisualRhythmSurface';
export * from '@/engines/visual';
