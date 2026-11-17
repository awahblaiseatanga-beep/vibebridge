/**
 * useVisualizer Hook
 *
 * Connects React UI components to the authoritative VisualRhythmEngine.
 * Automatically manages scheduler and clock attachments, and provides
 * reactive controls for enabling/disabling visuals and reduced-motion mode.
 */

import { useEffect, useState, useCallback } from 'react';
import { eventScheduler } from '@/engines/event-scheduler';
import { masterClock } from '@/engines/synchronization';
import {
  visualRhythmEngine,
  VisualRhythmState,
  VisualScaleConfig,
} from '@/engines/visual';

export interface UseVisualizerReturn {
  state: VisualRhythmState;
  enabled: boolean;
  reducedMotion: boolean;
  toggleEnabled: () => void;
  toggleReducedMotion: () => void;
  setScales: (scales: Partial<VisualScaleConfig>) => void;
}

export function useVisualizer(): UseVisualizerReturn {
  const [visualState, setVisualState] = useState<VisualRhythmState>(() =>
    visualRhythmEngine.getState()
  );

  useEffect(() => {
    // Attach engine to master clock and scheduler
    visualRhythmEngine.attachMasterClock(masterClock);
    visualRhythmEngine.attachScheduler(eventScheduler);

    // Subscribe to visual state transitions
    const unsubscribe = visualRhythmEngine.onVisualStateChange((updatedState) => {
      setVisualState(updatedState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const toggleEnabled = useCallback(() => {
    visualRhythmEngine.setEnabled(!visualState.enabled);
  }, [visualState.enabled]);

  const toggleReducedMotion = useCallback(() => {
    visualRhythmEngine.setReducedMotion(!visualState.reducedMotion);
  }, [visualState.reducedMotion]);

  const setScales = useCallback((scales: Partial<VisualScaleConfig>) => {
    visualRhythmEngine.setScales(scales);
  }, []);

  return {
    state: visualState,
    enabled: visualState.enabled,
    reducedMotion: visualState.reducedMotion,
    toggleEnabled,
    toggleReducedMotion,
    setScales,
  };
}
