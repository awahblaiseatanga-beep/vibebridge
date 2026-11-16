/**
 * Service: Tracks
 *
 * Responsibilities:
 * - Managing track metadata (reading ID3 tags, duration, title, artist).
 * - Maintaining the local track index and query interface.
 * - Associating lyrics files (.lrc) and haptic tracks with audio files.
 *
 * Status: Interface defined.
 */

import { TrackMetadata } from '@/types';

export interface TrackService {
  getAllTracks(): Promise<TrackMetadata[]>;
  getTrackById(id: string): Promise<TrackMetadata | null>;
  saveTrack(track: TrackMetadata): Promise<void>;
  deleteTrack(id: string): Promise<void>;
}
