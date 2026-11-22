/**
 * useLiveConcert
 *
 * React hook connecting UI components to LiveConcertAudioEngine.
 * Stage B-LIVE.2: Adaptive Haptic Intelligence & Physical Feedback Calibration.
 * Exposes live audio features, capture controls, haptic testing studio triggers,
 * and sensitivity/intensity profile configuration.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  liveConcertEngine,
  LiveConcertState,
  LiveHapticConfig,
  LiveHapticEventType,
  HapticIntensityProfile,
  AudioSensitivityProfile,
} from '@/engines/live';

export function useLiveConcert() {
  const [state, setState] = useState<LiveConcertState>(() => liveConcertEngine.getState());
  const [hapticConfig, setHapticConfigState] = useState<LiveHapticConfig>(() =>
    liveConcertEngine.getHapticConfig()
  );

  useEffect(() => {
    // Check initial permission status silently on mount
    liveConcertEngine.checkPermission();

    const unsubscribe = liveConcertEngine.onStateChange((newState) => {
      setState(newState);
      setHapticConfigState(liveConcertEngine.getHapticConfig());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const startListening = useCallback(async () => {
    await liveConcertEngine.start();
  }, []);

  const stopListening = useCallback(async () => {
    await liveConcertEngine.stop();
  }, []);

  const setHapticEnabled = useCallback((enabled: boolean) => {
    liveConcertEngine.setHapticConfig({ enabled });
    setHapticConfigState(liveConcertEngine.getHapticConfig());
  }, []);

  const setIntensityProfile = useCallback((profile: HapticIntensityProfile) => {
    liveConcertEngine.setIntensityProfile(profile);
    setHapticConfigState(liveConcertEngine.getHapticConfig());
  }, []);

  const setSensitivityProfile = useCallback((profile: AudioSensitivityProfile) => {
    liveConcertEngine.setSensitivityProfile(profile);
    setHapticConfigState(liveConcertEngine.getHapticConfig());
  }, []);

  const setAutoAdaptSensitivity = useCallback((enabled: boolean) => {
    liveConcertEngine.setAutoAdaptSensitivity(enabled);
    setHapticConfigState(liveConcertEngine.getHapticConfig());
  }, []);

  const setHapticIntensity = useCallback((intensity: number) => {
    liveConcertEngine.setHapticConfig({ intensity });
    setHapticConfigState(liveConcertEngine.getHapticConfig());
  }, []);

  const setHapticSensitivity = useCallback((sensitivity: number) => {
    liveConcertEngine.setHapticConfig({ sensitivity });
    setHapticConfigState(liveConcertEngine.getHapticConfig());
  }, []);

  const testPattern = useCallback(async (type: LiveHapticEventType) => {
    return await liveConcertEngine.testPattern(type);
  }, []);

  const cancelHaptics = useCallback(() => {
    liveConcertEngine.cancelHaptics();
  }, []);

  return {
    state,
    hapticConfig,
    hapticStats: state.hapticStats,
    isCapturing: state.captureState === 'capturing',
    isStarting: state.captureState === 'starting',
    permissionStatus: state.permissionStatus,
    features: state.features,
    lastHapticEvent: state.lastHapticEvent,
    errorMessage: state.errorMessage,
    startListening,
    stopListening,
    setHapticEnabled,
    setIntensityProfile,
    setSensitivityProfile,
    setAutoAdaptSensitivity,
    setHapticIntensity,
    setHapticSensitivity,
    testPattern,
    cancelHaptics,
  };
}
