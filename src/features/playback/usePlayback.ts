/**
 * Hook: usePlayback
 *
 * Connects React UI components to the authoritative AudioEngine singleton.
 * Maintains real-time subscription to playback position and state without
 * coupling the underlying audio engine to the React lifecycle.
 */

import { useEffect, useState, useCallback } from 'react';
import { audioEngine, AudioSourceInput } from '@/engines/audio';
import { PlaybackClock, PlaybackStatus } from '@/types';

export function usePlayback() {
  const [clock, setClock] = useState<PlaybackClock>(() => audioEngine.getClock());

  useEffect(() => {
    // Subscribe to authoritative audio clock ticks (50ms interval)
    const unsubscribe = audioEngine.onClockUpdate((updatedClock) => {
      setClock(updatedClock);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const load = useCallback(async (source: AudioSourceInput) => {
    return audioEngine.load(source);
  }, []);

  const play = useCallback(async () => {
    return audioEngine.play();
  }, []);

  const pause = useCallback(async () => {
    return audioEngine.pause();
  }, []);

  const resume = useCallback(async () => {
    return audioEngine.resume();
  }, []);

  const stop = useCallback(async () => {
    return audioEngine.stop();
  }, []);

  const seek = useCallback(async (positionMs: number) => {
    return audioEngine.seek(positionMs);
  }, []);

  return {
    clock,
    positionMs: clock.positionMs,
    durationMs: clock.durationMs,
    status: clock.status,
    isBuffering: clock.isBuffering,
    errorMessage: clock.errorMessage,
    isPlaying: clock.status === 'playing',
    isPaused: clock.status === 'paused',
    isLoading: clock.status === 'loading',
    isStopped: clock.status === 'stopped',
    isIdle: clock.status === 'idle',
    isError: clock.status === 'error',
    load,
    play,
    pause,
    resume,
    stop,
    seek,
  };
}
