/**
 * VibeBridge Color Palette
 *
 * Designed with accessibility as the primary driver:
 * - High contrast ratios complying with WCAG AAA standards.
 * - Deep dark base (#090D16) for battery optimization and to maximize visual pop
 *   for rhythm and waveform visualizers.
 * - Dedicated signature colors for the three sensory pillars:
 *   - READ (Lyrics): Sky Cyan (#38BDF8)
 *   - SEE (Visualizer): Electric Violet (#A855F7)
 *   - FEEL (Tactile/Haptic): Vibrant Coral (#F43F5E)
 */

export const colors = {
  background: {
    base: '#090D16',
    surface: '#131B2E',
    elevated: '#1E293B',
    highlight: '#27354E',
  },
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    muted: '#64748B',
    inverted: '#090D16',
  },
  border: {
    subtle: '#1E293B',
    medium: '#334155',
    bright: '#475569',
  },
  // Sensory Pillars
  sensory: {
    read: '#38BDF8', // Cyan - Synchronized Lyrics
    see: '#A855F7',  // Violet - Rhythm & Intensity Visualizer
    feel: '#F43F5E', // Coral - Tactile & Haptic Motor
  },
  // Status & Feedback
  status: {
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#38BDF8',
  },
} as const;

export type Colors = typeof colors;
