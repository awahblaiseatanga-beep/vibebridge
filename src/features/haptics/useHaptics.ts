/**
 * useHaptics Hook
 *
 * Provides reactive access to the HapticEngine state, user controls (enable/disable, intensity),
 * manual test triggering, and attaches the engine to the global PriorityEventScheduler.
 */

import { useEffect, useState, useCallback } from 'react';
import { eventScheduler } from '@/engines/event-scheduler';
import { hapticEngine, HapticPattern } from '@/engines/haptic';

export interface UseHapticsReturn {
  enabled: boolean;
  intensity: number;
  lastPattern: HapticPattern | null;
  toggleEnabled: () => void;
  setIntensity: (val: number) => void;
  triggerTest: (pattern: HapticPattern) => Promise<boolean>;
}

export function useHaptics(): UseHapticsReturn {
  const [enabled, setEnabledState] = useState<boolean>(() => hapticEngine.getState().enabled);
  const [intensity, setIntensityState] = useState<number>(() => hapticEngine.getState().intensity);
  const [lastPattern, setLastPattern] = useState<HapticPattern | null>(null);

  useEffect(() => {
    // Attach haptic engine to global master scheduler
    hapticEngine.attachScheduler(eventScheduler);

    // Also listen locally to update UI indicator when a haptic cue fires
    const unsubscribe = eventScheduler.subscribe('haptic', (event) => {
      const payload = event.payload as { pattern?: HapticPattern } | undefined;
      if (payload?.pattern) {
        setLastPattern(payload.pattern);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabledState((prev) => {
      const next = !prev;
      hapticEngine.setEnabled(next);
      return next;
    });
  }, []);

  const setIntensity = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setIntensityState(clamped);
    hapticEngine.setIntensity(clamped);
  }, []);

  const triggerTest = useCallback(async (pattern: HapticPattern) => {
    setLastPattern(pattern);
    return await hapticEngine.trigger(pattern, 1.0);
  }, []);

  return {
    enabled,
    intensity,
    lastPattern,
    toggleEnabled,
    setIntensity,
    triggerTest,
  };
}
