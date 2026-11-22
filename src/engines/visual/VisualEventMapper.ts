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
  VisualCueAnimationPayload,
  VisualCueEvent,
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

  /**
   * Maps a scheduled musical cue and analytical energy state into the complete 3-layer animation payload (Stage A.7.2.1).
   */
  public static mapCueToLayeredPayload(
    cue: VisualCuePayload,
    event: VisualCueEvent,
    energyAccumulator: number,
    scales: VisualScaleConfig,
    reducedMotion: boolean = false
  ): VisualCueAnimationPayload {
    const mapped = VisualEventMapper.mapCueToVisual(cue, scales, reducedMotion);

    // 1. Layer 1: Directional Deformation (squash & stretch) & Envelope
    let attackMs = 25;
    let decayMs = 110;
    let targetScaleX = 1.0;
    let targetScaleY = 1.0;

    switch (cue.role) {
      case 'downbeat':
        attackMs = 30;
        decayMs = 130;
        targetScaleX = reducedMotion ? 1.0 : scales.strongScale;
        targetScaleY = reducedMotion ? 1.0 : scales.strongScale * (1.25 / 1.35);
        break;

      case 'backbeat':
        attackMs = 25;
        decayMs = 110;
        targetScaleX = reducedMotion ? 1.0 : scales.mediumScale * (1.15 / 1.20);
        targetScaleY = reducedMotion ? 1.0 : scales.mediumScale * (1.30 / 1.20);
        break;

      case 'accent':
        attackMs = 30;
        decayMs = 130;
        targetScaleX = reducedMotion ? 1.0 : scales.accentScale;
        targetScaleY = reducedMotion ? 1.0 : scales.accentScale;
        break;

      case 'resolution':
        attackMs = 40;
        decayMs = 260;
        targetScaleX = reducedMotion ? 1.0 : scales.resolutionScale;
        targetScaleY = reducedMotion ? 1.0 : scales.resolutionScale;
        break;

      case 'subdivision':
      default:
        attackMs = 20;
        decayMs = 70;
        targetScaleX = reducedMotion ? 1.0 : scales.softScale;
        targetScaleY = reducedMotion ? 1.0 : scales.softScale;
        break;
    }

    // 2. Layer 2: Continuous Energy Field (normalized [0, 1] relative to E_REST = 0.05)
    // At E = E_REST (0.05): normalizedEnergy = 0.0 => targetFieldScale = 1.05, targetFieldOpacity = 0.25 (exact)
    // At E = 1.00: normalizedEnergy = 1.0 => targetFieldScale = 1.40, targetFieldOpacity = 0.75 (exact)
    const E_REST = 0.05;
    const normalizedEnergy = Math.max(0.0, Math.min(1.0, (energyAccumulator - E_REST) / (1.0 - E_REST)));
    const targetFieldScale = reducedMotion ? 1.0 : 1.05 + (normalizedEnergy * 0.35);
    const targetFieldOpacity = 0.25 + (normalizedEnergy * 0.50);

    // 3. Layer 3: Acoustic Aura / Ripple (strictly canonical accents and resolution)
    const isRippleCandidate = cue.role === 'accent' || cue.role === 'resolution';
    const triggerRipple = isRippleCandidate && !reducedMotion;
    let targetRippleScale = 1.0;
    let targetRippleOpacity = 0.0;
    let rippleDurationMs = 0;

    if (triggerRipple) {
      if (cue.role === 'accent') {
        targetRippleScale = 1.75;
        targetRippleOpacity = 0.75;
        rippleDurationMs = 400;
      } else if (cue.role === 'resolution') {
        targetRippleScale = 1.65;
        targetRippleOpacity = 0.65;
        rippleDurationMs = 450;
      }
    }

    return {
      event,
      visual: mapped.visual,
      intensityLevel: mapped.intensityLevel,
      targetScale: Math.max(targetScaleX, targetScaleY),
      auraTarget: targetFieldScale,
      attackMs,
      decayMs,
      totalDurationMs: attackMs + decayMs,
      reducedMotion,

      // Layer 1
      targetScaleX,
      targetScaleY,

      // Layer 2
      targetFieldScale,
      targetFieldOpacity,
      energyAccumulator,

      // Layer 3
      triggerRipple,
      targetRippleScale,
      targetRippleOpacity,
      rippleDurationMs,
    };
  }
}
