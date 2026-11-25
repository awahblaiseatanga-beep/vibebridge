/**
 * Service: File Import
 *
 * Responsibilities:
 * - Local audio file selection (e.g., via DocumentPicker / SAF).
 * - Validation of audio file formats (MP3, WAV, FLAC, M4A).
 * - Moving imported files to sandboxed application documents storage.
 *
 * Status: Interface defined.
 */

export interface ImportedAudioResult {
  uri: string;
  filename: string;
  fileSizeBytes: number;
  mimeType: string;
}

export interface FileImportService {
  pickAudioFile(): Promise<ImportedAudioResult | null>;
  validateFile(uri: string): Promise<boolean>;
}

export * from './NativeFileImportService';
