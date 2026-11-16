/**
 * Format milliseconds into human-readable playback timestamps (e.g. 03:45)
 */
export function formatMilliseconds(ms: number): string {
  if (isNaN(ms) || ms < 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  return `${paddedMinutes}:${paddedSeconds}`;
}
