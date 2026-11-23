/**
 * VibeBridge Color Palette
 *
 * Designed with accessibility as the primary driver:
 * - High contrast ratios complying with WCAG AAA standards.
 * - Tactile Resonance Dark Foundation (#111722) and Light Foundation (#FFFFFF).
 * - Backward-compatible with existing engine and component references.
 */

import { darkTokens, lightTokens, ColorTokens } from './tokens';

export const colors = darkTokens;

export type Colors = typeof colors;
export { darkTokens, lightTokens, ColorTokens };
