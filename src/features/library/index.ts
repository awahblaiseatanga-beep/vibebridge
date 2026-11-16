/**
 * Feature: Library
 *
 * Responsibilities:
 * - Local audio track indexing and browsing.
 * - Audio file import UI.
 * - Track detail inspection and sensory track metadata availability.
 *
 * Status: Foundation milestone (Implementation scheduled for Library Milestone).
 */

export interface LibraryFilterOptions {
  searchQuery?: string;
  onlyWithLyrics?: boolean;
  onlyWithHaptics?: boolean;
}
