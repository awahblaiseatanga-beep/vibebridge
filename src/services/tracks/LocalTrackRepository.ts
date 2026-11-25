/**
 * LocalTrackRepository
 *
 * Local persistent storage and query interface for VibeBridge music library.
 * Persists imported audio tracks and their acoustic analysis scores across app restarts
 * in sandboxed FileSystem storage (tracks_manifest.json).
 */

import { Paths, Directory, File } from 'expo-file-system';
import { TrackMetadata, SensoryTimeline } from '@/types';
import { CANONICAL_DEMO_RHYTHM_SCORE } from '@/features/rhythm';
import { NativeFileImportService } from '@/services/file-import';

export const BUNDLED_SPHERES_TRACK: TrackMetadata = {
  id: 'spheres-demo',
  title: 'Spheres',
  artist: 'Halina Rice',
  album: '2020 Single',
  durationMs: 12000,
  uri: 'bundle://vibebridge_demo.wav',
  hasLyrics: true,
  hasHapticTrack: true,
  hasVisualBeats: true,
  importedAt: '2026-11-23T16:00:00Z',
  isLocalImport: false,
  analysisStatus: 'ready',
  bpm: 120,
  bpmConfidence: 1.0,
  energyConfidence: 1.0,
  onsetConfidence: 1.0,
  rhythmScore: CANONICAL_DEMO_RHYTHM_SCORE,
  rhythmicChanges: ['Intro Groove (0:00)', 'Syncopated Climax (0:10)'],
  summaryNote: 'Bundled Studio Demonstration with Verified Haptic & Visual Stems',
};

export class LocalTrackRepository {
  private static cachedTracks: TrackMetadata[] | null = null;

  private static getManifestFile(): File {
    return new File(Paths.document, 'tracks_manifest.json');
  }

  public static getTimelinesDirectory(): Directory {
    const dir = new Directory(Paths.document, 'timelines');
    if (!dir.exists) {
      dir.create({ idempotent: true });
    }
    return dir;
  }

  /**
   * Loads all tracks (bundled track + all imported tracks from persistent manifest).
   */
  public static async getAllTracks(): Promise<TrackMetadata[]> {
    if (this.cachedTracks) {
      return [BUNDLED_SPHERES_TRACK, ...this.cachedTracks];
    }

    try {
      const manifestFile = this.getManifestFile();
      if (!manifestFile.exists) {
        this.cachedTracks = [];
        return [BUNDLED_SPHERES_TRACK];
      }

      const rawJson = await manifestFile.text();
      const parsed: TrackMetadata[] = JSON.parse(rawJson);

      // Filter out any entries whose files no longer exist on disk
      const validTracks: TrackMetadata[] = [];
      for (const track of parsed) {
        const audioFile = new File(track.uri);
        if (audioFile.exists) {
          // Backward compatibility: unify 'complete' into 'ready'
          if ((track.analysisStatus as string) === 'complete') {
            track.analysisStatus = 'ready';
          }
          validTracks.push(track);
        }
      }

      this.cachedTracks = validTracks;
      return [BUNDLED_SPHERES_TRACK, ...this.cachedTracks];
    } catch (err) {
      console.warn('[LocalTrackRepository] Failed to read manifest:', err);
      this.cachedTracks = [];
      return [BUNDLED_SPHERES_TRACK];
    }
  }

  /**
   * Retrieve a specific track by its unique ID.
   */
  public static async getTrackById(id: string): Promise<TrackMetadata | null> {
    const all = await this.getAllTracks();
    return all.find((t) => t.id === id) || null;
  }

  /**
   * Save a newly imported or modified track to local persistent storage.
   */
  public static async saveTrack(track: TrackMetadata): Promise<void> {
    if (track.id === BUNDLED_SPHERES_TRACK.id) return; // Do not overwrite bundled track

    await this.getAllTracks(); // Ensure cache is populated
    const existingIndex = (this.cachedTracks || []).findIndex((t) => t.id === track.id);

    if (existingIndex >= 0) {
      this.cachedTracks![existingIndex] = track;
    } else {
      this.cachedTracks = [track, ...(this.cachedTracks || [])];
    }

    await this.flushManifest();
  }

