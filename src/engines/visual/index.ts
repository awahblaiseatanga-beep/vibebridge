/**
 * Engine: Visual (SEE Pillar)
 *
 * Responsibilities:
 * - Translates rhythm, beat, and intensity cues into visual animations.
 * - Drives 60fps/120fps reactive animations using React Native Reanimated.
 * - Architectural boundary prepared for React Native Skia when complex shader rendering is needed.
 *
 * Status: Interface defined.
 */

import { VisualBeatCue } from '@/types';

export interface VisualEngine {
  onBeat(cue: VisualBeatCue): void;
  reset(): void;
  setRenderQuality(quality: 'low' | 'medium' | 'high'): void;
}
