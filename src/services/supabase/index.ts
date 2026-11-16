/**
 * Service: Supabase (Optional Cloud Sync & Profiles)
 *
 * Responsibilities:
 * - Supabase Auth for optional user login.
 * - Supabase PostgreSQL for cloud sync of user preferences and custom haptic/lyric mappings.
 *
 * Status: Boundary reserved. Per architecture decisions, Supabase is deferred to later milestones.
 */

export interface SupabaseConfig {
  url?: string;
  anonKey?: string;
}

export const isSupabaseConfigured = (): boolean => {
  return false;
};