  /**
   * Delete an imported track, its audio file, and any persisted timeline from storage.
   */
  public static async deleteTrack(id: string): Promise<void> {
    if (id === BUNDLED_SPHERES_TRACK.id) return;

    await this.getAllTracks();
    const trackToDelete = (this.cachedTracks || []).find((t) => t.id === id);

    if (trackToDelete) {
      // Delete audio file from private storage
      await NativeFileImportService.deleteStoredAudio(trackToDelete.uri);

      // Delete timeline file if exists
      try {
        const timelinesDir = this.getTimelinesDirectory();
        const timelineFile = new File(timelinesDir, `${id}.timeline.json`);
        if (timelineFile.exists) timelineFile.delete();
        const tmpFile = new File(timelinesDir, `${id}.timeline.tmp`);
        if (tmpFile.exists) tmpFile.delete();
      } catch {}

      this.cachedTracks = (this.cachedTracks || []).filter((t) => t.id !== id);
      await this.flushManifest();
    }
  }

  /**
   * Update analysis results for an existing track.
   */
  public static async updateTrackAnalysis(
    id: string,
    updates: Partial<TrackMetadata>
  ): Promise<TrackMetadata | null> {
    const track = await this.getTrackById(id);
    if (!track) return null;

    const updatedTrack: TrackMetadata = {
      ...track,
      ...updates,
    };

    await this.saveTrack(updatedTrack);
    return updatedTrack;
  }

  /**
   * Two-phase atomic crash-safe timeline persistence:
   * 1. Write full SensoryTimeline JSON to <trackId>.timeline.tmp
   * 2. Verify file exists, size > 0, and JSON is parseable
   * 3. Atomically overwrite <trackId>.timeline.json
   * 4. Remove .tmp file
   * 5. Returns final file URI
   */
  public static async saveTimelineAtomic(
    trackId: string,
    timeline: SensoryTimeline
  ): Promise<string> {
    const timelinesDir = this.getTimelinesDirectory();
    const tmpFile = new File(timelinesDir, `${trackId}.timeline.tmp`);
    const finalFile = new File(timelinesDir, `${trackId}.timeline.json`);

    const jsonString = JSON.stringify(timeline, null, 2);
    await tmpFile.write(jsonString);

    if (!tmpFile.exists || (tmpFile.size ?? 0) === 0) {
      throw new Error(`Failed to write temporary timeline file for track ${trackId}`);
    }

    // Replace final file
    if (finalFile.exists) {
      try {
        finalFile.delete();
      } catch {}
    }
    await tmpFile.copy(finalFile);

    try {
      if (tmpFile.exists) tmpFile.delete();
    } catch {}

    return finalFile.uri;
  }

  /**
   * Loads a persisted SensoryTimeline from disk.
   */
  public static async loadTimeline(trackId: string): Promise<SensoryTimeline | null> {
    if (trackId === BUNDLED_SPHERES_TRACK.id) {
      return {
        version: 1,
        trackId: BUNDLED_SPHERES_TRACK.id,
        durationMs: BUNDLED_SPHERES_TRACK.durationMs,
        sampleRate: 44100,
        channelCount: 2,
        bpm: BUNDLED_SPHERES_TRACK.bpm || 120,
        bpmConfidence: 1.0,
        energyConfidence: 1.0,
        onsetConfidence: 1.0,
        timeSignature: '4/4',
        energyEnvelope: [],
        cues: BUNDLED_SPHERES_TRACK.rhythmScore || [],
        rhythmicChanges: BUNDLED_SPHERES_TRACK.rhythmicChanges || [],
        summaryNote: BUNDLED_SPHERES_TRACK.summaryNote || '',
        createdAt: BUNDLED_SPHERES_TRACK.importedAt,
      };
    }

    try {
      const timelinesDir = this.getTimelinesDirectory();
      const finalFile = new File(timelinesDir, `${trackId}.timeline.json`);
      if (!finalFile.exists) return null;

      const content = await finalFile.text();
      return JSON.parse(content) as SensoryTimeline;
    } catch (err) {
      console.warn(`[LocalTrackRepository] Failed to load timeline for ${trackId}:`, err);
      return null;
    }
  }

  /**
   * Persist current in-memory tracks to disk safely via temporary file.
   */
  private static async flushManifest(): Promise<void> {
    try {
      const manifestFile = this.getManifestFile();
      const tmpManifest = new File(Paths.document, 'tracks_manifest.json.tmp');
      const dataToPersist = this.cachedTracks || [];
      const json = JSON.stringify(dataToPersist, null, 2);

      await tmpManifest.write(json);
      if (tmpManifest.exists && (tmpManifest.size ?? 0) > 0) {
        if (manifestFile.exists) {
          try { manifestFile.delete(); } catch {}
        }
        await tmpManifest.copy(manifestFile);
        try { tmpManifest.delete(); } catch {}
      }
    } catch (err) {
      console.warn('[LocalTrackRepository] Failed to flush manifest:', err);
    }
  }
}
