/**
 * useLocalMusicLibrary
 *
 * Authoritative state and lifecycle hook for local music import, library persistence,
 * and automatic tactile rhythm synchronization.
 *
 * Lifecycle separation:
 * 1. File Import (`importTrack`): Picks file, copies to private persistent storage, registers manifest.
 *    Does NOT alter activeTrack, load audio, or start playback.
 * 2. Background Analysis (`runBackgroundAnalysis`): Streams the complete file in 64KB chunks,
 *    extracts full-track onsets/BPM/beats/duration asynchronously, and updates track entry.
 *    Does NOT touch AudioEngine or interrupt active playback (e.g., Spheres demo).
 * 3. Track Selection (`selectTrack`): Sets activeTrack metadata & score provider without loading/playing audio.
 * 4. Audio Loading (`loadTrack`): Loads track audio into AudioEngine in paused/ready state without playing.
 * 5. Playback (`playTrack`): Explicit user-triggered playback.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  TrackMetadata,
  TrackProcessingProgress,
  isTrackPlayable,
} from '@/types';
import {
  LocalTrackRepository,
  BUNDLED_SPHERES_TRACK,
} from '@/services/tracks';
import {
  NativeFileImportService,
  parseFilenameMetadata,
} from '@/services/file-import';
import {
  FullTrackSensoryPipeline,
  AutomaticRhythmAnalyzer,
  AudioAnalysisResult,
} from '@/engines/audio-analysis';
import { audioEngine } from '@/engines/audio';
import { eventScheduler } from '@/engines/event-scheduler';
import { hapticEngine } from '@/engines/haptic';
import {
  scheduleTrackSensoryCues,
  scheduleTrackSensoryCuesInWindow,
} from '@/features/rhythm';
import { lyricsEngine } from '@/engines/lyrics';
import { DEMO_TRACK_LYRICS } from '@/features/lyrics';

const DEMO_AUDIO_ASSET = require('../../../assets/music/vibebridge_demo.wav');

// Module-level global state shared across all components and screens
interface LibraryGlobalState {
  tracks: TrackMetadata[];
  activeTrack: TrackMetadata;
  loadedTrackId: string | null;
  isImporting: boolean;
  importStatus: string | null;
  processingProgress: Record<string, TrackProcessingProgress>;
}

let globalLibraryState: LibraryGlobalState = {
  tracks: [BUNDLED_SPHERES_TRACK],
  activeTrack: BUNDLED_SPHERES_TRACK,
  loadedTrackId: null,
  isImporting: false,
  importStatus: null,
  processingProgress: {},
};

let hasLoadedInitialTracks = false;
let hasAttachedClockDurationSync = false;
let lastHapticResetRevision = -1;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Configure PriorityEventScheduler rolling look-ahead window provider for the given track.
 * Continuously replenishes both FEEL (haptic) and SEE (visual) channels across full-length songs.
 */
export function attachScoreProviderForTrack(track: TrackMetadata): void {
  const score = track.rhythmScore || [];

  if (typeof eventScheduler.setWindowedScoreProvider === 'function') {
    eventScheduler.setWindowedScoreProvider(
      (scheduler, rev, windowStartMs, windowEndMs) => {
        if (lastHapticResetRevision !== rev) {
          lastHapticResetRevision = rev;
          hapticEngine.reset();
        }
        if (score.length > 0) {
          scheduleTrackSensoryCuesInWindow(
            scheduler,
            rev,
            score,
            windowStartMs,
            windowEndMs
          );
        }
      },
      15000,
      5000
    );
  } else {
    eventScheduler.setScoreProvider((scheduler, rev) => {
      hapticEngine.reset();
      if (score.length > 0) {
        scheduleTrackSensoryCues(scheduler, rev, score);
      }
    });
  }
}

/**
 * Syncs authoritative native duration from ExoPlayer into active imported track metadata
 * if the file container did not expose duration during initial registration.
 */
function ensureClockDurationSync(): void {
  if (hasAttachedClockDurationSync) return;
  hasAttachedClockDurationSync = true;

  audioEngine.onClockUpdate((clock) => {
    const active = globalLibraryState.activeTrack;
    if (
      active.isLocalImport &&
      globalLibraryState.loadedTrackId === active.id &&
      clock.durationMs > 0 &&
      Math.abs(clock.durationMs - active.durationMs) > 1000
    ) {
      const updatedTrack: TrackMetadata = {
        ...active,
        durationMs: clock.durationMs,
      };
      globalLibraryState.activeTrack = updatedTrack;
      LocalTrackRepository.updateTrackAnalysis(active.id, {
        durationMs: clock.durationMs,
      }).then((saved) => {
        if (saved) {
          LocalTrackRepository.getAllTracks().then((all) => {
            globalLibraryState.tracks = all;
            notifyListeners();
          });
        }
      });
      notifyListeners();
    }
  });
}

