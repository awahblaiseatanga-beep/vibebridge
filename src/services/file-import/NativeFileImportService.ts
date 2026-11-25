/**
 * NativeFileImportService
 *
 * Implements native Android / iOS document picking via Android Storage Access Framework (SAF)
 * and persistence to VibeBridge's private document sandbox using modern Expo FileSystem (Paths, Directory, File).
 * Strictly uses native system document picker; avoids broad device storage permissions.
 *
 * Android Expo Go Note:
 * `copyToCacheDirectory: true` writes into Expo Go's host cache directory, which can fail
 * `expo-file-system`'s scoped `FilePermissionService` READ check (`Missing 'READ' permission`).
 * Using `copyToCacheDirectory: false` obtains the SAF `content://` URI with an active Activity
 * read grant and copies it immediately via ContentResolver / stream fallback into VibeBridge's
 * scoped persistent storage (`Paths.document/tracks/`).
 */

import * as DocumentPicker from 'expo-document-picker';
import { Paths, Directory, File } from 'expo-file-system';
import { ImportedAudioResult } from './index';

export const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac'];
export const MAX_FILE_SIZE_BYTES = 150 * 1024 * 1024; // 150 MB

export interface CleanedTrackTitle {
  title: string;
  artist: string;
}

const MIME_TO_EXTENSION: Record<string, string> = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/mp4': '.m4a',
  'audio/m4a': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/x-aac': '.aac',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/ogg': '.ogg',
  'application/ogg': '.ogg',
  'audio/flac': '.flac',
  'audio/x-flac': '.flac',
};

export function inferAudioExtension(filename: string, mimeType?: string | null): string {
  const extMatch = filename.match(/\.[0-9a-z]+$/i);
  if (extMatch) {
    return extMatch[0].toLowerCase();
  }
  if (mimeType) {
    const normalizedMime = mimeType.split(';')[0].trim().toLowerCase();
    if (MIME_TO_EXTENSION[normalizedMime]) {
      return MIME_TO_EXTENSION[normalizedMime];
    }
  }
  return '.mp3';
}

export function parseFilenameMetadata(filename: string): CleanedTrackTitle {
  // Strip extension
  let baseName = filename.replace(/\.[^/.]+$/, '');

  // Strip common bitrate / rip tags: e.g. (128k), [Official Audio], (320kbps), (Audio), etc.
  baseName = baseName
    .replace(/\s*[\(\[]\s*(\d+k|\d+kbps|official.*|audio|video|lyrics?)\s*[\)\]]/gi, '')
    .trim();

  // Replace underscores with spaces
  baseName = baseName.replace(/_+/g, ' ').trim();

  // Check for "Artist - Title" format
  if (baseName.includes(' - ')) {
    const parts = baseName.split(' - ');
    if (parts.length >= 2) {
      const artist = parts[0].trim();
      const title = parts.slice(1).join(' - ').trim();
      if (artist.length > 0 && title.length > 0) {
        return { artist, title };
      }
    }
  }

  return {
    title: baseName || 'Untitled Audio',
    artist: 'Imported Track',
  };
}

/**
 * Copies a picked document URI (`content://` SAF URI or `file://` URI) into VibeBridge's
 * private persistent destination file, using native File.copy first and ContentResolver/fetch
 * stream fallbacks for maximum compatibility across Android document providers and Expo Go.
 */
