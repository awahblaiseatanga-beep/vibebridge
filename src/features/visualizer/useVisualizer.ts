/**
 * useVisualizer Hook
 *
 * Connects React UI components to the authoritative VisualRhythmEngine.
 * Automatically manages scheduler and clock attachments, and provides
 * reactive controls for enabling/disabling visuals and reduced-motion mode.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { eventScheduler } from '@/engines/event-scheduler';
import { masterClock } from '@/engines/synchronization';
import {
  visualRhythmEngine,
  VisualCueListener,
  VisualRhythmState,
  VisualScaleConfig,
  VisualCalibrationOffset,
  VisualSyncTelemetryRecord,
} from '@/engines/visual';

export interface UseVisualizerReturn {
  state: VisualRhythmState;
  enabled: boolean;
  reducedMotion: boolean;
  visualOffset: VisualCalibrationOffset;
  latestTelemetry: VisualSyncTelemetryRecord | null;
  toggleEnabled: () => void;
  toggleReducedMotion: () => void;
  setScales: (scales: Partial<VisualScaleConfig>) => void;
  setVisualOffset: (offset: VisualCalibrationOffset) => void;
  onVisualCue: (listener: VisualCueListener) => () => void;
}

export function useVisualizer(): UseVisualizerReturn {
  const [visualState, setVisualState] = useState<VisualRhythmState>(() =>
    visualRhythmEngine.getState()
  );
  const [visualOffset, setVisualOffsetState] = useState<VisualCalibrationOffset>(() =>
    visualRhythmEngine.getVisualCalibrationOffset()
  );
  const [latestTelemetry, setLatestTelemetry] = useState<VisualSyncTelemetryRecord | null>(() =>
    visualRhythmEngine.getLatestTelemetry()
  );
  const lastTelemetryTimeRef = useRef<number>(0);

  useEffect(() => {
    // Attach engine to master clock and scheduler
    visualRhythmEngine.attachMasterClock(masterClock);
    visualRhythmEngine.attachScheduler(eventScheduler);

    // Subscribe to visual state transitions
    const unsubscribeState = visualRhythmEngine.onVisualStateChange((updatedState) => {
      setVisualState(updatedState);
    });

    // Subscribe to visual sync telemetry with controlled low-frequency throttling
    // Decouples high-frequency telemetry logging from React component rendering passes
    const unsubscribeTelemetry = visualRhythmEngine.onTelemetry((record) => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastTelemetryTimeRef.current >= 1000 || lastTelemetryTimeRef.current === 0) {
        lastTelemetryTimeRef.current = now;
        setLatestTelemetry(record);
      }
    });

    return () => {
      unsubscribeState();
      unsubscribeTelemetry();
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

  const setVisualOffset = useCallback((offset: VisualCalibrationOffset) => {
    visualRhythmEngine.setVisualCalibrationOffset(offset);
    setVisualOffsetState(offset);
    setLatestTelemetry(visualRhythmEngine.getLatestTelemetry());
  }, []);

  const onVisualCue = useCallback((listener: VisualCueListener) => {
    return visualRhythmEngine.onVisualCue(listener);
  }, []);

  return {
    state: visualState,
    enabled: visualState.enabled,
    reducedMotion: visualState.reducedMotion,
    visualOffset,
    latestTelemetry,
    toggleEnabled,
    toggleReducedMotion,
    setScales,
    setVisualOffset,
    onVisualCue,
  };
}