/**
 * Runs the unified full-track decoding, analysis, and persistence pipeline.
 * Publishes honest, measurable progress to processingProgress and updates the track record.
 */
async function runBackgroundAnalysis(track: TrackMetadata): Promise<void> {
  try {
    const { track: finalTrack } = await FullTrackSensoryPipeline.processTrack(
      track,
      (progress) => {
        globalLibraryState.processingProgress = {
          ...globalLibraryState.processingProgress,
          [track.id]: progress,
        };
        notifyListeners();
      }
    );

    globalLibraryState.tracks = await LocalTrackRepository.getAllTracks();
    // Only refresh score provider if the user has this track active
    if (globalLibraryState.activeTrack.id === finalTrack.id) {
      globalLibraryState.activeTrack = finalTrack;
      attachScoreProviderForTrack(finalTrack);
    }
    notifyListeners();
  } catch (analysisErr) {
    console.warn('[useLocalMusicLibrary] Background analysis error:', analysisErr);
    globalLibraryState.tracks = await LocalTrackRepository.getAllTracks();
    const updated = await LocalTrackRepository.getTrackById(track.id);
    if (updated && globalLibraryState.activeTrack.id === updated.id) {
      globalLibraryState.activeTrack = updated;
    }
    notifyListeners();
  }
}

