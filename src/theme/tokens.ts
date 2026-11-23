/**
 * VIBEBRIDGE DESIGN SYSTEM TOKENS (V1.0)
 * Tactile Resonance System — Light & Dark Palette
 */

export interface ColorTokens {
  background: {
    base: string;
    surface: string;
    secondary: string;
    elevated: string;
    highlight: string;
  };
  accent: {
    primary: string;
    primaryHover: string;
    secondary: string;
    secondaryMuted: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverted: string;
  };
  border: {
    subtle: string;
    medium: string;
    bright: string;
  };
  sensory: {
    read: string; // Cyan - Lyrics
    see: string;  // Violet - Visualizer
    feel: string; // Coral - Haptics
  };
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
}

export const lightTokens: ColorTokens = {
  background: {
    base: '#FFFFFF',
    surface: '#FFFFFF',
    secondary: '#F5F7FB',
    elevated: '#FFFFFF',
    highlight: '#EEF2F9',
  },
  accent: {
    primary: '#4657D5',
    primaryHover: '#3948B8',
    secondary: '#159E98',
    secondaryMuted: 'rgba(21, 158, 152, 0.12)',
  },
  text: {
    primary: '#202638',
    secondary: '#687184',
    muted: '#94A3B8',
    inverted: '#FFFFFF',
  },
  border: {
    subtle: '#E7EAF1',
    medium: '#D1D7E4',
    bright: '#B5C0D5',
  },
  sensory: {
    read: '#0284C7',
    see: '#7C3AED',
    feel: '#E11D48',
  },
  status: {
    success: '#16A34A',
    warning: '#D97706',
    error: '#DC2626',
    info: '#0284C7',
  },
};

export const darkTokens: ColorTokens = {
  background: {
    base: '#111722',
    surface: '#192231',
    secondary: '#192231',
    elevated: '#202B3B',
    highlight: '#27354E',
  },
  accent: {
    primary: '#8B96FF',
    primaryHover: '#727EFF',
    secondary: '#62D8CE',
    secondaryMuted: 'rgba(98, 216, 206, 0.15)',
  },
  text: {
    primary: '#F5F7FC',
    secondary: '#A7B0C2',
    muted: '#64748B',
    inverted: '#111722',
  },
  border: {
    subtle: '#293548',
    medium: '#374763',
    bright: '#485E82',
  },
  sensory: {
    read: '#38BDF8',
    see: '#A855F7',
    feel: '#F43F5E',
  },
  status: {
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#38BDF8',
  },
};
