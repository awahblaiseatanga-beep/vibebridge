/**
 * Custom React Hooks
 *
 * Responsibilities:
 * - Encapsulate sensory, playback, and screen dimensions logic into reusable hooks.
 * - Bridges React components with the underlying engines and state.
 *
 * Status: Foundation milestone.
 */

export interface UseSensoryPillarsReturn {
  readEnabled: boolean;
  seeEnabled: boolean;
  feelEnabled: boolean;
  toggleChannel: (channel: 'read' | 'see' | 'feel') => void;
}