export function useLocalMusicLibrary() {
  const [state, setState] = useState<LibraryGlobalState>(globalLibraryState);

  // Sync with global singleton updates
  useEffect(() => {
    const handleUpdate = () => {
      setState({ ...globalLibraryState });
    };

    listeners.add(handleUpdate);
    ensureClockDurationSync();

    if (!hasLoadedInitialTracks) {
      hasLoadedInitialTracks = true;
      attachScoreProviderForTrack(globalLibraryState.activeTrack);
      LocalTrackRepository.getAllTracks().then((loaded) => {
        globalLibraryState.tracks = loaded;
        notifyListeners();
      });
    }

    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  /**
   * 1. File Import & Unified Analysis Trigger.
   * Copies SAF audio to private storage, sets 'importing' status, and automatically
   * kicks off the unified native PCM decoding and sensory analysis pipeline.
   */
  const importTrack = useCallback(async (): Promise<TrackMetadata | null> => {
    try {
      globalLibraryState.isImporting = true;
      globalLibraryState.importStatus = 'Selecting audio file...';
      notifyListeners();

      const picked = await NativeFileImportService.pickAudioFile();
      if (!picked) {
        globalLibraryState.isImporting = false;
        globalLibraryState.importStatus = null;
        notifyListeners();
        return null;
      }

      globalLibraryState.importStatus = 'Saving to device library...';
      notifyListeners();

      const { title, artist } = parseFilenameMetadata(picked.filename);
      const newTrackId = `imported_${Date.now()}`;

      const newTrack: TrackMetadata = {
        id: newTrackId,
        title,
        artist,
        durationMs: 0,
        uri: picked.uri,
        hasLyrics: false,
        hasHapticTrack: true,
        hasVisualBeats: true,
        importedAt: new Date().toISOString(),
        fileSizeBytes: picked.fileSizeBytes,
        mimeType: picked.mimeType,
        isLocalImport: true,
        analysisStatus: 'importing',
        summaryNote: 'Audio import initialized. Ready for PCM decoding...',
      };

      // Persist initial record immediately
      await LocalTrackRepository.saveTrack(newTrack);
      globalLibraryState.tracks = await LocalTrackRepository.getAllTracks();
      globalLibraryState.isImporting = false;
      globalLibraryState.importStatus = null;
      notifyListeners();

      // Automatically kick off the unified native PCM decode + DSP analysis pipeline
      void runBackgroundAnalysis(newTrack);

      return newTrack;
    } catch (error: any) {
      console.warn('[useLocalMusicLibrary] Import failed:', error);
      globalLibraryState.isImporting = false;
      globalLibraryState.importStatus = null;
      notifyListeners();
      throw error;
    }
  }, []);

  /**
   * Retries decoding and analysis for a failed track.
   */
  const retryAnalysis = useCallback(async (trackId: string): Promise<void> => {
    const target = globalLibraryState.tracks.find((t) => t.id === trackId);
    if (!target) return;

    const resetTrack = await LocalTrackRepository.updateTrackAnalysis(trackId, {
      analysisStatus: 'importing',
      summaryNote: 'Retrying audio decoding and analysis...',
    });

    if (resetTrack) {
      globalLibraryState.tracks = await LocalTrackRepository.getAllTracks();
      if (globalLibraryState.activeTrack.id === trackId) {
        globalLibraryState.activeTrack = resetTrack;
      }
      notifyListeners();
      void runBackgroundAnalysis(resetTrack);
    }
  }, []);

  /**
   * Delete an imported track from local storage, timelines, and library manifest.
   */
  const deleteTrack = useCallback(async (id: string): Promise<void> => {
    await LocalTrackRepository.deleteTrack(id);
    globalLibraryState.tracks = await LocalTrackRepository.getAllTracks();

    // Clean up any progress entry
    if (globalLibraryState.processingProgress[id]) {
      const nextProgress = { ...globalLibraryState.processingProgress };
      delete nextProgress[id];
      globalLibraryState.processingProgress = nextProgress;
    }

    // If deleting active track, fall back to bundled Spheres demo
    if (globalLibraryState.activeTrack.id === id) {
      globalLibraryState.activeTrack = BUNDLED_SPHERES_TRACK;
      globalLibraryState.loadedTrackId = null;
      attachScoreProviderForTrack(BUNDLED_SPHERES_TRACK);
    }

    notifyListeners();
  }, []);

  /**
   * 3. Track Selection (without loading or starting playback).
   */
  const selectTrack = useCallback((track: TrackMetadata) => {
    const latestTrack =
      globalLibraryState.tracks.find((t) => t.id === track.id) || track;
    globalLibraryState.activeTrack = latestTrack;
    attachScoreProviderForTrack(latestTrack);
    notifyListeners();
  }, []);

  /**
   * 4. Audio Loading with Lifecycle Gating:
   * Rejects unready tracks (importing, decoding, analyzing, saving, failed).
   * Prepares AudioEngine in paused state only when track is Ready to Play.
   */
  const loadTrack = useCallback(
    async (
      track: TrackMetadata,
      playback: {
        load: (source: any) => Promise<void>;
      }
    ) => {
      const latestTrack =
        globalLibraryState.tracks.find((t) => t.id === track.id) || track;

      // Playback restriction gate: only allow loading if track is ready
      if (!isTrackPlayable(latestTrack.analysisStatus)) {
        throw new Error(
          `"${latestTrack.title}" is currently ${latestTrack.analysisStatus}. Please wait until analysis is Ready to Play.`
        );
      }

      globalLibraryState.activeTrack = latestTrack;
      notifyListeners();
      attachScoreProviderForTrack(latestTrack);

      if (latestTrack.id === BUNDLED_SPHERES_TRACK.id) {
        lyricsEngine.loadLyrics(DEMO_TRACK_LYRICS);
        await playback.load({
          type: 'bundle',
          assetId: DEMO_AUDIO_ASSET,
          name: 'Spheres',
          durationMs: latestTrack.durationMs,
        });
      } else {
        lyricsEngine.loadLyrics(null);
        await playback.load({
          type: 'uri',
          uri: latestTrack.uri,
          name: latestTrack.title,
          durationMs: latestTrack.durationMs > 0 ? latestTrack.durationMs : undefined,
        });
      }

      globalLibraryState.loadedTrackId = latestTrack.id;
      notifyListeners();
    },
    []
  );

  /**
   * 5. Explicit User-Triggered Playback with Lifecycle Gating:
   * Strictly enforces that track must be Ready to Play before playing.
   */
  const playTrack = useCallback(
    async (
      track: TrackMetadata,
      playback: {
        status?: string;
        positionMs?: number;
        durationMs?: number;
        load: (source: any) => Promise<void>;
        play: () => Promise<void>;
        pause: () => Promise<void>;
        resume: () => Promise<void>;
        seek?: (positionMs: number) => Promise<void>;
        isPlaying: boolean;
        isPaused: boolean;
      }
    ) => {
      const latestTrack =
        globalLibraryState.tracks.find((t) => t.id === track.id) || track;

      // Playback restriction gate
      if (!isTrackPlayable(latestTrack.analysisStatus)) {
        throw new Error(
          `"${latestTrack.title}" cannot be played while ${latestTrack.analysisStatus}. Please wait until analysis is Ready to Play.`
        );
      }

      const needsLoad =
        globalLibraryState.loadedTrackId !== latestTrack.id ||
        playback.status === 'idle' ||
        playback.status === 'error';

      if (needsLoad) {
        await loadTrack(latestTrack, playback);
      } else if (
        playback.status === 'stopped' &&
        playback.seek &&
        (playback.durationMs ?? 0) > 0 &&
        (playback.positionMs ?? 0) >= (playback.durationMs ?? 0)
      ) {
        await playback.seek(0);
      }

      await playback.play();
    },
    [loadTrack]
  );

  return {
    tracks: state.tracks,
    importedTracks: state.tracks.filter((t) => t.isLocalImport),
    activeTrack: state.activeTrack,
    loadedTrackId: state.loadedTrackId,
    isImporting: state.isImporting,
    importStatus: state.importStatus,
    processingProgress: state.processingProgress,
    importTrack,
    retryAnalysis,
    deleteTrack,
    selectTrack,
    loadTrack,
    playTrack,
  };
}
