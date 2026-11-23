import { colors } from './colors';
import { typography } from './typography';
import { spacing, borderRadius } from './spacing';
import { darkTokens, lightTokens } from './tokens';

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
} as const;

export type Theme = typeof theme;

export * from './colors';
export * from './tokens';
export * from './typography';
export * from './spacing';
export * from './ThemeContext';
