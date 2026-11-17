/**
 * VisualEventMapper
 *
 * Pure, deterministic mapping functions that translate musical cue payloads
 * and transport states into geometric, non-color visual parameters.
 */

import { theme } from '@/theme';
import { VisualCuePayload } from '@/features/rhythm';
import {
  VisualBeatVisual,
  VisualIntensityLevel,
  VisualScaleConfig,
} from './types';

export class VisualEventMapper {
  /**
   * Translates a scheduled musical cue into expressive and informational visual parameters.
   */
  public static mapCueToVisual(
    cue: VisualCuePayload,
    scales: VisualScaleConfig,
    reducedMotion: boolean = false
  ): { visual: VisualBeatVisual; intensityLevel: VisualIntensityLevel } {
    switch (cue.role) {
      case 'downbeat':
        return {
          intensityLevel: 'strong',
          visual: {
            symbol: '◆',
            shape: 'diamond',
            color: theme.colors.sensory.see,
            scale: reducedMotion ? 1.0 : scales.strongScale,
            opacity: 1.0,
            borderWidth: reducedMotion ? 4 : 3,
            label: `Downbeat (${cue.label})`,
            energy: Math.min(1.0, cue.weight * 1.0),
          },
        };

      case 'backbeat':
        return {
          intensityLevel: 'medium',
          visual: {
            symbol: '▲',
            shape: 'triangle',
            color: theme.colors.sensory.read,
            scale: reducedMotion ? 1.0 : scales.mediumScale,
            opacity: 0.9,
            borderWidth: reducedMotion ? 3 : 2,
            label: `Backbeat (${cue.label})`,
            energy: Math.min(1.0, cue.weight * 0.95),
          },
        };

      case 'subdivision':
        return {
          intensityLevel: 'soft',
          visual: {
            symbol: '●',
            shape: 'circle',
            color: theme.colors.text.secondary,
            scale: reducedMotion ? 1.0 : scales.softScale,
            opacity: 0.65,
            borderWidth: reducedMotion ? 2 : 1,
            label: `Subdivision (${cue.label})`,
            energy: Math.min(1.0, cue.weight * 0.7),
          },
        };

      case 'accent':
        return {
          intensityLevel: 'accent',
          visual: {
            symbol: '◈',
            shape: 'accent-burst',
            color: theme.colors.status.warning,
            scale: reducedMotion ? 1.0 : scales.accentScale,
            opacity: 1.0,
            borderWidth: reducedMotion ? 5 : 4,
            label: `Climax Accent (${cue.label})`,
            energy: 1.0,
          },
        };

      case 'resolution':
        return {
          intensityLevel: 'resolution',
          visual: {
            symbol: '✦',
            shape: 'starburst',
            color: theme.colors.status.success,
            scale: reducedMotion ? 1.0 : scales.resolutionScale,
            opacity: 0.95,
            borderWidth: reducedMotion ? 3 : 2,
            label: `Resolution (${cue.label})`,
            energy: 0.85,
          },
        };

      default:
        return {
          intensityLevel: 'medium',
          visual: {
            symbol: '●',
            shape: 'circle',
            color: theme.colors.text.primary,
            scale: reducedMotion ? 1.0 : scales.mediumScale,
            opacity: 0.8,
            borderWidth: 2,
            label: cue.label || 'Beat',
            energy: cue.weight,
          },
        };
    }
  }

  /**
   * Generates resting visual baseline when music is at rest or transport is inactive.
   */
  public static getRestingVisual(scales: VisualScaleConfig): VisualBeatVisual {
    return {
      symbol: '—',
      shape: 'line',
      color: theme.colors.text.muted,
      scale: scales.restScale,
      opacity: 0.35,
      borderWidth: 1,
      label: 'Musical Rest',
      energy: 0.0,
    };
  }
}