async function copyPickedUriToPrivateStorage(
  sourceUri: string,
  destinationFile: File
): Promise<void> {
  const sourceFile = new File(sourceUri);

  // 1. Primary: Native zero-copy / InputStream copy (supports external SAF content:// URIs)
  try {
    await sourceFile.copy(destinationFile);
    return;
  } catch (copyErr: any) {
    console.warn(
      '[NativeFileImportService] Primary File.copy failed, trying bytes/stream fallback:',
      copyErr?.message || copyErr
    );
  }

  // 2. Fallback A: Direct InputStream byte read via Expo FileSystem (bypasses isFile() quirks)
  try {
    const bytes = await sourceFile.bytes();
    if (bytes && bytes.length > 0) {
      destinationFile.write(bytes);
      return;
    }
  } catch (bytesErr: any) {
    console.warn(
      '[NativeFileImportService] File.bytes fallback failed, trying fetch fallback:',
      bytesErr?.message || bytesErr
    );
  }

  // 3. Fallback B: React Native ContentResolver fetch stream (reads content:// or file://)
  const response = await fetch(sourceUri);
  if (!response.ok && response.status !== 0) {
    throw new Error(`Unable to read selected audio document (status ${response.status}).`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const payload = new Uint8Array(arrayBuffer);
  if (payload.byteLength === 0) {
    throw new Error('Selected audio document appears empty (0 bytes).');
  }
  destinationFile.write(payload);
}

export class NativeFileImportService {
  /**
   * Launch native system document picker for audio files and persist to private storage.
   */
  public static async pickAudioFile(): Promise<ImportedAudioResult | null> {
    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: [
          'audio/mpeg',
          'audio/mp4',
          'audio/x-m4a',
          'audio/wav',
          'audio/x-wav',
          'audio/ogg',
          'audio/flac',
          'audio/aac',
          'audio/*',
        ],
        // Keep the SAF content:// URI directly so Expo Go doesn't place a file in unscoped host cache
        copyToCacheDirectory: false,
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return null;
      }

      const asset = pickerResult.assets[0];
      const filename = asset.name || 'imported_track.mp3';
      const ext = inferAudioExtension(filename, asset.mimeType);

      if (!SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) {
        throw new Error(
          `Unsupported audio format (${ext}). Supported formats: MP3, M4A, AAC, WAV, OGG, FLAC.`
        );
      }

      const reportedSizeBytes = asset.size ?? 0;
      if (reportedSizeBytes > MAX_FILE_SIZE_BYTES) {
        throw new Error(
          `Audio file exceeds maximum size limit of 150MB (${Math.round(reportedSizeBytes / 1024 / 1024)}MB).`
        );
      }

      // Ensure persistent sandboxed directory exists: Paths.document / tracks
      const tracksDir = new Directory(Paths.document, 'tracks');
      if (!tracksDir.exists) {
        tracksDir.create({ idempotent: true });
      }

      // Create unique filename in private storage
      const uniqueId = `track_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const targetFilename = `${uniqueId}${ext}`;
      const destinationFile = new File(tracksDir, targetFilename);

      // Copy immediately while the SAF URI read grant is active
      await copyPickedUriToPrivateStorage(asset.uri, destinationFile);

      // Verify persisted destination file is readable, non-empty, and within size limits
      const persistedSize = destinationFile.size ?? 0;
      if (!destinationFile.exists || persistedSize <= 0) {
        await this.deleteStoredAudio(destinationFile.uri);
        throw new Error('Imported audio file could not be saved or is empty (0 bytes).');
      }
      if (persistedSize > MAX_FILE_SIZE_BYTES) {
        await this.deleteStoredAudio(destinationFile.uri);
        throw new Error(
          `Audio file exceeds maximum size limit of 150MB (${Math.round(persistedSize / 1024 / 1024)}MB).`
        );
      }

      return {
        uri: destinationFile.uri,
        filename,
        fileSizeBytes: persistedSize > 0 ? persistedSize : reportedSizeBytes,
        mimeType: asset.mimeType || 'audio/mpeg',
      };
    } catch (error: any) {
      console.warn('[NativeFileImportService] Audio pick error:', error?.message || error);
      throw error;
    }
  }

  /**
   * Delete an audio file from persistent storage.
   */
  public static async deleteStoredAudio(uri: string): Promise<void> {
    try {
      const file = new File(uri);
      if (file.exists) {
        file.delete();
      }
    } catch (err) {
      console.warn('[NativeFileImportService] Failed to delete file:', uri, err);
    }
  }
}
