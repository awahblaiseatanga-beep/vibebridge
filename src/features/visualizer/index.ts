/**
 * Feature: Visualizer (SEE Pillar)
 *
 * Responsibilities:
 * - Real-time visual representation of musical intensity and rhythm.
 * - Reactive animations (pulses, waveforms, frequency ripples).
 * - React Native Reanimated (and Skia when advanced shaders are required).
 *
 * Status: Foundation milestone.
 */

export interface VisualizerRenderConfig {
  mode: 'waveform' | 'pulse' | 'bars';
  fpsLimit: number;
  sensitivity: number;
}
