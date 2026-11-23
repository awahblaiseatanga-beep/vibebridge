import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { darkTokens, lightTokens, ColorTokens } from './tokens';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ColorTokens;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  isDark: true,
  colors: darkTokens,
  toggleTheme: () => {},
  setThemeMode: () => {},
});

export const ThemeProvider: React.FC<{ children: ReactNode; initialMode?: ThemeMode }> = ({
  children,
  initialMode = 'dark',
}) => {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  const value = useMemo(() => {
    const isDark = mode === 'dark';
    return {
      mode,
      isDark,
      colors: isDark ? darkTokens : lightTokens,
      toggleTheme: () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark')),
      setThemeMode: (newMode: ThemeMode) => setMode(newMode),
    };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = (): ThemeContextValue => {
  return useContext(ThemeContext);
};
